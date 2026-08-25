# notifications/dtos.py
# ==========================================
# Notifications Data Transfer Objects (DTOs)
# Standard: Enterprise SaaS 2026 (Pydantic V2)
# ==========================================
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .models import DeviceType, NotificationLevel, NotificationType

DEVICE_TYPE_VALUES = frozenset(DeviceType.values)
NOTIFICATION_LEVEL_VALUES = frozenset(NotificationLevel.values)
NOTIFICATION_TYPE_VALUES = frozenset(NotificationType.values)


def _require_choice(value: str, allowed_values: frozenset[str], field_name: str) -> str:
    if value not in allowed_values:
        allowed = ", ".join(sorted(allowed_values))
        raise ValueError(f"{field_name} must be one of: {allowed}.")
    return value

class EnterpriseBaseDTO(BaseModel):
    """Base payload model ensuring immutability for Celery serialization."""
    model_config = ConfigDict(frozen=True, extra="forbid", validate_by_name=True, validate_by_alias=True)

# ==========================================
# METADATA SCHEMAS (STRICT TYPING)
# ==========================================
#
# Design rule: metadata carries STRUCTURED, language-neutral DATA only — stable
# field/status codes, entity names, ISO datetimes, display fallbacks, counts. It must NEVER carry
# rendered prose, because the same row is rendered into the push body (in the
# recipient's language) AND into the in-app bell (in the *viewer's* current UI
# language). Human-readable copy is composed at render time, per surface, per
# language — see notifications/message_content.py and the frontend NotificationItem.

class FieldChangeMetadata(EnterpriseBaseDTO):
    """One audited field change. `field` is a stable key (e.g. 'location',
    'date_time'); its human label is localized at render time. `old`/`new` are
    pre-formatted, language-neutral display values (or None when unset)."""
    field: str
    old: str | None = None
    new: str | None = None


class EventMomentMetadata(EnterpriseBaseDTO):
    """Canonical event moment. `starts_at` is ISO-8601; display text is fallback-only.

    The closing moment is present only where one was entered — an unset end is
    an absent key, not an empty string, because "runs until 21:00" and "nobody
    timed this" are different facts and the copy states them differently.
    """
    starts_at: str | None = None
    starts_at_display: str | None = None
    ends_at: str | None = None
    ends_at_display: str | None = None
    timezone: str | None = None


# --- Project Management ---
class InvitationRehearsalMetadata(EnterpriseBaseDTO):
    """One rehearsal inside the invitation's schedule block. Carries the canonical
    moment rather than a rendered date, so every recipient reads it in their own
    language — the same contract as any other event moment in this module."""
    rehearsal_id: UUID
    starts_at: str = ""
    starts_at_display: str = ""
    # Empty for a session nobody has timed; the line then names the opening hour
    # alone rather than a range to an end that was never entered.
    ends_at: str = ""
    ends_at_display: str = ""
    timezone: str = ""
    location: str = ""
    focus: str = ""
    is_mandatory: bool = True


class ProjectInvitationMetadata(EnterpriseBaseDTO):
    """The whole decision, in one message.

    An invitation is the only thing a singer gets before answering, so it has to
    state the real cost of saying yes: not just the concert, but the rehearsals
    they are expected at and the part they would be singing. Fields below the
    event moment are the publication payload; they stay empty on legacy rows and
    on the immediate invite of an already-live project, and every composer
    tolerates their absence.
    """
    project_id: UUID
    project_name: str
    participation_id: UUID
    # Optional context — composers fall back to localized neutral copy when blank.
    inviter_name: str = ""
    # Canonical event moment, so the invitation states when the concert is in the
    # reader's own language. `date_range` stays as the legacy display fallback.
    starts_at: str = ""
    starts_at_display: str = ""
    timezone: str = ""
    date_range: str = ""
    location: str = ""
    description: str = ""
    # Call time is a second moment on the same day; kept separate so the copy can
    # say "be there at 18:00" without overwriting when the concert itself starts.
    call_time_at: str = ""
    call_time_display: str = ""
    dress_code: str = ""
    rehearsals: tuple[InvitationRehearsalMetadata, ...] = ()
    # Programme as ordered piece titles — names, not prose, so the list renders
    # identically on every surface.
    program: tuple[str, ...] = ()
    # This artist's own voice lines across the programme, as language-neutral
    # VoiceLine CODES. Empty when they have not been cast yet.
    voice_lines: tuple[str, ...] = ()
    # Every line the programme's arrangements divide into, across the pieces this
    # artist is cast on — the scope those codes are NAMED in, so a part that is
    # the only tenor line anywhere in the concert reads "Tenor", not "Tenor 1".
    voice_scope: tuple[str, ...] = ()
    message: str | None = None

class BriefingItemMetadata(EnterpriseBaseDTO):
    """One thing that changed, carried inside a composite briefing.

    The nested `metadata` is the payload the emitting service built, untouched —
    so a briefing line and the standalone message it would otherwise have been
    render from exactly the same facts, and a surface that already knows how to
    read a casting or a rehearsal needs no second vocabulary. `subject_type` and
    `kind` are what the briefing groups and phrases by; the calendar payload is
    lifted out to the briefing's own `ics`, since attachments are per message.
    """
    subject_type: str
    kind: str
    notification_type: str
    level: str = NotificationLevel.INFO
    metadata: dict[str, Any] = Field(default_factory=dict)


class ProjectBriefingMetadata(EnterpriseBaseDTO):
    """Everything one artist has not been told about one project.

    Assembled at publication from the collapsed queue: the changes the whole cast
    shares plus the ones that are only theirs, personal first. A recipient with a
    single item is never sent one of these — they get that item's own message,
    which says more precisely what happened.
    """
    project_id: UUID | None = None
    project_name: str
    # What the ensemble is singing at, as a CODE — the briefing heads its project
    # section with the event's own name, and a Mass filed under "Koncert" is the
    # heading a singer stops trusting. Empty on legacy rows, which read as the
    # model's default.
    event_kind: str = ""
    # The conductor's own words, written when publishing the queue. Free text,
    # passed through verbatim like any other authored message.
    note: str = ""
    items: tuple[BriefingItemMetadata, ...] = ()
    # Calendar events for every rehearsal named above, so a briefing announcing
    # five of them attaches one .ics rather than five.
    ics: tuple[dict[str, Any], ...] = ()
    message: str | None = None


class AnnouncementPendingMetadata(EnterpriseBaseDTO):
    """A live project whose queue has been sitting unpublished — addressed to the
    managers, not the cast.

    Two numbers, deliberately. `change_count` is what the project hub's pill shows,
    so the nudge and the app agree on how much is waiting; `recipient_count` is how
    many people are in the dark, which is the reason to care. How many envelopes
    publication would send is a decision the review sheet's confirm button states,
    and repeating it here would offer a third number to reconcile.

    `waiting_hours` is a count, not a rendered duration: the reader's language
    decides whether that reads as hours or days.
    """
    project_id: UUID
    project_name: str
    change_count: int = 0
    recipient_count: int = 0
    waiting_hours: int = 0
    message: str | None = None


class ProjectCancelledMetadata(EnterpriseBaseDTO):
    """A cancellation is an alarm in its own right, not a status field in a diff —
    it carries no `changes`, so the cast reads "cancelled" rather than a status
    transition they have to decode."""
    project_id: UUID | None = None
    project_name: str
    message: str | None = None


class ProjectUpdatedMetadata(EnterpriseBaseDTO):
    project_id: UUID | None = None
    project_name: str
    # Distinguishes the three artist-facing project events that share this type so
    # each is rendered with its own localized copy instead of an English message.
    event: str = "updated"  # "updated" | "removed"
    changes: tuple[FieldChangeMetadata, ...] | None = None
    message: str | None = None

# --- Rehearsals ---
class RehearsalScheduledMetadata(EventMomentMetadata):
    rehearsal_id: UUID
    project_id: UUID
    project_name: str
    location: str = ""
    focus: str = ""
    message: str | None = None

class RehearsalUpdatedMetadata(EventMomentMetadata):
    rehearsal_id: UUID
    project_id: UUID | None = None
    project_name: str
    location: str = ""
    focus: str = ""
    changes: tuple[FieldChangeMetadata, ...]
    message: str | None = None

class RehearsalCancelledMetadata(EventMomentMetadata):
    rehearsal_id: UUID | None = None
    project_id: UUID | None = None
    project_name: str
    location: str = ""
    focus: str = ""
    message: str | None = None

# --- Casting & Repertoire ---
class PieceCastingMetadata(EventMomentMetadata):
    piece_id: UUID | None = None
    piece_title: str
    # Language-neutral VoiceLine CODE (e.g. "B1"), NOT the rendered label — the
    # voice part is localized per surface at render time (message_content /
    # NotificationItem). A legacy row may still carry a pre-rendered label; the
    # renderers fall back to it unchanged.
    voice_line: str | None = None
    # Every line this piece's bound arrangement divides into, as CODES. Carried
    # rather than looked up because composers are pure functions over metadata,
    # and without it the renderer cannot know that "T1" is the only tenor line
    # here and should read "Tenor". Empty on legacy rows — those keep the index.
    voice_scope: tuple[str, ...] = ()
    # The concert this casting belongs to — so the singer sees WHICH programme the
    # part is for. `starts_at` (inherited, ISO-8601) carries the concert moment.
    project_id: UUID | None = None
    project_name: str | None = None
    # PIECE_CASTING_UPDATED carries both edits and removals; the event keeps them
    # apart so each renders its own localized copy.
    event: str = "updated"  # "updated" | "removed"
    message: str | None = None
    changes: tuple[FieldChangeMetadata, ...] | None = None

# --- HR & Logistics ---
class CrewAssignedMetadata(EnterpriseBaseDTO):
    project_id: UUID
    project_name: str
    role: str
    message: str | None = None

class AbsenceStatusMetadata(EnterpriseBaseDTO):
    rehearsal_id: UUID
    project_name: str
    # Canonical event moment; `rehearsal_date` stays as the legacy display fallback.
    starts_at: str = ""
    starts_at_display: str = ""
    timezone: str = ""
    rehearsal_date: str
    message: str | None = None
    # A decision covering a span of days rather than one evening: the closing
    # moment and how many rehearsals it actually reached. Absent on a single one.
    ends_at: str = ""
    ends_at_display: str = ""
    rehearsal_count: int | None = None


class ManagerActionMetadata(EnterpriseBaseDTO):
    """Manager-facing roster signal (attendance update, RSVP, absence request).
    Structured codes only — the prose is composed per surface/language at render."""
    project_name: str
    artist_name: str
    artist_id: str | UUID | None = None
    project_id: str | UUID | None = None
    rehearsal_id: str | UUID | None = None
    # Canonical event moment; `rehearsal_date` stays as the legacy display fallback.
    starts_at: str = ""
    starts_at_display: str = ""
    timezone: str = ""
    rehearsal_date: str | None = None
    # Attendance / absence: status code (PRESENT|LATE|EXCUSED|ABSENT) + context.
    status: str | None = None
    minutes_late: int | None = None
    excuse_note: str | None = None  # user-authored free text — passed through verbatim
    # Participation RSVP: new + previous status codes.
    previous_status: str | None = None
    # An absence stated over a span of days rather than one evening: the closing
    # moment and how many rehearsals it actually reached. Absent on a single one.
    ends_at: str = ""
    ends_at_display: str = ""
    rehearsal_count: int | None = None


class CustomAdminMessageMetadata(EnterpriseBaseDTO):
    """Payload for direct manager-to-artist messages. Carries sender context for read receipts."""
    title: str = Field(..., max_length=120)
    message: str = Field(..., max_length=2000)
    sender_id: str | UUID
    sender_name: str
    level: str = Field(default="INFO")
    cta_url: str | None = Field(None, max_length=500)
    cta_label: str | None = Field(None, max_length=80)

    @field_validator("level")
    @classmethod
    def validate_level(cls, value: str) -> str:
        return _require_choice(value, NOTIFICATION_LEVEL_VALUES, "level")


class NotificationReadReceiptMetadata(EnterpriseBaseDTO):
    """Payload sent back to the manager when the artist reads a CUSTOM_ADMIN_MESSAGE."""
    artist_name: str
    artist_id: str | UUID
    original_title: str
    read_at: str


class ProjectReminderMetadata(EventMomentMetadata):
    project_id: UUID | None = None
    project_name: str
    # Language-neutral CODE for what the ensemble is singing at, so the reminder
    # that lands the evening before names it in the recipient's own language
    # rather than calling every engagement a concert. Empty on legacy rows.
    event_kind: str = ""
    date_range: str | None = None
    location: str | None = None
    message: str | None = None


class RehearsalReminderMetadata(EventMomentMetadata):
    rehearsal_id: UUID | None = None
    project_id: UUID | None = None
    project_name: str
    rehearsal_date: str | None = None
    location: str | None = None
    focus: str | None = None
    message: str | None = None


class MaterialUploadedMetadata(EnterpriseBaseDTO):
    piece_id: UUID | None = None
    material_id: UUID | None = None
    piece_title: str | None = None
    project_name: str | None = None
    # What landed, so every surface can say it: "score" | "recording".
    material_kind: str | None = None
    composer_name: str | None = None
    message: str | None = None


class ContractIssuedMetadata(EnterpriseBaseDTO):
    contract_id: UUID | None = None
    project_id: UUID | None = None
    project_name: str
    message: str | None = None


class SystemAlertMetadata(EnterpriseBaseDTO):
    title: str | None = Field(None, max_length=120)
    message: str | None = Field(None, max_length=2000)
    cta_url: str | None = Field(None, max_length=500)


# Polymorphic Payload Definition
NotificationMetadataPayload = (
    ProjectInvitationMetadata
    | ProjectBriefingMetadata
    | ProjectUpdatedMetadata
    | ProjectReminderMetadata
    | RehearsalScheduledMetadata
    | RehearsalUpdatedMetadata
    | RehearsalCancelledMetadata
    | RehearsalReminderMetadata
    | PieceCastingMetadata
    | CrewAssignedMetadata
    | AbsenceStatusMetadata
    | ManagerActionMetadata
    | CustomAdminMessageMetadata
    | NotificationReadReceiptMetadata
    | MaterialUploadedMetadata
    | ContractIssuedMetadata
    | SystemAlertMetadata
)

# ==========================================
# CORE DATA TRANSFER OBJECT
# ==========================================

class NotificationCreateDTO(EnterpriseBaseDTO):
    """
    Data Transfer Object strictly typing the payload for notification creation.
    Guarantees structural integrity before passing to Celery and Service layers.
    """
    recipient_id: int | str
    notification_type: str = Field(..., max_length=50)
    level: str = Field(..., max_length=20)
    # A structured metadata model when provided, or a plain dict (the empty default, or
    # the already-serialized payload re-hydrated from Celery). Both are accepted by design.
    metadata: NotificationMetadataPayload | dict[str, Any] = Field(default_factory=dict)

    @field_validator("notification_type")
    @classmethod
    def validate_notification_type(cls, value: str) -> str:
        return _require_choice(value, NOTIFICATION_TYPE_VALUES, "notification_type")

    @field_validator("level")
    @classmethod
    def validate_level(cls, value: str) -> str:
        return _require_choice(value, NOTIFICATION_LEVEL_VALUES, "level")

class PushDeviceRegisterDTO(BaseModel):
    """DTO for FCM token registration (iOS / Android)."""
    model_config = ConfigDict(extra="forbid", frozen=True, validate_by_name=True, validate_by_alias=True)

    user_id: int | str
    registration_token: str = Field(..., min_length=10, description="The client-provided FCM token.")
    device_type: str = Field(default="WEB", description="Platform identifier.")

    @field_validator("device_type")
    @classmethod
    def validate_device_type(cls, value: str) -> str:
        return _require_choice(value, DEVICE_TYPE_VALUES, "device_type")


class WebPushSubscribeDTO(BaseModel):
    """DTO for Web Push (VAPID) subscription registration from browser clients."""
    model_config = ConfigDict(extra="forbid", frozen=True, validate_by_name=True, validate_by_alias=True)

    user_id: int | str
    endpoint: str = Field(..., min_length=1, description="Browser-assigned push endpoint URL.")
    p256dh_key: str = Field(..., min_length=10, description="ECDH public key for payload encryption.")
    auth_key: str = Field(..., min_length=10, description="Auth secret for payload encryption.")


class NotificationPreferenceUpdateDTO(BaseModel):
    """DTO for granular mutation of user notification preferences."""
    model_config = ConfigDict(extra="forbid", frozen=True, validate_by_name=True, validate_by_alias=True)

    user_id: int | str
    notification_type: str = Field(..., description="Target business event category.")
    email_enabled: bool | None = Field(None, description="Toggle Email delivery.")
    push_enabled: bool | None = Field(None, description="Toggle Push delivery.")

    @field_validator("notification_type")
    @classmethod
    def validate_notification_type(cls, value: str) -> str:
        return _require_choice(value, NOTIFICATION_TYPE_VALUES, "notification_type")

    @model_validator(mode="after")
    def require_at_least_one_channel(self):
        if self.email_enabled is None and self.push_enabled is None:
            raise ValueError("At least one notification channel toggle must be provided.")
        return self

