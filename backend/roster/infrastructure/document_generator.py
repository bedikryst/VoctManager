# roster/infrastructure/document_generator.py
# ==========================================
# Roster Infrastructure: Document Generation
# ==========================================
"""
Handles compilation of binary (PDF) and text (CSV/TXT) artifacts.
@architecture Enterprise SaaS 2026

Strictly isolated from core business logic. Acts as an infrastructure adapter 
for the rendering engine (WeasyPrint / Django Templates). This design enables 
effortless migration to microservices (e.g., AWS Lambda for PDF generation) in the future.
"""

import weasyprint
from typing import Iterator, Dict
from django.utils import timezone
from django.template.loader import render_to_string
from django.db.models import QuerySet

from roster.models import Project, Participation, CrewAssignment, ProgramItem, Artist


class DocumentGenerator:
    """Static utility class for compiling domain entities into exportable artifacts."""

    @staticmethod
    def generate_call_sheet_pdf(project: Project, participations: QuerySet[Participation], crew: QuerySet[CrewAssignment], program: QuerySet[ProgramItem]) -> bytes:
        """Compiles an Enterprise-grade PDF Call Sheet binary payload."""
        context = {
            'project': project,
            'participations': participations,
            'crew': crew,
            'program': program,
            'generation_date': timezone.now()
        }
        html_string = render_to_string('projects/call_sheet_pdf.html', context)
        return weasyprint.HTML(string=html_string).write_pdf()

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