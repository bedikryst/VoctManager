"""
Handles compilation of binary (PDF) and text (CSV/TXT) artifacts.
@architecture Enterprise SaaS 2026

Strictly isolated from core business logic. Acts as an infrastructure adapter
for the rendering engine (WeasyPrint / Django Templates). This design enables
effortless migration to microservices (for example AWS Lambda PDF rendering) in
the future.

The concert-day sheet is audience-shaped: the same production data is rendered
into three documents with different priorities and privacy rules — a personal
sheet for a single singer (``Audience.CHORISTER``), a music-forward sheet for
the maestro (``Audience.CONDUCTOR``), and the full production call sheet for
management (``Audience.PRODUCTION``). Typography is pinned to the bundled
Gentium Plus face (see ``print_fonts``) so the PDF renders identically on the
Windows dev host and the Linux runtime image.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterator
from enum import StrEnum
from typing import Any
from urllib.parse import quote_plus, urljoin

from django.conf import settings
from django.db.models import QuerySet
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.safestring import mark_safe

from core.constants import VoiceLine
from roster.domain.call_window import (
    CallWindow,
    CallWindowProblem,
    localize,
    resolve_call_window,
)
from roster.infrastructure.print_fonts import (
    BOOK_FONT_STACK,
    BRAND_SANS_STACK,
    BRAND_SERIF_STACK,
    brand_font_face_css,
    font_face_css,
)
from roster.models import (
    DEFAULT_EVENT_TIMEZONE,
    Artist,
    CrewAssignment,
    Participation,
    ProgramItem,
    Project,
    ProjectPieceCasting,
    Rehearsal,
    VoiceType,
)

_VOICE_LINE_ORDER = {value: idx for idx, value in enumerate(VoiceLine.values)}
# Language codes carried by `Piece.language` are free text ('la', 'la-pl'), so
# this only softens what it recognises — an unknown token passes through
# untouched rather than being guessed at.
_LANGUAGE_NAMES: dict[str, str] = {
    'la': 'łacina',
    'pl': 'polski',
    'en': 'angielski',
    'fr': 'francuski',
    'de': 'niemiecki',
    'it': 'włoski',
    'es': 'hiszpański',
    'ru': 'rosyjski',
    'uk': 'ukraiński',
    'cs': 'czeski',
    'sk': 'słowacki',
    'lt': 'litewski',
    'he': 'hebrajski',
    'el': 'grecki',
    'hu': 'węgierski',
}
# Reference links are a hyperlink strip on a printed page, not a discography.
_MAX_REFERENCE_LINKS = 2
# Printed on a Polish sheet for a Polish ensemble, the country is the one part
# of an address that never tells the reader anything.
_IMPLIED_COUNTRIES = frozenset({'poland', 'polska'})
# Keyed by VoiceType (a str-valued TextChoices), so the keys double as plain strings
# for ordering lookups by the serialized voice-type value.
_VOICE_TYPE_ORDER: dict[str, int] = {
    VoiceType.SOPRANO: 0,
    VoiceType.MEZZO: 1,
    VoiceType.ALTO: 2,
    VoiceType.COUNTERTENOR: 3,
    VoiceType.TENOR: 4,
    VoiceType.BARITONE: 5,
    VoiceType.BASS: 6,
    VoiceType.CONDUCTOR: 7,
}


class Audience(StrEnum):
    """Who the concert-day sheet is compiled for. Drives section order,
    personalization and — critically — which contact PII is exposed."""

    CHORISTER = "chorister"
    CONDUCTOR = "conductor"
    PRODUCTION = "production"


class DocumentKind(StrEnum):
    """What the sheet is *for*, which is independent of who reads it.

    The day card is executed: read standing up, minutes before the downbeat, by
    someone who needs the next few hours and can act on nothing else. The report
    is inspected: read at a desk, weeks out, by someone whose whole job is to
    find what is not ready. Fusing them produced a document that made the singer
    wade through coverage counters to find an arrival time and gave the manager
    no blocker list — so the two are one axis, and the endpoint picks it.
    """

    DAY_CARD = "day_card"
    PRODUCTION_REPORT = "report"


# Ordered section pipeline per document kind and audience. The template renders
# exactly these sections, in this order (the hero, the blocker list and the
# coverage band are rendered first, outside the loop — a band with no heading
# must not consume a section number). Keep the keys in sync with the
# ``{% if section == %}`` chain in ``projects/call_sheet_pdf.html``, and note
# that ``_visible_sections`` drops any entry whose data is absent so the printed
# numbering never skips.
_SECTIONS: dict[DocumentKind, dict[Audience, tuple[str, ...]]] = {
    DocumentKind.DAY_CARD: {
        # Singer first: what concerns *them* today, then the day, then the music,
        # and last the two things a lost or late singer needs — who else is there
        # and whom to reach.
        Audience.CHORISTER: (
            "personal",
            "event",
            "runsheet",
            "rehearsals",
            "program",
            "ensemble",
            "contacts",
        ),
        # Maestro first: the musical arc and who gives pitch, then the day.
        Audience.CONDUCTOR: (
            "program",
            "casting",
            "ensemble",
            "runsheet",
            "rehearsals",
            "event",
            "contacts",
        ),
        # Stage manager: the day as it will be run, and everyone who runs it.
        # No casting — micro-casting is the maestro's instrument, not the desk's.
        Audience.PRODUCTION: (
            "event",
            "runsheet",
            "rehearsals",
            "program",
            "ensemble",
            "contacts",
        ),
    },
    DocumentKind.PRODUCTION_REPORT: {
        # Management: the full preparation picture. The blocker list and the
        # coverage band open the document ahead of every numbered section.
        Audience.PRODUCTION: (
            "event",
            "runsheet",
            "rehearsals",
            "program",
            "casting",
            "ensemble",
            "contacts",
        ),
        # The maestro may want the state of preparation before a rehearsal
        # block; same document, music first.
        Audience.CONDUCTOR: (
            "program",
            "casting",
            "ensemble",
            "rehearsals",
            "runsheet",
            "event",
            "contacts",
        ),
    },
}


def resolve_document_kind(kind: DocumentKind, audience: Audience) -> DocumentKind:
    """The kind actually compiled for this audience.

    A singer is never handed a production report — it carries the invitation
    queue, declined counts and the crew's private numbers — so that pair
    degrades to the day card. Normalised here, once, rather than per section:
    the kind gates content in a dozen places, and a fallback that fixed only the
    section list would leave every one of them still in report mode.
    """
    if audience not in _SECTIONS[kind]:
        return DocumentKind.DAY_CARD
    return kind


def _count_label(count: int, one: str, few: str, many: str) -> str:
    """Polish noun after a numeral: 1 takes the singular, 2-4 the "few" form,
    everything else the genitive plural — with the 12-14 exception, which looks
    like a "few" ending but is not."""
    tens = count % 100
    units = count % 10
    if count == 1:
        return one
    if 2 <= units <= 4 and not 12 <= tens <= 14:
        return few
    return many


def _ensemble_name() -> str:
    """Resident-ensemble name for the document chrome, from settings (rebrandable)."""
    return getattr(settings, "SCORE_BOOK_ENSEMBLE_NAME", "VoctEnsemble")


def _doc_lang() -> str:
    """Document language for print hyphenation, from settings."""
    return getattr(settings, "SCORE_BOOK_LANG", "pl")


def _brand_font_context() -> dict[str, str]:
    """Bundled brand typography for outward-facing templates. Every contract
    template variable that names a face resolves here, so no template can drift
    back to a CDN import or to a face the host may not have.

    Marked safe at the source, not at each `{{ }}`: a font stack carries the
    quotes around multi-word family names, and autoescaping them to `&quot;`
    yields a declaration the renderer drops — silently, since an unparsable
    `font-family` is not an error, just a fall back to the default serif. These
    are our own constants, never user input."""
    return {
        "font_css": mark_safe(brand_font_face_css()),
        "font_sans": mark_safe(BRAND_SANS_STACK),
        "font_serif": mark_safe(BRAND_SERIF_STACK),
    }


class DocumentRenderDependencyError(RuntimeError):
    """Raised when the PDF rendering engine is installed without native runtime libraries."""


def _render_pdf(html_string: str, base_url: str | None = None) -> bytes:
    try:
        from weasyprint import HTML
    except (ImportError, OSError) as exc:
        raise DocumentRenderDependencyError(
            "WeasyPrint cannot load its native rendering dependencies. "
            "Install Pango, Cairo, GDK-PixBuf, and Fontconfig for the host operating system."
        ) from exc

    return HTML(string=html_string, base_url=base_url).write_pdf()


class DocumentGenerator:
    """Static utility class for compiling domain entities into exportable artifacts."""

    @staticmethod
    def generate_call_sheet_pdf(
        project: Project,
        participations: QuerySet[Participation],
        crew: QuerySet[CrewAssignment],
        program: QuerySet[ProgramItem],
        rehearsals: QuerySet[Rehearsal],
        castings: QuerySet[ProjectPieceCasting],
        audience: Audience = Audience.PRODUCTION,
        recipient: Participation | None = None,
        base_url: str | None = None,
        kind: DocumentKind = DocumentKind.PRODUCTION_REPORT,
    ) -> bytes:
        """Compiles the concert-day sheet PDF for the given kind and audience.

        ``recipient`` personalizes the ``CHORISTER`` sheet (their voice, their
        casting, their pitch duties). It is ignored for the other audiences.
        """
        context = DocumentGenerator._build_call_sheet_context(
            project=project,
            participations=participations,
            crew=crew,
            program=program,
            rehearsals=rehearsals,
            castings=castings,
            audience=audience,
            recipient=recipient,
            base_url=base_url,
            kind=kind,
        )
        html_string = render_to_string('projects/call_sheet_pdf.html', context)
        return _render_pdf(html_string, base_url=base_url)

    @staticmethod
    def generate_participation_contract_pdf(participation: Participation) -> bytes:
        """Compiles a dynamic legal PDF artifact for artist participation."""
        artist = participation.artist
        project = participation.project

        context = {
            'artist_name': f"{artist.first_name} {artist.last_name}",
            'voice_type': artist.get_voice_type_display(),
            'project_title': project.title,
            'project_date': project.date_time,
            'project_location': project.location or 'Miejsce do ustalenia',
            'fee': participation.fee or 0,
            'generation_date': timezone.now(),
            **_brand_font_context(),
        }

        html_string = render_to_string('contracts/contract_pdf.html', context)
        return _render_pdf(html_string)

    @staticmethod
    def generate_crew_contract_pdf(assignment: CrewAssignment) -> bytes:
        """Compiles a dynamic legal PDF artifact for crew members."""
        collaborator = assignment.collaborator
        project = assignment.project

        context = {
            'artist_name': f"{collaborator.first_name} {collaborator.last_name}",
            'role_description': assignment.role_description or collaborator.get_specialty_display(),
            'project_title': project.title,
            'project_date': project.date_time,
            'project_location': project.location or 'Miejsce do ustalenia',
            'fee': assignment.fee or 0,
            'generation_date': timezone.now(),
            **_brand_font_context(),
        }

        html_string = render_to_string('contracts/contract_pdf.html', context)
        return _render_pdf(html_string)

    @staticmethod
    def generate_zaiks_csv_iterator(program_items: QuerySet[ProgramItem]) -> Iterator[str]:
        """Generates a streaming CSV payload for ZAiKS copyright reporting."""
        yield 'Lp.;Tytuł Utworu;Kompozytor;Aranżer;Czas trwania;Uwagi (BIS)\n'

        for idx, item in enumerate(program_items, 1):
            title = item.piece.title if item.piece else 'Nieznany tytuł'

            composer_name = 'Nieznany'
            if item.piece and hasattr(item.piece, 'composer') and item.piece.composer:
                if hasattr(item.piece.composer, 'last_name'):
                    composer_name = f"{getattr(item.piece.composer, 'first_name', '')} {item.piece.composer.last_name}".strip()
                else:
                    composer_name = str(item.piece.composer)

            arranger_name = getattr(item.piece, 'arranger', '-') if item.piece else '-'
            encore = 'BIS' if item.is_encore else ''

            yield f'{idx};{title};{composer_name};{arranger_name};;{encore}\n'

    @staticmethod
    def generate_dtp_export_text(project: Project, participations: QuerySet[Participation]) -> str:
        """Generates a cleanly formatted text artifact tailored for Graphic Design (DTP)."""
        groups: dict[str, list[Artist]] = {'Soprany': [], 'Alty': [], 'Tenory': [], 'Basy': [], 'Inne': []}

        for p in participations:
            vt = p.artist.voice_type or ''
            if vt.startswith('S'):
                groups['Soprany'].append(p.artist)
            elif vt.startswith('A') or vt == 'MEZ':
                groups['Alty'].append(p.artist)
            elif vt.startswith('T') or vt == 'CT':
                groups['Tenory'].append(p.artist)
            elif vt.startswith('B'):
                groups['Basy'].append(p.artist)
            else:
                groups['Inne'].append(p.artist)

        context = {
            'project': project,
            'groups': groups,
            'generation_date': timezone.now()
        }

        return render_to_string('projects/dtp_export.txt', context)

    @staticmethod
    def _build_call_sheet_context(
        project: Project,
        participations: QuerySet[Participation],
        crew: QuerySet[CrewAssignment],
        program: QuerySet[ProgramItem],
        rehearsals: QuerySet[Rehearsal],
        castings: QuerySet[ProjectPieceCasting],
        audience: Audience,
        recipient: Participation | None,
        base_url: str | None,
        kind: DocumentKind = DocumentKind.PRODUCTION_REPORT,
    ) -> dict[str, Any]:
        participation_list = list(participations)
        crew_list = list(crew)
        program_items = list(program)
        rehearsal_list = list(rehearsals)
        casting_list = list(castings)

        kind = resolve_document_kind(kind, audience)
        # Everything a day card must never carry — coverage counters, the
        # invitation queue, past rehearsals, "to be filled in" copy — hangs off
        # this one flag rather than off the audience, which answers a different
        # question (whose privacy, whose priorities).
        is_report = kind == DocumentKind.PRODUCTION_REPORT
        is_chorister = audience == Audience.CHORISTER
        # The chorister sheet is personalized only when we actually know who the
        # recipient is; without it we degrade gracefully to a non-personal sheet.
        personal = (
            DocumentGenerator._build_personal_block(
                recipient, program_items, casting_list, participation_list
            )
            if is_chorister and recipient is not None
            else None
        )

        project_timezone = project.timezone or (
            project.location.timezone if project.location else 'UTC'
        )
        call_window = resolve_call_window(
            project.call_time, project.date_time, project_timezone
        )
        event_datetime_local = call_window.event_local
        call_time_local = call_window.call_local
        piece_castings_map = DocumentGenerator._map_castings_by_piece(casting_list)

        # The podium is `Project.conductor`, never a member of the cast: a
        # conductor who also holds a Participation must not be counted as a
        # singer awaiting confirmation, nor listed among the voice sections.
        cast_participations = [
            participation
            for participation in participation_list
            if participation.artist.voice_type != VoiceType.CONDUCTOR
        ]
        confirmed_participations = [
            participation
            for participation in cast_participations
            if participation.status == Participation.Status.CONFIRMED
        ]
        pending_participations = [
            participation
            for participation in cast_participations
            if participation.status == Participation.Status.INVITED
        ]
        declined_count = sum(
            1
            for participation in cast_participations
            if participation.status == Participation.Status.DECLINED
        )
        confirmed_crew_count = sum(
            1
            for assignment in crew_list
            if assignment.status == CrewAssignment.Status.CONFIRMED
        )
        tentative_crew_count = max(len(crew_list) - confirmed_crew_count, 0)

        # Program cards, optionally annotated with the recipient's own line.
        recipient_line_by_piece = (
            {c.piece_id: c for c in casting_list if c.participation_id == recipient.id}
            if recipient is not None
            else {}
        )
        program_cards = [
            DocumentGenerator._build_program_card(
                item,
                piece_castings_map.get(item.piece_id, []),
                recipient_line_by_piece.get(item.piece_id),
                base_url,
                is_report,
            )
            for item in program_items
        ]
        total_program_duration_seconds = sum(
            item.piece.estimated_duration or 0 for item in program_items
        )
        pieces_with_sheet_music = sum(1 for card in program_cards if card['sheet_music_url'])
        pieces_with_tracks = sum(1 for card in program_cards if card['track_count'] > 0)
        pieces_with_reference = sum(1 for card in program_cards if card['reference_links'])
        pieces_with_casting = sum(1 for card in program_cards if card['casting_count'] > 0)

        venue = project.location
        venue_map_url = DocumentGenerator._build_map_url(venue)
        # Date, call, downbeat and venue name are already the masthead's four
        # facts; restating them here filled half this card with an echo. It now
        # carries only what the masthead cannot fit.
        event_facts = []
        if venue and venue.category:
            event_facts.append(
                {'label': 'Typ lokalizacji', 'text': venue.get_category_display()}
            )
        event_facts.append(
            {
                'label': 'Adres',
                'text': DocumentGenerator._format_address(
                    venue.formatted_address if venue else ''
                ),
            }
        )
        # A timezone is worth a line only when it is not the one the reader
        # assumes; the IANA identifier itself is machine vocabulary either way.
        if project_timezone != DEFAULT_EVENT_TIMEZONE:
            event_facts.append(
                {
                    'label': 'Strefa czasowa',
                    'text': DocumentGenerator._format_timezone(
                        project_timezone, event_datetime_local
                    ),
                }
            )
        if project.conductor:
            event_facts.append({'label': 'Prowadzenie', 'text': str(project.conductor)})

        # Preparation-readiness meters are a management concern; the day card
        # gets a short "what to open" list, the report the coverage picture.
        preparation_assets = DocumentGenerator._build_preparation_assets(
            project, program_cards, base_url, is_report,
            pieces_with_sheet_music, pieces_with_tracks,
            pieces_with_reference, pieces_with_casting,
        )

        dress_code_entries = []
        if project.dress_code_female:
            dress_code_entries.append({'label': 'Kobiety', 'value': project.dress_code_female})
        if project.dress_code_male:
            dress_code_entries.append({'label': 'Mężczyźni', 'value': project.dress_code_male})
        if not dress_code_entries:
            dress_code_entries.append({'label': 'Dress code', 'value': 'Do potwierdzenia przez management.'})

        # Contacts carry personal phone/email — never handed to the whole choir.
        contact_directory = DocumentGenerator._build_contact_directory(
            project, crew_list, audience
        )

        now = timezone.now()
        rehearsal_items = [
            DocumentGenerator._build_rehearsal_item(rehearsal, project, recipient, now)
            for rehearsal in rehearsal_list
        ]
        # A singer only sees rehearsals that concern them (whole-ensemble calls
        # plus any they were personally invited to).
        if is_chorister:
            rehearsal_items = [item for item in rehearsal_items if item['is_for_me']]
        # The people performing the concert are handed a document about the day
        # ahead; a rehearsal that already happened is a record, and belongs to
        # the report. The count survives so nothing reads as missing.
        rehearsals_done = sum(1 for item in rehearsal_items if item['is_past'])
        if not is_report:
            rehearsal_items = [item for item in rehearsal_items if not item['is_past']]
        all_rehearsals_mandatory = bool(rehearsal_items) and all(
            item['is_mandatory'] for item in rehearsal_items
        )

        run_sheet_items = DocumentGenerator._normalize_run_sheet(project.run_sheet)

        greeting = None
        if recipient is not None:
            artist = recipient.artist
            greeting = artist.first_name_vocative.strip() or artist.first_name
        elif audience == Audience.CONDUCTOR and project.conductor:
            greeting = (
                project.conductor.first_name_vocative.strip()
                or project.conductor.first_name
            )

        return {
            'project': project,
            'audience': audience.value,
            'kind': kind.value,
            'sections': DocumentGenerator._visible_sections(kind, audience, personal),
            'is_chorister': is_chorister,
            'is_conductor': audience == Audience.CONDUCTOR,
            'is_production': audience == Audience.PRODUCTION,
            'is_report': is_report,
            'ensemble_name': _ensemble_name(),
            'doc_lang': _doc_lang(),
            'font_css': font_face_css(),
            'font_stack': BOOK_FONT_STACK,
            'greeting': greeting,
            'personal': personal,
            'generation_date': now,
            # A concert-day sheet gets reprinted as the plan changes; an "as of"
            # stamp on the page (not just the file metadata) is what stops people
            # working off a stale copy. Localised to the project timezone so it
            # reads in the same clock as the rest of the sheet.
            'generation_label': DocumentGenerator._format_datetime(
                localize(now, project_timezone)
            ),
            'event_datetime_local': event_datetime_local,
            'call_time_local': call_time_local,
            'event_date_label': DocumentGenerator._format_date(event_datetime_local),
            'event_time_label': DocumentGenerator._format_time(event_datetime_local),
            # A call time on another calendar day prints WITH that day: an hour
            # on its own reads as concert-day, and a singer acting on it arrives
            # on the wrong date.
            'call_time_label': DocumentGenerator._format_call_time(call_window),
            'call_crosses_day': call_window.crosses_day,
            'call_buffer_label': DocumentGenerator._format_call_buffer(call_window),
            # Stated only where someone can act on it: management and the
            # maestro get told the window is broken, the singer is simply not
            # shown a derived figure that would be wrong.
            'call_window_warning': (
                DocumentGenerator._call_window_warning(call_window)
                if audience != Audience.CHORISTER
                else ''
            ),
            'event_facts': event_facts,
            'venue_map_url': venue_map_url,
            'project_score_url': (
                DocumentGenerator._absolute_url(base_url, f'/api/projects/{project.pk}/score_pdf/')
                if project.score_pdf
                else ''
            ),
            'dress_code_entries': dress_code_entries,
            'preparation_assets': preparation_assets,
            'run_sheet_items': run_sheet_items,
            'rehearsal_items': rehearsal_items,
            'rehearsals_done': rehearsals_done,
            'all_rehearsals_mandatory': all_rehearsals_mandatory,
            'program_cards': program_cards,
            'casting_sections': [
                DocumentGenerator._build_casting_section(item, piece_castings_map.get(item.piece_id, []))
                for item in program_items
            ],
            'contact_directory': contact_directory,
            # Two roster rows carrying one name are annotated only where someone
            # can go and merge them. On a day card the marker is noise about the
            # database, printed to a reader who cannot act on it — and if the two
            # really are different people, the plain repetition is the truth.
            'ensemble_sections': DocumentGenerator._group_participations_by_voice(
                confirmed_participations, annotate_repeats=is_report
            ),
            # Who has not answered yet is the invitation queue: a report fact.
            'pending_sections': (
                DocumentGenerator._group_participations_by_voice(
                    pending_participations, annotate_repeats=True
                )
                if is_report
                else []
            ),
            'blockers': (
                DocumentGenerator._build_blockers(
                    project=project,
                    call_window=call_window,
                    program_cards=program_cards,
                    pending_participations=pending_participations,
                    confirmed_participations=confirmed_participations,
                    crew_list=crew_list,
                    venue=venue,
                    run_sheet_items=run_sheet_items,
                )
                if is_report
                else []
            ),
            'metrics': {
                'cast_confirmed': len(confirmed_participations),
                'cast_pending': len(pending_participations),
                'cast_declined': declined_count,
                'crew_confirmed': confirmed_crew_count,
                'crew_tentative': tentative_crew_count,
                'pieces_total': len(program_cards),
                'rehearsals_total': len(rehearsal_list),
                'program_total_duration': DocumentGenerator._format_duration(
                    total_program_duration_seconds
                ),
            },
        }

    @staticmethod
    def _build_personal_block(
        recipient: Participation,
        program_items: list[ProgramItem],
        casting_list: list[ProjectPieceCasting],
        participation_list: list[Participation],
    ) -> dict[str, Any]:
        """The heart of the singer sheet: their voice, their pieces, their pitch
        duties, and their section-mates for the day."""
        artist = recipient.artist
        order_by_piece = {item.piece_id: item.order for item in program_items}
        title_by_piece = {item.piece_id: item.piece.title for item in program_items}

        assignments = [
            {
                'order': order_by_piece.get(casting.piece_id),
                'title': title_by_piece.get(casting.piece_id, 'Pozycja programu'),
                'voice_line': casting.get_voice_line_display(),
                'gives_pitch': casting.gives_pitch,
                'notes': casting.notes.strip() if casting.notes else '',
            }
            for casting in casting_list
            if casting.participation_id == recipient.id
        ]
        assignments.sort(key=lambda entry: (entry['order'] is None, entry['order'] or 0))

        section_mates = sorted(
            f'{p.artist.first_name} {p.artist.last_name}'
            for p in participation_list
            if p.id != recipient.id
            and p.status == Participation.Status.CONFIRMED
            and p.artist.voice_type == artist.voice_type
        )
        section_size = len(section_mates) + 1

        return {
            'full_name': f'{artist.first_name} {artist.last_name}',
            'voice_label': artist.get_voice_type_display(),
            'status_label': recipient.get_status_display(),
            'is_confirmed': recipient.status == Participation.Status.CONFIRMED,
            'assignments': assignments,
            'gives_pitch_anywhere': any(entry['gives_pitch'] for entry in assignments),
            'section_mates': section_mates,
            'section_size': section_size,
            'section_size_label': _count_label(section_size, 'osoba', 'osoby', 'osób'),
        }

    @staticmethod
    def _build_preparation_assets(
        project: Project,
        program_cards: list[dict[str, Any]],
        base_url: str | None,
        is_report: bool,
        pieces_with_sheet_music: int,
        pieces_with_tracks: int,
        pieces_with_reference: int,
        pieces_with_casting: int,
    ) -> list[dict[str, Any]]:
        total = len(program_cards)
        # The day card gets the two things people actually open before a
        # concert; the coverage counters ("12/14 pieces have tracks") are a
        # manager's metric.
        #
        # A resource that does not exist is not listed on a performer's sheet:
        # printing "Playlista referencyjna — Brak" tells the one reader who can
        # do nothing about it that something is missing. Absent materials are a
        # management fact, and they stay in the coverage rows below.
        singer_assets = []
        if project.score_pdf:
            singer_assets.append(
                {
                    'label': 'Pełny score projektu',
                    'status': 'Gotowe',
                    'url': DocumentGenerator._absolute_url(
                        base_url, f'/api/projects/{project.pk}/score_pdf/'
                    ),
                    'note': 'Kompletny pakiet nut na dziś. Otwórz w aplikacji lub wydrukuj.',
                }
            )
        if project.spotify_playlist_url:
            singer_assets.append(
                {
                    'label': 'Playlista referencyjna',
                    'status': 'Gotowe',
                    'url': project.spotify_playlist_url,
                    'note': 'Brzmienie i kolejność programu do ostatniego odsłuchu.',
                }
            )
        if not is_report:
            return singer_assets

        return [
            {
                'label': 'Pełny score projektu',
                'status': 'Gotowe' if project.score_pdf else 'Brak',
                'url': (
                    DocumentGenerator._absolute_url(base_url, f'/api/projects/{project.pk}/score_pdf/')
                    if project.score_pdf
                    else ''
                ),
                'note': 'Kompletny pakiet nut na dziś. Otwórz w aplikacji lub wydrukuj.',
            },
            {
                'label': 'Playlista referencyjna',
                'status': 'Gotowe' if project.spotify_playlist_url else 'Brak',
                'url': project.spotify_playlist_url,
                'note': 'Brzmienie i kolejność programu do ostatniego odsłuchu.',
            },
            {
                'label': 'Nuty per utwór',
                'status': f'{pieces_with_sheet_music}/{total}' if total else '0/0',
                'note': 'Liczba pozycji z dedykowanym PDF partytury lub materiału.',
            },
            {
                'label': 'Tracki sekcyjne',
                'status': f'{pieces_with_tracks}/{total}' if total else '0/0',
                'note': 'Pozycje z przygotowanymi trackami do samodzielnego utrwalenia.',
            },
            {
                'label': 'Nagrania referencyjne',
                'status': f'{pieces_with_reference}/{total}' if total else '0/0',
                'note': 'Utwory z linkiem do YouTube lub Spotify.',
            },
            {
                'label': 'Casting rozpisany',
                'status': f'{pieces_with_casting}/{total}' if total else '0/0',
                'note': 'Pozycje z gotowym micro-castingiem i odpowiedzialnościami.',
            },
        ]

    @staticmethod
    def _build_contact_directory(
        project: Project,
        crew_list: list[CrewAssignment],
        audience: Audience,
    ) -> list[dict[str, Any]]:
        # RODO: the whole ensemble must never receive everyone's phone/email.
        # The singer sheet names who leads (no private numbers); the conductor
        # and management sheets carry the full operational directory.
        if audience == Audience.CHORISTER:
            if not project.conductor:
                return []
            return [
                {
                    'name': f'{project.conductor.first_name} {project.conductor.last_name}',
                    'role': 'Prowadzenie',
                    'organization': '',
                    'status': 'Za pytania i spóźnienia pisz w aplikacji.',
                    'phone': '',
                    'email': '',
                }
            ]

        directory: list[dict[str, Any]] = []
        if project.conductor:
            directory.append(
                {
                    'name': f'{project.conductor.first_name} {project.conductor.last_name}',
                    'role': 'Dyrygent',
                    'organization': '',
                    'status': 'Kontakt główny',
                    'phone': project.conductor.phone_number,
                    'email': project.conductor.email,
                }
            )
        for assignment in crew_list:
            directory.append(
                {
                    'name': f'{assignment.collaborator.first_name} {assignment.collaborator.last_name}',
                    'role': (
                        assignment.role_description
                        or assignment.collaborator.get_specialty_display()
                    ),
                    'organization': assignment.collaborator.company_name,
                    'status': assignment.get_status_display(),
                    'phone': assignment.collaborator.phone_number,
                    'email': assignment.collaborator.email or '',
                }
            )
        return directory

    @staticmethod
    def _build_program_card(
        item: ProgramItem,
        piece_castings: list[ProjectPieceCasting],
        recipient_casting: ProjectPieceCasting | None,
        base_url: str | None,
        is_report: bool = True,
    ) -> dict[str, Any]:
        piece = item.piece
        # `to_attr` always sets the attribute, so an EMPTY prefetch is a valid
        # answer — testing it for truthiness sends every materialless piece back
        # to the database for a result already known to be nothing.
        prefetched_editions = getattr(piece, 'prefetched_editions', None)
        prefetched_recordings = getattr(piece, 'prefetched_recordings', None)
        editions = list(
            piece.editions.all() if prefetched_editions is None else prefetched_editions
        )
        recordings = list(
            piece.recordings.all() if prefetched_recordings is None else prefetched_recordings
        )
        # Voice lines are stored as codes ('S1', 'A1', 'T1', 'B1'), so ordering
        # them in the database sorts alphabetically — Alt before Bas before
        # Sopran. Musical order is the only order a musician reads.
        tracks = sorted(
            getattr(piece, 'prefetched_tracks', []),
            key=lambda track: _VOICE_LINE_ORDER.get(track.voice_part, 999),
        )
        voice_requirements = sorted(
            getattr(piece, 'prefetched_voice_requirements', []),
            key=lambda requirement: _VOICE_LINE_ORDER.get(requirement.voice_line, 999),
        )

        # Default edition first; otherwise the most-recent edition with a PDF.
        editions_sorted = sorted(
            (e for e in editions if e.pdf_file),
            key=lambda e: (0 if e.is_default else 1, -(e.created_at.timestamp() if e.created_at else 0)),
        )
        primary_edition = editions_sorted[0] if editions_sorted else None
        # The per-piece "Nuty PDF" link points at the access-gated edition download
        # view (watermarked + logged per recipient), never the raw /media file —
        # nginx serves /media/score_editions/ `internal;` only, so a direct file
        # hyperlink 404s and would bypass score protection.
        sheet_music_url = (
            DocumentGenerator._absolute_url(base_url, f'/api/materials/scores/{primary_edition.pk}/download/')
            if primary_edition and primary_edition.pdf_file
            else ''
        )

        # Reference links — featured recordings first, then platform-grouped.
        # The label names the PERFORMER, because the platform does not
        # distinguish anything: five Spotify recordings of one piece used to
        # print as five identical "Spotify" buttons. A printed page carries a
        # couple of links, not a discography.
        reference_links: list[dict[str, str]] = []
        seen_labels: set[str] = set()
        for rec in sorted(recordings, key=lambda r: (0 if r.is_featured else 1, r.get_source_display())):
            if not rec.url:
                continue
            label = rec.performer.strip() or rec.get_source_display()
            if rec.year:
                label = f'{label} ({rec.year})'
            if label in seen_labels:
                continue
            seen_labels.add(label)
            reference_links.append({'label': label, 'url': rec.url})
            if len(reference_links) >= _MAX_REFERENCE_LINKS:
                break

        # Coverage flags only for what has no affordance of its own. "BIS" is
        # already a pill beside the title, and sheet music and recordings are
        # links right below — a badge repeating either is the same fact printed
        # twice, five points apart. On a day card they are absent entirely:
        # a flag saying tracks exist is a coverage counter, and nothing on paper
        # can be done with it.
        material_badges = []
        if is_report:
            if tracks:
                material_badges.append('Tracki')
            if piece_castings:
                material_badges.append('Casting')

        voice_requirements_summary = ', '.join(
            f'{requirement.quantity}x {requirement.get_voice_line_display()}'
            for requirement in voice_requirements
        )
        track_labels = [track.get_voice_part_display() for track in tracks]
        # Assembled here, not chained in the template: each `{% if %}` carried
        # its own " · " prefix, so a piece with no duration opened on a bullet.
        #
        # The requirement matrix ("4x Sopran 1, 4x Alt 1, …") answers how many
        # singers the piece needs per line — a planning question. On the day the
        # answer is the casting section (who is actually on it), and the singer's
        # own line is called out beneath the title, so the matrix is report-only.
        meta_line = ' · '.join(
            part
            for part in (
                DocumentGenerator._format_duration(piece.estimated_duration),
                DocumentGenerator._format_language(piece.language),
                piece.voicing,
                voice_requirements_summary if is_report else '',
            )
            if part
        )

        # "You sing this" annotation for the personalized singer sheet.
        you = None
        if recipient_casting is not None:
            you = {
                'voice_line': recipient_casting.get_voice_line_display(),
                'gives_pitch': recipient_casting.gives_pitch,
                'notes': recipient_casting.notes.strip() if recipient_casting.notes else '',
            }

        return {
            'piece_id': item.piece_id,
            'order': item.order,
            'is_encore': item.is_encore,
            'title': piece.title,
            'composer': str(piece.composer) if piece.composer else '',
            'arranger': piece.arranger,
            'duration_label': DocumentGenerator._format_duration(piece.estimated_duration),
            'language': DocumentGenerator._format_language(piece.language),
            'voicing': piece.voicing,
            'voice_requirements_summary': voice_requirements_summary,
            'meta_line': meta_line,
            'description': piece.description,
            'sheet_music_url': sheet_music_url,
            'reference_links': reference_links,
            'track_count': len(track_labels),
            'track_summary': ', '.join(track_labels),
            'casting_count': len(piece_castings),
            'material_badges': material_badges,
            'you': you,
        }

    @staticmethod
    def _build_casting_section(
        item: ProgramItem,
        piece_castings: list[ProjectPieceCasting],
    ) -> dict[str, Any]:
        grouped_castings: dict[str, list[ProjectPieceCasting]] = defaultdict(list)
        for casting in sorted(
            piece_castings,
            key=lambda entry: (
                _VOICE_LINE_ORDER.get(entry.voice_line, 999),
                entry.participation.artist.last_name,
                entry.participation.artist.first_name,
            ),
        ):
            grouped_castings[casting.get_voice_line_display()].append(casting)

        rows = []
        for voice_line, assignments in grouped_castings.items():
            singers = [
                f'{assignment.participation.artist.first_name} {assignment.participation.artist.last_name}'
                for assignment in assignments
            ]
            pitch_team = [
                f'{assignment.participation.artist.first_name} {assignment.participation.artist.last_name}'
                for assignment in assignments
                if assignment.gives_pitch
            ]
            notes = [
                assignment.notes.strip()
                for assignment in assignments
                if assignment.notes and assignment.notes.strip()
            ]
            rows.append(
                {
                    'voice_line': voice_line,
                    'singers': ', '.join(singers) if singers else 'Bez obsady',
                    'pitch_team': ', '.join(pitch_team),
                    'notes': '; '.join(dict.fromkeys(notes)),
                }
            )

        # A column every row answers with an em-dash is 120pt of width spent on
        # nothing; it appears only when the table has something to put in it.
        return {
            'order': item.order,
            'title': item.piece.title,
            'rows': rows,
            'has_pitch': any(row['pitch_team'] for row in rows),
            'has_notes': any(row['notes'] for row in rows),
        }

    @staticmethod
    def _build_rehearsal_item(
        rehearsal: Rehearsal,
        project: Project,
        recipient: Participation | None,
        now: Any,
    ) -> dict[str, Any]:
        rehearsal_timezone = rehearsal.timezone or (
            rehearsal.location.timezone if rehearsal.location else project.timezone
        )
        local_datetime = localize(rehearsal.date_time, rehearsal_timezone)
        invited_participations = list(rehearsal.invited_participations.all())
        invited_ids = {participation.id for participation in invited_participations}
        is_whole_ensemble = not invited_participations
        scope_label = (
            f'Wybrani artyści ({len(invited_participations)})'
            if invited_participations
            else 'Cały zespół'
        )
        # A whole-ensemble call is for everyone; a targeted one only for those on
        # the list. Absent a recipient (conductor / production sheets) we don't filter.
        is_for_me = (
            True
            if recipient is None
            else is_whole_ensemble or recipient.id in invited_ids
        )
        location = rehearsal.location or project.location

        return {
            'date_time': local_datetime,
            'date_label': DocumentGenerator._format_date(local_datetime),
            'time_label': DocumentGenerator._format_time(local_datetime),
            'timezone': rehearsal_timezone,
            'focus': rehearsal.focus,
            'is_mandatory': rehearsal.is_mandatory,
            'is_past': rehearsal.date_time < now,
            'scope_label': scope_label,
            'is_for_me': is_for_me,
            'location_name': location.name if location else 'Do ustalenia',
            'location_address': DocumentGenerator._format_address(
                location.formatted_address if location else ''
            ),
            'map_url': DocumentGenerator._build_map_url(location),
        }

    @staticmethod
    def _group_participations_by_voice(
        participations: list[Participation],
        annotate_repeats: bool = True,
    ) -> list[dict[str, Any]]:
        grouped: dict[str, list[str]] = defaultdict(list)
        labels: dict[str, str] = {}

        for participation in sorted(
            participations,
            key=lambda entry: (
                _VOICE_TYPE_ORDER.get(entry.artist.voice_type, 999),
                entry.artist.last_name,
                entry.artist.first_name,
            ),
        ):
            voice_type = participation.artist.voice_type
            labels[voice_type] = participation.artist.get_voice_type_display()
            grouped[voice_type].append(
                f'{participation.artist.first_name} {participation.artist.last_name}'
            )

        ordered_sections = []
        for voice_type, members in sorted(
            grouped.items(),
            key=lambda entry: _VOICE_TYPE_ORDER.get(entry[0], 999),
        ):
            ordered_sections.append(
                {
                    'label': labels.get(voice_type, voice_type),
                    'count': len(members),
                    'members': (
                        DocumentGenerator._collapse_repeated_names(members)
                        if annotate_repeats
                        else members
                    ),
                }
            )
        return ordered_sections

    @staticmethod
    def _build_blockers(
        project: Project,
        call_window: CallWindow,
        program_cards: list[dict[str, Any]],
        pending_participations: list[Participation],
        confirmed_participations: list[Participation],
        crew_list: list[CrewAssignment],
        venue: Any,
        run_sheet_items: list[dict[str, str]],
    ) -> list[dict[str, str]]:
        """What is not closed yet, worst first.

        The measure of a status report is that every hole is visible without
        reading the rest of it, so this opens the document: coverage tiles say
        how much is done, and a reader looking for what is *missing* has to
        subtract them in their head. Each entry names the gap and then the
        specific rows behind it, because "3 invitations unanswered" is only
        actionable once it says whose.
        """
        blockers: list[dict[str, str]] = []

        def add(text: str, detail: str = '') -> None:
            blockers.append({'text': text, 'detail': detail})

        if call_window.problem is CallWindowProblem.MISSING:
            add(
                'Zbiórka nie jest ustawiona',
                'Bez niej arkusz podaje samą godzinę koncertu.',
            )
        elif call_window.problem is CallWindowProblem.NOT_BEFORE:
            add(
                'Zbiórka nie wypada przed koncertem',
                'Sprawdź datę i godzinę zbiórki w projekcie.',
            )
        elif call_window.problem is CallWindowProblem.IMPLAUSIBLE:
            days = (call_window.buffer_minutes or 0) // (24 * 60)
            add(
                f'Zbiórka ustawiona {days} {_count_label(days, "dzień", "dni", "dni")} '
                'przed koncertem',
                'Najprawdopodobniej wpisano ją na złą datę.',
            )

        if venue is None:
            add('Brak miejsca wydarzenia', 'Adres i mapa nie trafią na żaden arkusz.')

        if pending_participations:
            count = len(pending_participations)
            by_voice: dict[str, list[str]] = defaultdict(list)
            for participation in sorted(
                pending_participations,
                key=lambda entry: (
                    _VOICE_TYPE_ORDER.get(entry.artist.voice_type, 999),
                    entry.artist.last_name,
                ),
            ):
                by_voice[participation.artist.get_voice_type_display()].append(
                    f'{participation.artist.first_name} {participation.artist.last_name}'
                )
            add(
                f'{count} {_count_label(count, "zaproszenie", "zaproszenia", "zaproszeń")} '
                'bez odpowiedzi',
                ' · '.join(
                    f'{voice}: {", ".join(names)}' for voice, names in by_voice.items()
                ),
            )

        if not confirmed_participations:
            add('Brak potwierdzonej obsady', 'Nikt jeszcze nie potwierdził udziału.')

        # Two roster rows under one name are two Artist records for (almost
        # always) one human — artist uniqueness is on e-mail alone, so it only
        # bites when both rows carry one. The sheet cannot resolve it; it can
        # refuse to let it pass unnoticed, which is what the roster's
        # "(2 wpisy)" marker and this line do together.
        repeated: dict[str, int] = {}
        for participation in confirmed_participations + pending_participations:
            name = f'{participation.artist.first_name} {participation.artist.last_name}'
            repeated[name] = repeated.get(name, 0) + 1
        collisions = sorted(name for name, count in repeated.items() if count > 1)
        if collisions:
            add(
                f'{len(collisions)} '
                f'{_count_label(len(collisions), "nazwisko występuje", "nazwiska występują", "nazwisk występuje")} '
                'w obsadzie więcej niż raz',
                ' · '.join(collisions) + ' — sprawdź, czy to nie zdublowana kartoteka.',
            )

        if not program_cards:
            add('Program nie został ustalony', 'Arkusz nie ma czego wypisać.')
        else:
            for key, singular, few, many in (
                ('sheet_music_url', 'utwór bez nut', 'utwory bez nut', 'utworów bez nut'),
                ('track_count', 'utwór bez tracków sekcyjnych',
                 'utwory bez tracków sekcyjnych', 'utworów bez tracków sekcyjnych'),
                ('casting_count', 'utwór bez rozpisanego castingu',
                 'utwory bez rozpisanego castingu', 'utworów bez rozpisanego castingu'),
            ):
                missing = [card for card in program_cards if not card[key]]
                if not missing:
                    continue
                count = len(missing)
                add(
                    f'{count} {_count_label(count, singular, few, many)}',
                    ' · '.join(card['title'] for card in missing[:6])
                    + (' …' if count > 6 else ''),
                )

        if not crew_list:
            add('Brak obsady technicznej', 'Żaden współpracownik nie jest przypisany.')

        if not run_sheet_items:
            add(
                'Przebieg dnia nie został uzupełniony',
                'Wykonawcy dostaną same godziny z nagłówka.',
            )

        if not project.dress_code_female and not project.dress_code_male:
            add('Dress code nie został ustalony', 'Karta dnia poprosi o potwierdzenie.')

        return blockers

    @staticmethod
    def _collapse_repeated_names(members: list[str]) -> list[str]:
        """One name printed twice in a row reads as a rendering fault and is
        quietly ignored; printed once with a multiplier it reads as what it is —
        two roster entries for one name, which someone has to go and merge. The
        count is left alone: it counts participations, and that is the truth."""
        counts: dict[str, int] = {}
        for name in members:
            counts[name] = counts.get(name, 0) + 1
        return [
            name
            if repeats == 1
            else f'{name} ({repeats} {_count_label(repeats, "wpis", "wpisy", "wpisów")})'
            for name, repeats in counts.items()
        ]

    @staticmethod
    def _map_castings_by_piece(
        castings: list[ProjectPieceCasting],
    ) -> dict[Any, list[ProjectPieceCasting]]:
        mapping: dict[Any, list[ProjectPieceCasting]] = defaultdict(list)
        for casting in castings:
            mapping[casting.piece_id].append(casting)
        return mapping

    @staticmethod
    def _normalize_run_sheet(run_sheet: list[Any]) -> list[dict[str, str]]:
        normalized = []
        for item in run_sheet or []:
            if not isinstance(item, dict):
                continue
            normalized.append(
                {
                    'time': str(item.get('time', '')).strip(),
                    'title': (
                        str(
                            item.get('title')
                            # `label` is the key the run sheet shipped with and
                            # rows written then still carry it; without it they
                            # print as the fallback rather than as themselves.
                            or item.get('label')
                            or item.get('task')
                            or item.get('activity')
                            or item.get('name')
                            or 'Punkt dnia'
                        )
                    ).strip(),
                    'description': str(item.get('description') or item.get('notes') or '').strip(),
                    'location': str(item.get('location') or '').strip(),
                }
            )
        # The editor and overview widget sort chronologically; the PDF must match,
        # so a manager entering points out of order still prints a clean timeline.
        # Sorted on parsed minutes, not on the string: `run_sheet` is an
        # unvalidated JSON field, and lexically "9:00" follows "12:00".
        normalized.sort(key=lambda entry: DocumentGenerator._clock_sort_key(entry['time']))
        return normalized

    @staticmethod
    def _clock_sort_key(value: str) -> tuple[int, int]:
        """Minutes since midnight for an `H:MM`/`HH:MM` string. Anything
        unparsable sorts last rather than being dropped or guessed at."""
        hours, _, minutes = value.partition(':')
        try:
            return (0, int(hours) * 60 + int(minutes))
        except ValueError:
            return (1, 0)

    @staticmethod
    def _visible_sections(
        kind: DocumentKind,
        audience: Audience,
        personal: dict[str, Any] | None,
    ) -> list[str]:
        """The sections the template will actually emit, in order.

        The printed section numbers come from the loop counter, so a section
        listed here but skipped at render time leaves a gap — the production
        sheet used to open at "2" because a headingless metrics band held the
        first number.
        """
        return [
            section
            for section in _SECTIONS[kind][audience]
            if section != 'personal' or personal is not None
        ]

    @staticmethod
    def _absolute_url(base_url: str | None, path: str) -> str:
        """Join an app-relative API path onto the request origin.

        Score/edition links MUST target the authenticated, access-gated endpoints
        (``/api/projects/<pk>/score_pdf/``, ``/api/materials/scores/<pk>/download/``)
        — never a raw ``/media/`` file URL. nginx serves the score media prefixes
        ``internal;`` only, so a direct file hyperlink 404s and would also bypass
        watermarking + access logging. Mirrors ``ProjectSerializer.get_score_pdf``.
        """
        if not path:
            return ''
        return urljoin(base_url or '', path)

    @staticmethod
    def _build_map_url(location: Any) -> str:
        if not location:
            return ''
        if location.latitude is not None and location.longitude is not None:
            return (
                'https://www.google.com/maps/search/?api=1&query='
                f'{location.latitude},{location.longitude}'
            )
        if location.formatted_address:
            return (
                'https://www.google.com/maps/search/?api=1&query='
                f'{quote_plus(location.formatted_address)}'
            )
        return ''

    @staticmethod
    def _format_address(formatted_address: str | None) -> str:
        """Places addresses arrive as free text and occasionally repeat a
        fragment ("02-532, Rakowiecka 61, 02-532 Warszawa"). Only exact repeats
        of a comma-separated part are dropped, and the ensemble's own country is
        left off — a Polish sheet does not need to say the concert is in Poland.
        Anything else passes through untouched: this is a print-time tidy, not
        an address parser. Normalisation belongs to the logistics import.
        """
        if not formatted_address:
            return 'Do ustalenia'
        parts = [part.strip() for part in formatted_address.split(',') if part.strip()]
        kept: list[str] = []
        for part in parts:
            if part in kept:
                continue
            if part.casefold() in _IMPLIED_COUNTRIES:
                continue
            kept.append(part)
        # A postal code repeated inside a longer part ("02-532 Warszawa" after a
        # bare "02-532") is the common Places shape; drop the bare one.
        deduped = [
            part
            for index, part in enumerate(kept)
            if not any(
                other != part and other.startswith(f'{part} ')
                for other in kept[index + 1:]
            )
        ]
        return ', '.join(deduped) or 'Do ustalenia'

    @staticmethod
    def _format_timezone(timezone_name: str, event_local: Any) -> str:
        """The IANA identifier with its actual offset for the event, so a reader
        can act on it without knowing what 'Europe/Warsaw' means in August."""
        if event_local is None:
            return timezone_name
        offset = event_local.utcoffset()
        if offset is None:
            return timezone_name
        total_minutes = int(offset.total_seconds() // 60)
        sign = '+' if total_minutes >= 0 else '-'
        hours, minutes = divmod(abs(total_minutes), 60)
        suffix = f'{sign}{hours}' if minutes == 0 else f'{sign}{hours}:{minutes:02d}'
        return f'{timezone_name} (UTC{suffix})'

    @staticmethod
    def _format_language(language: str | None) -> str:
        """'la-pl' is a machine token; the sheet says which languages are sung.
        Unrecognised tokens pass through rather than being guessed at."""
        if not language:
            return ''
        raw = language.strip()
        if not raw:
            return ''
        codes = [code.strip() for code in raw.replace('/', '-').split('-') if code.strip()]
        named = [_LANGUAGE_NAMES.get(code.casefold(), code) for code in codes]
        return ' / '.join(dict.fromkeys(named))

    @staticmethod
    def _format_duration(seconds: int | None) -> str:
        if not seconds:
            return ''
        total_seconds = int(seconds)
        hours, remainder = divmod(total_seconds, 3600)
        minutes, secs = divmod(remainder, 60)
        if hours:
            return f'{hours} h {minutes:02d} min'
        if minutes:
            return f'{minutes} min' if secs == 0 else f'{minutes} min {secs} s'
        return f'{secs} s'

    @staticmethod
    def _format_call_buffer(window: CallWindow) -> str:
        """The arrival window, stated only when it is one. A call entered on the
        wrong date used to print here as "481 h 00 min między zbiórką a startem"
        — arithmetic presented as a plan."""
        if not window.is_stated or window.buffer_minutes is None:
            return ''
        hours, minutes = divmod(window.buffer_minutes, 60)
        if hours:
            return f'{hours} h {minutes:02d} min'
        return f'{minutes} min'

    @staticmethod
    def _format_call_time(window: CallWindow) -> str:
        """The call as an hour — carrying its date whenever that date is not the
        concert's, because a bare hour is read as concert-day."""
        if window.call_local is None:
            return 'Do ustalenia'
        if window.crosses_day:
            return window.call_local.strftime('%d.%m, %H:%M')
        return window.call_local.strftime('%H:%M')

    @staticmethod
    def _call_window_warning(window: CallWindow) -> str:
        """What is wrong with the arrival window, for the sheets whose reader can
        go and fix it."""
        if window.problem is CallWindowProblem.NOT_BEFORE:
            return 'Zbiórka nie wypada przed koncertem — sprawdź datę i godzinę w projekcie.'
        if window.problem is CallWindowProblem.IMPLAUSIBLE:
            return (
                'Zbiórka jest ustawiona ponad dobę przed koncertem — '
                'najprawdopodobniej wpisano ją na złą datę.'
            )
        return ''

    @staticmethod
    def _format_date(value) -> str:
        if not value:
            return 'Do ustalenia'
        return value.strftime('%d.%m.%Y')

    @staticmethod
    def _format_time(value) -> str:
        if not value:
            return 'Do ustalenia'
        return value.strftime('%H:%M')

    @staticmethod
    def _format_datetime(value) -> str:
        if not value:
            return ''
        return value.strftime('%d.%m.%Y, %H:%M')
