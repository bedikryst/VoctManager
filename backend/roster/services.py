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
from datetime import date, datetime, time
from typing import TYPE_CHECKING, Any
from uuid import UUID

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from core.exceptions import EmailAlreadyInUseException
from core.services import UserIdentityService
from logistics.models import Location
from notifications.dtos import (
    AbsenceStatusMetadata,
    ManagerActionMetadata,
    PieceCastingMetadata,
    ProjectInvitationMetadata,
    ProjectUpdatedMetadata,
    RehearsalCancelledMetadata,
    RehearsalScheduledMetadata,
    RehearsalUpdatedMetadata,
)
from notifications.models import NotificationLevel, NotificationType
from notifications.services import NotificationRecipientPolicy
from notifications.tasks import send_bulk_notifications_task, send_notification_task

from .dtos import (
    ArtistCreateDTO,
    AttendanceRecordDTO,
    PieceReadinessUpdateDTO,
    ProjectBulkFeeDTO,
    ProjectCreateDTO,
    ProjectUpdateDTO,
    RehearsalCreateDTO,
    RehearsalUpdateDTO,
)
from .exceptions import (
    ArtistProvisioningException,
    AttendanceValidationException,
    CastingValidationException,
    ParticipationException,
)
from .models import (
    Artist,
    Attendance,
    CrewAssignment,
    Participation,
    PieceReadiness,
    Project,
    ProjectPieceCasting,
    Rehearsal,
)

logger = logging.getLogger(__name__)

# Bind the concrete user model under TYPE_CHECKING so annotations resolve, while
# keeping the dynamic swappable-model lookup at runtime.
if TYPE_CHECKING:
    from django.contrib.auth.models import User
else:
    User = get_user_model()

def resolve_location_and_timezone(location_id: UUID | None, fallback_timezone: str) -> tuple[Location | None, str]:
    """
    Enforces Single Source of Truth for timezones based on the Logistics module.
    """
    if not location_id:
        return None, fallback_timezone
        
    try:
        location = Location.objects.get(id=location_id)
        # Magic happens here: overriding the timezone with the location's official timezone
        return location, location.timezone
    except Location.DoesNotExist:
        logger.warning(f"Location with ID {location_id} not found. Using fallback timezone.")
        return None, fallback_timezone


def _format_change_value(value: object) -> str:
    """Renders an audit-trail value for human-readable change logs (single source of truth)."""
    if isinstance(value, datetime):
        return value.strftime('%d.%m.%Y %H:%M')
    if isinstance(value, date):
        return value.strftime('%d.%m.%Y')
    if isinstance(value, time):
        return value.strftime('%H:%M')
    if value is None:
        return "None"
    return str(value)


class ArtistHRService:
    """Service handling HR operations, onboarding, and artist lifecycles."""

    @staticmethod
    def provision_artist(dto: ArtistCreateDTO) -> Artist:
        """
        Provisions a new Artist entity within the Roster domain.
        Delegates core identity creation and notification to the IAM Service.
        """
        # Ensure domain-level uniqueness (preventing soft-delete ghost collisions)
        if Artist.objects.filter(email__iexact=dto.email, is_deleted=False).exists():
             raise ArtistProvisioningException(f"Active artist with email {dto.email} already exists.")
             
        try:
            with transaction.atomic():
                # 1. Delegate Identity Management to Core Bounded Context
                user = UserIdentityService.provision_user_account(
                    email=dto.email,
                    first_name=dto.first_name,
                    last_name=dto.last_name,
                    language=getattr(dto, 'language', 'en'),
                    first_name_vocative=dto.first_name_vocative or ""
                )

                # 2. Create Roster-specific entity
                artist = Artist.objects.create(
                    user=user,
                    first_name=dto.first_name,
                    last_name=dto.last_name,
                    first_name_vocative=dto.first_name_vocative or "",
                    email=dto.email,
                    voice_type=dto.voice_type,
                    phone_number=dto.phone_number or "",
                    sight_reading_skill=dto.sight_reading_skill,
                    vocal_range_bottom=dto.vocal_range_bottom or "",
                    vocal_range_top=dto.vocal_range_top or ""
                )

                logger.info(f"Successfully provisioned artist HR profile for: {dto.email}")
                return artist
                
        except EmailAlreadyInUseException:
            # Catch Core exception and map it to Roster Domain exception
            raise ArtistProvisioningException(f"Account with email {dto.email} already exists.")
    
    @staticmethod
    def archive_artist(artist: Artist) -> None:
        """Przenosi artystę do archiwum i blokuje mu możliwość logowania do aplikacji."""
        with transaction.atomic():
            # 1. Soft Delete Artysty (ukrywa go na listach)
            artist.delete() 
            
            # 2. Blokada logowania (Zatrzymuje autoryzację JWT/Sesji)
            user = artist.user
            if user is not None:
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
            user = artist.user
            if user is not None:
                user.is_active = True
                user.save(update_fields=['is_active'])
            
            logger.info(f"Artist {artist.email} restored and user access granted.")


class ProjectManagementService:
    """Service handling the lifecycle of concert projects and artist participations."""

    @staticmethod
    def create_project_with_creator(user: User, dto: ProjectCreateDTO) -> Project:
        with transaction.atomic():
            # 1. Extract and map data, explicitly excluding location_id from the dump
            create_data = dto.model_dump(exclude={'location_id', 'conductor'})
            create_data['run_sheet'] = list(dto.run_sheet)
            
            # 2. Resolve Domain Logistics
            location, resolved_timezone = resolve_location_and_timezone(dto.location_id, dto.timezone)
            
            # 3. Inject resolved data
            create_data['location'] = location
            create_data['timezone'] = resolved_timezone
            create_data['conductor_id'] = dto.conductor

            project = Project.objects.create(**create_data)

            if hasattr(user, 'artist_profile'):
                Participation.objects.create(
                    artist=user.artist_profile, 
                    project=project,
                    status=Participation.Status.CONFIRMED, 
                    fee=0
                )
            logger.info(f"Project '{project.title}' created by {user.email} with timezone {resolved_timezone}")
            return project
            
    @staticmethod
    def update_project(project: Project, dto: ProjectUpdateDTO) -> Project:
        FIELD_NAMES = {
            "title": "Title", "date_time": "Date", "location_id": "Location",
            "call_time": "Call-time", "status": "Status", "conductor": "Conductor",
            "dress_code_male": "Dress Code", "dress_code_female": "Dress Code"
        }
        changes = []

        # Exclude location_id to handle it manually via the helper
        update_data = dto.model_dump(
            exclude={'location_id', 'conductor'},
            exclude_unset=True,
        )
        if 'run_sheet' in dto.model_fields_set:
            update_data['run_sheet'] = list(dto.run_sheet or ())

        with transaction.atomic():
            # Resolve location and timezone if location_id was provided in the update DTO
            if 'location_id' in dto.model_fields_set:
                location, resolved_timezone = resolve_location_and_timezone(
                    dto.location_id,
                    dto.timezone or project.timezone
                )

                if project.location_id != (location.id if location else None):
                    old_loc = project.location.name if project.location else "None"
                    new_loc = location.name if location else "None"
                    changes.append(f"Location: {old_loc} ➔ {new_loc}")

                # The apply loop below deliberately skips 'location'/'timezone',
                # so the resolved FK + timezone must be persisted on the instance
                # here — otherwise the location move is silently dropped.
                project.location = location
                project.timezone = resolved_timezone
                update_data.pop('timezone', None)
            elif 'timezone' in update_data:
                # Standalone timezone change (no location move) — also skipped by
                # the loop, so apply it directly.
                project.timezone = update_data['timezone']

            if 'conductor' in dto.model_fields_set:
                if project.conductor_id != dto.conductor:
                    changes.append("Conductor updated")
                update_data['conductor_id'] = dto.conductor

            for attr, value in update_data.items():
                if attr in ('location', 'timezone'):
                    continue
                old_value = getattr(project, attr)
                if old_value != value:
                    field_name = FIELD_NAMES.get(attr, attr.title())
                    changes.append(f"{field_name}: {_format_change_value(old_value)} ➔ {_format_change_value(value)}")
                setattr(project, attr, value)
                
            project.save()

            qs = Participation.objects.filter(project=project, is_deleted=False)
            recipient_ids = NotificationRecipientPolicy.from_participations(qs)

            if recipient_ids and changes:
                unique_changes = list(set(changes))
                metadata = ProjectUpdatedMetadata(
                    project_id=project.id,
                    project_name=project.title,
                    message="Project details have been updated.",
                    changes=unique_changes
                ).model_dump(mode="json")
                
                level = (
                    NotificationLevel.URGENT
                    if any(any(label in change for label in ("Date", "Call-time")) for change in changes)
                    else NotificationLevel.WARNING
                )
                
                transaction.on_commit(lambda: send_bulk_notifications_task.delay(
                    recipient_ids=recipient_ids,
                    notification_type=NotificationType.PROJECT_UPDATED,
                    level=level,
                    metadata=metadata
                ))
                
        return project

    
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
    def create_or_restore_participation(validated_data: dict[str, Any]) -> Participation:
        """
        Enterprise Upsert Pattern: Checks for an archived (soft-deleted) participation first.
        If found, restores it to preserve history and avoid constraint collisions. 
        If not, creates a fresh participation.
        """
        artist = validated_data.get('artist')
        project = validated_data.get('project')

        with transaction.atomic():
            # 1. Look for a soft-deleted record using the explicit base manager
            archived_participation = Participation.all_objects.filter(
                artist=artist, project=project, is_deleted=True
            ).first()

            if archived_participation:
                # 2A. RESTORE PATH
                # Update any new values passed in the request (e.g., a new fee or status)
                for attr, value in validated_data.items():
                    setattr(archived_participation, attr, value)
                
                archived_participation.restore() # Saves and sets is_deleted=False
                participation = archived_participation
                message = "You have been re-added to the project."
            else:
                # 2B. CREATE PATH
                participation = Participation.objects.create(**validated_data)
                message = None # Default invitation message

            # 3. Dispatch Notification
            if participation.artist.user_id:
                location_name = participation.project.location.name if participation.project.location else "TBD"
                inviter_name = f"{participation.project.conductor.first_name} {participation.project.conductor.last_name}" if participation.project.conductor else "Zarząd VoctManager"
                
                metadata = ProjectInvitationMetadata(
                    project_id=participation.project_id,
                    project_name=participation.project.title,
                    participation_id=participation.id,
                    inviter_name=inviter_name,
                    date_range=participation.project.date_time.strftime("%Y-%m-%d %H:%M"),
                    location=location_name,
                    description=participation.project.description or "Brak opisu",
                    message=message
                ).model_dump(mode="json")
                
                transaction.on_commit(lambda: send_notification_task.delay(
                    recipient_id=str(participation.artist.user_id),
                    notification_type=NotificationType.PROJECT_INVITATION,
                    level=NotificationLevel.INFO,
                    metadata=metadata
                ))

        return participation
    
    @staticmethod
    def update_project_bulk_fee(dto: ProjectBulkFeeDTO) -> int:
        if dto.new_fee < 0:
            raise ParticipationException("Fee cannot be negative.")

        # A standard cast rate must never rewrite money already settled (that would
        # silently desync the recorded fee from what was actually paid), nor price
        # artists who declined. Both are excluded; individual fees stay editable.
        count = (
            Participation.objects
            .filter(project_id=dto.project_id, is_deleted=False, is_paid=False)
            .exclude(status=Participation.Status.DECLINED)
            .update(fee=dto.new_fee, updated_at=timezone.now())
        )
        logger.info(f"Bulk fee updated to {dto.new_fee} for project {dto.project_id} ({count} participants affected).")
        return count

    @staticmethod
    def update_project_crew_bulk_fee(dto: ProjectBulkFeeDTO) -> int:
        """Applies one standard rate across a project's crew, skipping already-settled rows."""
        if dto.new_fee < 0:
            raise ParticipationException("Fee cannot be negative.")

        # CrewAssignment is a plain model (no soft-delete / no decline state); only
        # guard against overwriting a fee already marked paid.
        count = (
            CrewAssignment.objects
            .filter(project_id=dto.project_id, is_paid=False)
            .update(fee=dto.new_fee)
        )
        logger.info(f"Bulk crew fee updated to {dto.new_fee} for project {dto.project_id} ({count} assignments affected).")
        return count

class ManagerNotificationHelper:
    @staticmethod
    def notify_managers(notification_type: str, metadata: dict, level: str = NotificationLevel.INFO):
        """Utility method to send notifications to all Managers and Admins in the system."""
        manager_ids = User.objects.filter(
            profile__role__in=['MANAGER', 'ADMIN'],
            is_active=True
        ).values_list('id', flat=True)
        
        if manager_ids:
            send_bulk_notifications_task.delay(
                recipient_ids=[str(uid) for uid in manager_ids],
                notification_type=notification_type,
                level=level,
                metadata=metadata
            )

class RehearsalOperationsService:
    @staticmethod
    def schedule_rehearsal(dto: RehearsalCreateDTO, invited_participations: list[Participation] | None = None) -> Rehearsal:
        
        with transaction.atomic():
            create_data = dto.model_dump(exclude={'location_id'})
            location, resolved_timezone = resolve_location_and_timezone(dto.location_id, dto.timezone)
            
            create_data['location'] = location
            create_data['timezone'] = resolved_timezone

            rehearsal = Rehearsal.objects.create(**create_data)
            
            if invited_participations:
                rehearsal.invited_participations.set(invited_participations)

            qs = invited_participations if invited_participations else Participation.objects.filter(project=rehearsal.project, is_deleted=False)
            recipient_ids = NotificationRecipientPolicy.from_participations(qs)

            if recipient_ids:
                metadata = RehearsalScheduledMetadata(
                    rehearsal_id=rehearsal.id,
                    project_id=rehearsal.project_id,
                    project_name=rehearsal.project.title,
                    message=f"A new rehearsal has been scheduled for the project '{rehearsal.project.title}'."
                ).model_dump(mode="json")
                
                transaction.on_commit(lambda: send_bulk_notifications_task.delay(
                    recipient_ids=recipient_ids,
                    notification_type=NotificationType.REHEARSAL_SCHEDULED,
                    level=NotificationLevel.INFO,
                    metadata=metadata
                ))
        return rehearsal

    @staticmethod
    def update_rehearsal(rehearsal: Rehearsal, dto: RehearsalUpdateDTO, invited_participations: list[Participation] | None = None) -> Rehearsal:
        FIELD_NAMES = {
            "date_time": "Date / Time", "location_id": "Location",
            "focus": "Focus / Plan", "is_mandatory": "Mandatory Status"
        }
        changes = []
        update_data = dto.model_dump(exclude={'location_id'}, exclude_unset=True)
        
        with transaction.atomic():
            if 'location_id' in dto.model_fields_set:
                location, resolved_timezone = resolve_location_and_timezone(
                    dto.location_id, 
                    dto.timezone or rehearsal.timezone
                )
                update_data['location'] = location
                update_data['timezone'] = resolved_timezone
                
                if rehearsal.location_id != (location.id if location else None):
                    old_loc = rehearsal.location.name if rehearsal.location else "None"
                    new_loc = location.name if location else "None"
                    changes.append(f"Location: {old_loc} ➔ {new_loc}")

            for attr, value in update_data.items():
                if attr in ('location', 'timezone'):
                    continue
                old_value = getattr(rehearsal, attr)
                if old_value != value:
                    field_name = FIELD_NAMES.get(attr, attr.title())
                    changes.append(f"{field_name}: {_format_change_value(old_value)} ➔ {_format_change_value(value)}")
                setattr(rehearsal, attr, value)
                
            rehearsal.save()

            if invited_participations is not None:
                rehearsal.invited_participations.set(invited_participations)

            qs = rehearsal.invited_participations.all()
            if not qs.exists():
                qs = Participation.objects.filter(project=rehearsal.project, is_deleted=False)

            recipient_ids = NotificationRecipientPolicy.from_participations(qs)

            if recipient_ids and changes:
                metadata = RehearsalUpdatedMetadata(
                    rehearsal_id=rehearsal.id,
                    project_name=rehearsal.project.title,
                    changes=changes,
                    message=f"Details for a rehearsal in the project '{rehearsal.project.title}' have been updated."
                ).model_dump(mode="json")
                
                level = NotificationLevel.URGENT if any("Date / Time" in change for change in changes) else NotificationLevel.WARNING
                
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

        recipient_ids = NotificationRecipientPolicy.from_participations(qs)
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
            rehearsal = Rehearsal.objects.select_related('project').prefetch_related('invited_participations').get(id=dto.rehearsal_id, is_deleted=False)
        except (Participation.DoesNotExist, Rehearsal.DoesNotExist):
            raise AttendanceValidationException("Record not found.")

        if participation.project_id != rehearsal.project_id:
            raise AttendanceValidationException("Project mismatch between participation and rehearsal.")

        if not dto.is_manager and participation.artist.user_id != dto.requesting_user_id:
            raise AttendanceValidationException("Can only record self-attendance unless you are a Manager.")


        with transaction.atomic():
            attendance, _created = Attendance.objects.update_or_create(
                rehearsal=rehearsal,
                participation=participation,
                defaults={'status': dto.status, 'minutes_late': dto.minutes_late, 'excuse_note': dto.excuse_note}
            )

            if not dto.is_manager:
                metadata = ManagerActionMetadata(
                    project_name=attendance.rehearsal.project.title,
                    artist_name=f"{attendance.participation.artist.first_name} {attendance.participation.artist.last_name}",
                    action_details=f"Status: {dto.status}. Note: {dto.excuse_note or 'No note'}",
                    rehearsal_date=attendance.rehearsal.date_time.strftime("%Y-%m-%d %H:%M"),
                    message="An artist has submitted an attendance update."
                ).model_dump(mode="json")
                
                transaction.on_commit(lambda: ManagerNotificationHelper.notify_managers(
                    notification_type=NotificationType.ATTENDANCE_SUBMITTED,
                    metadata=metadata
                ))
            
            if dto.is_manager and dto.status in ['EXCUSED', 'ABSENT'] and participation.artist.user_id:
                notif_type = NotificationType.ABSENCE_APPROVED if dto.status == 'EXCUSED' else NotificationType.ABSENCE_REJECTED
                status_text = "approved" if dto.status == 'EXCUSED' else "rejected"
                metadata = AbsenceStatusMetadata(
                    rehearsal_id=rehearsal.id,
                    project_name=rehearsal.project.title,
                    rehearsal_date=rehearsal.date_time.strftime("%Y-%m-%d %H:%M"),
                    message=f"Your absence request for the rehearsal on {rehearsal.date_time.strftime('%Y-%m-%d')} has been {status_text}."
                ).model_dump(mode="json")
                
                transaction.on_commit(lambda: send_notification_task.delay(
                    recipient_id=str(participation.artist.user_id),
                    notification_type=notif_type,
                    level=NotificationLevel.INFO,
                    metadata=metadata
                ))
                
        return attendance

class ParticipationService:
    @staticmethod
    def update_status_by_artist(participation: Participation, new_status: str) -> Participation:
        with transaction.atomic():
            old_status = participation.status
            participation.status = new_status
            participation.save(update_fields=['status', 'updated_at'])
            
            metadata = ManagerActionMetadata(
                project_name=participation.project.title,
                artist_name=f"{participation.artist.first_name} {participation.artist.last_name}",
                action_details=f"Changed status from {old_status} to {new_status}",
                message="An artist has updated their participation status."
            ).model_dump(mode="json")
            
            transaction.on_commit(lambda: ManagerNotificationHelper.notify_managers(
                notification_type=NotificationType.PARTICIPATION_RESPONSE,
                metadata=metadata,
                level=NotificationLevel.WARNING if new_status == Participation.Status.DECLINED else NotificationLevel.INFO
            ))
        return participation

class PieceReadinessService:
    """Practice-readiness self reports (chorister Songbook checklist)."""

    @staticmethod
    def upsert_readiness(participation: Participation, dto: PieceReadinessUpdateDTO) -> PieceReadiness:
        """
        Idempotent upsert of the artist's readiness status for one piece.
        Caller is responsible for ownership checks (artist can only touch own rows).
        """
        entry, _created = PieceReadiness.objects.update_or_create(
            participation=participation,
            piece_id=dto.piece,
            defaults={'status': dto.status},
        )
        return entry

    @staticmethod
    def get_project_readiness_summary(project: Project) -> list[dict[str, Any]]:
        """
        Conductor-facing aggregate: per program piece, how many cast singers are
        ready / practising / untouched. Castings without a readiness row count
        as NOT_STARTED.
        """
        program_items = list(
            project.program_items.select_related('piece').order_by('order')
        )
        piece_ids = [item.piece_id for item in program_items]

        castings = ProjectPieceCasting.objects.filter(
            piece_id__in=piece_ids,
            participation__project=project,
            participation__is_deleted=False,
        ).exclude(participation__status=Participation.Status.DECLINED)

        cast_totals: dict[UUID, int] = {}
        for casting in castings:
            cast_totals[casting.piece_id] = cast_totals.get(casting.piece_id, 0) + 1

        readiness_rows = PieceReadiness.objects.filter(
            participation__project=project,
            participation__is_deleted=False,
            piece_id__in=piece_ids,
        ).values('piece_id', 'status')

        counts: dict[UUID, dict[str, int]] = {}
        for row in readiness_rows:
            bucket = counts.setdefault(row['piece_id'], {})
            bucket[row['status']] = bucket.get(row['status'], 0) + 1

        summary: list[dict[str, Any]] = []
        for item in program_items:
            bucket = counts.get(item.piece_id, {})
            ready = bucket.get(PieceReadiness.Status.READY, 0)
            in_progress = bucket.get(PieceReadiness.Status.IN_PROGRESS, 0)
            total = cast_totals.get(item.piece_id, 0)
            summary.append({
                'piece_id': str(item.piece_id),
                'piece_title': item.piece.title,
                'order': item.order,
                'total_cast': total,
                'ready': ready,
                'in_progress': in_progress,
                'not_started': max(total - ready - in_progress, 0),
            })
        return summary


class CastingAndCrewService:
    @staticmethod
    def assign_piece_casting(validated_data: dict[str, Any]) -> ProjectPieceCasting:
        participation = validated_data.get('participation')
        if participation and participation.status != Participation.Status.CONFIRMED:
            raise CastingValidationException(
                f"Cannot assign artist to a voice line: participation status is "
                f"'{participation.status}', expected '{Participation.Status.CONFIRMED}'. "
                f"Only confirmed (CON) participants may be cast."
            )

        with transaction.atomic():
            casting = ProjectPieceCasting.objects.create(**validated_data)
            user_id = casting.participation.artist.user_id
            
            if user_id:
                metadata = PieceCastingMetadata(
                    piece_id=casting.piece_id,
                    piece_title=casting.piece.title,
                    voice_line=casting.get_voice_line_display() or casting.voice_line,
                    message=f"You have been cast in the piece '{casting.piece.title}'."
                ).model_dump(mode="json")
                
                transaction.on_commit(lambda: send_notification_task.delay(
                    recipient_id=str(user_id),
                    notification_type=NotificationType.PIECE_CASTING_ASSIGNED,
                    level=NotificationLevel.INFO,
                    metadata=metadata
                ))
        return casting

    @staticmethod
    def update_piece_casting(casting: ProjectPieceCasting, validated_data: dict[str, Any]) -> ProjectPieceCasting:
        changes = []
        with transaction.atomic():
            for attr, value in validated_data.items():
                old_value = getattr(casting, attr)
                if old_value != value:
                    field_name = attr.replace('_', ' ').title()
                    if attr == 'voice_line':
                        from roster.models import VoiceLine
                        voice_map = dict(VoiceLine.choices)
                        old_display = voice_map.get(old_value, old_value) if old_value else 'None'
                        new_display = voice_map.get(value, value) if value else 'None'
                        changes.append(f"{field_name}: {old_display} ➔ {new_display}")
                    else:
                        changes.append(f"{field_name}: {old_value or 'None'} ➔ {value or 'None'}")
                setattr(casting, attr, value)
            casting.save()
            
            user_id = casting.participation.artist.user_id
            if user_id and changes:
                metadata = PieceCastingMetadata(
                    piece_id=casting.piece_id,
                    piece_title=casting.piece.title,
                    voice_line=casting.get_voice_line_display() or casting.voice_line,
                    changes=changes,
                    message=f"Your casting in the piece '{casting.piece.title}' has been updated."
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
    def assign_crew(validated_data: dict[str, Any]) -> CrewAssignment:
        """
        Assigns a collaborator to a crew role within a project.
        NOTE: By design (2026 Business Rules), Crew members do not possess UserProfiles 
        and are excluded from the automated notification system.
        """
        with transaction.atomic():
            assignment = CrewAssignment.objects.create(**validated_data)
            
        return assignment
