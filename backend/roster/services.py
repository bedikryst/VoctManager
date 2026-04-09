# roster/services.py
# ==========================================
# Roster Business Logic (Service Layer)
# ==========================================
"""
Domain-driven service layer for the Roster application.
@architecture Enterprise SaaS 2026

Encapsulates all database transactions, state mutations, and side-effects (e.g., Celery notifications).
Views MUST delegate all business logic to these functions.
"""
import unicodedata
from typing import Optional, List, Dict, Any
from django.utils import timezone
from django.db import transaction
from django.contrib.auth import get_user_model
from django.conf import settings

from notifications.tasks import send_notification_task, send_bulk_notifications_task
from notifications.models import NotificationType, NotificationLevel

from .models import (
    Artist, Project, Participation, ProgramItem, 
    ProjectPieceCasting, Rehearsal, Attendance, CrewAssignment
)
from .dtos import ArtistCreateDTO, AttendanceRecordDTO, ProjectBulkFeeDTO, ParticipationRestoreDTO
from .exceptions import ArtistProvisioningException, AttendanceValidationException, ParticipationException

User = get_user_model()


# --- ARTIST & USER PROVISIONING ---

def provision_artist_with_user_account(dto: ArtistCreateDTO) -> Artist:
    if User.objects.filter(email=dto.email).exists():
        raise ArtistProvisioningException(f"Account with email {dto.email} already exists.")
    
    raw_username = f"{dto.first_name[0].lower()}{dto.last_name.lower()}".replace(' ', '')
    base_username = unicodedata.normalize('NFKD', raw_username).encode('ASCII', 'ignore').decode('utf-8')
    
    username = base_username
    counter = 2
    while User.objects.filter(username=username).exists():
        username = f"{base_username}{counter}"
        counter += 1
        
    with transaction.atomic():
        user = User.objects.create(username=username, email=dto.email)
        user.set_password(getattr(settings, 'DEFAULT_ARTIST_PASSWORD', 'secure123')) 
        user.save()
        
        artist = Artist.objects.create(
            user=user, 
            first_name=dto.first_name, 
            last_name=dto.last_name, 
            email=dto.email, 
            voice_type=dto.voice_type, 
            phone_number=dto.phone_number or "",               
            sight_reading_skill=dto.sight_reading_skill, 
            vocal_range_bottom=dto.vocal_range_bottom or "",   
            vocal_range_top=dto.vocal_range_top or ""          
        )
    return artist


# --- PROJECT & PARTICIPATION MANAGEMENT ---

def create_project_with_creator(user: User, validated_data: Dict[str, Any]) -> Project:
    with transaction.atomic():
        project = Project.objects.create(**validated_data)
        if hasattr(user, 'artist_profile'):
            Participation.objects.create(
                artist=user.artist_profile, 
                project=project,
                status=Participation.Status.CONFIRMED, 
                fee=0
            )
    return project

def create_participation(validated_data: Dict[str, Any]) -> Participation:
    with transaction.atomic():
        participation = Participation.objects.create(**validated_data)
        
        if participation.artist.user_id:
            transaction.on_commit(lambda: send_notification_task.delay(
                recipient_id=str(participation.artist.user_id),
                notification_type=NotificationType.PROJECT_INVITATION,
                level=NotificationLevel.INFO,
                metadata={
                    "project_id": str(participation.project_id),
                    "project_name": participation.project.title,
                }
            ))
    return participation

def update_project_bulk_fee(dto: ProjectBulkFeeDTO) -> int:
    if dto.new_fee < 0:
        raise ParticipationException("Fee cannot be negative.")
    return Participation.objects.filter(project_id=dto.project_id).update(
        fee=dto.new_fee, updated_at=timezone.now()
    )

def handle_soft_deleted_participation(dto: ParticipationRestoreDTO) -> Optional[Participation]:
    """Restores a soft-deleted participation AND triggers a notification."""
    deleted = Participation.all_objects.filter(artist_id=dto.artist_id, project_id=dto.project_id, is_deleted=True).first()
    if deleted:
        with transaction.atomic():
            deleted.restore()
            
            if deleted.artist.user_id:
                transaction.on_commit(lambda: send_notification_task.delay(
                    recipient_id=str(deleted.artist.user_id),
                    notification_type=NotificationType.PROJECT_INVITATION,
                    level=NotificationLevel.INFO,
                    metadata={
                        "project_id": str(deleted.project_id),
                        "project_name": deleted.project.title,
                        "message": "You have been re-added to the project."
                    }
                ))
        return deleted
    return None

def delete_participation(participation: Participation) -> None:
    """Safely removes an artist from a project and notifies them."""
    user_id = participation.artist.user_id
    project_name = participation.project.title
    
    with transaction.atomic():
        participation.delete()  # Uruchomi soft-delete z EnterpriseBaseModel
        
        if user_id:
            transaction.on_commit(lambda: send_notification_task.delay(
                recipient_id=str(user_id),
                notification_type=NotificationType.PROJECT_UPDATED,
                level=NotificationLevel.WARNING,
                metadata={
                    "project_name": project_name,
                    "message": "You have been removed from this project."
                }
            ))


# --- REHEARSAL MANAGEMENT ---

def create_rehearsal(validated_data: Dict[str, Any], invited_participations: Optional[List[Participation]] = None) -> Rehearsal:
    with transaction.atomic():
        rehearsal = Rehearsal.objects.create(**validated_data)
        if invited_participations:
            rehearsal.invited_participations.set(invited_participations)

        # Broadcast notification
        qs = invited_participations if invited_participations else Participation.objects.filter(project=rehearsal.project)
        recipient_ids = [str(p.artist.user_id) for p in qs if p.artist.user_id]
        
        if recipient_ids:
            transaction.on_commit(lambda: send_bulk_notifications_task.delay(
                recipient_ids=recipient_ids,
                notification_type=NotificationType.REHEARSAL_SCHEDULED,
                level=NotificationLevel.INFO,
                metadata={
                    "rehearsal_id": str(rehearsal.id),
                    "project_id": str(rehearsal.project_id),
                    "project_name": rehearsal.project.title
                }
            ))
    return rehearsal

def update_rehearsal(rehearsal: Rehearsal, validated_data: Dict[str, Any], invited_participations: Optional[List[Participation]] = None) -> Rehearsal:
    with transaction.atomic():
        for attr, value in validated_data.items():
            setattr(rehearsal, attr, value)
        rehearsal.save()
        
        if invited_participations is not None:
            rehearsal.invited_participations.set(invited_participations)

        # Notify about schedule change
        qs = rehearsal.invited_participations.all()
        if not qs.exists():
            qs = Participation.objects.filter(project=rehearsal.project)
            
        recipient_ids = [str(p.artist.user_id) for p in qs if p.artist.user_id]
        
        if recipient_ids:
            transaction.on_commit(lambda: send_bulk_notifications_task.delay(
                recipient_ids=recipient_ids,
                notification_type=NotificationType.REHEARSAL_UPDATED,
                level=NotificationLevel.WARNING,
                metadata={
                    "rehearsal_id": str(rehearsal.id),
                    "project_name": rehearsal.project.title
                }
            ))
    return rehearsal

def delete_rehearsal(rehearsal: Rehearsal) -> None:
    """Cancels a rehearsal and blasts an urgent notification to all expected attendees."""
    qs = rehearsal.invited_participations.all()
    if not qs.exists():
        qs = Participation.objects.filter(project=rehearsal.project)
        
    recipient_ids = [str(p.artist.user_id) for p in qs if p.artist.user_id]
    project_name = rehearsal.project.title
    
    with transaction.atomic():
        rehearsal.delete()
        
        if recipient_ids:
            transaction.on_commit(lambda: send_bulk_notifications_task.delay(
                recipient_ids=recipient_ids,
                notification_type=NotificationType.REHEARSAL_CANCELLED,
                level=NotificationLevel.URGENT, # URGENT pokaże się na czerwono
                metadata={
                    "project_name": project_name,
                    "message": "A scheduled rehearsal has been cancelled."
                }
            ))

# --- ATTENDANCE & HR ---

def validate_attendance_write(dto: AttendanceRecordDTO) -> None:
    try:
        participation = Participation.objects.select_related('artist').get(id=dto.participation_id)
        rehearsal = Rehearsal.objects.prefetch_related('invited_participations').get(id=dto.rehearsal_id)
    except (Participation.DoesNotExist, Rehearsal.DoesNotExist):
        raise AttendanceValidationException("Record not found.")

    if participation.project_id != rehearsal.project_id:
        raise AttendanceValidationException("Project mismatch between participation and rehearsal.")

    if dto.is_superuser: return

    if participation.artist.user_id != dto.requesting_user_id:
        raise AttendanceValidationException("Can only record self-attendance.")

    invited_ids = set(rehearsal.invited_participations.values_list('id', flat=True))
    if invited_ids and participation.id not in invited_ids:
        raise AttendanceValidationException("Artist not invited to this rehearsal.")

def update_attendance_status(attendance: Attendance, new_status: str, is_admin: bool) -> Attendance:
    with transaction.atomic():
        attendance.status = new_status
        attendance.save(update_fields=['status', 'updated_at'])
        
        user_id = attendance.participation.artist.user_id
        if not user_id:
            return attendance

        # Admin approving/rejecting triggers info to the artist
        if is_admin and new_status in ['EXCUSED', 'ABSENT']:
            notif_type = NotificationType.ABSENCE_APPROVED if new_status == 'EXCUSED' else NotificationType.ABSENCE_REJECTED
            transaction.on_commit(lambda: send_notification_task.delay(
                recipient_id=str(user_id),
                notification_type=notif_type,
                level=NotificationLevel.INFO,
                metadata={"rehearsal_id": str(attendance.rehearsal_id)}
            ))
            
        # Artist requesting absence triggers info to admins (or implicitly recorded)
        elif not is_admin and new_status == 'ABSENT':
            # Example hook: Could send bulk notification to HR admins here
            pass
            
    return attendance


# --- PROGRAM, CASTING & CREW ---

def cascade_delete_program_item(program_item: ProgramItem) -> None:
    with transaction.atomic():
        ProjectPieceCasting.objects.filter(
            piece=program_item.piece, participation__project=program_item.project
        ).delete() 
        program_item.delete()

def create_piece_casting(validated_data: Dict[str, Any]) -> ProjectPieceCasting:
    with transaction.atomic():
        casting = ProjectPieceCasting.objects.create(**validated_data)
        
        user_id = casting.participation.artist.user_id
        if user_id:
            transaction.on_commit(lambda: send_notification_task.delay(
                recipient_id=str(user_id),
                notification_type=NotificationType.PIECE_CASTING_ASSIGNED,
                level=NotificationLevel.INFO,
                metadata={
                    "piece_id": str(casting.piece_id),
                    "piece_title": casting.piece.title,
                    "voice_line": casting.voice_line
                }
            ))
    return casting

def update_piece_casting(casting: ProjectPieceCasting, validated_data: Dict[str, Any]) -> ProjectPieceCasting:
    """Updates vocal assignment and notifies the artist."""
    with transaction.atomic():
        for attr, value in validated_data.items():
            setattr(casting, attr, value)
        casting.save()
        
        user_id = casting.participation.artist.user_id
        if user_id:
            transaction.on_commit(lambda: send_notification_task.delay(
                recipient_id=str(user_id),
                notification_type=NotificationType.PIECE_CASTING_UPDATED,
                level=NotificationLevel.INFO,
                metadata={
                    "piece_id": str(casting.piece_id),
                    "piece_title": casting.piece.title,
                    "voice_line": casting.voice_line
                }
            ))
    return casting

def delete_piece_casting(casting: ProjectPieceCasting) -> None:
    """Removes an artist from a specific piece/divisi and notifies them."""
    user_id = casting.participation.artist.user_id
    piece_title = casting.piece.title
    
    with transaction.atomic():
        casting.delete()
        
        if user_id:
            transaction.on_commit(lambda: send_notification_task.delay(
                recipient_id=str(user_id),
                notification_type=NotificationType.PIECE_CASTING_UPDATED,
                level=NotificationLevel.WARNING,
                metadata={
                    "piece_title": piece_title,
                    "message": f"Your casting for '{piece_title}' has been removed."
                }
            ))

def create_crew_assignment(validated_data: Dict[str, Any]) -> CrewAssignment:
    with transaction.atomic():
        assignment = CrewAssignment.objects.create(**validated_data)
        
        user_id = assignment.collaborator.user_id
        if user_id:
            transaction.on_commit(lambda: send_notification_task.delay(
                recipient_id=str(user_id),
                notification_type=NotificationType.CREW_ASSIGNED,
                level=NotificationLevel.INFO,
                metadata={
                    "project_id": str(assignment.project_id),
                    "project_name": assignment.project.title,
                    "role": assignment.role
                }
            ))
    return assignment