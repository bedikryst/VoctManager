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
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, replace
from datetime import date, datetime, time, timedelta
from typing import TYPE_CHECKING, Any, ClassVar
from uuid import UUID

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from archive.models import Piece, PieceVoiceRequirement
from archive.services.voice_scope import voice_scope
from core.exceptions import EmailAlreadyInUseException
from core.models import UserProfile
from core.services import UserIdentityService
from finance.services.ledger import LedgerService
from logistics.models import Location
from notifications.announcement_queue import AnnouncementQueue
from notifications.announcements import (
    announce,
    announce_bulk,
    is_announceable,
    queue_announcement,
    queue_broadcast,
)
from notifications.dtos import (
    AbsenceStatusMetadata,
    DelegatedRehearsalMetadata,
    ManagerActionMetadata,
    PieceCastingMetadata,
    ProjectCancelledMetadata,
    ProjectUpdatedMetadata,
    RehearsalCancelledMetadata,
    RehearsalDebriefPostedMetadata,
    RehearsalDelegationEndedMetadata,
    RehearsalDelegationMetadata,
    RehearsalLeadAssignedMetadata,
    RehearsalScheduledMetadata,
    RehearsalUpdatedMetadata,
)
from notifications.models import (
    AnnouncementKind,
    AnnouncementSubject,
    NotificationLevel,
    NotificationType,
)
from notifications.services import NotificationRecipientPolicy
from notifications.tasks import send_bulk_notifications_task, send_notification_task
from notifications.time_metadata import build_event_time_metadata, format_event_time

from .domain.attendance_window import SELF_REPORT_CLOSED_MESSAGE, is_open_to_self_report
from .domain.day_timeline import format_time_window
from .dtos import (
    ArtistCreateDTO,
    AttendanceRangeDTO,
    AttendanceRangeWindowDTO,
    AttendanceRecordDTO,
    CastOrderRowDTO,
    PieceCastingRowDTO,
    PieceReadinessUpdateDTO,
    ProjectCreateDTO,
    ProjectUpdateDTO,
    RehearsalCreateDTO,
    RehearsalPlanRowDTO,
    RehearsalUpdateDTO,
)
from .exceptions import (
    ActivatedArtistMergeException,
    ActivatedEmailChangeException,
    ActivationResendException,
    ArtistEmailConflictException,
    ArtistMergeException,
    ArtistProvisioningException,
    AttendanceValidationException,
    CastingValidationException,
    ParticipationException,
    ProjectAlreadyPublishedException,
    ProjectUnpublishException,
    SelfReportWindowClosedException,
)
from .invitations import build_invitation_context, build_invitation_metadata
from .models import (
    DEFAULT_EVENT_TIMEZONE,
    FALLBACK_REHEARSAL_DURATION_MINUTES,
    Artist,
    Attendance,
    CrewAssignment,
    Participation,
    PieceReadiness,
    ProgramItem,
    Project,
    ProjectPieceCasting,
    Rehearsal,
    RehearsalDelegate,
    RehearsalPlanItem,
    VoiceType,
)
from .permissions import live_delegate_q
from .queries.schedule_queries import get_artist_rehearsals_in_window
from .score_package_config import resolve_item_edition

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


# One sentence for both casting paths (single assignment and the whole board), so
# the singer-facing rule reads identically wherever it is enforced.
DECLINED_CASTING_MESSAGE = _(
    "Cannot assign artist to a voice line: the artist declined this project."
)


def _piece_voice_scope(piece_id: UUID, project: Project) -> tuple[str, ...]:
    """Every line this piece divides into for THIS concert, as codes.

    Carried on the payload rather than looked up at render time, because the
    message composers are pure functions over metadata — and without the scope
    a message cannot know that "T1" is the only tenor line here and should read
    plainly as "Tenor". Widened by the seats already filled, for the same reason
    the panel widens it: a singer on T2 must keep T1 numbered.
    """
    item = (
        ProgramItem.objects
        .filter(project=project, piece_id=piece_id)
        .select_related('piece')
        .prefetch_related('piece__editions')
        .first()
    )
    edition = resolve_item_edition(item) if item is not None else None
    requirements = PieceVoiceRequirement.objects.filter(piece_id=piece_id)
    cast_codes = ProjectPieceCasting.objects.filter(
        piece_id=piece_id, participation__project=project, participation__is_deleted=False,
    ).values_list('voice_line', flat=True)
    return tuple(sorted(voice_scope(
        list(requirements), edition.pk if edition else None, extra_codes=cast_codes,
    )))


def _casting_metadata(
    casting: ProjectPieceCasting,
    project: Project,
    changes: list[dict[str, str | None]] | None = None,
    scope: tuple[str, ...] | None = None,
) -> dict[str, Any]:
    """Payload for an announcement about a seat the singer still holds.

    `scope` is the naming scope, three queries' worth. A caller announcing a
    whole board at once resolves it ONCE for the piece and passes it in — every
    seat on that board shares the arrangement, so recomputing it per singer buys
    nothing and costs the transaction three queries per row.
    """
    return PieceCastingMetadata(
        piece_id=casting.piece_id,
        piece_title=casting.piece.title,
        # Language-neutral CODE — localized per surface at render time.
        voice_line=casting.voice_line,
        voice_scope=(
            _piece_voice_scope(casting.piece_id, project) if scope is None else scope
        ),
        project_id=project.id,
        project_name=project.title,
        **build_event_time_metadata(
            project.date_time,
            project.timezone,
            fallback_timezone=DEFAULT_EVENT_TIMEZONE,
        ),
        changes=changes,
    ).model_dump(mode="json")


def _casting_removed_metadata(piece_title: str, project: Project) -> dict[str, Any]:
    """Payload for a seat that no longer exists — no voice line, nothing to open."""
    return PieceCastingMetadata(
        piece_title=piece_title,
        project_id=project.id,
        project_name=project.title,
        event="removed",
    ).model_dump(mode="json")


@dataclass(frozen=True)
class ArtistMergeReport:
    """What a merge actually moved, so the manager who took the decision is told
    what it cost rather than just that it succeeded."""

    participations_moved: int = 0
    participations_folded: int = 0
    castings_moved: int = 0
    castings_dropped: int = 0
    readiness_moved: int = 0
    attendances_moved: int = 0
    attendances_dropped: int = 0
    threads_moved: int = 0
    projects_conducted: int = 0
    statuses_upgraded: int = 0
    # Projects where the duplicate's fee stayed on its folded seat: the survivor
    # had a fee of its own, or the budget is closed. This says where to go and
    # look — money is not something a cleanup gets to choose between.
    fee_conflicts: tuple[str, ...] = ()


class ArtistHRService:
    """Service handling HR operations, onboarding, and artist lifecycles."""

    # A person who answered "yes" on one of their two rows has answered yes.
    # Ranked so the surviving participation can adopt the stronger answer
    # without the merge having to ask which row was "the real one".
    _PARTICIPATION_RANK: ClassVar[dict[str, int]] = {
        Participation.Status.DECLINED: 0,
        Participation.Status.INVITED: 1,
        Participation.Status.CONFIRMED: 2,
    }

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
                    instrument=dto.instrument or "",
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
    def merge_artists(primary: Artist, duplicate: Artist, *, actor: "User | None" = None) -> ArtistMergeReport:
        """Folds one roster row into another and retires the emptied one.

        Two `Artist` rows for one human are possible because uniqueness is on
        the e-mail column alone, and they are not a cosmetic problem: the two
        rows split one person's history in half and the concert sheet counts
        them as two singers. Nothing is deleted here — every row that carries
        history is repointed at `primary`, and the emptied row leaves through
        the same door as any other departure (`archive_artist`), so its record
        survives and its account stops signing in.

        Two rules the caller cannot override:

        - **An activated duplicate is refused.** A usable password means someone
          has signed in at that address, and retiring the row would take their
          login with it. Which of two live accounts survives is not a decision a
          cleanup makes.
        - **A project both rows appear in keeps the primary's participation.**
          The other one is soft-deleted after its castings, readiness and
          attendance move across — the alternative, repointing it, would break
          `unique_active_project_participation` and put the same singer on the
          riser twice. Its fee moves to the primary's seat through the ledger
          (`LedgerService.fold_seat`), which logs the move under `actor`.
        """
        from messaging.models import Thread

        if primary.pk == duplicate.pk:
            raise ArtistMergeException("An entry cannot be merged into itself.")
        if primary.is_deleted:
            raise ArtistMergeException(
                "The surviving entry is archived. Restore it before merging into it."
            )

        duplicate_user = duplicate.user
        if duplicate_user is not None and duplicate_user.has_usable_password():
            raise ActivatedArtistMergeException()

        with transaction.atomic():
            report = ArtistHRService._merge_participations(primary, duplicate, actor=actor)

            # The podium and the conversations follow the person, not the row.
            # `all_objects` on purpose: a soft-deleted project or thread still
            # holds a reference, and leaving it behind would split the history
            # this merge exists to reunite.
            projects_conducted = Project.all_objects.filter(
                conductor=duplicate
            ).update(conductor=primary)
            threads_moved = Thread.all_objects.filter(artist=duplicate).update(
                artist=primary
            )

            ArtistHRService.archive_artist(duplicate)

        logger.info(
            "Artist %s merged into %s (%s participations moved, %s folded)",
            duplicate.pk, primary.pk,
            report.participations_moved, report.participations_folded,
        )
        return replace(
            report,
            projects_conducted=projects_conducted,
            threads_moved=threads_moved,
        )

    @staticmethod
    def _merge_participations(primary: Artist, duplicate: Artist, *, actor: "User | None") -> ArtistMergeReport:
        """Moves the duplicate's participations, folding the ones that collide.

        A collision is the normal case for the duplicate that gets noticed —
        both rows were invited to the same concert, which is exactly how the
        person ends up printed twice in one voice section.
        """
        moved = folded = statuses_upgraded = 0
        castings_moved = castings_dropped = 0
        readiness_moved = attendances_moved = attendances_dropped = 0
        fee_conflicts: list[str] = []

        surviving = {
            participation.project_id: participation
            for participation in primary.participations.all()
        }

        for participation in duplicate.participations.select_related('project').all():
            target = surviving.get(participation.project_id)

            if target is None:
                participation.artist = primary
                participation.save(update_fields=['artist', 'updated_at'])
                surviving[participation.project_id] = participation
                moved += 1
                continue

            # One seat per piece and one attendance per rehearsal are already
            # taken where the two rows overlap; those rows are the duplicate's
            # copy of a fact the survivor already records.
            taken_pieces = set(target.castings.values_list('piece_id', flat=True))
            castings_moved += ProjectPieceCasting.objects.filter(
                participation=participation
            ).exclude(piece_id__in=taken_pieces).update(participation=target)
            castings_dropped += ProjectPieceCasting.objects.filter(
                participation=participation
            ).delete()[0]

            taken_readiness = set(
                target.piece_readiness.values_list('piece_id', flat=True)
            )
            readiness_moved += PieceReadiness.objects.filter(
                participation=participation
            ).exclude(piece_id__in=taken_readiness).update(participation=target)
            PieceReadiness.objects.filter(participation=participation).delete()

            taken_rehearsals = set(
                target.attendances.values_list('rehearsal_id', flat=True)
            )
            attendances_moved += Attendance.objects.filter(
                participation=participation
            ).exclude(rehearsal_id__in=taken_rehearsals).update(participation=target)
            attendances_dropped += Attendance.objects.filter(
                participation=participation
            ).delete()[0]

            for rehearsal in participation.invited_rehearsals.all():
                rehearsal.invited_participations.add(target)
                rehearsal.invited_participations.remove(participation)

            fields: list[str] = []
            if (
                ArtistHRService._PARTICIPATION_RANK.get(participation.status, -1)
                > ArtistHRService._PARTICIPATION_RANK.get(target.status, -1)
            ):
                target.status = participation.status
                fields.append('status')
                statuses_upgraded += 1

            if LedgerService.fold_seat(participation, target, actor=actor):
                fee_conflicts.append(participation.project.title)

            if fields:
                target.save(update_fields=[*fields, 'updated_at'])

            participation.delete()
            folded += 1

        return ArtistMergeReport(
            participations_moved=moved,
            participations_folded=folded,
            castings_moved=castings_moved,
            castings_dropped=castings_dropped,
            readiness_moved=readiness_moved,
            attendances_moved=attendances_moved,
            attendances_dropped=attendances_dropped,
            statuses_upgraded=statuses_upgraded,
            fee_conflicts=tuple(fee_conflicts),
        )

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


class ProjectPublicationService:
    """The one act that takes a project out of silence.

    While a project is a DRAFT nothing reaches its cast (see
    notifications/announcements.py). Publication is therefore not a status field
    the conductor happens to flip — it is the moment every invited singer learns
    the concert exists, and the only message they get before deciding whether to
    sing it. It runs through here so the preview the conductor is shown and the
    fan-out that follows are computed by the same code.
    """

    # Language-neutral codes; the client localizes them. These are warnings, never
    # blockers: an incomplete project may still be a deliberate publication (a date
    # announced before the programme is settled), and refusing it would put this
    # service in charge of an editorial decision that is the conductor's.
    _WARNING_NO_CAST = "no_cast"
    _WARNING_NO_REHEARSALS = "no_rehearsals"
    _WARNING_NO_PROGRAM = "no_program"
    _WARNING_NO_LOCATION = "no_location"
    _WARNING_UNREACHABLE = "unreachable_artists"

    @staticmethod
    def preview(project: Project) -> dict[str, Any]:
        """What publishing this project would do, without doing it.

        Publication is irreversible in the only sense that matters — a message
        cannot be recalled — so the conductor sees the recipients and the gaps
        first.
        """
        participations = list(
            Participation.objects.filter(project=project, is_deleted=False)
            .select_related("artist")
            .order_by("artist__last_name", "artist__first_name")
        )
        addressable = [
            participation for participation in participations
            if participation.status == Participation.Status.INVITED
        ]
        unreachable = [
            participation for participation in addressable
            if not participation.artist.user_id
        ]

        warnings: list[str] = []
        if not participations:
            warnings.append(ProjectPublicationService._WARNING_NO_CAST)
        if not Rehearsal.objects.filter(project=project).exists():
            warnings.append(ProjectPublicationService._WARNING_NO_REHEARSALS)
        if not ProgramItem.objects.filter(project=project).exists():
            warnings.append(ProjectPublicationService._WARNING_NO_PROGRAM)
        if project.location_id is None:
            warnings.append(ProjectPublicationService._WARNING_NO_LOCATION)
        if unreachable:
            warnings.append(ProjectPublicationService._WARNING_UNREACHABLE)

        return {
            "project_id": str(project.id),
            "status": project.status,
            # Already-published projects are reported rather than rejected, so the
            # client can render the reason instead of an error.
            "is_publishable": project.status == Project.Status.DRAFT,
            "recipient_count": len(addressable) - len(unreachable),
            "recipients": [
                {
                    "participation_id": str(participation.id),
                    "artist_name": (
                        f"{participation.artist.first_name} "
                        f"{participation.artist.last_name}"
                    ).strip(),
                    "is_reachable": bool(participation.artist.user_id),
                }
                for participation in addressable
            ],
            # Confirmed and declined participations are deliberately not addressed
            # (see send_invitations); surfacing the count keeps the conductor from
            # reading a smaller recipient list as a bug.
            "skipped_count": len(participations) - len(addressable),
            "warnings": warnings,
        }

    @staticmethod
    def publish(project: Project) -> Project:
        """Take the project live and invite everyone still awaiting an answer."""
        if project.status != Project.Status.DRAFT:
            raise ProjectAlreadyPublishedException(
                _("Only a draft can be published; this project is already live.")
            )

        with transaction.atomic():
            project.status = Project.Status.ACTIVE
            project.save(update_fields=["status", "updated_at"])
            ProjectPublicationService.send_invitations(project)

        logger.info("Project '%s' published; invitations dispatched.", project.title)
        return project

    @staticmethod
    def send_invitations(
        project: Project,
        participations: Sequence[Participation] | None = None,
    ) -> int:
        """Fan the full invitation out, and return how many were dispatched.

        Called with no participations it addresses everyone still awaiting an
        answer — the publication fan-out. Called with one it is the same message
        for a singer added to an already-live project: for them the whole project
        is news, so they get the full picture rather than the bare concert date
        the rest of the cast has long since read.

        Confirmed and declined participations are never addressed: a confirmed
        singer has already accepted (the project creator is auto-confirmed on
        their own project) and a declined one has answered. Both would read a
        fresh invitation as a mistake.
        """
        if not is_announceable(project):
            # `announce` withholds each of these anyway; returning here keeps the
            # context queries off every participation write on a draft.
            return 0

        if participations is None:
            participations = list(
                Participation.objects.filter(
                    project=project,
                    is_deleted=False,
                    status=Participation.Status.INVITED,
                ).select_related(
                    "artist", "project", "project__location", "project__conductor"
                )
            )
        else:
            participations = [
                participation for participation in participations
                if participation.status == Participation.Status.INVITED
            ]
        if not participations:
            return 0

        context = build_invitation_context(project)
        dispatched = 0
        for participation in participations:
            if not participation.artist.user_id:
                continue
            announce(
                project=project,
                recipient_id=str(participation.artist.user_id),
                notification_type=NotificationType.PROJECT_INVITATION,
                level=NotificationLevel.INFO,
                metadata=build_invitation_metadata(participation, context),
            )
            dispatched += 1
        return dispatched


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
                )
            logger.info(f"Project '{project.title}' created by {user.email} with timezone {resolved_timezone}")
            return project
            
    # Maps a model attribute to a stable, localizable change key. Keys (not English
    # labels) drive both rendering and the urgency escalation below.
    #
    # The day-of logistics belong here for the same reason the run sheet does:
    # they are facts the cast acts on, and a singer who read the day card
    # yesterday has no way of learning that the door moved. Each note keeps its
    # own key, because each is its own fact with its own name — grouping them
    # would produce one row that names an hour or a sentence without saying
    # which of three it belongs to. The contact is the exception and is one
    # entry: a name and a number are one person to call.
    _PROJECT_CHANGE_KEYS: ClassVar[dict[str, str]] = {
        "title": "title", "date_time": "date_time", "location_id": "location",
        "call_time": "call_time", "status": "status", "conductor": "conductor",
        "dress_code_male": "dress_code", "dress_code_female": "dress_code",
        # A concert that turns into a Mass changes what the cast is preparing —
        # the running order becomes an order of service — so it is a change the
        # singer is told about, not one that lands silently in the programme.
        "event_kind": "event_kind",
        "entrance_note": "entrance", "parking_note": "parking",
        "dressing_room_note": "dressing_room",
        "onsite_contact_name": "onsite_contact",
        "onsite_contact_phone": "onsite_contact",
    }

    # The two typed windows, each as (change key, opening column, closing one).
    # Diffed as pairs rather than through the map above — see
    # :func:`roster.domain.day_timeline.format_time_window`.
    _DAY_WINDOWS: ClassVar[tuple[tuple[str, str, str], ...]] = (
        ("warmup", "warmup_start", "warmup_end"),
        ("soundcheck", "soundcheck_start", "soundcheck_end"),
    )

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

        # Leaving DRAFT is the project's publication: the cast has heard nothing so
        # far, so this save owes them an invitation rather than a field diff.
        was_draft = project.status == Project.Status.DRAFT

        # Read before anything is written onto the instance: the loop below sets
        # the four window columns one at a time, so the pair can only be
        # compared as a whole from here.
        old_windows = {
            key: format_time_window(getattr(project, start), getattr(project, end))
            for key, start, end in ProjectManagementService._DAY_WINDOWS
        }

        # Publication is one-way. Sending a live project back to DRAFT would
        # silence a concert the cast is already preparing for and would leave its
        # pending announcements unreachable behind the draft gate.
        if not was_draft and update_data.get('status') == Project.Status.DRAFT:
            raise ProjectUnpublishException(
                _("A published project cannot be turned back into a draft.")
            )

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
                    # Fields outside the surfaceable set (description, spotify URL,
                    # and the window columns diffed as pairs below) persist
                    # silently here — a note tweak isn't worth alerting the cast.
                setattr(project, attr, value)

            for key, start, end in ProjectManagementService._DAY_WINDOWS:
                new_window = format_time_window(
                    getattr(project, start), getattr(project, end)
                )
                if new_window != old_windows[key]:
                    changes.append(_change(key, old_windows[key], new_window))

            project.save()

            # A project leaving DRAFT is being published, and publication supersedes
            # the field diff of the same save: the invitation already carries every
            # fact the diff would have listed, and the cast has no prior state to
            # diff against anyway. A draft abandoned or cancelled before it was ever
            # published stays silent for the same reason — nobody was told it existed.
            #
            # The publish endpoint is the intended door and shows a preview first;
            # this branch is the backstop for a bare status PATCH, so no path can
            # take a project live and leave its cast uninvited.
            if was_draft:
                if project.status == Project.Status.ACTIVE:
                    ProjectPublicationService.send_invitations(project)
                return project

            if changes:
                # A move to CANCELLED is an alarm of its own — not one field change
                # among several. It supersedes any other edit in the same save, so
                # the cast reads "cancelled" instead of decoding "Status: … → CANC".
                # It also supersedes the whole pending queue: nothing held back about
                # a concert that is off is worth publishing afterwards.
                if project.status == Project.Status.CANCELLED and any(
                    c["field"] == "status" for c in changes
                ):
                    AnnouncementQueue.discard(project)
                    cancelled_metadata = ProjectCancelledMetadata(
                        project_id=project.id,
                        project_name=project.title,
                    ).model_dump(mode="json")
                    announce_bulk(
                        project=project,
                        # Everyone still in the conversation, not only the
                        # confirmed: right after publication the whole cast is
                        # INVITED, and they are precisely the people whose pending
                        # decision this cancellation answers.
                        recipient_ids=NotificationRecipientPolicy.in_conversation(
                            Participation.objects.filter(project=project, is_deleted=False)
                        ),
                        notification_type=NotificationType.PROJECT_CANCELLED,
                        level=NotificationLevel.URGENT,
                        metadata=cancelled_metadata,
                    )
                    return project

                # De-duplicate on the structured key (dress_code_male/female both map
                # to one "dress_code" change; conductor may repeat).
                unique_changes = list({c["field"]: c for c in changes}.values())
                metadata = ProjectUpdatedMetadata(
                    project_id=project.id,
                    project_name=project.title,
                    changes=unique_changes,
                ).model_dump(mode="json")

                # WARNING is the baseline; the queue escalates the individual rows
                # that move a time the cast has to keep, so a reschedule that is
                # reverted before publication loses its urgency with its row.
                queue_broadcast(
                    project=project,
                    subject_type=AnnouncementSubject.PROJECT,
                    subject_id=str(project.id),
                    kind=AnnouncementKind.CHANGED,
                    notification_type=NotificationType.PROJECT_UPDATED,
                    level=NotificationLevel.WARNING,
                    metadata=metadata,
                )

        return project

    @staticmethod
    def delete_participation(participation: Participation) -> None:
        artist_id = participation.artist_id
        user_id = participation.artist.user_id
        project = participation.project
        project_name = project.title

        with transaction.atomic():
            participation.delete()

            if user_id:
                # Whatever was queued about this person's part is moot now — they
                # are off the cast and it would arrive as news about a project they
                # can no longer open. Dropped before the removal is queued, so the
                # row recording it survives.
                AnnouncementQueue.discard_recipient(project, str(user_id))

                metadata = ProjectUpdatedMetadata(
                    project_name=project_name,
                    event="removed",
                ).model_dump(mode="json")

                # Queued like every other edit, and for the reason the queue exists
                # at all: a mis-click must be undoable. Told at once, "you're off
                # the roster" is the one announcement that cannot be taken back, and
                # re-adding the singer a minute later cannot unsay it. Held, it
                # cancels out against the re-add and nobody is ever the wiser.
                #
                # Published, it never folds into a briefing (see
                # _STANDALONE_SUBJECTS): this is a message about leaving, not a
                # bullet under "what's new in Requiem". The subject is the artist
                # rather than the participation row, because a re-add may create a
                # fresh one and the two must still cancel.
                queue_announcement(
                    project=project,
                    recipient_id=str(user_id),
                    subject_type=AnnouncementSubject.PARTICIPATION,
                    subject_id=str(artist_id),
                    kind=AnnouncementKind.REMOVED,
                    notification_type=NotificationType.PROJECT_UPDATED,
                    level=NotificationLevel.WARNING,
                    metadata=metadata,
                )
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
                # Update any new values passed in the request (e.g., a new status)
                for attr, value in validated_data.items():
                    setattr(archived_participation, attr, value)
                
                archived_participation.restore() # Saves and sets is_deleted=False
                participation = archived_participation
            else:
                # 2B. CREATE PATH
                participation = Participation.objects.create(**validated_data)

            # 2C. The section this singer walks into is usually the one they left
            # last time, so their place in it travels with them. Without this the
            # conductor re-arranges forty people at the start of every project,
            # which he would do twice and then stop — and every list in the app
            # would quietly fall back to alphabetical for good.
            if participation.section_rank is None:
                inherited = ProjectManagementService._last_known_section_rank(
                    participation
                )
                if inherited is not None:
                    participation.section_rank = inherited
                    participation.save(update_fields=['section_rank'])

            # 3. Undo a removal that was never announced. Taking someone off a cast
            # is queued (see delete_participation), so a mis-click put back before
            # the conductor publishes must leave no trace — the singer is not told
            # they left, because as far as anyone outside this app is concerned they
            # never did.
            AnnouncementQueue.discard_subject(
                participation.project,
                AnnouncementSubject.PARTICIPATION,
                str(participation.artist_id),
            )

            # 4. Dispatch Notification (an invitation, whether fresh or restored).
            # On a draft this is withheld — the cast is assembled in silence and every
            # pending invitation goes out together when the project is published.
            ProjectPublicationService.send_invitations(
                participation.project, [participation]
            )

        return participation

    @staticmethod
    def _last_known_section_rank(participation: Participation) -> int | None:
        """The place this singer held the last time anyone arranged their section.

        A rank is a score, not a slot, so carrying one across projects needs no
        renumbering: the cast it lands in sorts by the same comparison, and two
        singers who arrive holding the same number simply fall through to the
        tie-breakers under it. The first drag makes the section dense again.
        """
        return (
            Participation.objects
            .filter(artist_id=participation.artist_id, section_rank__isnull=False)
            .exclude(pk=participation.pk)
            # Undated projects are drafts and plans; they say less about where
            # this singer stands than the last concert that actually happened.
            .order_by(F('project__date_time').desc(nulls_last=True), '-created_at')
            .values_list('section_rank', flat=True)
            .first()
        )

    @staticmethod
    def reorder_cast(
        project: Project, rows: Sequence[CastOrderRowDTO]
    ) -> list[Participation]:
        """Write one rearranged voice section, whole.

        Deliberately silent: a singer moved from third to second place in the
        sopranos has had nothing about their engagement changed, and a
        notification saying otherwise would be noise on the one screen the
        conductor fiddles with most. ``bulk_update`` also keeps this off the
        participation-update path, which exists to re-ask people about things
        that actually concern them.
        """
        if not rows:
            return []

        by_id = {
            participation.id: participation
            for participation in Participation.objects.filter(
                project=project, is_deleted=False
            ).select_related('artist')
        }
        missing = [row for row in rows if row.participation not in by_id]
        if missing:
            raise ParticipationException(
                _("Cannot order an artist who is not a participant of this project.")
            )

        ordered: list[Participation] = []
        for row in rows:
            participation = by_id[row.participation]
            participation.section_rank = row.section_rank
            ordered.append(participation)

        with transaction.atomic():
            Participation.objects.bulk_update(ordered, ['section_rank'])

        return ordered


class ManagerNotificationHelper:
    @staticmethod
    def notify_managers(
        notification_type: str,
        metadata: dict,
        level: str = NotificationLevel.INFO,
        exclude_user_id: int | str | None = None,
    ):
        """Utility method to send notifications to all Managers and Admins in
        the system. `exclude_user_id` leaves out the manager who caused the
        event — a report of one's own action is noise."""
        managers = User.objects.filter(
            profile__role__in=['MANAGER', 'ADMIN'],
            is_active=True
        )
        if exclude_user_id is not None:
            managers = managers.exclude(id=exclude_user_id)
        manager_ids = managers.values_list('id', flat=True)

        if manager_ids:
            send_bulk_notifications_task.delay(
                recipient_ids=[str(uid) for uid in manager_ids],
                notification_type=notification_type,
                level=level,
                metadata=metadata
            )

def rehearsal_ics_payload(rehearsal: Rehearsal) -> dict:
    """Lightweight calendar payload carried in notification metadata so the email
    layer can attach a localized 'add to calendar' .ics. Push ignores it.

    The only place a rehearsal's end may be assumed, and only because the reader
    is a calendar: an untimed session still has to reserve a block, or the
    evening renders as a zero-length mark. The message copy beside it stays
    silent about the end instead.
    """
    location_name = rehearsal.location.name if rehearsal.location else ""
    end = rehearsal.end_date_time or (
        rehearsal.date_time + timedelta(minutes=FALLBACK_REHEARSAL_DURATION_MINUTES)
    )
    return {
        "kind": "rehearsal",
        "uid": f"rehearsal_{rehearsal.id}@voctensemble.com",
        "start": rehearsal.date_time.isoformat(),
        "end": end.isoformat(),
        "project_name": rehearsal.project.title,
        "location": location_name,
        "focus": rehearsal.focus or "",
    }


def rehearsal_plan_lines(
    rehearsal: Rehearsal, now: datetime | None = None,
) -> list[dict[str, str | bool]]:
    """The plan as a message carries it: one entry per row, in plan order,
    with its anchor, its title, its note and whether it is reserve. Only the
    clock the conductor typed is printed, never one derived from minutes:
    the choir is told promises, not the budget — the reader's own part of
    the evening travels as the window, which reads every clock. Nothing
    while the plan is a draft (`Rehearsal.plan_is_public`) — the reminder
    must not publish what the conductor has not.

    Kept out of `rehearsal_notification_context` on purpose. That context is
    shared by every rehearsal notice, and a cancellation or a change of date
    listing what was going to be rehearsed buries the one fact it is sent for.
    Only the reminder — the message a singer plans the evening from — carries
    the plan.
    """
    if not rehearsal.plan_is_public(now):
        return []
    return [
        {
            'time': item.starts_at.strftime('%H:%M') if item.starts_at else '',
            'title': item.title,
            'note': item.note,
            'reserve': item.is_reserve,
        }
        for item in rehearsal.plan_items.select_related('piece').all()
    ]


def rehearsal_notification_context(rehearsal: Rehearsal) -> dict[str, str]:
    """Compact rehearsal facts reused by push, email, and in-app surfaces."""
    return {
        **build_event_time_metadata(
            rehearsal.date_time,
            rehearsal.timezone,
            fallback_timezone=DEFAULT_EVENT_TIMEZONE,
            end=rehearsal.end_date_time,
        ),
        "location": rehearsal.location.name if rehearsal.location else "",
        "focus": rehearsal.focus or "",
    }


def _actor_name(user: "User | None") -> str:
    """Who performed a gesture, for the person it was performed on.

    Blank when there is no usable name — the composers all fall back to neutral
    copy ("the management team"), which reads better than a bare username or a
    sentence with a hole in it.
    """
    if user is None:
        return ""
    full = f"{user.first_name} {user.last_name}".strip()
    return full or ""


class RehearsalDelegationService:
    """Appointing the leader of one project — somebody who is not a manager —
    and taking the appointment back.

    Every write goes through here for one reason: a delegation lends out the
    conductor's markings and the choir's attendance record, and who did that for
    whom has to be answerable afterwards. The audit line is the point of the
    service, not a side effect of it.
    """

    @staticmethod
    def suggested_leader(project: Project) -> Artist | None:
        """Who the add form should pre-select for this project: the most recently
        appointed leader anywhere, if that person is still active and does not
        already lead this project.

        A suggestion and nothing more. The conductor normally wants one person
        for every programme but decides it per concert, so the last appointment
        is the best guess and the click stays his — nobody is handed a project
        by the form remembering them. Read from `all_objects`: a revoked or
        expired grant still says who was last trusted with a programme.

        Ordered by `updated_at`, never `created_at`: `grant` is an upsert that
        revives soft-deleted rows, so the creation stamp is the FIRST time this
        pair was ever written and says nothing about who was trusted last.
        Instrumentalists are out for the same reason the picker never offers
        them — they do not stand in front of the choir — and a suggestion the
        picker cannot show is a suggestion that silently does nothing.
        """
        already_leading = (
            RehearsalDelegate.objects
            .filter(live_delegate_q(scope='any'), project=project)
            .values('artist_id')
        )
        recent = (
            RehearsalDelegate.all_objects
            .filter(artist__is_deleted=False, artist__is_active=True)
            .exclude(artist__voice_type=VoiceType.INSTRUMENTALIST)
            .exclude(artist_id__in=already_leading)
            .select_related('artist')
            .order_by('-updated_at')
            .first()
        )
        return recent.artist if recent else None

    @staticmethod
    def _log(event: str, delegate: RehearsalDelegate, actor: "User | None") -> None:
        logger.info(
            "rehearsal_delegation:%s actor=%s artist=%s project=%s "
            "marks=%s roll_call=%s materials=%s choir_marks=%s expires=%s",
            event,
            getattr(actor, 'pk', None),
            delegate.artist_id,
            delegate.project_id,
            delegate.can_see_leader_marks,
            delegate.can_take_roll_call,
            delegate.can_open_materials,
            delegate.can_mark_for_choir,
            delegate.expires_at.isoformat() if delegate.expires_at else '',
        )

    @staticmethod
    def grant(
        *,
        project: Project,
        granted_by: "User | None",
        artist: Artist,
        **scopes: Any,
    ) -> RehearsalDelegate:
        """Give `artist` this project, or rewrite the grant they already have.

        An upsert rather than an insert: the uniqueness constraint is scoped to
        live rows, so a second grant after a revoke would otherwise depend on
        whether anyone had ever revoked one. "This person leads it" is the
        gesture; how many rows it took to say so is not the manager's problem.

        The person is TOLD, but only when the answer to "am I running this?"
        changes from no to yes. Narrowing a scope on a live delegation is a
        correction to something they already know about, and announcing it again
        would teach them to ignore the announcement that matters.
        """
        with transaction.atomic():
            was_live = RehearsalDelegate.objects.filter(
                project=project, artist=artist,
            ).exists()
            delegate, _created = RehearsalDelegate.all_objects.update_or_create(
                project=project,
                artist=artist,
                defaults={
                    **scopes,
                    'granted_by': granted_by,
                    'is_deleted': False,
                },
            )
        RehearsalDelegationService._log('granted', delegate, granted_by)
        if not was_live:
            RehearsalDelegationService._announce_granted(delegate, granted_by)
        return delegate

    @staticmethod
    def revoke(delegate: RehearsalDelegate, *, revoked_by: "User | None") -> None:
        """End a delegation. Soft, like every other deletion here, so the audit
        trail keeps a row to point at.

        Announced for the same reason the grant is, and it is the more urgent
        half: access disappearing in silence is discovered by standing in front
        of a choir with the conductor's cues closed.
        """
        RehearsalDelegationService._log('revoked', delegate, revoked_by)
        delegate.delete()
        RehearsalDelegationService.release_future_rehearsals(
            project_id=delegate.project_id, artist_id=delegate.artist_id,
        )
        RehearsalDelegationService._announce_revoked(delegate, revoked_by)

    @staticmethod
    def release_future_rehearsals(*, project_id, artist_id) -> None:
        """Hand this artist's evenings still ahead back to the conductor.

        Called wherever the power to run them ends by a manager's gesture — the
        grant revoked, or its roll call switched off. An announcement naming
        somebody the register now refuses would be a lie on every singer's
        timeline, and would make the evening unsavable in the rehearsal form,
        which re-sends the field on every edit.

        Past evenings keep the name: they are history, and the dossier counts
        them. Expiry by the clock raises no gesture to hang this on, so a
        lapsed grant leaves the name standing — `RehearsalSerializer` does not
        re-judge an unchanged value for exactly that reason.
        """
        Rehearsal.objects.filter(
            project_id=project_id,
            led_by_id=artist_id,
            date_time__gte=timezone.now(),
        ).update(led_by=None)

    @staticmethod
    def log_change(delegate: RehearsalDelegate, *, changed_by: "User | None") -> None:
        """Record a narrowed or extended scope. Called after the write so the
        line describes what the delegation now says, not what it used to.

        Silent by design — see `grant`.
        """
        RehearsalDelegationService._log('changed', delegate, changed_by)

    @staticmethod
    def _next_led_rehearsal(delegate: RehearsalDelegate) -> Rehearsal | None:
        """The soonest rehearsal this delegation actually covers, if one is on
        the calendar yet. A grant made a fortnight ahead legitimately covers
        nothing so far, and that is not a failure — the briefing then offers the
        schedule instead of an evening."""
        return (
            Rehearsal.objects
            .filter(project_id=delegate.project_id, date_time__gte=timezone.now())
            .select_related('location')
            .order_by('date_time')
            .first()
        )

    @staticmethod
    def _recipient_id(delegate: RehearsalDelegate) -> str | None:
        """A delegation can be recorded against a singer who has no account yet
        — the roster holds people, not logins. There is then nobody to tell, and
        that is a fact to log rather than an error to raise."""
        user_id = delegate.artist.user_id
        if not user_id:
            logger.info(
                "rehearsal_delegation:no_account artist=%s project=%s",
                delegate.artist_id, delegate.project_id,
            )
            return None
        return str(user_id)

    @staticmethod
    def _announce_granted(
        delegate: RehearsalDelegate, granted_by: "User | None",
    ) -> None:
        """Tell the stand-in what they have been handed, and what it opens.

        Every scope flag travels: a delegation is three permissions that leak
        differently, so "you are running rehearsals" on its own would leave the
        reader guessing whether the conductor's cues are among them.
        """
        recipient_id = RehearsalDelegationService._recipient_id(delegate)
        if not recipient_id:
            return

        next_rehearsal = RehearsalDelegationService._next_led_rehearsal(delegate)
        upcoming = None
        if next_rehearsal is not None:
            upcoming = DelegatedRehearsalMetadata(
                rehearsal_id=next_rehearsal.id,
                location=(
                    next_rehearsal.location.name if next_rehearsal.location else ""
                ),
                focus=next_rehearsal.focus or "",
                **build_event_time_metadata(
                    next_rehearsal.date_time,
                    next_rehearsal.timezone,
                    fallback_timezone=DEFAULT_EVENT_TIMEZONE,
                    end=next_rehearsal.end_date_time,
                ),
            )

        expires = delegate.expires_at
        metadata = RehearsalDelegationMetadata(
            project_id=delegate.project_id,
            project_name=delegate.project.title,
            granted_by_name=_actor_name(granted_by),
            can_see_leader_marks=delegate.can_see_leader_marks,
            can_take_roll_call=delegate.can_take_roll_call,
            can_open_materials=delegate.can_open_materials,
            can_mark_for_choir=delegate.can_mark_for_choir,
            expires_at=expires.isoformat() if expires else None,
            expires_at_display=(
                format_event_time(expires, DEFAULT_EVENT_TIMEZONE, DEFAULT_EVENT_TIMEZONE)
                if expires else ""
            ),
            timezone=DEFAULT_EVENT_TIMEZONE,
            note=delegate.note or "",
            next_rehearsal=upcoming,
        ).model_dump(mode="json")

        transaction.on_commit(
            lambda: send_notification_task.delay(
                recipient_id=recipient_id,
                notification_type=NotificationType.REHEARSAL_DELEGATED,
                level=NotificationLevel.INFO,
                metadata=metadata,
            )
        )

    @staticmethod
    def _announce_revoked(
        delegate: RehearsalDelegate, revoked_by: "User | None",
    ) -> None:
        """Tell them it has ended. The urgent half of the pair: access that
        disappears in silence is discovered in front of a choir."""
        recipient_id = RehearsalDelegationService._recipient_id(delegate)
        if not recipient_id:
            return
        metadata = RehearsalDelegationEndedMetadata(
            project_id=delegate.project_id,
            project_name=delegate.project.title,
            revoked_by_name=_actor_name(revoked_by),
        ).model_dump(mode="json")
        transaction.on_commit(
            lambda: send_notification_task.delay(
                recipient_id=recipient_id,
                notification_type=NotificationType.REHEARSAL_DELEGATION_ENDED,
                level=NotificationLevel.INFO,
                metadata=metadata,
            )
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

            if rehearsal.led_by_id:
                RehearsalOperationsService._announce_lead_assigned(rehearsal)

            metadata = RehearsalScheduledMetadata(
                rehearsal_id=rehearsal.id,
                project_id=rehearsal.project_id,
                project_name=rehearsal.project.title,
                **rehearsal_notification_context(rehearsal),
            ).model_dump(mode="json")
            metadata["ics"] = rehearsal_ics_payload(rehearsal)

            # No recipients are resolved here: a sectional's audience is read off
            # the rehearsal when the queue is published, so singers invited to it
            # later are still reached by this same announcement.
            queue_broadcast(
                project=rehearsal.project,
                subject_type=AnnouncementSubject.REHEARSAL,
                subject_id=str(rehearsal.id),
                kind=AnnouncementKind.CREATED,
                notification_type=NotificationType.REHEARSAL_SCHEDULED,
                level=NotificationLevel.INFO,
                metadata=metadata,
            )
        return rehearsal

    # Stable, localizable change keys (not English labels). `is_mandatory` is
    # handled separately below — a raw boolean diff ("True → False") reads badly,
    # so it becomes a self-describing state change instead.
    _REHEARSAL_CHANGE_KEYS: ClassVar[dict[str, str]] = {
        "date_time": "date_time", "location_id": "location", "focus": "focus",
        # Carried as a raw minute count, not a rendered "2 godz. 30 min": the
        # diff is stored once and read by recipients in three languages, so the
        # number is the language-neutral form and the composer spells it out.
        "duration_minutes": "duration",
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

            lead_changed = False
            for attr, value in update_data.items():
                if attr in ('location', 'timezone'):
                    continue
                old_value = getattr(rehearsal, attr)
                # Who is called is not a change to the rehearsal: the invited
                # list is set below without a diff entry, and the
                # instrumentalists' flag and the called sections are the same
                # kind of fact. The queue
                # resolves recipients off the rehearsal at publish time, so a
                # newly called player is reached by whatever is announced next.
                # Who leads is not a diff for the cast either — the cast reads
                # it off the schedule, and the person named is told directly.
                if attr == "led_by_id":
                    lead_changed = old_value != value
                elif old_value != value and attr not in ("calls_instrumentalists", "called_sections"):
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

            # Told on set and on change, never on clear: handing an evening
            # back to the conductor is the resting case, and a push saying so
            # would read as a demotion.
            if lead_changed and rehearsal.led_by_id:
                RehearsalOperationsService._announce_lead_assigned(rehearsal)

            if changes:
                metadata = RehearsalUpdatedMetadata(
                    rehearsal_id=rehearsal.id,
                    project_id=rehearsal.project_id,
                    project_name=rehearsal.project.title,
                    **rehearsal_notification_context(rehearsal),
                    changes=changes,
                ).model_dump(mode="json")
                metadata["ics"] = rehearsal_ics_payload(rehearsal)

                # WARNING is the baseline; a move of `date_time` is escalated per
                # row by the queue, which owns that rule for every field diff.
                queue_broadcast(
                    project=rehearsal.project,
                    subject_type=AnnouncementSubject.REHEARSAL,
                    subject_id=str(rehearsal.id),
                    kind=AnnouncementKind.CHANGED,
                    notification_type=NotificationType.REHEARSAL_UPDATED,
                    level=NotificationLevel.WARNING,
                    metadata=metadata,
                )
        return rehearsal

    @staticmethod
    def _announce_lead_assigned(rehearsal: Rehearsal) -> None:
        """Tell the person named in `led_by` that this evening is theirs.

        Silent for the conductor: an explicit value equal to the podium says
        the same thing as null, and the conductor telling himself would be
        noise. Silent, and logged, for a leader with no account — the roster
        holds people, not logins. The sections travel as codes — the letters
        of `called_sections`, nothing for a tutti or a hand-picked list — so
        the push can say "(soprany, alty)" in the reader's language.
        """
        artist = rehearsal.led_by
        if artist is None or artist.pk == rehearsal.project.conductor_id:
            return
        if not artist.user_id:
            logger.info(
                "rehearsal_lead:no_account artist=%s rehearsal=%s",
                artist.pk, rehearsal.pk,
            )
            return

        metadata = RehearsalLeadAssignedMetadata(
            rehearsal_id=rehearsal.pk,
            project_id=rehearsal.project_id,
            project_name=rehearsal.project.title,
            sections=tuple(rehearsal.called_sections),
            **rehearsal_notification_context(rehearsal),
        ).model_dump(mode="json")
        recipient_id = str(artist.user_id)

        transaction.on_commit(
            lambda: send_notification_task.delay(
                recipient_id=recipient_id,
                notification_type=NotificationType.REHEARSAL_LEAD_ASSIGNED,
                level=NotificationLevel.INFO,
                metadata=metadata,
            )
        )

    # What a push can say of the debrief: enough to know whether to open it.
    DEBRIEF_EXCERPT_CHARS: ClassVar[int] = 200

    @staticmethod
    def post_debrief(rehearsal: Rehearsal, text: str, author: "User") -> Rehearsal:
        """Hand the evening back: store the report, stamp who and when, tell
        the managers.

        Refused before the rehearsal's start — a report on an evening that has
        not happened is not one. Stamped for a manager writing it too, so the
        card can always say whose words these are, and re-stamped on a wipe:
        "X cleared it at 22:14" is still a fact worth a surface. A save that
        changes nothing changes nothing — the signature under a paragraph must
        not slide forward because somebody re-opened the page and pressed save.
        The managers are told on the first write and on every change; a wipe
        and an unchanged save are silent.
        """
        if timezone.now() < rehearsal.date_time:
            raise ValueError(_("The debrief can be written once the rehearsal has started."))

        text = text.strip()
        if text == rehearsal.debrief:
            return rehearsal

        author_artist = Artist.objects.filter(user=author, is_deleted=False).first()

        with transaction.atomic():
            rehearsal.debrief = text
            rehearsal.debrief_by = author_artist
            rehearsal.debrief_at = timezone.now()
            rehearsal.save(update_fields=['debrief', 'debrief_by', 'debrief_at', 'updated_at'])

            if text:
                RehearsalOperationsService._announce_debrief_posted(rehearsal, author)
        return rehearsal

    @staticmethod
    def _announce_debrief_posted(rehearsal: Rehearsal, author: "User") -> None:
        """Tell the managers — every one but the author — that the evening's
        report is in. The body is an excerpt: the push is a reason to open
        the card, not the card. Named as the roster names them (the artist
        row) when there is one; a manager without a row goes by the account."""
        excerpt = rehearsal.debrief[:RehearsalOperationsService.DEBRIEF_EXCERPT_CHARS]
        author_artist = rehearsal.debrief_by if rehearsal.debrief_by_id else None
        author_name = (
            f"{author_artist.first_name} {author_artist.last_name}".strip()
            if author_artist is not None
            else _actor_name(author)
        )
        metadata = RehearsalDebriefPostedMetadata(
            rehearsal_id=rehearsal.pk,
            project_id=rehearsal.project_id,
            project_name=rehearsal.project.title,
            author_name=author_name,
            excerpt=excerpt,
            **rehearsal_notification_context(rehearsal),
        ).model_dump(mode="json")
        author_id = author.pk

        transaction.on_commit(lambda: ManagerNotificationHelper.notify_managers(
            notification_type=NotificationType.REHEARSAL_DEBRIEF_POSTED,
            metadata=metadata,
            exclude_user_id=author_id,
        ))

    @staticmethod
    def replace_plan(
        rehearsal: Rehearsal, rows: Sequence[RehearsalPlanRowDTO],
    ) -> list[RehearsalPlanItem]:
        """Save the plan whole, silently.

        Declarative like a divisi board: the rows arrive in their final order,
        a row naming an existing id keeps that row (and its debrief verdict),
        any row not named is gone. Silent by decision — the conductor redraws
        the plan a dozen times the day before; telling the cast is
        `announce_plan`. A piece outside the project's programme is refused:
        one project per rehearsal, and the row's piece is chosen from that
        programme.

        `Rehearsal.plan_changed_at` is stamped when anything the cast could
        notice happened — a row created, edited, moved or deleted — and only
        then, so a save of the same list leaves "zmieniony po wysłaniu"
        where it was. A row that comes back unchanged is not re-saved either,
        so its own `updated_at` still says when it was last edited.
        """
        programme = set(
            ProgramItem.objects.filter(project_id=rehearsal.project_id)
            .values_list('piece_id', flat=True)
        )
        if any(row.piece is not None and row.piece not in programme for row in rows):
            raise ValueError(_("Every piece on the plan must be in the project's programme."))

        with transaction.atomic():
            existing = {
                item.id: item
                for item in RehearsalPlanItem.objects.select_for_update().filter(rehearsal=rehearsal)
            }
            kept_ids = {row.id for row in rows if row.id is not None}
            if kept_ids - existing.keys():
                raise ValueError(_("A row on the plan does not belong to this rehearsal."))

            deleted, _by_model = (
                RehearsalPlanItem.objects.filter(rehearsal=rehearsal)
                .exclude(id__in=kept_ids)
                .delete()
            )
            touched = deleted > 0

            # Positions are unique per rehearsal and the constraint is checked
            # row by row, so a reorder written in place trips over itself.
            # The kept rows are parked beyond every position in play — old or
            # new — and then walked into their final places.
            original_position = {item.id: item.position for item in existing.values()}
            kept = [existing[row.id] for row in rows if row.id is not None]
            if kept:
                park_base = max(
                    len(rows), max(item.position for item in existing.values()),
                )
                for offset, item in enumerate(kept, start=1):
                    item.position = park_base + offset
                RehearsalPlanItem.objects.bulk_update(kept, ['position'])

            saved: list[RehearsalPlanItem] = []
            for position, row in enumerate(rows, start=1):
                values = {
                    'piece_id': row.piece,
                    'label': row.label,
                    'note': row.note,
                    'starts_at': row.starts_at,
                    # A change of minutes moves derived clocks the choir
                    # reads (their window), so it is a change of the plan.
                    'minutes': row.minutes,
                    'excluded_voice_lines': list(row.excluded_voice_lines),
                    'excludes_instrumentalists': row.excludes_instrumentalists,
                    'is_reserve': row.is_reserve,
                    'is_break': row.is_break,
                }
                if row.id is None:
                    item = RehearsalPlanItem.objects.create(
                        rehearsal=rehearsal, position=position, **values,
                    )
                    touched = True
                else:
                    item = existing[row.id]
                    changed = any(
                        getattr(item, field) != value for field, value in values.items()
                    )
                    for field, value in values.items():
                        setattr(item, field, value)
                    item.position = position
                    # A pure move counts: the order is part of what was sent.
                    if changed or original_position[item.id] != position:
                        item.save()
                        touched = True
                    else:
                        # Back from the parking slot without touching
                        # `updated_at` — on the row or on the instance.
                        RehearsalPlanItem.objects.filter(pk=item.pk).update(position=position)
                saved.append(item)

            if touched:
                rehearsal.plan_changed_at = timezone.now()
                rehearsal.save(update_fields=['plan_changed_at'])
        return saved

    @staticmethod
    def mark_plan_item(
        rehearsal: Rehearsal, item_id: UUID | str, *, done: bool,
    ) -> RehearsalPlanItem:
        """Write the debrief's explicit verdict on one row: ``done`` stamps
        `done_at`, not done stamps `skipped_at`, and each clears the other.
        The first step of the debrief, so it is refused before the rehearsal
        has started, exactly as the debrief is. A tap is always explicit —
        ticking a row the plan already reads as done still records that
        somebody said so. A break is refused: it is not a piece of work.

        Not a change to the plan the cast was sent: neither `plan_changed_at`
        nor the row's `updated_at` moves."""
        if timezone.now() < rehearsal.date_time:
            raise ValueError(_("The plan can be ticked off once the rehearsal has started."))
        item = (
            RehearsalPlanItem.objects.select_related('piece')
            .get(rehearsal=rehearsal, pk=item_id)
        )
        if item.is_break:
            raise ValueError(_("A break is not ticked off."))
        already = item.done_at is not None if done else item.skipped_at is not None
        if not already:
            now = timezone.now()
            item.done_at = now if done else None
            item.skipped_at = None if done else now
            item.save(update_fields=['done_at', 'skipped_at'])
        return item

    @staticmethod
    def announce_plan(rehearsal: Rehearsal) -> Rehearsal:
        """The conductor sends the plan: stamp the send, queue one notice for
        the cast. Through the announcement queue like every other rehearsal
        change (a DRAFT project stays silent), with the change key `plan` so
        the copy says the plan is up rather than that the evening moved. The
        push cannot personalise, so the reader's own window is not in it —
        the page it opens is exact, and the reminder carries the window.

        The first send publishes the plan (`Rehearsal.plan_is_public`); every
        later one is a revision, refused unless the plan changed since the
        last send — re-sending an identical plan is noise. A revision's copy
        says the plan CHANGED, except while the previous send is still
        waiting in the announcement queue: the cast has not heard the first
        one yet, so the one message they will get is still the plan arriving.

        The mirror of `mark_plan_item`'s gate: a plan is something to arrive
        with, so it cannot be sent once the evening is under way — the notice
        would reach phones that are already in the room."""
        if not rehearsal.plan_items.exists():
            raise ValueError(_("There is no plan to send yet."))
        if timezone.now() >= rehearsal.date_time:
            raise ValueError(_("The plan can no longer be sent once the rehearsal has started."))
        sent_before = rehearsal.plan_announced_at
        if sent_before is not None and (
            rehearsal.plan_changed_at is None or rehearsal.plan_changed_at <= sent_before
        ):
            raise ValueError(_("The plan has not changed since it was sent."))
        revised = sent_before is not None and not AnnouncementQueue.has_pending_change(
            rehearsal.project, AnnouncementSubject.REHEARSAL, str(rehearsal.id), "plan",
        )
        with transaction.atomic():
            rehearsal.plan_announced_at = timezone.now()
            rehearsal.save(update_fields=['plan_announced_at', 'updated_at'])

            metadata = RehearsalUpdatedMetadata(
                rehearsal_id=rehearsal.id,
                project_id=rehearsal.project_id,
                project_name=rehearsal.project.title,
                **rehearsal_notification_context(rehearsal),
                changes=[_change("plan", None, None)],
                plan_revised=revised,
            ).model_dump(mode="json")
            metadata["ics"] = rehearsal_ics_payload(rehearsal)
            queue_broadcast(
                project=rehearsal.project,
                subject_type=AnnouncementSubject.REHEARSAL,
                subject_id=str(rehearsal.id),
                kind=AnnouncementKind.CHANGED,
                notification_type=NotificationType.REHEARSAL_UPDATED,
                level=NotificationLevel.WARNING,
                metadata=metadata,
            )
        return rehearsal

    @staticmethod
    def delete_rehearsal(rehearsal: Rehearsal) -> None:
        qs = rehearsal.called_participations()

        # Same audience the queue would have reached with this rehearsal's
        # creation or move (AnnouncementQueue.recipients_for): telling only the
        # confirmed that it is off would leave everyone still deciding holding a
        # date that no longer exists.
        recipient_ids = NotificationRecipientPolicy.in_conversation(qs)
        project = rehearsal.project
        project_name = project.title
        metadata_context = rehearsal_notification_context(rehearsal)

        # A rehearsal that was scheduled but never announced is cancelled in
        # silence — nobody was told it existed, so its removal is not news. Either
        # way its pending rows go: the cancellation supersedes every edit made to
        # it, and a queued announcement about a rehearsal that no longer exists
        # would resolve to nothing at publish time.
        never_announced = AnnouncementQueue.has_unannounced_creation(
            project, AnnouncementSubject.REHEARSAL, str(rehearsal.id)
        )

        with transaction.atomic():
            rehearsal.delete()
            AnnouncementQueue.discard_subject(
                project, AnnouncementSubject.REHEARSAL, str(rehearsal.id)
            )

            if recipient_ids and not never_announced:
                metadata = RehearsalCancelledMetadata(
                    rehearsal_id=rehearsal.id,
                    project_id=rehearsal.project_id,
                    project_name=project_name,
                    **metadata_context,
                ).model_dump(mode="json")

                announce_bulk(
                    project=project,
                    recipient_ids=recipient_ids,
                    notification_type=NotificationType.REHEARSAL_CANCELLED,
                    level=NotificationLevel.URGENT,
                    metadata=metadata,
                )

    @staticmethod
    def record_attendance(dto: AttendanceRecordDTO) -> Attendance:
        try:
            participation = Participation.objects.select_related('artist').get(id=dto.participation_id, is_deleted=False)
            rehearsal = Rehearsal.objects.select_related('project').prefetch_related('invited_participations').get(id=dto.rehearsal_id, is_deleted=False)
        except (Participation.DoesNotExist, Rehearsal.DoesNotExist):
            raise AttendanceValidationException("Record not found.")

        if participation.project_id != rehearsal.project_id:
            raise AttendanceValidationException("Project mismatch between participation and rehearsal.")

        if not dto.can_take_roll_call and participation.artist.user_id != dto.requesting_user_id:
            raise AttendanceValidationException(
                "Can only record self-attendance unless you are taking the roll call."
            )

        # A report is about what one is going to do; once the evening is over,
        # the row is the roll call's record and only whoever takes that roll call
        # may still write it.
        if not dto.can_take_roll_call and not is_open_to_self_report(rehearsal):
            raise SelfReportWindowClosedException(str(SELF_REPORT_CLOSED_MESSAGE))

        with transaction.atomic():
            attendance, _created = Attendance.objects.update_or_create(
                rehearsal=rehearsal,
                participation=participation,
                defaults={'status': dto.status, 'minutes_late': dto.minutes_late, 'excuse_note': dto.excuse_note}
            )

            if not dto.can_take_roll_call:
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
            
            # Keyed on managership, not on the roll call: this is a VERDICT on a
            # singer's request and it reaches them as one. A stand-in ticking
            # boxes in front of the choir is recording who came, and must not
            # tell somebody their excuse was refused.
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

    @staticmethod
    def _artist_spoken_for(dto: AttendanceRangeWindowDTO) -> Artist:
        """The artist a range is about, once the asker is allowed to speak for them."""
        try:
            artist = Artist.objects.get(id=dto.artist_id, is_deleted=False)
        except Artist.DoesNotExist:
            raise AttendanceValidationException("Record not found.") from None

        if not dto.is_manager and artist.user_id != dto.requesting_user_id:
            raise AttendanceValidationException(
                "Can only record self-attendance unless you are a Manager."
            )
        return artist

    @staticmethod
    def resolve_attendance_range(
        dto: AttendanceRangeWindowDTO, artist: Artist
    ) -> list[tuple[Rehearsal, UUID]]:
        """Every rehearsal a span would reach, in the order it would write them.

        The one resolver behind three answers — the write, the count a manager is
        shown before sending, and the count the write reports back. The rehearsals
        already held drop out for a singer here rather than inside the loop, so
        the number they are promised is the number they get.
        """
        matched = get_artist_rehearsals_in_window(
            artist.id, dto.window_start, dto.window_end
        )
        if dto.is_manager:
            return matched
        return [pair for pair in matched if is_open_to_self_report(pair[0])]

    @staticmethod
    def preview_attendance_range(
        dto: AttendanceRangeWindowDTO,
    ) -> list[tuple[Rehearsal, UUID]]:
        """What `record_attendance_range` would touch, without touching it."""
        artist = RehearsalOperationsService._artist_spoken_for(dto)
        return RehearsalOperationsService.resolve_attendance_range(dto, artist)

    @staticmethod
    def record_attendance_range(dto: AttendanceRangeDTO) -> list[Attendance]:
        """
        State one absence once, across every rehearsal of a span of days.

        A singer away for three weeks used to open every rehearsal in turn and
        retype the same sentence. This writes one row per rehearsal they are
        actually part of inside the window — nothing for the rehearsals they were
        never invited to, nothing for a project they are only conducting.

        Idempotent by construction: the row is keyed on (rehearsal, participation),
        so re-sending an overlapping range updates the same rows rather than
        adding to them.

        The managers hear about it **once per production**, not once per evening:
        a fortnight away is one decision to make, and the project has to be named
        truthfully when the span reaches across two of them.

        A singer's span reaches forward only — the rehearsals inside it that have
        already been held stay as the roll call wrote them.
        """
        artist = RehearsalOperationsService._artist_spoken_for(dto)
        matched = RehearsalOperationsService.resolve_attendance_range(dto, artist)
        if not matched:
            return []

        by_project: dict[UUID, list[Rehearsal]] = {}
        written: list[Attendance] = []

        with transaction.atomic():
            for rehearsal, participation_id in matched:
                attendance, _created = Attendance.objects.update_or_create(
                    rehearsal=rehearsal,
                    participation_id=participation_id,
                    defaults={
                        'status': dto.status,
                        # A span says nothing about one evening's lateness.
                        'minutes_late': None,
                        'excuse_note': dto.excuse_note,
                    },
                )
                written.append(attendance)
                by_project.setdefault(rehearsal.project_id, []).append(rehearsal)

            for rehearsals in by_project.values():
                RehearsalOperationsService._announce_attendance_span(
                    dto, artist, rehearsals
                )

        return written

    @staticmethod
    def _announce_attendance_span(
        dto: AttendanceRangeDTO, artist: Artist, rehearsals: list[Rehearsal]
    ) -> None:
        """One message for one production's slice of a range.

        `matched` arrives ordered by start time, so the first and last entries of
        a project's slice are its real edges — which is what the reader is told,
        rather than the dates the singer happened to type.
        """
        first, last = rehearsals[0], rehearsals[-1]
        opening = build_event_time_metadata(
            first.date_time, first.timezone, fallback_timezone=DEFAULT_EVENT_TIMEZONE
        )
        closing = build_event_time_metadata(
            last.date_time, last.timezone, fallback_timezone=DEFAULT_EVENT_TIMEZONE
        )
        count = len(rehearsals)

        if not dto.is_manager:
            metadata = ManagerActionMetadata(
                project_name=first.project.title,
                artist_name=f"{artist.first_name} {artist.last_name}",
                artist_id=str(artist.id),
                project_id=str(first.project_id),
                rehearsal_id=str(first.id),
                starts_at=opening["starts_at"],
                starts_at_display=opening["starts_at_display"],
                timezone=opening["timezone"],
                ends_at=closing["starts_at"],
                ends_at_display=closing["starts_at_display"],
                rehearsal_count=count,
                rehearsal_date=opening["starts_at_display"],
                status=dto.status,
                excuse_note=dto.excuse_note or None,
            ).model_dump(mode="json")

            transaction.on_commit(
                lambda: ManagerNotificationHelper.notify_managers(
                    notification_type=NotificationType.ABSENCE_REQUESTED,
                    metadata=metadata,
                )
            )
            return

        if not artist.user_id:
            return

        is_approved = dto.status == Attendance.Status.EXCUSED
        notif_type = (
            NotificationType.ABSENCE_APPROVED if is_approved
            else NotificationType.ABSENCE_REJECTED
        )
        level = NotificationLevel.INFO if is_approved else NotificationLevel.WARNING
        decision = AbsenceStatusMetadata(
            rehearsal_id=first.id,
            project_name=first.project.title,
            starts_at=opening["starts_at"],
            starts_at_display=opening["starts_at_display"],
            timezone=opening["timezone"],
            ends_at=closing["starts_at"],
            ends_at_display=closing["starts_at_display"],
            rehearsal_count=count,
            rehearsal_date=opening["starts_at_display"],
        ).model_dump(mode="json")
        recipient_id = str(artist.user_id)

        transaction.on_commit(
            lambda: send_notification_task.delay(
                recipient_id=recipient_id,
                notification_type=notif_type,
                level=level,
                metadata=decision,
            )
        )


class ParticipationService:
    @staticmethod
    def update_by_manager(
        participation: Participation, changes: Mapping[str, Any]
    ) -> Participation:
        """Apply a manager's edit to one seat in the cast.

        Mostly administrative (the seat, the section), but one transition is an act rather
        than a field: **moving someone back to INVITED asks them again.** That is
        what the cast tab does when a singer who declined is re-added, and until
        the invitation follows it, the project simply reappears in their schedule
        with nobody ever having put the question. On a draft this is a no-op — the
        whole cast is invited together at publication — so the invitation only
        goes out on a project that is already speaking.

        Every other status the manager can set is administrative and stays silent:
        answering CONFIRMED or DECLINED *for* someone is not a message to them.
        """
        was_invited = participation.status == Participation.Status.INVITED

        with transaction.atomic():
            for attr, value in dict(changes).items():
                setattr(participation, attr, value)
            participation.save()

            if not was_invited and participation.status == Participation.Status.INVITED:
                ProjectPublicationService.send_invitations(
                    participation.project, [participation]
                )

        return participation

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
    """
    Practice-readiness self reports (chorister Songbook checklist).

    First-person only, by design: rows are written by the singer they describe
    and read back into that singer's own surfaces. There is deliberately no
    project-wide aggregate — a roll-call of who has yet to learn their part
    turns a practice note into a performance report.
    """

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


class CastingAndCrewService:
    # The three columns of a divisi seat. Everything the board can edit, and
    # therefore everything a save may have to diff and announce.
    _BOARD_FIELDS: ClassVar[tuple[str, ...]] = ("voice_line", "gives_pitch", "notes")

    @staticmethod
    def assign_piece_casting(validated_data: dict[str, Any]) -> ProjectPieceCasting:
        participation = validated_data.get('participation')
        # Casting is a plan, not a record of consent: the conductor decides who sings
        # which line before the singers answer — and on a draft nobody has even been
        # asked yet. Only a decline is a genuine mistake to block, because that seat
        # is known to be empty.
        if participation and participation.status == Participation.Status.DECLINED:
            raise CastingValidationException(DECLINED_CASTING_MESSAGE)

        with transaction.atomic():
            casting = ProjectPieceCasting.objects.create(**validated_data)
            user_id = casting.participation.artist.user_id

            if user_id:
                project = casting.participation.project
                queue_announcement(
                    project=project,
                    recipient_id=str(user_id),
                    subject_type=AnnouncementSubject.CASTING,
                    subject_id=str(casting.piece_id),
                    kind=AnnouncementKind.CREATED,
                    notification_type=NotificationType.PIECE_CASTING_ASSIGNED,
                    level=NotificationLevel.INFO,
                    metadata=_casting_metadata(casting, project),
                )
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
                queue_announcement(
                    project=project,
                    recipient_id=str(user_id),
                    subject_type=AnnouncementSubject.CASTING,
                    subject_id=str(casting.piece_id),
                    kind=AnnouncementKind.CHANGED,
                    notification_type=NotificationType.PIECE_CASTING_UPDATED,
                    level=NotificationLevel.INFO,
                    metadata=_casting_metadata(casting, project, changes),
                )
        return casting

    @staticmethod
    def delete_piece_casting(casting: ProjectPieceCasting) -> None:
        user_id = casting.participation.artist.user_id
        piece_id = casting.piece_id
        piece_title = casting.piece.title
        project = casting.participation.project

        with transaction.atomic():
            casting.delete()

            if user_id:
                queue_announcement(
                    project=project,
                    recipient_id=str(user_id),
                    subject_type=AnnouncementSubject.CASTING,
                    subject_id=str(piece_id),
                    kind=AnnouncementKind.REMOVED,
                    notification_type=NotificationType.PIECE_CASTING_UPDATED,
                    level=NotificationLevel.WARNING,
                    metadata=_casting_removed_metadata(piece_title, project),
                )

    @staticmethod
    def save_piece_board(
        *,
        project: Project,
        piece: Piece,
        rows: Sequence[PieceCastingRowDTO],
    ) -> list[ProjectPieceCasting]:
        """Reconcile one piece's divisi board against what the conductor submitted.

        The payload is the board, not a list of edits: rows that are absent are
        deleted, rows that are new are created, rows that differ are updated. That
        is what collapses a Save into one request and — because each singer can
        hold at most one seat per piece — into at most one announcement each,
        instead of one per drag.

        Last save wins. Two managers editing the same piece at once will overwrite
        each other rather than merge; the board is a single-editor surface and the
        alternative (per-row edits) is exactly the flood this replaces.

        Returns the resulting board, ordered for display.
        """
        participations = {
            participation.id: participation
            for participation in Participation.objects.filter(
                project=project, is_deleted=False
            ).select_related("artist")
        }
        if any(row.participation not in participations for row in rows):
            raise CastingValidationException(
                _("Cannot cast an artist who is not a participant of this project.")
            )

        # Castings hanging off a soft-deleted participation are deliberately out of
        # scope: they are not on the board, so a save must not silently reap them.
        existing: dict[UUID, list[ProjectPieceCasting]] = {}
        for casting in ProjectPieceCasting.objects.filter(
            piece=piece,
            participation__project=project,
            participation__is_deleted=False,
        ).select_related("piece"):
            existing.setdefault(casting.participation_id, []).append(casting)

        to_create: list[PieceCastingRowDTO] = []
        to_update: list[tuple[ProjectPieceCasting, PieceCastingRowDTO, list[dict[str, str | None]]]] = []
        # Two kinds of deletion, and only one of them is news: a seat the conductor
        # emptied (the singer is no longer cast) versus a duplicate row for a singer
        # who keeps their seat — nothing changed for them, so nobody is told.
        emptied: list[ProjectPieceCasting] = []
        superseded: list[ProjectPieceCasting] = []

        for row in rows:
            held = existing.pop(row.participation, [])
            if not held:
                to_create.append(row)
                continue
            casting, *duplicates = held
            superseded.extend(duplicates)
            changes = [
                _change(field, getattr(casting, field), getattr(row, field))
                for field in CastingAndCrewService._BOARD_FIELDS
                if getattr(casting, field) != getattr(row, field)
            ]
            if changes:
                to_update.append((casting, row, changes))

        for orphaned in existing.values():
            emptied.extend(orphaned)

        # Same rule as the single-casting path, applied to what this save actually
        # touches: a declined seat cannot be filled or moved. An untouched row for
        # someone who declined after being cast stays — that hole has to remain
        # visible to the conductor rather than quietly reading as filled.
        touched = [row.participation for row in to_create]
        touched += [casting.participation_id for casting, _row, _changes in to_update]
        if any(
            participations[participation_id].status == Participation.Status.DECLINED
            for participation_id in touched
        ):
            raise CastingValidationException(DECLINED_CASTING_MESSAGE)

        with transaction.atomic():
            for casting in (*emptied, *superseded):
                casting.delete()

            for casting, row, _changes in to_update:
                for field in CastingAndCrewService._BOARD_FIELDS:
                    setattr(casting, field, getattr(row, field))
                casting.save(update_fields=list(CastingAndCrewService._BOARD_FIELDS))

            created = [
                ProjectPieceCasting.objects.create(
                    participation=participations[row.participation],
                    piece=piece,
                    voice_line=row.voice_line,
                    gives_pitch=row.gives_pitch,
                    notes=row.notes,
                )
                for row in to_create
            ]

            if is_announceable(project):
                # One board, one piece, one arrangement — so one lookup, read
                # after the writes above so the seats just filled are in it.
                scope = _piece_voice_scope(piece.id, project)
                for casting in created:
                    CastingAndCrewService._queue_casting(
                        project, participations[casting.participation_id], piece.id,
                        AnnouncementKind.CREATED,
                        NotificationType.PIECE_CASTING_ASSIGNED, NotificationLevel.INFO,
                        _casting_metadata(casting, project, scope=scope),
                    )
                for casting, _row, changes in to_update:
                    CastingAndCrewService._queue_casting(
                        project, participations[casting.participation_id], piece.id,
                        AnnouncementKind.CHANGED,
                        NotificationType.PIECE_CASTING_UPDATED, NotificationLevel.INFO,
                        _casting_metadata(casting, project, changes, scope=scope),
                    )
                for casting in emptied:
                    CastingAndCrewService._queue_casting(
                        project, participations[casting.participation_id], piece.id,
                        AnnouncementKind.REMOVED,
                        NotificationType.PIECE_CASTING_UPDATED, NotificationLevel.WARNING,
                        _casting_removed_metadata(casting.piece.title, project),
                    )

        return list(
            ProjectPieceCasting.objects
            .filter(piece=piece, participation__project=project, participation__is_deleted=False)
            .select_related("piece", "participation__artist")
            .order_by("voice_line", "participation__artist__last_name")
        )

    @staticmethod
    def _queue_casting(
        project: Project,
        participation: Participation,
        piece_id: UUID,
        kind: str,
        notification_type: str,
        level: str,
        metadata: dict[str, Any],
    ) -> None:
        """Queue one singer's own seat, if there is an account to tell.

        The piece is the subject, the singer the recipient: two singers moved on
        the same piece are two announcements, while one singer moved twice on it
        is one.
        """
        user_id = participation.artist.user_id
        if not user_id:
            return
        queue_announcement(
            project=project,
            recipient_id=str(user_id),
            subject_type=AnnouncementSubject.CASTING,
            subject_id=str(piece_id),
            kind=kind,
            notification_type=notification_type,
            level=level,
            metadata=metadata,
        )

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
