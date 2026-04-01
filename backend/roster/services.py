# roster/services.py
# ==========================================
# Roster Business Logic (Service Layer)
# ==========================================
"""
Domain-driven service layer for the Roster application.
@architecture Enterprise SaaS 2026

Encapsulates all core business rules, PDF/CSV generation, and complex 
database transactions. Exposes pure Python functions that are completely 
decoupled from Django's HTTP Request/Response cycle, ensuring testability 
and asynchronous compatibility (e.g., via Celery).
"""

import io
import weasyprint
from typing import Iterator, Dict, Any, Optional

from django.utils import timezone
from django.template.loader import render_to_string
from django.db.models import QuerySet
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.contrib.auth.models import User
from django.conf import settings
from .models import (
    Project, Participation, CrewAssignment, ProgramItem, 
    Attendance, Rehearsal, ProjectPieceCasting, Artist
)

# --- 1. ARTIST LOGIC ---

def provision_artist_with_user_account(*, first_name: str, last_name: str, email: str, **artist_kwargs) -> Artist:
    """
    Business logic for onboarding a new artist.
    Automatically provisions a linked Django User account with sequential username collision resolution.
    """
    base_username = f"{first_name[0].lower()}{last_name.lower()}"
    username = base_username.replace(' ', '')
    counter = 2
    
    # Resolve username collisions
    while User.objects.filter(username=username).exists():
        username = f"{base_username}{counter}"
        counter += 1
        
    with transaction.atomic():
        user = User.objects.create(username=username, email=email)
        default_password = getattr(settings, 'DEFAULT_ARTIST_PASSWORD', 'fallback_secure_password123')  
        user.set_password(default_password) 
        user.save()
        
        artist = Artist.objects.create(
            user=user,
            first_name=first_name,
            last_name=last_name,
            email=email,
            **artist_kwargs
        )
        
    return artist

# --- 2. PROJECT & PARTICIPATION LOGIC ---

def provision_project_creator_participation(*, project: Project, user: Any) -> None:
    """Automatically assigns the initializing user to the project as a confirmed artist."""
    if hasattr(user, 'artist_profile'):
        Participation.objects.create(
            artist=user.artist_profile,
            project=project,
            status=Participation.Status.CONFIRMED,
            fee=0 
        )

def update_project_bulk_fee(*, project_id: str, new_fee: int) -> int:
    """Executes a high-performance batch SQL UPDATE for remuneration logic."""
    return Participation.objects.filter(project_id=project_id).update(
        fee=new_fee,
        updated_at=timezone.now()
    )

def handle_soft_deleted_participation(*, artist_id: str, project_id: str) -> Optional[Participation]:
    """Detects and restores a soft-deleted participation record if it exists."""
    deleted_participation = Participation.all_objects.filter(
        artist_id=artist_id, 
        project_id=project_id, 
        is_deleted=True
    ).first()

    if deleted_participation:
        deleted_participation.restore()
        return deleted_participation
    return None

def cascade_delete_program_item(*, program_item: ProgramItem) -> None:
    """Safely removes a program item and resolves micro-casting constraints."""
    ProjectPieceCasting.objects.filter(
        piece=program_item.piece,
        participation__project=program_item.project
    ).delete() 
    program_item.delete()


# --- 2. VALIDATION SERVICES ---

def validate_attendance_write(*, user: Any, participation: Participation, rehearsal: Rehearsal) -> None:
    """Enforces role-based access control and domain rules for attendance tracking."""
    if participation.project_id != rehearsal.project_id:
        raise ValidationError("Attendance can only be recorded for a rehearsal within the same project.")

    if user.is_superuser:
        return

    if participation.artist.user_id != user.id:
        raise PermissionDenied("Możesz zapisywać tylko swoje własne zgłoszenia obecności.")

    invited_ids = set(rehearsal.invited_participations.values_list('id', flat=True))
    if invited_ids and participation.id not in invited_ids:
        raise PermissionDenied("Nie możesz zgłosić obecności dla próby, na którą nie zostałeś wezwany.")


# --- 3. DOCUMENT GENERATION SERVICES (PDF/CSV/TXT) ---

def generate_call_sheet_pdf(*, project: Project) -> bytes:
    """Compiles an Enterprise-grade PDF Call Sheet binary payload via Weasyprint."""
    context = {
        'project': project,
        'participations': Participation.objects.filter(project=project).select_related('artist').order_by('artist__last_name'),
        'crew': CrewAssignment.objects.filter(project=project).select_related('collaborator'),
        'program': ProgramItem.objects.filter(project=project).select_related('piece').order_by('order'),
        'generation_date': timezone.now()
    }

    html_string = render_to_string('projects/call_sheet_pdf.html', context)
    return weasyprint.HTML(string=html_string).write_pdf()

def generate_zaiks_csv_iterator(*, program_items: QuerySet[ProgramItem]) -> Iterator[str]:
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

def generate_dtp_export_text(*, project: Project) -> str:
    """Generates a cleanly formatted text artifact tailored for Graphic Design (DTP)."""
    participations = Participation.objects.filter(project=project).select_related('artist').order_by('artist__last_name')

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

def generate_participation_contract_pdf(*, participation: Participation) -> bytes:
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

def generate_crew_contract_pdf(*, assignment: CrewAssignment) -> bytes:
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