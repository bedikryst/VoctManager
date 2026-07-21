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

import zoneinfo
from collections import defaultdict
from collections.abc import Iterator
from enum import StrEnum
from typing import Any
from urllib.parse import quote_plus, urljoin

from django.conf import settings
from django.db.models import QuerySet
from django.template.loader import render_to_string
from django.utils import timezone

from core.constants import VoiceLine
from roster.infrastructure.print_fonts import BOOK_FONT_STACK, font_face_css
from roster.models import (
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


# Ordered section pipeline per audience. The template renders exactly these
# sections, in this order (the hero is always rendered first, outside the loop).
# Keep the keys in sync with the ``{% if section == %}`` chain in
# ``projects/call_sheet_pdf.html``.
_SECTIONS: dict[Audience, tuple[str, ...]] = {
    # Singer first: what concerns *them* today, then the day, then the music.
    Audience.CHORISTER: ("personal", "event", "runsheet", "rehearsals", "program"),
    # Maestro first: the musical arc and who sings/gives pitch, then the day.
    Audience.CONDUCTOR: (
        "program",
        "casting",
        "ensemble",
        "runsheet",
        "rehearsals",
        "event",
        "contacts",
    ),
    # Management: full coverage picture, logistics, everything, everyone.
    Audience.PRODUCTION: (
        "metrics",
        "event",
        "runsheet",
        "rehearsals",
        "program",
        "casting",
        "contacts",
        "ensemble",
    ),
}


def _ensemble_name() -> str:
    """Resident-ensemble name for the document chrome, from settings (rebrandable)."""
    return getattr(settings, "SCORE_BOOK_ENSEMBLE_NAME", "VoctEnsemble")


def _doc_lang() -> str:
    """Document language for print hyphenation, from settings."""
    return getattr(settings, "SCORE_BOOK_LANG", "pl")


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
    ) -> bytes:
        """Compiles the concert-day sheet PDF for the given audience.

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
    ) -> dict[str, Any]:
        participation_list = list(participations)
        crew_list = list(crew)
        program_items = list(program)
        rehearsal_list = list(rehearsals)
        casting_list = list(castings)

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
        event_datetime_local = DocumentGenerator._localize(project.date_time, project_timezone)
        call_time_local = DocumentGenerator._localize(project.call_time, project_timezone)
        piece_castings_map = DocumentGenerator._map_castings_by_piece(casting_list)

        confirmed_participations = [
            participation
            for participation in participation_list
            if participation.status == Participation.Status.CONFIRMED
        ]
        pending_participations = [
            participation
            for participation in participation_list
            if participation.status == Participation.Status.INVITED
        ]
        declined_count = sum(
            1
            for participation in participation_list
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
        event_facts = [
            {'label': 'Data wydarzenia', 'text': DocumentGenerator._format_date(event_datetime_local)},
            {'label': 'Zbiórka (call)', 'text': DocumentGenerator._format_time(call_time_local)},
            {'label': 'Start koncertu', 'text': DocumentGenerator._format_time(event_datetime_local)},
            {'label': 'Strefa czasowa', 'text': project_timezone},
            {'label': 'Miejsce', 'text': venue.name if venue else 'Do ustalenia'},
            {
                'label': 'Adres',
                'text': venue.formatted_address if venue and venue.formatted_address else 'Do ustalenia',
            },
        ]
        if venue and venue.category:
            event_facts.insert(
                4,
                {'label': 'Typ lokalizacji', 'text': venue.get_category_display()},
            )
        if project.conductor:
            event_facts.append({'label': 'Prowadzenie', 'text': str(project.conductor)})

        # Preparation-readiness meters are a management concern; singers get a
        # short "what to open" list, managers get the full coverage picture.
        preparation_assets = DocumentGenerator._build_preparation_assets(
            project, program_cards, base_url, audience,
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

        rehearsal_items = [
            DocumentGenerator._build_rehearsal_item(rehearsal, project, recipient)
            for rehearsal in rehearsal_list
        ]
        # A singer only sees rehearsals that concern them (whole-ensemble calls
        # plus any they were personally invited to).
        if is_chorister:
            rehearsal_items = [item for item in rehearsal_items if item['is_for_me']]

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
            'sections': list(_SECTIONS[audience]),
            'is_chorister': is_chorister,
            'is_conductor': audience == Audience.CONDUCTOR,
            'is_production': audience == Audience.PRODUCTION,
            'ensemble_name': _ensemble_name(),
            'doc_lang': _doc_lang(),
            'font_css': font_face_css(),
            'font_stack': BOOK_FONT_STACK,
            'greeting': greeting,
            'personal': personal,
            'generation_date': timezone.now(),
            # A concert-day sheet gets reprinted as the plan changes; an "as of"
            # stamp on the page (not just the file metadata) is what stops people
            # working off a stale copy. Localised to the project timezone so it
            # reads in the same clock as the rest of the sheet.
            'generation_label': DocumentGenerator._format_datetime(
                DocumentGenerator._localize(timezone.now(), project_timezone)
            ),
            'event_datetime_local': event_datetime_local,
            'call_time_local': call_time_local,
            'event_date_label': DocumentGenerator._format_date(event_datetime_local),
            'event_time_label': DocumentGenerator._format_time(event_datetime_local),
            'call_time_label': DocumentGenerator._format_time(call_time_local),
            'call_buffer_label': DocumentGenerator._format_call_buffer(
                call_time_local,
                event_datetime_local,
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
            'run_sheet_items': DocumentGenerator._normalize_run_sheet(project.run_sheet),
            'rehearsal_items': rehearsal_items,
            'program_cards': program_cards,
            'casting_sections': [
                DocumentGenerator._build_casting_section(item, piece_castings_map.get(item.piece_id, []))
                for item in program_items
            ],
            'contact_directory': contact_directory,
            'ensemble_sections': DocumentGenerator._group_participations_by_voice(
                confirmed_participations
            ),
            'pending_sections': DocumentGenerator._group_participations_by_voice(
                pending_participations
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

        return {
            'full_name': f'{artist.first_name} {artist.last_name}',
            'voice_label': artist.get_voice_type_display(),
            'status_label': recipient.get_status_display(),
            'is_confirmed': recipient.status == Participation.Status.CONFIRMED,
            'assignments': assignments,
            'gives_pitch_anywhere': any(entry['gives_pitch'] for entry in assignments),
            'section_mates': section_mates,
            'section_size': len(section_mates) + 1,
        }

    @staticmethod
    def _build_preparation_assets(
        project: Project,
        program_cards: list[dict[str, Any]],
        base_url: str | None,
        audience: Audience,
        pieces_with_sheet_music: int,
        pieces_with_tracks: int,
        pieces_with_reference: int,
        pieces_with_casting: int,
    ) -> list[dict[str, Any]]:
        total = len(program_cards)
        # Singers get the two things they actually open before a concert; the
        # coverage counters ("12/14 pieces have tracks") are a manager's metric.
        singer_assets = [
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
        ]
        if audience != Audience.PRODUCTION:
            return singer_assets

        return [
            *singer_assets,
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
    ) -> dict[str, Any]:
        piece = item.piece
        tracks = list(getattr(piece, 'prefetched_tracks', []))
        voice_requirements = list(getattr(piece, 'prefetched_voice_requirements', []))
        editions = list(getattr(piece, 'prefetched_editions', None) or piece.editions.all())
        recordings = list(getattr(piece, 'prefetched_recordings', None) or piece.recordings.all())

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
        reference_links: list[dict[str, str]] = []
        for rec in sorted(recordings, key=lambda r: (0 if r.is_featured else 1, r.get_source_display())):
            if not rec.url:
                continue
            reference_links.append({'label': rec.get_source_display(), 'url': rec.url})

        material_badges = []
        if item.is_encore:
            material_badges.append('BIS')
        if sheet_music_url:
            material_badges.append('Nuty PDF')
        if tracks:
            material_badges.append('Tracki')
        if reference_links:
            material_badges.append('Nagranie referencyjne')
        if piece_castings:
            material_badges.append('Casting')

        voice_requirements_summary = ', '.join(
            f'{requirement.quantity}x {requirement.get_voice_line_display()}'
            for requirement in voice_requirements
        )
        track_labels = [track.get_voice_part_display() for track in tracks]

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
            'language': piece.language,
            'voicing': piece.voicing,
            'voice_requirements_summary': voice_requirements_summary,
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
                    'singers': ', '.join(singers) if singers else 'Unassigned',
                    'pitch_team': ', '.join(pitch_team),
                    'notes': '; '.join(dict.fromkeys(notes)),
                }
            )

        return {
            'order': item.order,
            'title': item.piece.title,
            'rows': rows,
        }

    @staticmethod
    def _build_rehearsal_item(
        rehearsal: Rehearsal,
        project: Project,
        recipient: Participation | None,
    ) -> dict[str, Any]:
        rehearsal_timezone = rehearsal.timezone or (
            rehearsal.location.timezone if rehearsal.location else project.timezone
        )
        local_datetime = DocumentGenerator._localize(rehearsal.date_time, rehearsal_timezone)
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
            'scope_label': scope_label,
            'is_for_me': is_for_me,
            'location_name': location.name if location else 'Do ustalenia',
            'location_address': (
                location.formatted_address
                if location and location.formatted_address
                else 'Do ustalenia'
            ),
            'map_url': DocumentGenerator._build_map_url(location),
        }

    @staticmethod
    def _group_participations_by_voice(
        participations: list[Participation],
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
                    'members': members,
                }
            )
        return ordered_sections

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
                            or item.get('task')
                            or item.get('activity')
                            or item.get('name')
                            or 'Timeline entry'
                        )
                    ).strip(),
                    'description': str(item.get('description') or item.get('notes') or '').strip(),
                    'location': str(item.get('location') or '').strip(),
                }
            )
        # The editor and overview widget sort chronologically; the PDF must match,
        # so a manager entering points out of order still prints a clean timeline.
        normalized.sort(key=lambda entry: (entry['time'] == '', entry['time']))
        return normalized

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
    def _localize(value, timezone_name: str | None):
        if not value:
            return None
        try:
            target_timezone = zoneinfo.ZoneInfo(timezone_name or 'UTC')
        except zoneinfo.ZoneInfoNotFoundError:
            target_timezone = zoneinfo.ZoneInfo('UTC')
        return timezone.localtime(value, target_timezone)

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
    def _format_call_buffer(call_time, event_time) -> str:
        if not call_time or not event_time:
            return ''
        buffer_minutes = int((event_time - call_time).total_seconds() // 60)
        if buffer_minutes <= 0:
            return ''
        hours, minutes = divmod(buffer_minutes, 60)
        if hours:
            return f'{hours} h {minutes:02d} min'
        return f'{minutes} min'

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
