"""
Handles compilation of binary (PDF) and text (CSV/TXT) artifacts.
@architecture Enterprise SaaS 2026

Strictly isolated from core business logic. Acts as an infrastructure adapter
for the rendering engine (WeasyPrint / Django Templates). This design enables
effortless migration to microservices (for example AWS Lambda PDF rendering) in
the future.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, Iterator
from urllib.parse import quote_plus, urljoin
import zoneinfo

import weasyprint
from django.db.models import QuerySet
from django.template.loader import render_to_string
from django.utils import timezone

from core.constants import VoiceLine
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
_VOICE_TYPE_ORDER = {
    VoiceType.SOPRANO: 0,
    VoiceType.MEZZO: 1,
    VoiceType.ALTO: 2,
    VoiceType.COUNTERTENOR: 3,
    VoiceType.TENOR: 4,
    VoiceType.BARITONE: 5,
    VoiceType.BASS: 6,
    VoiceType.CONDUCTOR: 7,
}


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
        base_url: str | None = None,
    ) -> bytes:
        """Compiles an Enterprise-grade PDF Call Sheet binary payload."""
        context = DocumentGenerator._build_call_sheet_context(
            project=project,
            participations=participations,
            crew=crew,
            program=program,
            rehearsals=rehearsals,
            castings=castings,
            base_url=base_url,
        )
        html_string = render_to_string('projects/call_sheet_pdf.html', context)
        return weasyprint.HTML(string=html_string, base_url=base_url).write_pdf()

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
        return weasyprint.HTML(string=html_string).write_pdf()

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
        return weasyprint.HTML(string=html_string).write_pdf()

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
        groups: Dict[str, list[Artist]] = {'Soprany': [], 'Alty': [], 'Tenory': [], 'Basy': [], 'Inne': []}
        
        for p in participations:
            vt = p.artist.voice_type or ''
            if vt.startswith('S'): groups['Soprany'].append(p.artist)
            elif vt.startswith('A') or vt == 'MEZ': groups['Alty'].append(p.artist)
            elif vt.startswith('T') or vt == 'CT': groups['Tenory'].append(p.artist)
            elif vt.startswith('B'): groups['Basy'].append(p.artist)
            else: groups['Inne'].append(p.artist)

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
        base_url: str | None,
    ) -> dict[str, Any]:
        participation_list = list(participations)
        crew_list = list(crew)
        program_items = list(program)
        rehearsal_list = list(rehearsals)
        casting_list = list(castings)

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

        program_cards = [
            DocumentGenerator._build_program_card(item, piece_castings_map.get(item.piece_id, []), base_url)
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
            {'label': 'Call time', 'text': DocumentGenerator._format_time(call_time_local)},
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

        preparation_assets = [
            {
                'label': 'Pelny score projektu',
                'status': 'Gotowe' if project.score_pdf else 'Brak',
                'url': DocumentGenerator._build_file_url(project.score_pdf, base_url),
                'note': 'Kompletny pakiet nut dla calego wydarzenia.',
            },
            {
                'label': 'Spotify playlist',
                'status': 'Gotowe' if project.spotify_playlist_url else 'Brak',
                'url': project.spotify_playlist_url,
                'note': 'Referencyjna kolejnosc i brzmienie programu.',
            },
            {
                'label': 'Nuty per utwor',
                'status': f'{pieces_with_sheet_music}/{len(program_cards)}'
                if program_cards
                else '0/0',
                'note': 'Liczba pozycji z dedykowanym PDF partytury lub materialu.',
            },
            {
                'label': 'Tracki sekcyjne',
                'status': f'{pieces_with_tracks}/{len(program_cards)}'
                if program_cards
                else '0/0',
                'note': 'Pozycje z przygotowanymi trackami do samodzielnego utrwalenia.',
            },
            {
                'label': 'Nagrania referencyjne',
                'status': f'{pieces_with_reference}/{len(program_cards)}'
                if program_cards
                else '0/0',
                'note': 'Utwory z linkiem do YouTube lub Spotify.',
            },
            {
                'label': 'Casting rozpisany',
                'status': f'{pieces_with_casting}/{len(program_cards)}'
                if program_cards
                else '0/0',
                'note': 'Pozycje z gotowym micro-castingiem i odpowiedzialnosciami.',
            },
        ]

        dress_code_entries = []
        if project.dress_code_female:
            dress_code_entries.append({'label': 'Kobiety', 'value': project.dress_code_female})
        if project.dress_code_male:
            dress_code_entries.append({'label': 'Mezczyzni', 'value': project.dress_code_male})
        if not dress_code_entries:
            dress_code_entries.append({'label': 'Dress code', 'value': 'Do potwierdzenia przez management.'})

        contact_directory = []
        if project.conductor:
            contact_directory.append(
                {
                    'name': f'{project.conductor.first_name} {project.conductor.last_name}',
                    'role': 'Dyrygent',
                    'organization': '',
                    'status': 'Kontakt glowny',
                    'phone': project.conductor.phone_number,
                    'email': project.conductor.email,
                }
            )
        for assignment in crew_list:
            contact_directory.append(
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

        return {
            'project': project,
            'generation_date': timezone.now(),
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
            'project_score_url': DocumentGenerator._build_file_url(project.score_pdf, base_url),
            'dress_code_entries': dress_code_entries,
            'preparation_assets': preparation_assets,
            'run_sheet_items': DocumentGenerator._normalize_run_sheet(project.run_sheet),
            'rehearsal_items': [
                DocumentGenerator._build_rehearsal_item(rehearsal, project)
                for rehearsal in rehearsal_list
            ],
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
    def _build_program_card(
        item: ProgramItem,
        piece_castings: list[ProjectPieceCasting],
        base_url: str | None,
    ) -> dict[str, Any]:
        piece = item.piece
        tracks = list(getattr(piece, 'prefetched_tracks', []))
        voice_requirements = list(getattr(piece, 'prefetched_voice_requirements', []))
        reference_links = []
        if piece.reference_recording_youtube:
            reference_links.append({'label': 'YouTube', 'url': piece.reference_recording_youtube})
        if piece.reference_recording_spotify:
            reference_links.append({'label': 'Spotify', 'url': piece.reference_recording_spotify})

        material_badges = []
        if item.is_encore:
            material_badges.append('BIS')
        if piece.sheet_music:
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

        return {
            'order': item.order,
            'title': piece.title,
            'composer': str(piece.composer) if piece.composer else '',
            'arranger': piece.arranger,
            'duration_label': DocumentGenerator._format_duration(piece.estimated_duration),
            'language': piece.language,
            'voicing': piece.voicing,
            'voice_requirements_summary': voice_requirements_summary,
            'description': piece.description,
            'sheet_music_url': DocumentGenerator._build_file_url(piece.sheet_music, base_url),
            'reference_links': reference_links,
            'track_count': len(track_labels),
            'track_summary': ', '.join(track_labels),
            'casting_count': len(piece_castings),
            'material_badges': material_badges,
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
    def _build_rehearsal_item(rehearsal: Rehearsal, project: Project) -> dict[str, Any]:
        rehearsal_timezone = rehearsal.timezone or (
            rehearsal.location.timezone if rehearsal.location else project.timezone
        )
        local_datetime = DocumentGenerator._localize(rehearsal.date_time, rehearsal_timezone)
        invited_participations = list(getattr(rehearsal, 'invited_participations').all())
        scope_label = (
            f'Wybrani artysci ({len(invited_participations)})'
            if invited_participations
            else 'Caly zespol'
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
    def _normalize_run_sheet(run_sheet: list[dict[str, Any]]) -> list[dict[str, str]]:
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
        return normalized

    @staticmethod
    def _build_file_url(file_field: Any, base_url: str | None) -> str:
        if not file_field:
            return ''
        try:
            relative_url = file_field.url
        except ValueError:
            return ''
        if not relative_url:
            return ''
        return urljoin(base_url or '', relative_url)

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
