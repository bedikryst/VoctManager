# roster/services.py
# ==========================================
# Roster Business Logic (Domain Services)
# Standard: Enterprise SaaS 2026
# ==========================================
"""
Domain-driven service layer for the Roster application.
Encapsulates all database transactions, state mutations, and side-effects.
Views MUST delegate all business logic to these stateless classes.
"""
import logging
import unicodedata
from typing import Optional, List, Dict, Any
from django.conf import settings
from django.utils import timezone
from django.db import transaction
from django.contrib.auth import get_user_model
from notifications.email_service import EmailType

from core.models import UserProfile
from notifications.tasks import send_notification_task, send_bulk_notifications_task
from notifications.email_tasks import send_transactional_email_task
from notifications.models import NotificationType, NotificationLevel
from notifications.dtos import (
    ProjectInvitationMetadata, 
    ProjectUpdatedMetadata,
    RehearsalScheduledMetadata,
    RehearsalUpdatedMetadata,
    RehearsalCancelledMetadata,
    PieceCastingMetadata,
    CrewAssignedMetadata,
    AbsenceStatusMetadata
)

from core.services import UserIdentityService
from .models import (
    Artist, Project, Participation, ProgramItem, 
    ProjectPieceCasting, Rehearsal, Attendance, CrewAssignment
)
from .dtos import ArtistCreateDTO, AttendanceRecordDTO, ProjectBulkFeeDTO, ParticipationRestoreDTO
from .exceptions import ArtistProvisioningException, AttendanceValidationException, ParticipationException

logger = logging.getLogger(__name__)
User = get_user_model()


class ArtistHRService:
    """Service handling HR operations, onboarding, and artist lifecycles."""

    @staticmethod
    def provision_artist(dto: ArtistCreateDTO) -> Artist:
        if User.objects.filter(email__iexact=dto.email).exists() or \
           Artist.objects.filter(email__iexact=dto.email, is_deleted=False).exists():
             raise ArtistProvisioningException(f"Account with email {dto.email} already exists.")
        
        raw_username = f"{dto.first_name[0].lower()}{dto.last_name.lower()}".replace(' ', '')
        base_username = unicodedata.normalize('NFKD', raw_username).encode('ASCII', 'ignore').decode('utf-8')
        
        username = base_username
        counter = 2
        while User.objects.filter(username=username).exists():
            username = f"{base_username}{counter}"
            counter += 1
            
        with transaction.atomic():
            # 1. Create User
            user = User.objects.create(username=username, email=dto.email, is_active=False)
            user.set_unusable_password() 
            user.save()
            
            # 2. EXPLICITLY Create Profile (No more reliance on hidden signals)
            profile_lang = getattr(dto, 'language', 'pl')
            profile = UserProfile.objects.create(
                user=user,
                language=profile_lang
            )
            
            # 3. Create Artist Details
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

            # 4. Generate Tokens
            payload = UserIdentityService.generate_activation_token_payload(user)
            activation_link = (
                f"{settings.CORS_ALLOWED_ORIGINS[0]}/activate"
                f"?uid={payload['uidb64']}&token={payload['token']}"
            )

            # 5. Dispatch Operational Email
            transaction.on_commit(
                lambda: send_transactional_email_task.delay(
                    recipient_email=user.email,
                    subject="Welcome to VoctEnsemble - Activate Your Account",
                    template_name="account_activation",
                    context={
                        "first_name": artist.first_name,
                        "activation_link": activation_link,
                    },
                    fallback_language=profile_lang,
                    email_type=EmailType.OPERATIONAL
                )
            )
            
            logger.info(f"Successfully provisioned artist and dispatched invite for: {dto.email}")
            return artist
    
    @staticmethod
    def archive_artist(artist: Artist) -> None:
        """Przenosi artystę do archiwum i blokuje mu możliwość logowania do aplikacji."""
        with transaction.atomic():
            # 1. Soft Delete Artysty (ukrywa go na listach)
            artist.delete() 
            
            # 2. Blokada logowania (Zatrzymuje autoryzację JWT/Sesji)
            if artist.user_id:
                user = artist.user
                user.is_active = False
                user.save(update_fields=['is_active'])
            
            logger.info(f"Artist {artist.email} archived and user access revoked.")

    @staticmethod
    def restore_artist(artist: Artist) -> None:
        """Przywraca artystę z archiwum i odblokowuje mu dostęp."""
        with transaction.atomic():
            # 1. Przywrócenie Artysty (odkręcenie Soft Delete)
            artist.restore() 
            
            # 2. Odblokowanie logowania
            if artist.user_id:
                user = artist.user
                user.is_active = True
                user.save(update_fields=['is_active'])
            
            logger.info(f"Artist {artist.email} restored and user access granted.")


class ProjectManagementService:
    """Service handling the lifecycle of concert projects and artist participations."""

    @staticmethod
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
            logger.info(f"Project '{project.title}' created by {user.email}")
            return project

    @staticmethod
    def update_project(project: Project, validated_data: Dict[str, Any]) -> Project:
        FIELD_NAMES = {
            "title": "Title", "date_time": "Date", "location": "Location",
            "call_time": "Call-time", "status": "Status", 
            "dress_code_male": "Dress Code", "dress_code_female": "Dress Code"
        }
        changes = []
        
        with transaction.atomic():
            for attr, value in validated_data.items():
                old_value = getattr(project, attr)
                if old_value != value:
                    changes.append(FIELD_NAMES.get(attr, attr))
                setattr(project, attr, value)
                
            project.save()

            qs = Participation.objects.filter(project=project, is_deleted=False).select_related('artist')
            recipient_ids = [str(p.artist.user_id) for p in qs if p.artist.user_id]
            
            if recipient_ids and changes:
                unique_changes = list(set(changes))
                # ENTERPRISE: Instantiate Pydantic model and dump to JSON-serializable dict
                metadata = ProjectUpdatedMetadata(
                    project_id=project.id,
                    project_name=project.title,
                    message="Project details have been updated.",
                    changes=unique_changes
                ).model_dump(mode="json")
                
                level = NotificationLevel.URGENT if any(k in changes for k in ["Date", "Call-time"]) else NotificationLevel.WARNING
                
                transaction.on_commit(lambda: send_bulk_notifications_task.delay(
                    recipient_ids=recipient_ids,
                    notification_type=NotificationType.PROJECT_UPDATED,
                    level=level,
                    metadata=metadata
                ))
                
        return project

    @staticmethod
    def create_participation(validated_data: Dict[str, Any]) -> Participation:
        with transaction.atomic():
            participation = Participation.objects.create(**validated_data)
            
            if participation.artist.user_id:
                metadata = ProjectInvitationMetadata(
                    project_id=participation.project_id,
                    project_name=participation.project.title,
                ).model_dump(mode="json")
                
                transaction.on_commit(lambda: send_notification_task.delay(
                    recipient_id=str(participation.artist.user_id),
                    notification_type=NotificationType.PROJECT_INVITATION,
                    level=NotificationLevel.INFO,
                    metadata=metadata
                ))
        return participation

    @staticmethod
    def delete_participation(participation: Participation) -> None:
        user_id = participation.artist.user_id
        project_name = participation.project.title
        
        with transaction.atomic():
            participation.delete()
            
            if user_id:
                metadata = ProjectUpdatedMetadata(
                    project_name=project_name,
                    message="You have been removed from this project."
                ).model_dump(mode="json")
                
                transaction.on_commit(lambda: send_notification_task.delay(
                    recipient_id=str(user_id),
                    notification_type=NotificationType.PROJECT_UPDATED,
                    level=NotificationLevel.WARNING,
                    metadata=metadata
                ))

    @staticmethod
    def handle_soft_deleted_participation(dto: ParticipationRestoreDTO) -> Optional[Participation]:
        deleted = Participation.all_objects.filter(artist_id=dto.artist_id, project_id=dto.project_id, is_deleted=True).first()
        if deleted:
            with transaction.atomic():
                deleted.restore()
                if deleted.artist.user_id:
                    metadata = ProjectInvitationMetadata(
                        project_id=deleted.project_id,
                        project_name=deleted.project.title,
                        message="You have been re-added to the project."
                    ).model_dump(mode="json")
                    
                    transaction.on_commit(lambda: send_notification_task.delay(
                        recipient_id=str(deleted.artist.user_id),
                        notification_type=NotificationType.PROJECT_INVITATION,
                        level=NotificationLevel.INFO,
                        metadata=metadata
                    ))
            return deleted
        return None

    @staticmethod
    def update_project_bulk_fee(dto: ProjectBulkFeeDTO) -> int:
        if dto.new_fee < 0:
            raise ParticipationException("Fee cannot be negative.")
        
        count = Participation.objects.filter(project_id=dto.project_id, is_deleted=False).update(
            fee=dto.new_fee, updated_at=timezone.now()
        )
        logger.info(f"Bulk fee updated to {dto.new_fee} for project {dto.project_id} ({count} participants affected).")
        return count


class RehearsalOperationsService:
    @staticmethod
    def schedule_rehearsal(validated_data: Dict[str, Any], invited_participations: Optional[List[Participation]] = None) -> Rehearsal:
        with transaction.atomic():
            rehearsal = Rehearsal.objects.create(**validated_data)
            if invited_participations:
                rehearsal.invited_participations.set(invited_participations)

            qs = invited_participations if invited_participations else Participation.objects.filter(project=rehearsal.project, is_deleted=False)
            recipient_ids = [str(p.artist.user_id) for p in qs if p.artist.user_id]
            
            if recipient_ids:
                metadata = RehearsalScheduledMetadata(
                    rehearsal_id=rehearsal.id,
                    project_id=rehearsal.project_id,
                    project_name=rehearsal.project.title
                ).model_dump(mode="json")
                
                transaction.on_commit(lambda: send_bulk_notifications_task.delay(
                    recipient_ids=recipient_ids,
                    notification_type=NotificationType.REHEARSAL_SCHEDULED,
                    level=NotificationLevel.INFO,
                    metadata=metadata
                ))
        return rehearsal

    @staticmethod
    def update_rehearsal(rehearsal: Rehearsal, validated_data: Dict[str, Any], invited_participations: Optional[List[Participation]] = None) -> Rehearsal:
        FIELD_NAMES = {
            "date_time": "Date / Time", "location": "Location",
            "focus": "Focus / Plan", "is_mandatory": "Mandatory Status"
        }
        changes = []
        
        with transaction.atomic():
            for attr, value in validated_data.items():
                old_value = getattr(rehearsal, attr)
                if old_value != value:
                    changes.append(FIELD_NAMES.get(attr, attr))
                setattr(rehearsal, attr, value)
                
            rehearsal.save()

            if invited_participations is not None:
                rehearsal.invited_participations.set(invited_participations)

            qs = rehearsal.invited_participations.all()
            if not qs.exists():
                qs = Participation.objects.filter(project=rehearsal.project, is_deleted=False)
                
            recipient_ids = [str(p.artist.user_id) for p in qs if p.artist.user_id]
            
            if recipient_ids and changes:
                metadata = RehearsalUpdatedMetadata(
                    rehearsal_id=rehearsal.id,
                    project_name=rehearsal.project.title,
                    changes=changes
                ).model_dump(mode="json")
                
                level = NotificationLevel.URGENT if "Date / Time" in changes else (NotificationLevel.WARNING if changes else NotificationLevel.INFO)
                
                transaction.on_commit(lambda: send_bulk_notifications_task.delay(
                    recipient_ids=recipient_ids,
                    notification_type=NotificationType.REHEARSAL_UPDATED,
                    level=level,
                    metadata=metadata
                ))
        return rehearsal

    @staticmethod
    def delete_rehearsal(rehearsal: Rehearsal) -> None:
        qs = rehearsal.invited_participations.all()
        if not qs.exists():
            qs = Participation.objects.filter(project=rehearsal.project, is_deleted=False)
            
        recipient_ids = [str(p.artist.user_id) for p in qs if p.artist.user_id]
        project_name = rehearsal.project.title
        
        with transaction.atomic():
            rehearsal.delete()
            
            if recipient_ids:
                metadata = RehearsalCancelledMetadata(
                    project_name=project_name,
                    message="A scheduled rehearsal has been cancelled."
                ).model_dump(mode="json")
                
                transaction.on_commit(lambda: send_bulk_notifications_task.delay(
                    recipient_ids=recipient_ids,
                    notification_type=NotificationType.REHEARSAL_CANCELLED,
                    level=NotificationLevel.URGENT,
                    metadata=metadata
                ))

    @staticmethod
    def record_attendance(dto: AttendanceRecordDTO) -> Attendance:
        try:
            participation = Participation.objects.select_related('artist').get(id=dto.participation_id, is_deleted=False)
            rehearsal = Rehearsal.objects.prefetch_related('invited_participations').get(id=dto.rehearsal_id, is_deleted=False)
        except (Participation.DoesNotExist, Rehearsal.DoesNotExist):
            raise AttendanceValidationException("Record not found.")

        if participation.project_id != rehearsal.project_id:
            raise AttendanceValidationException("Project mismatch between participation and rehearsal.")

        if not dto.is_superuser and participation.artist.user_id != dto.requesting_user_id:
            raise AttendanceValidationException("Can only record self-attendance.")

        with transaction.atomic():
            attendance, created = Attendance.objects.update_or_create(
                rehearsal=rehearsal,
                participation=participation,
                defaults={'status': dto.status, 'minutes_late': dto.minutes_late, 'excuse_note': dto.excuse_note}
            )
            
            if dto.is_superuser and dto.status in ['EXCUSED', 'ABSENT'] and participation.artist.user_id:
                notif_type = NotificationType.ABSENCE_APPROVED if dto.status == 'EXCUSED' else NotificationType.ABSENCE_REJECTED
                metadata = AbsenceStatusMetadata(rehearsal_id=rehearsal.id).model_dump(mode="json")
                
                transaction.on_commit(lambda: send_notification_task.delay(
                    recipient_id=str(participation.artist.user_id),
                    notification_type=notif_type,
                    level=NotificationLevel.INFO,
                    metadata=metadata
                ))
                
        return attendance


class CastingAndCrewService:
    @staticmethod
    def assign_piece_casting(validated_data: Dict[str, Any]) -> ProjectPieceCasting:
        with transaction.atomic():
            casting = ProjectPieceCasting.objects.create(**validated_data)
            user_id = casting.participation.artist.user_id
            
            if user_id:
                metadata = PieceCastingMetadata(
                    piece_id=casting.piece_id,
                    piece_title=casting.piece.title,
                    voice_line=casting.voice_line
                ).model_dump(mode="json")
                
                transaction.on_commit(lambda: send_notification_task.delay(
                    recipient_id=str(user_id),
                    notification_type=NotificationType.PIECE_CASTING_ASSIGNED,
                    level=NotificationLevel.INFO,
                    metadata=metadata
                ))
        return casting

    @staticmethod
    def update_piece_casting(casting: ProjectPieceCasting, validated_data: Dict[str, Any]) -> ProjectPieceCasting:
        with transaction.atomic():
            for attr, value in validated_data.items():
                setattr(casting, attr, value)
            casting.save()
            
            user_id = casting.participation.artist.user_id
            if user_id:
                metadata = PieceCastingMetadata(
                    piece_id=casting.piece_id,
                    piece_title=casting.piece.title,
                    voice_line=casting.voice_line
                ).model_dump(mode="json")
                
                transaction.on_commit(lambda: send_notification_task.delay(
                    recipient_id=str(user_id),
                    notification_type=NotificationType.PIECE_CASTING_UPDATED,
                    level=NotificationLevel.INFO,
                    metadata=metadata
                ))
        return casting

    @staticmethod
    def delete_piece_casting(casting: ProjectPieceCasting) -> None:
        user_id = casting.participation.artist.user_id
        piece_title = casting.piece.title
        
        with transaction.atomic():
            casting.delete()
            
            if user_id:
                metadata = PieceCastingMetadata(
                    piece_title=piece_title,
                    message=f"Your casting for '{piece_title}' has been removed."
                ).model_dump(mode="json")
                
                transaction.on_commit(lambda: send_notification_task.delay(
                    recipient_id=str(user_id),
                    notification_type=NotificationType.PIECE_CASTING_UPDATED,
                    level=NotificationLevel.WARNING,
                    metadata=metadata
                ))

    @staticmethod
    def assign_crew(validated_data: Dict[str, Any]) -> CrewAssignment:
        with transaction.atomic():
            assignment = CrewAssignment.objects.create(**validated_data)
            # Notification logic placeholder for crew
        return assignment