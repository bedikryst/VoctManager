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
management (``Audience.PRODUCTION``). Typography is the bundled brand pair
(Cormorant Garamond + IBM Plex Sans, see ``print_fonts``), so the PDF renders
identically on the Windows dev host and the Linux runtime image — and so a
document made of labels, times and tables is set in the face that draws them.
The rules it follows are the ``Print artifacts`` canon in
``.ai/04_design_system.md``, shared with the contract template.

Its wording is gettext'd and resolved from the *reader*, not from the server or
from the request: see ``resolve_document_language``. Most of it is composed here
rather than in the template, because a numeral governs the noun beside it and a
template can only concatenate the two.
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
from django.utils import timezone, translation
from django.utils.safestring import mark_safe
from django.utils.translation import gettext as _
from django.utils.translation import ngettext, pgettext

from core.constants import VoiceLine
from core.greetings import apply_vocative_rule
from logistics.address import address_parts
from roster.domain.day_timeline import (
    CallWindow,
    CallWindowProblem,
    RunSheetPoint,
    TimelineEntry,
    TimelineEntryKind,
    build_day_timeline,
    clock_sort_key,
    localize,
    normalize_run_sheet,
    plan_end,
    resolve_call_window,
)
from roster.infrastructure.print_fonts import (
    BRAND_SANS_STACK,
    BRAND_SERIF_STACK,
    brand_font_face_css,
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
#
# The values are msgids translated under the ``sung language`` context, not
# display strings: they print inside a piece's metaline, where Polish and French
# both want lower case, while the panel's own language names are capitalised
# labels. The context is what keeps the two apart in one catalog.
_LANGUAGE_NAMES: dict[str, str] = {
    'la': 'Latin',
    'pl': 'Polish',
    'en': 'English',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'es': 'Spanish',
    'ru': 'Russian',
    'uk': 'Ukrainian',
    'cs': 'Czech',
    'sk': 'Slovak',
    'lt': 'Lithuanian',
    'he': 'Hebrew',
    'el': 'Greek',
    'hu': 'Hungarian',
}
# Reference links are a hyperlink strip on a printed page, not a discography.
_MAX_REFERENCE_LINKS = 2
# A QR is spent only where scanning is the realistic way in: a public map or
# playlist a phone opens with no session. The gated endpoints (project score,
# score editions) are named in words instead — a code that leads to a login
# wall is worse than no code, because it is tried first. See the print canon's
# three-per-page ceiling; the sheet never emits more than two.
_QR_ERROR_LEVEL = 'm'
# The materials a report tracks per piece, in the order the grid prints them.
# Each column is a yes/no over the SAME denominator (the programme), which is
# what makes the grid a grid rather than four counters standing in a row.
#
# The labels are msgids under their own ``coverage column`` context, and that is
# not decoration: these four heads share one 56pt cell each, so a translator has
# to be free to abbreviate here without abbreviating the same word where it has
# room. French proved the point — "Enregistrement" and "Distribution" ran into
# each other under the marks they label.
_COVERAGE_COLUMNS: tuple[tuple[str, str], ...] = (
    ('sheet_music_url', 'Score'),
    ('track_count', 'Tracks'),
    ('reference_links', 'Recording'),
    ('casting_count', 'Casting'),
)
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
# The day's two fixed points, named for the printed sheet. Placing them is the
# domain's job (``day_timeline``); only the wording belongs to the document.
# Msgids under the ``call sheet`` context — the same two the masthead band uses,
# so the timeline below it can never call them something else.
_ANCHOR_LABELS: dict[TimelineEntryKind, str] = {
    TimelineEntryKind.CALL: 'Call time',
    TimelineEntryKind.CONCERT: 'Concert start',
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
#
# **A day card leads with the day.** The masthead promises the day's anchors, so
# the run sheet is the first numbered section on every day card — the maestro's
# used to open on four pages of casting matrix before reaching the hours the
# band above it had just stated. The report leads with the event, because its
# reader is establishing facts, not executing them.
_SECTIONS: dict[DocumentKind, dict[Audience, tuple[str, ...]]] = {
    DocumentKind.DAY_CARD: {
        # Singer: their own part first (it is the one section nobody else's
        # sheet carries), then the day, then the music, and last the two things
        # a lost or late singer needs — who else is there and whom to reach.
        Audience.CHORISTER: (
            "personal",
            "runsheet",
            "event",
            "rehearsals",
            "program",
            "ensemble",
            "contacts",
        ),
        # Maestro: the day, then the musical arc and who gives pitch.
        Audience.CONDUCTOR: (
            "runsheet",
            "program",
            "casting",
            "ensemble",
            "rehearsals",
            "event",
            "contacts",
        ),
        # Stage manager: the day as it will be run, and everyone who runs it.
        # No casting — micro-casting is the maestro's instrument, not the desk's.
        Audience.PRODUCTION: (
            "runsheet",
            "event",
            "rehearsals",
            "program",
            "ensemble",
            "contacts",
        ),
    },
    DocumentKind.PRODUCTION_REPORT: {
        # Management: the full preparation picture. The blocker list and the
        # coverage band open the document ahead of every numbered section.
        #
        # PRODUCTION is the only audience here, and deliberately: a report for
        # the maestro was configured for a stage that never gave it an endpoint,
        # and `resolve_document_kind` already degrades that pair to the day card
        # he can actually request. Dead configuration outlives the reason it was
        # written; if a conductor's report is ever wanted, it arrives with the
        # entry point that motivates it.
        Audience.PRODUCTION: (
            "event",
            "runsheet",
            "rehearsals",
            "program",
            "casting",
            "ensemble",
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


def _ensemble_name() -> str:
    """Resident-ensemble name for the document chrome, from settings (rebrandable)."""
    return getattr(settings, "SCORE_BOOK_ENSEMBLE_NAME", "VoctEnsemble")


def _supported_language(code: str | None) -> str | None:
    """``code`` reduced to a language this backend actually has a catalog for,
    or ``None``. A regional tag falls back to its base language rather than to
    the server default: ``fr-CA`` is still French."""
    if not code:
        return None
    available = {language.lower() for language, _label in settings.LANGUAGES}
    normalized = code.replace('_', '-').lower()
    if normalized in available:
        return normalized
    base = normalized.split('-')[0]
    return base if base in available else None


def _reader_language(user: Any) -> str | None:
    """The stored preference of one person, when there is one. ``profile`` is a
    reverse one-to-one, so ``getattr`` with a default is the access that does
    not raise on an account without one."""
    if user is None:
        return None
    profile = getattr(user, 'profile', None)
    return _supported_language(getattr(profile, 'language', None))


def resolve_document_language(
    project: Project,
    audience: Audience,
    recipient: Participation | None,
    requester_language: str | None = None,
) -> str:
    """The language the sheet is set in — its reader's, never the server's.

    A printed document has exactly one reader, and for the two personal
    audiences we know who: the singer holding their day card, and the maestro
    holding his. Both carry a stored language preference, and the ensemble's own
    conductor is francophone — resolved from a global setting (this used to read
    ``SCORE_BOOK_LANG``) he is handed a Polish sheet whatever he asked for, and
    the setting cannot be changed for him without changing it for the choir.

    Only the production sheets have no named recipient. There the reader is
    whoever asked for the export, which the caller passes in: the request's own
    language is the wrong answer, since it comes from an ``Accept-Language``
    header the panel sets from the UI, not from who the document is for.
    """
    reader: Any = None
    if recipient is not None:
        reader = getattr(recipient.artist, 'user', None)
    elif audience == Audience.CONDUCTOR and project.conductor is not None:
        reader = getattr(project.conductor, 'user', None)
    return (
        _reader_language(reader)
        or _supported_language(requester_language)
        or settings.LANGUAGE_CODE
    )


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


def _qr_data_uri(url: str) -> str:
    """An SVG QR for ``url``, inline as a data URI, or '' when there is nothing
    scannable.

    SVG rather than a raster: a QR is printed at ~15mm, where an upscaled PNG
    loses the module edges a scanner reads. A missing ``segno`` degrades to no
    code rather than failing the render — the resource is named in words beside
    it either way, which is the part that has to survive.
    """
    if not url:
        return ''
    try:
        import segno
    except ImportError:  # pragma: no cover - the dependency ships in requirements
        return ''
    return segno.make(url, error=_QR_ERROR_LEVEL).svg_data_uri(scale=1, border=0)


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
        requester_language: str | None = None,
    ) -> bytes:
        """Compiles the concert-day sheet PDF for the given kind and audience.

        ``recipient`` personalizes the ``CHORISTER`` sheet (their voice, their
        casting, their pitch duties). It is ignored for the other audiences.

        ``requester_language`` is the language of whoever asked for the export,
        used only where the document has no identifiable reader of its own — the
        report and the stage manager's card. Everything else resolves from the
        recipient (see :func:`resolve_document_language`).

        The override wraps the context build as well as the render: most of this
        document's wording is composed in Python (a numeral governs the noun
        beside it, so the two cannot be assembled in the template), and an eager
        ``gettext`` outside the override would resolve against the request's
        language instead of the reader's.
        """
        language = resolve_document_language(
            project, audience, recipient, requester_language
        )
        with translation.override(language):
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
                language=language,
            )
            html_string = render_to_string('projects/call_sheet_pdf.html', context)
        return _render_pdf(html_string, base_url=base_url)

    @staticmethod
    def generate_participation_contract_pdf(participation: Participation) -> bytes:
        """Compiles a dynamic legal PDF artifact for artist participation.

        Deliberately NOT gettext'd, unlike the call sheet. `contract_pdf.html`
        is Polish legal text under Polish law, and its wording is settled with
        the foundation, not with a translator; a placeholder resolved through
        the active language would also follow the request's `Accept-Language`
        and drop one French word into an otherwise Polish contract. Translating
        this document is a legal decision, and it starts with the clauses.
        """
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
        """Generates a streaming CSV payload for ZAiKS copyright reporting.

        The Polish here is a filing format, not copy: ZAiKS is the Polish
        collecting society and reads these column heads. Translating them would
        produce a report it rejects, so this file is Polish whoever exports it.
        """
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
        """Generates a cleanly formatted text artifact tailored for Graphic Design (DTP).

        The section names are the copy that will be typeset into a Polish
        concert programme, so they are the programme's language rather than the
        exporting manager's — the same reason the ZAiKS export stays Polish.
        """
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
        language: str | None = None,
    ) -> dict[str, Any]:
        # The caller passes the language it resolved and overrode with; calling
        # this builder directly (the tests do) simply follows what is active.
        doc_language = language or translation.get_language() or settings.LANGUAGE_CODE
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

        venue = project.location
        venue_map_url = DocumentGenerator._build_map_url(venue)
        venue_address = DocumentGenerator._format_address(
            venue.formatted_address if venue else ''
        )
        # Date, call, downbeat and venue name are already the masthead's four
        # facts; restating them here filled half this card with an echo. It now
        # carries only what the masthead cannot fit.
        event_facts = []
        if venue and venue.category:
            event_facts.append(
                {
                    'label': pgettext('call sheet', 'Venue type'),
                    'text': venue.get_category_display(),
                }
            )
        # The day card prints the address in the masthead, directly under the
        # anchors — the one line a lost singer needs is not worth a second row
        # inside a card further down the page.
        if is_report:
            event_facts.append(
                {
                    'label': pgettext('call sheet', 'Address'),
                    'text': venue_address or pgettext('call sheet', 'To be arranged'),
                }
            )
        # A timezone is worth a line only when it is not the one the reader
        # assumes; the IANA identifier itself is machine vocabulary either way.
        if project_timezone != DEFAULT_EVENT_TIMEZONE:
            event_facts.append(
                {
                    'label': pgettext('call sheet', 'Time zone'),
                    'text': DocumentGenerator._format_timezone(
                        project_timezone, event_datetime_local
                    ),
                }
            )
        if project.conductor:
            event_facts.append(
                {
                    'label': pgettext('call sheet', 'Conducted by'),
                    'text': str(project.conductor),
                }
            )

        # The day card lists what exists; the report lists both rows, because
        # there an absence is a finding. Per-piece readiness is the coverage
        # grid's job and no longer duplicated here as four counters.
        preparation_assets = DocumentGenerator._build_preparation_assets(
            project, base_url, is_report
        )

        dress_code_entries = []
        if project.dress_code_female:
            dress_code_entries.append(
                {
                    'label': pgettext('call sheet', 'Women'),
                    'value': project.dress_code_female,
                }
            )
        if project.dress_code_male:
            dress_code_entries.append(
                {
                    'label': pgettext('call sheet', 'Men'),
                    'value': project.dress_code_male,
                }
            )
        if not dress_code_entries:
            dress_code_entries.append(
                {
                    'label': pgettext('call sheet', 'Dress code'),
                    'value': _('To be confirmed by management.'),
                }
            )

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

        # The day as one axis. The sheet used to print the raw run sheet beside
        # a header built from the project's datetimes, so a stale "12:00 Start"
        # could sit under a masthead announcing a 20:02 downbeat — two
        # implementations of one concept, one of them wrong, in one document.
        #
        # The two structured moments join that axis rather than opening a second
        # list of hours: warm-up and sound check are moments of this day like any
        # run-sheet point, and the only thing that makes them different is that
        # nobody has to type their name (which is why they print in the reader's
        # language and a run-sheet title does not).
        run_sheet_points = normalize_run_sheet(project.run_sheet)
        day_points = sorted(
            [*run_sheet_points, *DocumentGenerator._structured_day_points(project)],
            key=lambda point: clock_sort_key(point.time),
        )
        timeline = build_day_timeline(day_points, call_window)

        # Polish is the only supported language with a distinct vocative, and
        # the rule that knows it lives in one place. Printing the stored form
        # unconditionally put "Préparé pour vous, Janie" on a French sheet — a
        # Polish case ending inside a French sentence.
        addressee = None
        if recipient is not None:
            addressee = recipient.artist
        elif audience == Audience.CONDUCTOR and project.conductor:
            addressee = project.conductor
        greeting = (
            apply_vocative_rule(
                vocative=addressee.first_name_vocative.strip(),
                first_name=addressee.first_name,
                language=doc_language,
            )
            if addressee is not None
            else None
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
            # Drives `<html lang>`, which is what WeasyPrint hyphenates by. It
            # is the resolved reader's language, so the hyphenation dictionary
            # can never disagree with the words on the page.
            'doc_lang': doc_language,
            # The brand pair, not the score book's face: this document is
            # labels, times, tables and counters, and one serif at one width
            # made its eyebrow rows read as texture rather than as structure.
            **_brand_font_context(),
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
            # The masthead band, derived from the same axis as the timeline
            # below it rather than from four independently formatted fields. A
            # call on another calendar day carries that day inside its cell: an
            # hour on its own reads as concert-day, and a singer acting on it
            # arrives on the wrong date.
            'masthead_facts': DocumentGenerator._build_masthead_facts(
                call_window, timeline, project, is_report
            ),
            'venue_line': (
                '' if is_report else DocumentGenerator._venue_line(venue, venue_address)
            ),
            # The one code a lost singer scans, beside the address it decodes.
            # The report's reader is at a desk with the address in front of
            # them, so it gets no code.
            'venue_qr': '' if is_report else _qr_data_uri(venue_map_url),
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
            'day_timeline': DocumentGenerator._build_timeline_rows(timeline),
            # With no points of its own the merged axis is just the two anchors,
            # which the masthead already states — the section says so in words
            # instead of restating them as a two-row table.
            'has_run_sheet': bool(day_points),
            # Where exactly, once the reader has arrived at the address. Only
            # what is actually recorded: a card whose whole content is the
            # absence of three facts is noise on the sheet of the person who
            # cannot fill them in, and the report names the gap in its blockers.
            'onsite_facts': DocumentGenerator._build_onsite_facts(project),
            'rehearsal_items': rehearsal_items,
            'rehearsals_done': rehearsals_done,
            # Composed here rather than in the template because a numeral
            # governs the noun beside it: Polish needs three forms of "próba"
            # and the template can only concatenate a number to a fixed word.
            'rehearsals_done_note': (
                ngettext(
                    '%(count)d rehearsal has already taken place.',
                    '%(count)d rehearsals have already taken place.',
                    rehearsals_done,
                ) % {'count': rehearsals_done}
                if rehearsals_done and not is_report
                else ''
            ),
            'rehearsals_all_done_note': (
                ngettext(
                    'The %(count)d rehearsal is behind you — only the concert is left.',
                    'All %(count)d rehearsals are behind you — only the concert is left.',
                    rehearsals_done,
                ) % {'count': rehearsals_done}
                if rehearsals_done
                else ''
            ),
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
            'ensemble_confirmed_label': (
                ngettext('%(count)d confirmed', '%(count)d confirmed', len(confirmed_participations))
                % {'count': len(confirmed_participations)}
                if confirmed_participations
                else ''
            ),
            'pending_heading': _('Awaiting confirmation (%(count)d)')
            % {'count': len(pending_participations)},
            'declined_note': (
                _('Declined: %(count)d — outside the active cast.')
                % {'count': declined_count}
                if is_report and declined_count
                else ''
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
                    day_points=day_points,
                )
                if is_report
                else []
            ),
            # Four unrelated denominators in one row of equal boxes were not
            # siblings; the coverage question is one grid over one denominator
            # (the programme), and the census beside it names its own nouns so
            # nothing implies a shared one.
            'coverage': (
                DocumentGenerator._build_coverage_grid(program_cards)
                if is_report
                else None
            ),
            'coverage_census': (
                DocumentGenerator._build_coverage_census(
                    program_cards=program_cards,
                    total_program_duration_seconds=total_program_duration_seconds,
                    confirmed=len(confirmed_participations),
                    pending=len(pending_participations),
                    rehearsals=len(rehearsal_list),
                    crew_confirmed=confirmed_crew_count,
                    crew_tentative=tentative_crew_count,
                )
                if is_report
                else ''
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
                'title': title_by_piece.get(casting.piece_id, _('Programme item')),
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
            'section_label': ngettext(
                'section of %(count)d singer',
                'section of %(count)d singers',
                section_size,
            ) % {'count': section_size},
        }

    @staticmethod
    def _build_preparation_assets(
        project: Project,
        base_url: str | None,
        is_report: bool,
    ) -> list[dict[str, Any]]:
        """The two project-level resources, named as resources rather than drawn
        as buttons.

        A pill-shaped link is a decoration on paper (its target is invisible,
        unreachable even by typing) and an 8pt tap target on a phone. What works
        in both media is the resource named in words plus, where the target is
        genuinely reachable, a QR. ``access`` is that sentence: the score sits
        behind the app's login, so it says so instead of offering a code that
        would lead to a wall.

        A resource that does not exist is not listed on a performer's sheet —
        printing "Playlista referencyjna — Brak" tells the one reader who can do
        nothing about it that something is missing. On the report both rows are
        stated either way, because there its absence is the point.
        """
        score_url = (
            DocumentGenerator._absolute_url(
                base_url, f'/api/projects/{project.pk}/score_pdf/'
            )
            if project.score_pdf
            else ''
        )
        ready = pgettext('call sheet', 'Ready')
        missing = pgettext('call sheet', 'Missing')
        assets = [
            {
                'label': pgettext('call sheet', 'Full project score'),
                'status': ready if project.score_pdf else missing,
                'url': score_url,
                'access': _('In the app, after signing in — the Materials tab.'),
                'qr': '',
                'note': _(
                    'The complete set of scores for today. Open it in the app or print it.'
                ),
            },
            {
                'label': pgettext('call sheet', 'Reference playlist'),
                'status': ready if project.spotify_playlist_url else missing,
                'url': project.spotify_playlist_url,
                'access': _('Spotify — open, no panel sign-in required.'),
                'qr': _qr_data_uri(project.spotify_playlist_url),
                'note': _('The sound and the running order, for one last listen.'),
            },
        ]
        if is_report:
            return assets
        return [asset for asset in assets if asset['url']]

    @staticmethod
    def _build_coverage_grid(program_cards: list[dict[str, Any]]) -> dict[str, Any]:
        """Material readiness as a grid: one row per piece, one column per material.

        The band this replaced was four counters over four different
        denominators standing in one row of equal boxes — a matrix pretending to
        be tiles, which the reader had to re-derive by subtraction. A grid
        answers in one glance: every column is the same question over the same
        programme, and a missing material is an empty cell, i.e. visibly a hole.
        Nothing here depends on colour; presence is a mark and absence is space.
        """
        rows = [
            {
                'order': card['order'],
                'title': card['title'],
                'cells': [bool(card[key]) for key, _label in _COVERAGE_COLUMNS],
            }
            for card in program_cards
        ]
        return {
            'labels': [
                pgettext('coverage column', label) for _key, label in _COVERAGE_COLUMNS
            ],
            'rows': rows,
            'totals': [
                sum(1 for row in rows if row['cells'][index])
                for index in range(len(_COVERAGE_COLUMNS))
            ],
            'total': len(rows),
            # The summary row names its own denominator, so no column can be
            # read as a share of a total it never had.
            'total_label': ngettext(
                'Out of %(count)d programme item',
                'Out of %(count)d programme items',
                len(rows),
            ) % {'count': len(rows)},
        }

    @staticmethod
    def _build_coverage_census(
        program_cards: list[dict[str, Any]],
        total_program_duration_seconds: int,
        confirmed: int,
        pending: int,
        rehearsals: int,
        crew_confirmed: int,
        crew_tentative: int,
    ) -> str:
        """The project's size in one line of plain type.

        Each figure carries its own noun, so no two of them read as shares of a
        denominator they never had. Deliberately not a row of tiles: a census is
        a measurement, and the loud slot on this page belongs to what is *not*
        closed.
        """
        pieces = len(program_cards)
        parts = [
            ngettext('%(count)d piece', '%(count)d pieces', pieces) % {'count': pieces},
        ]
        duration = DocumentGenerator._format_duration(total_program_duration_seconds)
        if duration:
            parts.append(_('%(duration)s of programme') % {'duration': duration})
        cast = ngettext(
            '%(count)d confirmed in the cast',
            '%(count)d confirmed in the cast',
            confirmed,
        ) % {'count': confirmed}
        if pending:
            parts.append(
                _('%(cast)s, %(count)d unanswered')
                % {'cast': cast, 'count': pending}
            )
        else:
            parts.append(cast)
        parts.append(
            ngettext('%(count)d rehearsal', '%(count)d rehearsals', rehearsals)
            % {'count': rehearsals}
        )
        crew_total = crew_confirmed + crew_tentative
        if crew_total:
            crew = ngettext(
                '%(count)d crew member',
                '%(count)d crew members',
                crew_confirmed,
            ) % {'count': crew_confirmed}
            parts.append(
                _('%(crew)s, %(count)d tentative')
                % {'crew': crew, 'count': crew_tentative}
                if crew_tentative
                else crew
            )
        else:
            parts.append(_('no crew'))
        return ' · '.join(parts)

    @staticmethod
    def _structured_day_points(project: Project) -> list[RunSheetPoint]:
        """The day's two typed moments, as points of the same axis.

        They exist as columns rather than as run-sheet rows for one reason that
        only shows up in print: a run-sheet title is free text somebody typed in
        Polish, so the maestro's French sheet printed "Próba akustyczna". A
        typed moment carries no wording of its own and is named here, in the
        reader's language.

        An open window (a start with no end) is normal — the sound check ends
        when it ends — so the closing hour is a qualifier, never a second row.
        """
        moments: list[RunSheetPoint] = []
        for start, end, title in (
            (
                project.warmup_start,
                project.warmup_end,
                pgettext('call sheet', 'Warm-up'),
            ),
            (
                project.soundcheck_start,
                project.soundcheck_end,
                pgettext('call sheet', 'Sound check'),
            ),
        ):
            if start is None:
                continue
            moments.append(
                RunSheetPoint(
                    time=start.strftime('%H:%M'),
                    title=title,
                    description=(
                        _('until %(time)s') % {'time': end.strftime('%H:%M')}
                        if end is not None
                        else ''
                    ),
                    location='',
                )
            )
        return moments

    @staticmethod
    def _build_onsite_facts(project: Project) -> list[dict[str, str]]:
        """Where exactly, once the reader is standing at the address.

        The three facts a singer asks a stranger for — which door, where to
        leave the car, where to change — and which used to exist only as prose
        inside the project description or the venue's internal notes, so neither
        reached the sheet as a fact anyone could act on.
        """
        return [
            {'label': label, 'text': value}
            for label, value in (
                (pgettext('call sheet', 'Entrance'), project.entrance_note),
                (pgettext('call sheet', 'Parking'), project.parking_note),
                (pgettext('call sheet', 'Dressing room'), project.dressing_room_note),
            )
            if value
        ]

    @staticmethod
    def _onsite_contact_entry(project: Project) -> dict[str, Any] | None:
        """The number a lost or late singer calls, as a directory entry.

        It reaches every audience, the choir included, and that is the one piece
        of contact data on this sheet which may: it is typed for this concert
        rather than read off somebody's profile, so printing it is the decision
        the producer already took when they entered it. A crew member's private
        mobile is theirs, and stays where it is.
        """
        name = project.onsite_contact_name.strip()
        phone = project.onsite_contact_phone.strip()
        if not name and not phone:
            return None
        # Unnamed, the role *is* the name — a nameless entry headed "On site"
        # above a line reading "On-site contact" says one thing twice.
        label = pgettext('call sheet', 'On-site contact')
        return {
            'name': name or label,
            'role': label if name else '',
            'organization': '',
            'status': _('Reachable on the day of the concert.'),
            'phone': phone,
            'email': '',
        }

    @staticmethod
    def _build_contact_directory(
        project: Project,
        crew_list: list[CrewAssignment],
        audience: Audience,
    ) -> list[dict[str, Any]]:
        # RODO: the whole ensemble must never receive everyone's phone/email.
        # The singer sheet names who leads (no private numbers); the conductor
        # and management sheets carry the full operational directory. The
        # project's own on-site number opens all three, because a document read
        # forty minutes before the downbeat is answering "whom do I call now".
        onsite = DocumentGenerator._onsite_contact_entry(project)

        directory: list[dict[str, Any]] = [onsite] if onsite else []

        if audience == Audience.CHORISTER:
            if project.conductor:
                directory.append(
                    {
                        'name': f'{project.conductor.first_name} {project.conductor.last_name}',
                        'role': pgettext('call sheet', 'Conducted by'),
                        'organization': '',
                        'status': _('For questions and delays, write in the app.'),
                        'phone': '',
                        'email': '',
                    }
                )
            return directory

        if project.conductor:
            directory.append(
                {
                    'name': f'{project.conductor.first_name} {project.conductor.last_name}',
                    'role': pgettext('call sheet', 'Conductor'),
                    'organization': '',
                    'status': pgettext('call sheet', 'Main contact'),
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
            # The platform is a qualifier, never the label: it names where to
            # look for a recording nobody can reach by scanning a printed page
            # (a QR per recording is how a page becomes a QR wall).
            reference_links.append(
                {'label': label, 'source': rec.get_source_display(), 'url': rec.url}
            )
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
                material_badges.append(pgettext('call sheet', 'Tracks'))
            if piece_castings:
                material_badges.append(pgettext('call sheet', 'Casting'))

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
                    'singers': ', '.join(singers) if singers else _('No cast assigned'),
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
            _('Selected artists (%(count)d)') % {'count': len(invited_participations)}
            if invited_participations
            else pgettext('call sheet', 'Whole ensemble')
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
            'location_name': (
                location.name if location else pgettext('call sheet', 'To be arranged')
            ),
            'location_address': DocumentGenerator._format_address(
                location.formatted_address if location else ''
            ) or pgettext('call sheet', 'To be arranged'),
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
        day_points: list[RunSheetPoint],
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
                _('The call time is not set'),
                _('Without it the sheet states the concert hour alone.'),
            )
        elif call_window.problem is CallWindowProblem.NOT_BEFORE:
            add(
                _('The call time does not fall before the concert'),
                _('Check the call date and hour on the project.'),
            )
        elif call_window.problem is CallWindowProblem.IMPLAUSIBLE:
            days = (call_window.buffer_minutes or 0) // (24 * 60)
            add(
                ngettext(
                    'Call time set %(count)d day before the concert',
                    'Call time set %(count)d days before the concert',
                    days,
                ) % {'count': days},
                _('It was most likely entered on the wrong date.'),
            )
        elif call_window.crosses_day:
            # Inside the plausible window a different calendar day is legitimate
            # — the tour case the ceiling exists to permit — but it is also what
            # an off-by-one date looks like from below the threshold. The day
            # card simply prints the date; the report asks someone to confirm it.
            add(
                _('The call time falls on a different day than the concert'),
                _(
                    'Usually a tour or a night on site — confirm it is not a '
                    'mistake in the date.'
                ),
            )

        if venue is None:
            add(
                _('No venue for the event'),
                _('Neither the address nor the map will reach any sheet.'),
            )

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
                ngettext(
                    '%(count)d invitation with no answer',
                    '%(count)d invitations with no answer',
                    count,
                ) % {'count': count},
                ' · '.join(
                    f'{voice}: {", ".join(names)}' for voice, names in by_voice.items()
                ),
            )

        if not confirmed_participations:
            add(
                _('No confirmed cast'),
                _('Nobody has confirmed their participation yet.'),
            )

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
                ngettext(
                    '%(count)d name appears in the cast more than once',
                    '%(count)d names appear in the cast more than once',
                    len(collisions),
                ) % {'count': len(collisions)},
                _('%(names)s — check for a duplicated roster entry.')
                % {'names': ' · '.join(collisions)},
            )

        if not program_cards:
            add(
                _('The programme has not been settled'),
                _('The sheet has nothing to list.'),
            )
        else:
            # One ngettext per gap, each spelled out at its own call site rather
            # than parameterised over a table of endings: the numeral governs
            # the noun (Polish needs three forms of "utwór"), and a catalog can
            # only carry forms for msgids that are written down where a scanner
            # — or the next reader — can see them.
            for key, phrase in (
                (
                    'sheet_music_url',
                    lambda count: ngettext(
                        '%(count)d piece without a score',
                        '%(count)d pieces without a score',
                        count,
                    ),
                ),
                (
                    'track_count',
                    lambda count: ngettext(
                        '%(count)d piece without section tracks',
                        '%(count)d pieces without section tracks',
                        count,
                    ),
                ),
                (
                    'casting_count',
                    lambda count: ngettext(
                        '%(count)d piece without casting',
                        '%(count)d pieces without casting',
                        count,
                    ),
                ),
            ):
                missing = [card for card in program_cards if not card[key]]
                if not missing:
                    continue
                count = len(missing)
                add(
                    phrase(count) % {'count': count},
                    ' · '.join(card['title'] for card in missing[:6])
                    + (' …' if count > 6 else ''),
                )

        if not crew_list:
            add(
                _('No technical crew'),
                _('No collaborator is assigned.'),
            )

        # Counted over the merged day, not over the JSON field: a producer who
        # only set the warm-up and the sound check has planned a day, and the
        # detail below would be untrue of the sheet that actually prints.
        if not day_points:
            add(
                _('The run sheet has not been filled in'),
                _('Performers will get only the hours from the masthead.'),
            )

        # The worst thing a call sheet can do is abandon its reader: a singer on
        # the wrong tram, forty minutes out, with nobody to call. The conductor's
        # private mobile is not the answer for a forty-voice choir, which is why
        # the project carries a number of its own.
        if not project.onsite_contact_phone.strip():
            add(
                _('No on-site phone number'),
                _('A singer who is lost or late has nobody to call on the day.'),
            )

        if not project.dress_code_female and not project.dress_code_male:
            add(
                _('The dress code has not been settled'),
                _('The day card will ask for confirmation.'),
            )

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
            else ngettext(
                '%(name)s (%(count)d entry)',
                '%(name)s (%(count)d entries)',
                repeats,
            ) % {'name': name, 'count': repeats}
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
    def _build_timeline_rows(timeline: list[TimelineEntry]) -> list[dict[str, Any]]:
        """The merged day, flattened for the template.

        Anchors print in the heavier voice and carry their date when they fall
        on another calendar day — an anchor hour on its own reads as concert-day
        wherever it appears, the run sheet included.
        """
        rows: list[dict[str, Any]] = []
        for entry in timeline:
            point = entry.point
            rows.append(
                {
                    'time': entry.time,
                    'title': (
                        point.title
                        if point is not None
                        else DocumentGenerator._anchor_label(entry.kind)
                    ),
                    'description': point.description if point is not None else '',
                    'location': point.location if point is not None else '',
                    'is_anchor': entry.is_anchor,
                    'day_note': (
                        DocumentGenerator._day_offset_note(entry.day_offset)
                        if entry.is_anchor
                        else ''
                    ),
                }
            )
        return rows

    @staticmethod
    def _anchor_label(kind: TimelineEntryKind) -> str:
        """The printed name of one of the day's two fixed points."""
        msgid = _ANCHOR_LABELS.get(kind)
        return pgettext('call sheet', msgid) if msgid else ''

    @staticmethod
    def _day_offset_note(day_offset: int) -> str:
        """How far from concert day an anchor sits, in words. Only the sign and
        the magnitude matter here; the exact date is already in the masthead."""
        if day_offset == 0:
            return ''
        days = abs(day_offset)
        if day_offset < 0:
            return ngettext(
                '%(count)d day earlier', '%(count)d days earlier', days
            ) % {'count': days}
        return ngettext(
            '%(count)d day later', '%(count)d days later', days
        ) % {'count': days}

    @staticmethod
    def _build_masthead_facts(
        call_window: CallWindow,
        timeline: list[TimelineEntry],
        project: Project,
        is_report: bool,
    ) -> list[dict[str, Any]]:
        """The band of facts under the title.

        On the day card the fourth cell closes the day rather than repeating the
        venue (which prints in full directly below): the last planned moment,
        taken from the merged timeline so it cannot disagree with it. There is
        no cell when nothing is planned after the downbeat — an end derived from
        summed piece durations would be a fabricated hour stated as a fact.
        """
        facts: list[dict[str, Any]] = [
            {
                'label': pgettext('call sheet', 'Date'),
                'value': DocumentGenerator._format_date(call_window.event_local),
                'note': '',
                'accent': False,
            },
            {
                'label': pgettext('call sheet', 'Call time'),
                'value': DocumentGenerator._format_call_time(call_window),
                'note': (
                    pgettext('call sheet', 'another day')
                    if call_window.crosses_day
                    else ''
                ),
                'accent': True,
            },
            {
                'label': pgettext('call sheet', 'Concert start'),
                'value': DocumentGenerator._format_time(call_window.event_local),
                'note': '',
                'accent': False,
            },
        ]
        if is_report:
            facts.append(
                {
                    'label': pgettext('call sheet', 'Venue'),
                    'value': (
                        project.location.name
                        if project.location
                        else pgettext('call sheet', 'To be arranged')
                    ),
                    'note': '',
                    'accent': False,
                }
            )
            return facts

        end = plan_end(timeline)
        if end is not None and end.point is not None:
            facts.append(
                {
                    'label': pgettext('call sheet', 'Plan ends'),
                    'value': end.time,
                    'note': end.point.title,
                    'accent': False,
                }
            )
        return facts

    @staticmethod
    def _venue_line(venue: Any, venue_address: str) -> str:
        """Venue and street in one line, for the day card's masthead. The reader
        who needs it is standing outside with a phone, not reading a facts
        table."""
        name = venue.name if venue else _('Venue to be arranged')
        if venue_address:
            return f'{name} · {venue_address}'
        return name

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
        """The stored address, minus the country that goes without saying.

        Repetition is dropped by ``logistics.address``, at the import that
        introduces it; what is left here is the one removal that belongs to the
        page rather than to the record — a Polish sheet for a Polish ensemble
        does not need to say the concert is in Poland, while the stored value
        keeps the country because a maps query and a postal use both want it.
        Rows written before that normalisation existed still arrive dirty, which
        is why this composes it rather than assuming it. Nothing to show returns
        nothing: the placeholder is the caller's, because "to be arranged"
        belongs in a facts table and is noise inside a venue line.
        """
        return ', '.join(
            part
            for part in address_parts(formatted_address)
            if part.casefold() not in _IMPLIED_COUNTRIES
        )

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
        named = [
            pgettext('sung language', _LANGUAGE_NAMES[folded])
            if (folded := code.casefold()) in _LANGUAGE_NAMES
            else code
            for code in codes
        ]
        return ' / '.join(dict.fromkeys(named))

    @staticmethod
    def _format_duration(seconds: int | None) -> str:
        # `h`, `min` and `s` are SI symbols, identical in all three locales, so
        # they stay literals: a catalog entry here would only invite someone to
        # translate a unit into something that is no longer one.
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
            return pgettext('call sheet', 'To be arranged')
        if window.crosses_day:
            return window.call_local.strftime('%d.%m, %H:%M')
        return window.call_local.strftime('%H:%M')

    @staticmethod
    def _call_window_warning(window: CallWindow) -> str:
        """What is wrong with the arrival window, for the sheets whose reader can
        go and fix it."""
        if window.problem is CallWindowProblem.NOT_BEFORE:
            return _(
                'The call time does not fall before the concert — check the date '
                'and hour on the project.'
            )
        if window.problem is CallWindowProblem.IMPLAUSIBLE:
            return _(
                'The call time is set more than a day before the concert — it was '
                'most likely entered on the wrong date.'
            )
        return ''

    @staticmethod
    def _format_date(value) -> str:
        # Numeric and language-neutral on purpose: a written-out weekday or
        # month would have to come from Django's bundled catalogs, which
        # capitalise the Polish weekday and the French month where neither
        # language wants it. The document states one date, in the one order all
        # three locales read the same way.
        if not value:
            return pgettext('call sheet', 'To be arranged')
        return value.strftime('%d.%m.%Y')

    @staticmethod
    def _format_time(value) -> str:
        if not value:
            return pgettext('call sheet', 'To be arranged')
        return value.strftime('%H:%M')

    @staticmethod
    def _format_datetime(value) -> str:
        if not value:
            return ''
        return value.strftime('%d.%m.%Y, %H:%M')
