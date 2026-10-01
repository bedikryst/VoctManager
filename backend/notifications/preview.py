"""
@file preview.py
@description "What will I get?" — every notification a reader's settings govern,
             composed as it would reach them, with what each channel does with it
             and why. Examples go through `message_content` with sample metadata,
             in the reader's language; each outcome is `plan_delivery`'s answer
             for their effective preference, decorated with what only a read of
             their state can know — whether a device takes push
             (`reachable_devices`) and whether the account takes e-mail
             (`notification_email_block`). The client renders; nothing here is
             decided a second time.
@architecture Enterprise SaaS 2026
@module notifications/preview
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time, timedelta
from typing import Any, Literal, TypedDict
from zoneinfo import ZoneInfo

from django.utils import timezone, translation
from django.utils.translation import pgettext

from core.permissions import user_is_manager

from .delivery import (
    ChannelPlan,
    EmailOutcome,
    PushOutcome,
    effective_preferences,
    needs_email_reserve,
    plan_delivery,
    visible_preference_groups,
)
from .email_service import EmailBlock, notification_email_block
from .message_content import (
    FOLD_ITEMS_KEY,
    NOTIFICATION_IDS_KEY,
    MessageContentBuilder,
)
from .models import NotificationLevel, NotificationType
from .push_service import reachable_devices
from .time_metadata import build_event_time_metadata, normalize_timezone_name

PushStatus = Literal["now", "off", "no_device", "no_device_email", "never"]
EmailStatus = Literal[
    "now", "stand_in", "digest", "off", "never", "undeliverable", "opted_out", "not_activated",
]


class PushExample(TypedDict):
    status: PushStatus
    delivered: bool
    title: str
    body: str


class EmailExample(TypedDict):
    status: EmailStatus
    delivered: bool
    subject: str
    lead: str


class PreviewExample(TypedDict):
    notification_type: str
    # Which shape of the type this is, where one type arrives in several:
    # "accepted"/"declined", "soon"/"later", "single"/"fold". Empty otherwise.
    case: str
    push: PushExample
    # None for a sample that is a shape of push alone (`_Sample.push_only`).
    email: EmailExample | None


class PreviewGroup(TypedDict):
    id: str
    examples: list[PreviewExample]


class DeliveryPreview(TypedDict):
    devices: int
    digest_hour: int
    groups: list[PreviewGroup]


@dataclass(frozen=True)
class _Sample:
    """One event as it would be emitted: its type, the level its emitter gives
    it, and a payload in the shape the emitter builds."""
    notification_type: str
    metadata: dict[str, Any]
    level: str = NotificationLevel.INFO
    case: str = ""
    # A shape only the push takes, with no e-mail of its own to preview. The
    # folded burst is not one: the fold sends its e-mail as one message too.
    push_only: bool = False


# Stable identifiers for the sample payloads. Composers put them in deep links
# and tags, which the preview never shows, but a payload without them is not
# the shape any emitter builds.
_PROJECT_ID = "00000000-0000-4000-8000-000000000001"
_REHEARSAL_ID = "00000000-0000-4000-8000-000000000002"
_OTHER_REHEARSAL_ID = "00000000-0000-4000-8000-000000000003"
_PIECE_ID = "00000000-0000-4000-8000-000000000004"
_ARTIST_ID = "00000000-0000-4000-8000-000000000005"
_THREAD_ID = "00000000-0000-4000-8000-000000000006"

# People and works are names, and a name is not translated.
_SINGER = "Anna Kowalska"
_CONDUCTOR = "Jan Nowak"
_ASSISTANT = "Maria Wiśniewska"
_PIECE = "Ave verum corpus"
_COMPOSER = "W. A. Mozart"


def _samples(*, is_manager: bool, zone_name: str) -> dict[str, tuple[_Sample, ...]]:
    """One sample event per type, several where one type arrives in shapes the
    router treats differently. Must run inside the reader's language override:
    the sample prose is gettext.

    Absence requests take their level from the emitters' own rule, so the
    preview moves with the 48-hour threshold rather than restating it.
    """
    from roster.services import absence_request_level

    zone = ZoneInfo(zone_name)
    today = timezone.now().astimezone(zone).date()

    def evening(days: int, hour: int = 19) -> datetime:
        return datetime.combine(today + timedelta(days=days), time(hour), tzinfo=zone)

    def moment(value: datetime) -> dict[str, str]:
        return build_event_time_metadata(value, zone_name, fallback_timezone=zone_name)

    context = "notification preview sample"
    # Not a name beginning with the event kind: the reminder leads with the kind,
    # and "Concert «Advent Concert»" would read as a stammer.
    project = pgettext(context, "Advent Vespers")
    venue = pgettext(context, "St Anne's Church")
    other_venue = pgettext(context, "Philharmonic Hall")
    focus = pgettext(context, "Tuning and the Magnificat")

    soon = evening(1)
    later = evening(9)
    concert = evening(24, 18)

    def rehearsal(value: datetime, **more: Any) -> dict[str, Any]:
        facts = moment(value)
        return {
            "rehearsal_id": _REHEARSAL_ID,
            "project_id": _PROJECT_ID,
            "project_name": project,
            **facts,
            "rehearsal_date": facts["starts_at_display"],
            "location": venue,
            "focus": focus,
            **more,
        }

    def report(value: datetime, **more: Any) -> dict[str, Any]:
        facts = moment(value)
        return {
            "project_name": project,
            "project_id": _PROJECT_ID,
            "artist_name": _SINGER,
            "artist_id": _ARTIST_ID,
            "rehearsal_id": _REHEARSAL_ID,
            **facts,
            "rehearsal_date": facts["starts_at_display"],
            **more,
        }

    fold_items = [
        {
            **report(evening(days)),
            "notification_type": NotificationType.ATTENDANCE_SUBMITTED,
            "status": status,
            **({"minutes_late": 15} if status == "LATE" else {}),
        }
        for days, status in ((2, "PRESENT"), (5, "LATE"), (9, "PRESENT"), (12, "PRESENT"))
    ]
    excuse = pgettext(context, "A family matter, I'm sorry.")
    casting = {
        "piece_id": _PIECE_ID,
        "piece_title": _PIECE,
        "voice_scope": ["S1", "S2"],
        "project_id": _PROJECT_ID,
        "project_name": project,
        **moment(concert),
    }
    absence_decision = {
        "rehearsal_id": _REHEARSAL_ID,
        "project_name": project,
        **moment(later),
        "rehearsal_date": moment(later)["starts_at_display"],
    }
    location_change = [{"field": "location", "old": venue, "new": other_venue}]

    return {
        NotificationType.PROJECT_INVITATION: (_Sample(NotificationType.PROJECT_INVITATION, {
            "project_id": _PROJECT_ID,
            "project_name": project,
            "participation_id": _ARTIST_ID,
            "inviter_name": _CONDUCTOR,
            **moment(concert),
            "location": venue,
            "program": [_PIECE],
        }),),
        NotificationType.PROJECT_UPDATED: (_Sample(NotificationType.PROJECT_UPDATED, {
            "project_id": _PROJECT_ID,
            "project_name": project,
            "event": "updated",
            "changes": location_change,
        }, level=NotificationLevel.WARNING),),
        NotificationType.PROJECT_CANCELLED: (_Sample(NotificationType.PROJECT_CANCELLED, {
            "project_id": _PROJECT_ID,
            "project_name": project,
        }, level=NotificationLevel.URGENT),),
        NotificationType.REHEARSAL_SCHEDULED: (_Sample(
            NotificationType.REHEARSAL_SCHEDULED, rehearsal(later),
        ),),
        NotificationType.REHEARSAL_UPDATED: (_Sample(
            NotificationType.REHEARSAL_UPDATED,
            rehearsal(later, location=other_venue, changes=location_change),
            level=NotificationLevel.WARNING,
        ),),
        NotificationType.REHEARSAL_CANCELLED: (_Sample(
            NotificationType.REHEARSAL_CANCELLED, rehearsal(later), level=NotificationLevel.URGENT,
        ),),
        NotificationType.REHEARSAL_DELEGATED: (_Sample(NotificationType.REHEARSAL_DELEGATED, {
            "project_id": _PROJECT_ID,
            "project_name": project,
            "granted_by_name": _CONDUCTOR,
            "can_take_roll_call": True,
            "can_open_materials": True,
            "next_rehearsal": {
                "rehearsal_id": _OTHER_REHEARSAL_ID, **moment(later), "location": venue,
            },
        }),),
        NotificationType.REHEARSAL_DELEGATION_ENDED: (_Sample(
            NotificationType.REHEARSAL_DELEGATION_ENDED,
            {"project_id": _PROJECT_ID, "project_name": project, "revoked_by_name": _CONDUCTOR},
        ),),
        NotificationType.REHEARSAL_LEAD_ASSIGNED: (_Sample(
            NotificationType.REHEARSAL_LEAD_ASSIGNED, rehearsal(later, sections=["S", "A"]),
        ),),
        NotificationType.PIECE_CASTING_ASSIGNED: (_Sample(
            NotificationType.PIECE_CASTING_ASSIGNED, {**casting, "voice_line": "S1"},
        ),),
        NotificationType.PIECE_CASTING_UPDATED: (_Sample(NotificationType.PIECE_CASTING_UPDATED, {
            **casting,
            "event": "updated",
            "voice_line": "S2",
            "changes": [{"field": "voice_line", "old": "S1", "new": "S2"}],
        }),),
        NotificationType.ABSENCE_APPROVED: (_Sample(
            NotificationType.ABSENCE_APPROVED, absence_decision,
        ),),
        NotificationType.ABSENCE_REJECTED: (_Sample(
            NotificationType.ABSENCE_REJECTED, absence_decision, level=NotificationLevel.WARNING,
        ),),
        NotificationType.MESSAGE_RECEIVED: (_Sample(NotificationType.MESSAGE_RECEIVED, {
            # A manager hears from singers; a singer hears from the managers.
            "sender_name": _SINGER if is_manager else _CONDUCTOR,
            "title": pgettext(context, "Thursday's rehearsal"),
            "snippet": pgettext(context, "Thank you, see you on Thursday!"),
            "thread_id": _THREAD_ID,
        }),),
        NotificationType.CUSTOM_ADMIN_MESSAGE: (_Sample(NotificationType.CUSTOM_ADMIN_MESSAGE, {
            "title": pgettext(context, "Concert dress"),
            "message": pgettext(
                context, "Black dress for Sunday, please. The details are in the materials.",
            ),
            "sender_id": _ARTIST_ID,
            "sender_name": _CONDUCTOR,
        }),),
        NotificationType.MATERIAL_UPLOADED: (_Sample(NotificationType.MATERIAL_UPLOADED, {
            "piece_id": _PIECE_ID,
            "piece_title": _PIECE,
            "project_name": project,
            "material_kind": "recording",
            "composer_name": _COMPOSER,
        }),),
        NotificationType.PROJECT_REMINDER: (_Sample(NotificationType.PROJECT_REMINDER, {
            "project_id": _PROJECT_ID,
            "project_name": project,
            "event_kind": "CONCERT",
            **moment(concert),
            "location": venue,
        }),),
        NotificationType.REHEARSAL_REMINDER: (_Sample(
            NotificationType.REHEARSAL_REMINDER, rehearsal(soon),
        ),),
        NotificationType.ANNOUNCEMENT_PENDING: (_Sample(NotificationType.ANNOUNCEMENT_PENDING, {
            "project_id": _PROJECT_ID,
            "project_name": project,
            "change_count": 3,
            "recipient_count": 24,
            "waiting_hours": 30,
        }),),
        NotificationType.SITE_COPY_PROPOSED: (_Sample(NotificationType.SITE_COPY_PROPOSED, {
            "author_name": _ASSISTANT,
            "proposal_count": 3,
            "scopes": [{"scope": "home", "label": pgettext(context, "Home page"), "count": 3}],
            "locales": ["pl"],
        }),),
        NotificationType.REHEARSAL_DEBRIEF_POSTED: (_Sample(
            NotificationType.REHEARSAL_DEBRIEF_POSTED,
            rehearsal(
                evening(-1),
                author_name=_ASSISTANT,
                excerpt=pgettext(
                    context,
                    "The sopranos were secure in the Gloria; the tenors need another pass at bar 40.",
                ),
            ),
        ),),
        NotificationType.PARTICIPATION_RESPONSE: (
            _Sample(
                NotificationType.PARTICIPATION_RESPONSE,
                report(later, status="CON", previous_status="INV"),
                case="accepted",
            ),
            # The emitter raises a decline to WARNING (roster.services), which
            # is what keeps it out of the digest.
            _Sample(
                NotificationType.PARTICIPATION_RESPONSE,
                report(later, status="DEC", previous_status="INV"),
                level=NotificationLevel.WARNING,
                case="declined",
            ),
        ),
        NotificationType.ATTENDANCE_SUBMITTED: (
            _Sample(
                NotificationType.ATTENDANCE_SUBMITTED,
                report(later, status="LATE", minutes_late=15),
                case="single",
            ),
            _Sample(
                NotificationType.ATTENDANCE_SUBMITTED,
                {
                    "artist_id": _ARTIST_ID,
                    "artist_name": _SINGER,
                    NOTIFICATION_IDS_KEY: [],
                    FOLD_ITEMS_KEY: fold_items,
                },
                case="fold",
            ),
        ),
        NotificationType.ABSENCE_REQUESTED: (
            _Sample(
                NotificationType.ABSENCE_REQUESTED,
                report(soon, status="EXCUSED", excuse_note=excuse),
                level=absence_request_level(soon),
                case="soon",
            ),
            _Sample(
                NotificationType.ABSENCE_REQUESTED,
                report(later, status="EXCUSED", excuse_note=excuse),
                level=absence_request_level(later),
                case="later",
            ),
        ),
    }


def _push_status(
    plan: ChannelPlan, *, devices: int, email_stands_in: bool
) -> PushStatus:
    if plan.push is PushOutcome.NEVER:
        return "never"
    if plan.push is PushOutcome.OFF:
        return "off"
    if devices == 0:
        return "no_device_email" if email_stands_in else "no_device"
    return "now"


_BLOCK_STATUS: dict[EmailBlock, EmailStatus] = {
    EmailBlock.UNDELIVERABLE: "undeliverable",
    EmailBlock.OPTED_OUT: "opted_out",
    EmailBlock.NOT_ACTIVATED: "not_activated",
}


def _email_status(
    plan: ChannelPlan, *, email_stands_in: bool, block: EmailBlock | None
) -> EmailStatus:
    if plan.email is EmailOutcome.NEVER:
        return "never"
    reaches_inbox = plan.email in (EmailOutcome.NOW, EmailOutcome.DIGEST) or email_stands_in
    # The account-level block speaks only where an e-mail would otherwise go:
    # a type the reader switched off stays "switched off", which is the answer
    # that survives turning e-mail back on.
    if reaches_inbox and block is not None:
        return _BLOCK_STATUS[block]
    if plan.email is EmailOutcome.NOW:
        return "now"
    if plan.email is EmailOutcome.DIGEST:
        return "digest"
    return "stand_in" if email_stands_in else "off"


def build_delivery_preview(user: Any) -> DeliveryPreview:
    """Every event this reader's settings govern, as it would reach them now."""
    profile = getattr(user, "profile", None)
    language = getattr(profile, "language", "en") or "en"
    is_manager = user_is_manager(user)

    from roster.models import DEFAULT_EVENT_TIMEZONE
    zone_name = normalize_timezone_name(
        getattr(profile, "timezone", None), DEFAULT_EVENT_TIMEZONE,
    )

    groups = visible_preference_groups(
        is_manager=is_manager, is_staff=bool(getattr(user, "is_staff", False)),
    )
    preferences = effective_preferences(
        user.id, [ntype for group in groups for ntype in group.types],
    )
    digest_enabled = bool(getattr(profile, "digest_enabled", False))
    devices = reachable_devices(user.id).count()
    block = notification_email_block(user)

    result: list[PreviewGroup] = []
    with translation.override(language):
        samples = _samples(is_manager=is_manager, zone_name=zone_name)
        for group in groups:
            examples: list[PreviewExample] = []
            for ntype in group.types:
                preference = preferences[ntype]
                for sample in samples[ntype]:
                    plan = plan_delivery(
                        ntype, sample.level,
                        preference=preference, digest_enabled=digest_enabled,
                    )
                    # The router's own condition for the e-mail a push carries in
                    # reserve, spent only when no device takes the push. The fold
                    # never carries one.
                    email_stands_in = (
                        not sample.push_only
                        and plan.push is PushOutcome.NOW
                        and devices == 0
                        and block is None
                        and needs_email_reserve(ntype, preference["email_enabled"])
                    )
                    content = MessageContentBuilder.build(
                        ntype, sample.level, sample.metadata, is_manager=is_manager,
                    )
                    push = content.to_push().to_dict()
                    push_status = _push_status(
                        plan, devices=devices, email_stands_in=email_stands_in,
                    )
                    email: EmailExample | None = None
                    if not sample.push_only:
                        email_status = _email_status(
                            plan, email_stands_in=email_stands_in, block=block,
                        )
                        email = {
                            "status": email_status,
                            "delivered": email_status in ("now", "stand_in"),
                            "subject": content.subject or content.title,
                            "lead": content.email_lead or content.body,
                        }
                    examples.append({
                        "notification_type": ntype,
                        "case": sample.case,
                        "push": {
                            "status": push_status,
                            "delivered": push_status == "now",
                            "title": push["title"],
                            "body": push["body"],
                        },
                        "email": email,
                    })
            result.append({"id": group.id, "examples": examples})

    return {
        "devices": devices,
        "digest_hour": int(getattr(profile, "digest_hour", 8)),
        "groups": result,
    }
