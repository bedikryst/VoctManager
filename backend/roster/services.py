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
from collections.abc import Mapping
from datetime import date, datetime, time, timedelta
from typing import TYPE_CHECKING, Any, ClassVar
from uuid import UUID

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.utils import timezone

from core.exceptions import EmailAlreadyInUseException
from core.models import UserProfile
from core.services import UserIdentityService
from logistics.models import Location
from notifications.dtos import (
    AbsenceStatusMetadata,
    ManagerActionMetadata,
    PieceCastingMetadata,
    ProjectCancelledMetadata,
    ProjectInvitationMetadata,
    ProjectUpdatedMetadata,
    RehearsalCancelledMetadata,
    RehearsalScheduledMetadata,
    RehearsalUpdatedMetadata,
)
from notifications.models import NotificationLevel, NotificationType
from notifications.services import NotificationRecipientPolicy
from notifications.tasks import send_bulk_notifications_task, send_notification_task
from notifications.time_metadata import build_event_time_metadata

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
    ActivatedEmailChangeException,
    ActivationResendException,
    ArtistEmailConflictException,
    ArtistProvisioningException,
    AttendanceValidationException,
    CastingValidationException,
    ParticipationException,
)
from .models import (
    DEFAULT_EVENT_TIMEZONE,
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


def _format_change_value(value: object) -> str | None:
    """Renders an audit-trail value for change logs (single source of truth).
    Returns None for empty values so the renderer can show a localized dash."""
    if isinstance(value, datetime):
        return value.strftime('%d.%m.%Y %H:%M')
    if isinstance(value, date):
        return value.strftime('%d.%m.%Y')
    if isinstance(value, time):
        return value.strftime('%H:%M')
    if value is None or value == "":
        return None
    return str(value)


def _change(field: str, old: object, new: object) -> dict[str, str | None]:
    """Builds one structured field change. `field` is a stable, localizable key;
    `old`/`new` are language-neutral display values. The human label is resolved
    per language at render time (push/email composer + in-app NotificationItem)."""
    return {"field": field, "old": _format_change_value(old), "new": _format_change_value(new)}


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
                    first_name_vocative=dto.first_name_vocative or "",
                    salutation=getattr(dto, 'salutation', 'N'),
                )

                # 2. Create Roster-specific entity. `provision_user_account` has
                #    already queued the first activation invite, so stamp the send
                #    time now — the roster can show when the singer was invited.
                #    Names and e-mail are seeded from the same DTO the account was
                #    built from; from here on they are a projection of it, and the
                #    vocative is not copied at all — it lives on the profile.
                artist = Artist.objects.create(
                    user=user,
                    first_name=dto.first_name,
                    last_name=dto.last_name,
                    email=dto.email,
                    voice_type=dto.voice_type,
                    phone_number=dto.phone_number or "",
                    sight_reading_skill=dto.sight_reading_skill,
                    vocal_range_bottom=dto.vocal_range_bottom or "",
                    vocal_range_top=dto.vocal_range_top or "",
                    activation_email_sent_at=timezone.now(),
                )

                logger.info(f"Successfully provisioned artist HR profile for: {dto.email}")
                return artist
                
        except EmailAlreadyInUseException:
            # Catch Core exception and map it to Roster Domain exception
            raise ArtistProvisioningException(f"Account with email {dto.email} already exists.")
    
    @staticmethod
    def resend_activation(artist: Artist) -> None:
        """
        Re-sends the platform activation invite to an artist who was provisioned
        but never activated. Delegates the token + email to the IAM service;
        here we only enforce that a linked account actually exists to activate.
        """
        user = artist.user
        if user is None:
            raise ActivationResendException(
                "This artist has no linked account to activate."
            )
        UserIdentityService.resend_activation_email(user)
        # Only stamp once the invite is actually (re)queued — the call above raises
        # for an already-activated account, so we never record a phantom send.
        artist.activation_email_sent_at = timezone.now()
        artist.save(update_fields=['activation_email_sent_at'])
        logger.info(f"Activation invite re-sent for artist: {artist.email}")

    @staticmethod
    def update_artist(artist: Artist, changes: Mapping[str, Any]) -> Artist:
        """
        Applies a manager's roster edit.

        Choral fields (voice, sight-reading, range) are written straight through —
        the roster owns them. Everything that identifies the person does not live
        here and must not be written here alone:

        - **names** belong to the account. Writing only the roster copy is how a
          singer ends up renamed on every manager screen while their own settings,
          their greetings and their e-mails keep the old name indefinitely.
        - **the vocative** belongs to the account's profile, for the same reason
          plus one more: managers and crew are greeted too and have no row here.
        - **the e-mail** is the sign-in identity, routed through `_rewrite_email`,
          which owns both sides and re-issues the dead invitation link.

        The first two are applied to the account and then projected back onto this
        row in the same transaction, so the archival snapshot this row exists to be
        stays current right up to the moment the account is detached.
        """
        data = dict(changes)
        new_email = data.pop('email', None)
        vocative = data.pop('first_name_vocative', None)
        names = {
            field: data.pop(field) for field in ('first_name', 'last_name') if field in data
        }

        with transaction.atomic():
            ArtistHRService._rewrite_account_names(artist, names, vocative)

            if data:
                for field, value in data.items():
                    setattr(artist, field, value)
                artist.save()

            # Last, because it queues an e-mail: nothing may fail after that
            # point and roll back a message already handed to the broker.
            if new_email is not None:
                ArtistHRService._rewrite_email(artist, new_email)

        return artist

    @staticmethod
    def _rewrite_account_names(
        artist: Artist, names: Mapping[str, str], vocative: str | None
    ) -> None:
        """Writes a name edit to the account and projects it onto the roster row.

        A detached row (GDPR erasure SET_NULLed `user`) has no account to write to,
        so the edit lands on the archival label alone — the only case where this
        row is the owner rather than the projection.
        """
        if not names and vocative is None:
            return

        user = artist.user

        if user is None:
            for field, value in names.items():
                setattr(artist, field, value)
            if names:
                artist.save(update_fields=[*names, 'updated_at'])
            return

        if names:
            for field, value in names.items():
                setattr(user, field, value)
                setattr(artist, field, value)
            user.save(update_fields=list(names))
            artist.save(update_fields=[*names, 'updated_at'])

        if vocative is not None:
            # Written through the instance already attached to `user`, not with a
            # queryset update: the caller serializes this artist straight back to
            # the manager, and `Artist.first_name_vocative` reads it off that
            # cached profile — a detached write would answer with the old value.
            profile = getattr(user, 'profile', None)
            if profile is None:
                # Provisioning always makes one; a fixture or a pre-existing
                # account may not, and the edit must not vanish either way.
                UserProfile.objects.create(user=user, first_name_vocative=vocative)
            else:
                profile.first_name_vocative = vocative
                profile.save(update_fields=['first_name_vocative', 'updated_at'])

    @staticmethod
    def _rewrite_email(artist: Artist, raw_email: str) -> None:
        """
        Moves an artist's e-mail on both sides of the Core/Roster boundary.

        Only reachable before activation. The old invitation link dies on its own
        —  the signed token hashes the account's e-mail — so the correction has
        to re-issue the invite, or the member is simply left without one.
        """
        new_email = (raw_email or "").strip()
        if not new_email or new_email.casefold() == (artist.email or "").strip().casefold():
            return

        user = artist.user

        if user is not None and user.has_usable_password():
            raise ActivatedEmailChangeException()

        # Uniqueness spans both tables. Checking one alone lets the other drift
        # into a duplicate, and these two are meant to hold the same address.
        if Artist.objects.exclude(pk=artist.pk).filter(
            email__iexact=new_email, is_deleted=False
        ).exists():
            raise ArtistEmailConflictException()
        if user is not None and User.objects.exclude(pk=user.pk).filter(
            email__iexact=new_email
        ).exists():
            raise ArtistEmailConflictException()

        artist.email = new_email
        artist.save(update_fields=['email', 'updated_at'])

        if user is None:
            # Detached by GDPR erasure: no sign-in identity behind this row, so
            # the address is a historical label and there is nothing to keep in
            # step with it.
            logger.info(f"Roster: archival email relabelled for detached artist {artist.id}")
            return

        user.email = new_email
        try:
            # The uniqueness checks above are separate statements from this write;
            # the database's case-insensitive index is what actually settles a
            # concurrent claim on the same address.
            with transaction.atomic():
                user.save(update_fields=['email'])
        except IntegrityError as exc:
            logger.warning(f"Roster email correction lost a race for {new_email}: {exc}")
            raise ArtistEmailConflictException() from exc

        # A correction is often prompted by the old address bouncing, which
        # leaves the account suppressed. The new mailbox is deliverable until
        # proven otherwise, so it must start clean or every later notification
        # would be silently dropped.
        UserProfile.objects.filter(user=user, email_undeliverable=True).update(
            email_undeliverable=False
        )

        UserIdentityService.resend_activation_email(user)
        artist.activation_email_sent_at = timezone.now()
        artist.save(update_fields=['activation_email_sent_at', 'updated_at'])
        logger.info(f"Roster: artist email corrected and invite re-issued to {new_email}")

    @staticmethod
    def archive_artist(artist: Artist) -> None:
        """
        Moves an artist to the archive and revokes their access to the platform.

        The sole writer of the archived state. All three markers move together —
        `is_active` (what every roster surface renders), `is_deleted` (what the
        default manager filters on) and the account's login gate — because a
        singer shown as archived while still able to sign in is the one outcome
        this operation must never produce.
        """
        with transaction.atomic():
            artist.is_active = False
            artist.save(update_fields=['is_active', 'updated_at'])
            artist.delete()

            user = artist.user
            if user is not None:
                user.is_active = False
                user.save(update_fields=['is_active'])

            logger.info(f"Artist {artist.email} archived and user access revoked.")

    @staticmethod
    def restore_artist(artist: Artist) -> None:
        """Returns an artist from the archive and restores their access. Exact
        inverse of `archive_artist` — see there for why all three move as one."""
        with transaction.atomic():
            artist.is_active = True
            artist.save(update_fields=['is_active', 'updated_at'])
            artist.restore()

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
            
    # Maps a model attribute to a stable, localizable change key. Keys (not English
    # labels) drive both rendering and the urgency escalation below.
    _PROJECT_CHANGE_KEYS: ClassVar[dict[str, str]] = {
        "title": "title", "date_time": "date_time", "location_id": "location",
        "call_time": "call_time", "status": "status", "conductor": "conductor",
        "dress_code_male": "dress_code", "dress_code_female": "dress_code",
    }
    # A change to any of these fields is time-critical → escalate to URGENT.
    _PROJECT_URGENT_FIELDS: ClassVar[frozenset[str]] = frozenset({"date_time", "call_time"})

    @staticmethod
    def update_project(project: Project, dto: ProjectUpdateDTO) -> Project:
        changes: list[dict[str, str | None]] = []

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
                    old_loc = project.location.name if project.location else None
                    new_loc = location.name if location else None
                    changes.append(_change("location", old_loc, new_loc))

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
                    changes.append(_change("conductor", None, None))
                update_data['conductor_id'] = dto.conductor

            for attr, value in update_data.items():
                if attr in ('location', 'timezone'):
                    continue
                old_value = getattr(project, attr)
                if old_value != value:
                    if attr == 'run_sheet':
                        # The run-sheet is a structured JSON list; a raw payload diff
                        # ("[{'time': '18:00', ...}]") reads as gibberish on the bell,
                        # push and email. Surface it as a self-describing "day schedule
                        # updated" change instead — mirrors the is_mandatory pattern.
                        changes.append(_change("run_sheet", None, None))
                    elif attr in ProjectManagementService._PROJECT_CHANGE_KEYS:
                        key = ProjectManagementService._PROJECT_CHANGE_KEYS[attr]
                        changes.append(_change(key, old_value, value))
                    # Fields outside the surfaceable set (description, spotify URL)
                    # persist silently — a note tweak isn't worth alerting the cast.
                setattr(project, attr, value)

            project.save()

            qs = Participation.objects.filter(project=project, is_deleted=False)
            recipient_ids = NotificationRecipientPolicy.from_participations(qs)

            if recipient_ids and changes:
                # A move to CANCELLED is an alarm of its own — not one field change
                # among several. It supersedes any other edit in the same save, so
                # the cast reads "cancelled" instead of decoding "Status: … → CANC".
                if project.status == Project.Status.CANCELLED and any(
                    c["field"] == "status" for c in changes
                ):
                    cancelled_metadata = ProjectCancelledMetadata(
                        project_id=project.id,
                        project_name=project.title,
                    ).model_dump(mode="json")
                    transaction.on_commit(lambda: send_bulk_notifications_task.delay(
                        recipient_ids=recipient_ids,
                        notification_type=NotificationType.PROJECT_CANCELLED,
                        level=NotificationLevel.URGENT,
                        metadata=cancelled_metadata,
                    ))
                    return project

                # De-duplicate on the structured key (dress_code_male/female both map
                # to one "dress_code" change; conductor may repeat).
                unique_changes = list({c["field"]: c for c in changes}.values())
                metadata = ProjectUpdatedMetadata(
                    project_id=project.id,
                    project_name=project.title,
                    changes=unique_changes,
                ).model_dump(mode="json")

                level = (
                    NotificationLevel.URGENT
                    if any(c["field"] in ProjectManagementService._PROJECT_URGENT_FIELDS for c in unique_changes)
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
                    event="removed",
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
            else:
                # 2B. CREATE PATH
                participation = Participation.objects.create(**validated_data)

            # 3. Dispatch Notification (an invitation, whether fresh or restored)
            if participation.artist.user_id:
                # Blank when unset → the composer falls back to localized neutral copy
                # (e.g. "the management team", and it simply omits a missing venue).
                location_name = participation.project.location.name if participation.project.location else ""
                inviter_name = (
                    f"{participation.project.conductor.first_name} {participation.project.conductor.last_name}"
                    if participation.project.conductor else ""
                )

                event_time_metadata = build_event_time_metadata(
                    participation.project.date_time,
                    participation.project.timezone,
                    fallback_timezone=DEFAULT_EVENT_TIMEZONE,
                )

                metadata = ProjectInvitationMetadata(
                    project_id=participation.project_id,
                    project_name=participation.project.title,
                    participation_id=participation.id,
                    inviter_name=inviter_name,
                    **event_time_metadata,
                    date_range=event_time_metadata["starts_at_display"],
                    location=location_name,
                    description=participation.project.description or "",
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

def _rehearsal_ics_payload(rehearsal: Rehearsal) -> dict:
    """Lightweight calendar payload carried in notification metadata so the email
    layer can attach a localized 'add to calendar' .ics. Push ignores it."""
    location_name = rehearsal.location.name if rehearsal.location else ""
    return {
        "kind": "rehearsal",
        "uid": f"rehearsal_{rehearsal.id}@voctensemble.com",
        "start": rehearsal.date_time.isoformat(),
        "end": (rehearsal.date_time + timedelta(hours=3)).isoformat(),
        "project_name": rehearsal.project.title,
        "location": location_name,
        "focus": rehearsal.focus or "",
    }


def _rehearsal_notification_context(rehearsal: Rehearsal) -> dict[str, str]:
    """Compact rehearsal facts reused by push, email, and in-app surfaces."""
    return {
        **build_event_time_metadata(
            rehearsal.date_time,
            rehearsal.timezone,
            fallback_timezone=DEFAULT_EVENT_TIMEZONE,
        ),
        "location": rehearsal.location.name if rehearsal.location else "",
        "focus": rehearsal.focus or "",
    }


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
                    **_rehearsal_notification_context(rehearsal),
                ).model_dump(mode="json")
                metadata["ics"] = _rehearsal_ics_payload(rehearsal)

                transaction.on_commit(lambda: send_bulk_notifications_task.delay(
                    recipient_ids=recipient_ids,
                    notification_type=NotificationType.REHEARSAL_SCHEDULED,
                    level=NotificationLevel.INFO,
                    metadata=metadata
                ))
        return rehearsal

    # Stable, localizable change keys (not English labels). `is_mandatory` is
    # handled separately below — a raw boolean diff ("True → False") reads badly,
    # so it becomes a self-describing state change instead.
    _REHEARSAL_CHANGE_KEYS: ClassVar[dict[str, str]] = {
        "date_time": "date_time", "location_id": "location", "focus": "focus",
    }

    @staticmethod
    def update_rehearsal(rehearsal: Rehearsal, dto: RehearsalUpdateDTO, invited_participations: list[Participation] | None = None) -> Rehearsal:
        changes: list[dict[str, str | None]] = []
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
                    old_loc = rehearsal.location.name if rehearsal.location else None
                    new_loc = location.name if location else None
                    changes.append(_change("location", old_loc, new_loc))

            for attr, value in update_data.items():
                if attr in ('location', 'timezone'):
                    continue
                old_value = getattr(rehearsal, attr)
                if old_value != value:
                    if attr == "is_mandatory":
                        # Self-describing state change — never a raw "True → False".
                        changes.append(_change("now_mandatory" if value else "now_optional", None, None))
                    else:
                        key = RehearsalOperationsService._REHEARSAL_CHANGE_KEYS.get(attr, attr)
                        changes.append(_change(key, old_value, value))
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
                    project_id=rehearsal.project_id,
                    project_name=rehearsal.project.title,
                    **_rehearsal_notification_context(rehearsal),
                    changes=changes,
                ).model_dump(mode="json")
                metadata["ics"] = _rehearsal_ics_payload(rehearsal)

                level = NotificationLevel.URGENT if any(c["field"] == "date_time" for c in changes) else NotificationLevel.WARNING
                
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
        metadata_context = _rehearsal_notification_context(rehearsal)
        
        with transaction.atomic():
            rehearsal.delete()
            
            if recipient_ids:
                metadata = RehearsalCancelledMetadata(
                    rehearsal_id=rehearsal.id,
                    project_id=rehearsal.project_id,
                    project_name=project_name,
                    **metadata_context,
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
                artist_name = f"{attendance.participation.artist.first_name} {attendance.participation.artist.last_name}"
                event_time_metadata = build_event_time_metadata(
                    attendance.rehearsal.date_time,
                    attendance.rehearsal.timezone,
                    fallback_timezone=DEFAULT_EVENT_TIMEZONE,
                )
                rehearsal_date = event_time_metadata["starts_at_display"]

                # An artist marking themselves EXCUSED/ABSENT IS an absence request —
                # surface it to managers as the specific, actionable type rather than
                # the generic attendance-submitted ping.
                if dto.status in (Attendance.Status.EXCUSED, Attendance.Status.ABSENT):
                    notif_type = NotificationType.ABSENCE_REQUESTED
                    metadata = ManagerActionMetadata(
                        project_name=attendance.rehearsal.project.title,
                        artist_name=artist_name,
                        artist_id=str(attendance.participation.artist_id),
                        project_id=str(attendance.rehearsal.project_id),
                        rehearsal_id=str(rehearsal.id),
                        **event_time_metadata,
                        rehearsal_date=rehearsal_date,
                        status=dto.status,
                        excuse_note=dto.excuse_note or None,
                    ).model_dump(mode="json")
                else:
                    notif_type = NotificationType.ATTENDANCE_SUBMITTED
                    metadata = ManagerActionMetadata(
                        project_name=attendance.rehearsal.project.title,
                        artist_name=artist_name,
                        artist_id=str(attendance.participation.artist_id),
                        rehearsal_id=str(rehearsal.id),
                        **event_time_metadata,
                        rehearsal_date=rehearsal_date,
                        status=dto.status,
                        minutes_late=dto.minutes_late or None,
                    ).model_dump(mode="json")

                transaction.on_commit(lambda: ManagerNotificationHelper.notify_managers(
                    notification_type=notif_type,
                    metadata=metadata
                ))
            
            if dto.is_manager and dto.status in ['EXCUSED', 'ABSENT'] and participation.artist.user_id:
                is_approved = dto.status == 'EXCUSED'
                notif_type = NotificationType.ABSENCE_APPROVED if is_approved else NotificationType.ABSENCE_REJECTED
                # A rejected absence reinstates a commitment ("you're expected after
                # all"), so it carries WARNING weight; an approval is a positive FYI
                # at INFO. Mirrors the composer's intended level for each.
                level = NotificationLevel.INFO if is_approved else NotificationLevel.WARNING
                decision_time_metadata = build_event_time_metadata(
                    rehearsal.date_time,
                    rehearsal.timezone,
                    fallback_timezone=DEFAULT_EVENT_TIMEZONE,
                )
                metadata = AbsenceStatusMetadata(
                    rehearsal_id=rehearsal.id,
                    project_name=rehearsal.project.title,
                    **decision_time_metadata,
                    rehearsal_date=decision_time_metadata["starts_at_display"],
                ).model_dump(mode="json")

                transaction.on_commit(lambda: send_notification_task.delay(
                    recipient_id=str(participation.artist.user_id),
                    notification_type=notif_type,
                    level=level,
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
                artist_id=str(participation.artist_id),
                project_id=str(participation.project_id),
                status=new_status,
                previous_status=old_status,
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
                project = casting.participation.project
                metadata = PieceCastingMetadata(
                    piece_id=casting.piece_id,
                    piece_title=casting.piece.title,
                    # Language-neutral CODE — localized per surface at render time.
                    voice_line=casting.voice_line,
                    project_id=project.id,
                    project_name=project.title,
                    **build_event_time_metadata(
                        project.date_time,
                        project.timezone,
                        fallback_timezone=DEFAULT_EVENT_TIMEZONE,
                    ),
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
        changes: list[dict[str, str | None]] = []
        with transaction.atomic():
            for attr, value in validated_data.items():
                old_value = getattr(casting, attr)
                if old_value != value:
                    # Store language-neutral CODES for voice_line — the old/new are
                    # localized to each surface's language at render time.
                    changes.append(_change(attr, old_value, value))
                setattr(casting, attr, value)
            casting.save()

            user_id = casting.participation.artist.user_id
            if user_id and changes:
                project = casting.participation.project
                metadata = PieceCastingMetadata(
                    piece_id=casting.piece_id,
                    piece_title=casting.piece.title,
                    voice_line=casting.voice_line,
                    project_id=project.id,
                    project_name=project.title,
                    **build_event_time_metadata(
                        project.date_time,
                        project.timezone,
                        fallback_timezone=DEFAULT_EVENT_TIMEZONE,
                    ),
                    changes=changes,
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
        project = casting.participation.project

        with transaction.atomic():
            casting.delete()

            if user_id:
                metadata = PieceCastingMetadata(
                    piece_title=piece_title,
                    project_id=project.id,
                    project_name=project.title,
                    event="removed",
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
