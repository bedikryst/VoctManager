"""
@file push_payloads.py
@description Localized, per-notification-type push payload composer. Produces a
             structured payload (title, body, deep-link URL, dedupe tag, level
             and quick-actions) ready for the Service Worker to render. Pure
             functions, no I/O — composition only.
@architecture Enterprise SaaS 2026
@module notifications/push_payloads
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Tuple

from django.utils.translation import gettext as _

from .models import NotificationLevel, NotificationType

logger = logging.getLogger(__name__)

# Web Push spec ceiling on the encrypted payload is ~4 KB. Stay well below to
# leave headroom for transport-level encryption overhead and structured fields.
_MAX_TITLE_LEN = 65
_MAX_BODY_LEN = 220
_ELLIPSIS = "…"


@dataclass(frozen=True)
class PushAction:
    """Quick-action button rendered alongside the system notification."""
    action: str
    title: str


@dataclass(frozen=True)
class PushContext:
    """Inputs handed to every per-type composer. Frozen for safety."""
    notification_type: str
    level: str
    metadata: Dict[str, Any]
    is_manager: bool


@dataclass(frozen=True)
class PushPayload:
    """Structured, fully-localized payload consumed by the Service Worker."""
    title: str
    body: str
    url: str
    tag: str
    notification_type: str
    level: str
    actions: Tuple[PushAction, ...] = field(default_factory=tuple)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "title": _truncate(self.title, _MAX_TITLE_LEN),
            "body": _truncate(self.body, _MAX_BODY_LEN),
            "url": self.url,
            "tag": self.tag,
            "type": self.notification_type,
            "level": self.level,
            "renotify": True,
            "actions": [{"action": a.action, "title": a.title} for a in self.actions],
        }


def _truncate(value: str, limit: int) -> str:
    if not value:
        return ""
    return value if len(value) <= limit else value[: limit - 1].rstrip() + _ELLIPSIS


def _open_action() -> PushAction:
    return PushAction(action="view", title=_("Open"))


def _dismiss_action() -> PushAction:
    return PushAction(action="dismiss", title=_("Dismiss"))


# --------------------------------------------------------------------------- #
# Role-aware deep-link resolution                                             #
# Mirrors the in-app navigation contract from NotificationItem.tsx so that    #
# the system push and the in-app click route to the same destination.        #
# --------------------------------------------------------------------------- #

def _projects_url(ctx: PushContext) -> str:
    return "/panel/projects" if ctx.is_manager else "/panel/schedule"


def _rehearsals_url(ctx: PushContext) -> str:
    return "/panel/rehearsals" if ctx.is_manager else "/panel/schedule"


def _materials_url(ctx: PushContext) -> str:
    return "/panel/archive-management" if ctx.is_manager else "/panel/materials"


def _contracts_url(_ctx: PushContext) -> str:
    return "/panel/contracts"


def _settings_notifications_url() -> str:
    return "/panel/settings?tab=notifications"


# --------------------------------------------------------------------------- #
# Per-type composers                                                          #
# --------------------------------------------------------------------------- #

def _compose_project_invitation(ctx: PushContext) -> PushPayload:
    m = ctx.metadata
    project = m.get("project_name") or _("a new project")
    inviter = m.get("inviter_name") or _("the management team")
    dates = m.get("date_range")
    venue = m.get("location")

    parts = [_("%(inviter)s has invited you to participate.") % {"inviter": inviter}]
    if dates:
        parts.append(_("Dates: %(dates)s.") % {"dates": dates})
    if venue:
        parts.append(_("Venue: %(venue)s.") % {"venue": venue})

    return PushPayload(
        title=_("Project invitation: %(project)s") % {"project": project},
        body=" ".join(parts),
        url=_projects_url(ctx),
        tag=f"project-invitation:{m.get('participation_id') or m.get('project_id') or ''}",
        notification_type=ctx.notification_type,
        level=ctx.level,
        actions=(_open_action(),),
    )


def _compose_project_updated(ctx: PushContext) -> PushPayload:
    m = ctx.metadata
    project = m.get("project_name") or _("a project")
    changes = m.get("changes") or []

    if isinstance(changes, list) and changes:
        body = _("Updated: %(changes)s.") % {
            "changes": ", ".join(str(c) for c in changes[:3])
        }
        if len(changes) > 3:
            body += " " + _("(+%(count)d more)") % {"count": len(changes) - 3}
    else:
        body = m.get("message") or _(
            "Project details have been revised. Tap to review the changes."
        )

    return PushPayload(
        title=_("Project updated: %(project)s") % {"project": project},
        body=body,
        url=_projects_url(ctx),
        tag=f"project-updated:{m.get('project_id') or project}",
        notification_type=ctx.notification_type,
        level=ctx.level,
        actions=(_open_action(),),
    )


def _compose_project_cancelled(ctx: PushContext) -> PushPayload:
    m = ctx.metadata
    project = m.get("project_name") or _("a project")
    body = m.get("message") or _(
        "The project has been cancelled. Please review your dashboard for details."
    )
    return PushPayload(
        title=_("Project cancelled: %(project)s") % {"project": project},
        body=body,
        url=_projects_url(ctx),
        tag=f"project-cancelled:{m.get('project_id') or project}",
        notification_type=ctx.notification_type,
        level=ctx.level or NotificationLevel.WARNING,
        actions=(_open_action(),),
    )


def _compose_project_reminder(ctx: PushContext) -> PushPayload:
    m = ctx.metadata
    project = m.get("project_name") or _("an upcoming engagement")
    when = m.get("date_range") or m.get("starts_at")
    body = (
        _("Your engagement begins on %(when)s. Tap to review the schedule.")
        % {"when": when}
        if when
        else _("Your engagement is approaching. Tap to review the schedule.")
    )
    return PushPayload(
        title=_("Reminder: %(project)s") % {"project": project},
        body=body,
        url=_projects_url(ctx),
        tag=f"project-reminder:{m.get('project_id') or project}",
        notification_type=ctx.notification_type,
        level=ctx.level,
        actions=(_open_action(),),
    )


def _compose_rehearsal_scheduled(ctx: PushContext) -> PushPayload:
    m = ctx.metadata
    project = m.get("project_name") or _("your project")
    return PushPayload(
        title=_("New rehearsal scheduled"),
        body=m.get("message")
        or _("A new rehearsal has been added to %(project)s. Tap to view the schedule.")
        % {"project": project},
        url=_rehearsals_url(ctx),
        tag=f"rehearsal-scheduled:{m.get('rehearsal_id') or ''}",
        notification_type=ctx.notification_type,
        level=ctx.level,
        actions=(_open_action(),),
    )


def _compose_rehearsal_updated(ctx: PushContext) -> PushPayload:
    m = ctx.metadata
    project = m.get("project_name") or _("your project")
    changes = m.get("changes") or []

    if isinstance(changes, list) and changes:
        body = _("Changed: %(changes)s.") % {
            "changes": ", ".join(str(c) for c in changes[:3])
        }
        if len(changes) > 3:
            body += " " + _("(+%(count)d more)") % {"count": len(changes) - 3}
    else:
        body = m.get("message") or _(
            "Rehearsal time or location has changed. Please review the schedule."
        )

    return PushPayload(
        title=_("Rehearsal updated — %(project)s") % {"project": project},
        body=body,
        url=_rehearsals_url(ctx),
        tag=f"rehearsal-updated:{m.get('rehearsal_id') or ''}",
        notification_type=ctx.notification_type,
        level=ctx.level or NotificationLevel.WARNING,
        actions=(_open_action(),),
    )


def _compose_rehearsal_cancelled(ctx: PushContext) -> PushPayload:
    m = ctx.metadata
    project = m.get("project_name") or _("your project")
    return PushPayload(
        title=_("Rehearsal cancelled — %(project)s") % {"project": project},
        body=m.get("message")
        or _("This rehearsal has been cancelled. Please review the updated schedule."),
        url=_rehearsals_url(ctx),
        tag=f"rehearsal-cancelled:{m.get('rehearsal_id') or ''}",
        notification_type=ctx.notification_type,
        level=ctx.level or NotificationLevel.WARNING,
        actions=(_open_action(),),
    )


def _compose_rehearsal_reminder(ctx: PushContext) -> PushPayload:
    m = ctx.metadata
    project = m.get("project_name") or _("your project")
    when = m.get("starts_at") or m.get("rehearsal_date")
    body = (
        _("Your %(project)s rehearsal starts on %(when)s.")
        % {"project": project, "when": when}
        if when
        else _("Your %(project)s rehearsal is approaching.") % {"project": project}
    )
    return PushPayload(
        title=_("Rehearsal reminder"),
        body=body,
        url=_rehearsals_url(ctx),
        tag=f"rehearsal-reminder:{m.get('rehearsal_id') or ''}",
        notification_type=ctx.notification_type,
        level=ctx.level,
        actions=(_open_action(),),
    )


def _compose_piece_casting_assigned(ctx: PushContext) -> PushPayload:
    m = ctx.metadata
    piece = m.get("piece_title") or _("a new piece")
    voice = m.get("voice_line")
    body = (
        _("You have been cast as %(voice)s. Tap to open the score and recordings.")
        % {"voice": voice}
        if voice
        else _("You have been cast in this piece. Tap to open the score and recordings.")
    )
    return PushPayload(
        title=_("New casting: %(piece)s") % {"piece": piece},
        body=body,
        url=_projects_url(ctx),
        tag=f"casting-assigned:{m.get('piece_id') or piece}",
        notification_type=ctx.notification_type,
        level=ctx.level,
        actions=(_open_action(),),
    )


def _compose_piece_casting_updated(ctx: PushContext) -> PushPayload:
    m = ctx.metadata
    piece = m.get("piece_title") or _("a piece")
    changes = m.get("changes") or []
    if isinstance(changes, list) and changes:
        body = _("Changes: %(changes)s.") % {
            "changes": ", ".join(str(c) for c in changes[:3])
        }
    else:
        body = m.get("message") or _(
            "Your casting has been updated. Tap to review the new arrangement."
        )
    return PushPayload(
        title=_("Casting changed: %(piece)s") % {"piece": piece},
        body=body,
        url=_projects_url(ctx),
        tag=f"casting-updated:{m.get('piece_id') or piece}",
        notification_type=ctx.notification_type,
        level=ctx.level,
        actions=(_open_action(),),
    )


def _compose_material_uploaded(ctx: PushContext) -> PushPayload:
    m = ctx.metadata
    piece = m.get("piece_title") or m.get("project_name") or _("your repertoire")
    return PushPayload(
        title=_("New material available"),
        body=_("Sheet music or audio has been added to %(piece)s. Tap to open the library.")
        % {"piece": piece},
        url=_materials_url(ctx),
        tag=f"material-uploaded:{m.get('piece_id') or m.get('material_id') or piece}",
        notification_type=ctx.notification_type,
        level=ctx.level,
        actions=(_open_action(),),
    )


def _compose_contract_issued(ctx: PushContext) -> PushPayload:
    m = ctx.metadata
    project = m.get("project_name") or _("your engagement")
    return PushPayload(
        title=_("Contract ready for review"),
        body=_("Your contract for %(project)s is ready. Tap to review and sign.")
        % {"project": project},
        url=_contracts_url(ctx),
        tag=f"contract-issued:{m.get('contract_id') or m.get('project_id') or ''}",
        notification_type=ctx.notification_type,
        level=NotificationLevel.WARNING,
        actions=(_open_action(),),
    )


def _compose_absence_requested(ctx: PushContext) -> PushPayload:
    m = ctx.metadata
    artist = m.get("artist_name") or _("An artist")
    project = m.get("project_name") or _("a project")
    when = m.get("rehearsal_date")
    body = (
        _("%(artist)s requested an absence for %(project)s on %(when)s.")
        % {"artist": artist, "project": project, "when": when}
        if when
        else _("%(artist)s requested an absence for %(project)s.")
        % {"artist": artist, "project": project}
    )
    return PushPayload(
        title=_("Absence request"),
        body=body,
        url=_rehearsals_url(ctx),
        tag=f"absence-requested:{m.get('rehearsal_id') or ''}",
        notification_type=ctx.notification_type,
        level=ctx.level,
        actions=(_open_action(),),
    )


def _compose_absence_approved(ctx: PushContext) -> PushPayload:
    m = ctx.metadata
    project = m.get("project_name") or _("your project")
    when = m.get("rehearsal_date")
    body = (
        _("Your absence on %(when)s for %(project)s has been approved.")
        % {"when": when, "project": project}
        if when
        else _("Your absence for %(project)s has been approved.") % {"project": project}
    )
    return PushPayload(
        title=_("Absence approved"),
        body=body,
        url=_rehearsals_url(ctx),
        tag=f"absence-approved:{m.get('rehearsal_id') or ''}",
        notification_type=ctx.notification_type,
        level=ctx.level,
        actions=(_open_action(),),
    )


def _compose_absence_rejected(ctx: PushContext) -> PushPayload:
    m = ctx.metadata
    project = m.get("project_name") or _("your project")
    when = m.get("rehearsal_date")
    body = (
        _("Your absence on %(when)s for %(project)s was not approved. Tap for details.")
        % {"when": when, "project": project}
        if when
        else _("Your absence for %(project)s was not approved. Tap for details.")
        % {"project": project}
    )
    return PushPayload(
        title=_("Absence not approved"),
        body=body,
        url=_rehearsals_url(ctx),
        tag=f"absence-rejected:{m.get('rehearsal_id') or ''}",
        notification_type=ctx.notification_type,
        level=ctx.level or NotificationLevel.WARNING,
        actions=(_open_action(),),
    )


def _compose_participation_response(ctx: PushContext) -> PushPayload:
    m = ctx.metadata
    artist = m.get("artist_name") or _("An artist")
    action = m.get("action_details") or _("responded")
    project = m.get("project_name") or _("a project")
    return PushPayload(
        title=_("%(artist)s · %(action)s") % {"artist": artist, "action": action},
        body=_("Response to %(project)s. Tap to review the participation status.")
        % {"project": project},
        url=_projects_url(ctx),
        tag=f"participation:{m.get('project_id') or ''}:{m.get('artist_id') or artist}",
        notification_type=ctx.notification_type,
        level=ctx.level,
        actions=(_open_action(),),
    )


def _compose_attendance_submitted(ctx: PushContext) -> PushPayload:
    m = ctx.metadata
    artist = m.get("artist_name") or _("An artist")
    detail = m.get("action_details") or _("updated their attendance")
    project = m.get("project_name") or _("a project")
    when = m.get("rehearsal_date")
    suffix = (
        _(" · %(when)s") % {"when": when} if when else ""
    )
    return PushPayload(
        title=_("Attendance update — %(project)s") % {"project": project},
        body=_("%(artist)s %(detail)s%(suffix)s.")
        % {"artist": artist, "detail": detail, "suffix": suffix},
        url=_rehearsals_url(ctx),
        tag=f"attendance:{m.get('rehearsal_id') or ''}:{m.get('artist_id') or artist}",
        notification_type=ctx.notification_type,
        level=ctx.level,
        actions=(_open_action(),),
    )


def _compose_custom_admin_message(ctx: PushContext) -> PushPayload:
    """Direct manager → artist message. Sender is the title; the message is the body."""
    m = ctx.metadata
    sender = m.get("sender_name") or _("Management")
    subject = m.get("title") or _("New message")
    message = m.get("message") or ""

    body = f"{subject} — {message}" if message else subject
    cta_url = m.get("cta_url") or _settings_notifications_url()

    actions = (_open_action(),)
    if m.get("cta_label"):
        actions = (PushAction(action="cta", title=str(m["cta_label"])), _dismiss_action())

    return PushPayload(
        title=_("Message from %(sender)s") % {"sender": sender},
        body=body,
        url=cta_url,
        tag=f"admin-message:{m.get('sender_id') or sender}",
        notification_type=ctx.notification_type,
        level=ctx.level or m.get("level") or NotificationLevel.INFO,
        actions=actions,
    )


def _compose_system_alert(ctx: PushContext) -> PushPayload:
    m = ctx.metadata
    title = m.get("title") or _("System notice")
    body = m.get("message") or _(
        "A system update requires your attention. Tap to learn more."
    )
    return PushPayload(
        title=str(title),
        body=str(body),
        url=m.get("cta_url") or "/panel",
        tag="system-alert",
        notification_type=ctx.notification_type,
        level=ctx.level or NotificationLevel.WARNING,
        actions=(_open_action(),),
    )


def _compose_default(ctx: PushContext) -> PushPayload:
    """Fallback for any unmapped or future notification types."""
    m = ctx.metadata
    project = m.get("project_name")
    title = (
        _("Update from %(project)s") % {"project": project}
        if project
        else _("New update")
    )
    body = m.get("message") or _("You have a new update in VoctManager. Tap to view.")
    return PushPayload(
        title=title,
        body=body,
        url="/panel",
        tag=f"voct:{ctx.notification_type}",
        notification_type=ctx.notification_type,
        level=ctx.level,
        actions=(_open_action(),),
    )


_Composer = Callable[[PushContext], PushPayload]

_COMPOSERS: Dict[str, _Composer] = {
    NotificationType.PROJECT_INVITATION: _compose_project_invitation,
    NotificationType.PROJECT_UPDATED: _compose_project_updated,
    NotificationType.PROJECT_CANCELLED: _compose_project_cancelled,
    NotificationType.PROJECT_REMINDER: _compose_project_reminder,
    NotificationType.REHEARSAL_SCHEDULED: _compose_rehearsal_scheduled,
    NotificationType.REHEARSAL_UPDATED: _compose_rehearsal_updated,
    NotificationType.REHEARSAL_CANCELLED: _compose_rehearsal_cancelled,
    NotificationType.REHEARSAL_REMINDER: _compose_rehearsal_reminder,
    NotificationType.PIECE_CASTING_ASSIGNED: _compose_piece_casting_assigned,
    NotificationType.PIECE_CASTING_UPDATED: _compose_piece_casting_updated,
    NotificationType.MATERIAL_UPLOADED: _compose_material_uploaded,
    NotificationType.CONTRACT_ISSUED: _compose_contract_issued,
    NotificationType.ABSENCE_REQUESTED: _compose_absence_requested,
    NotificationType.ABSENCE_APPROVED: _compose_absence_approved,
    NotificationType.ABSENCE_REJECTED: _compose_absence_rejected,
    NotificationType.PARTICIPATION_RESPONSE: _compose_participation_response,
    NotificationType.ATTENDANCE_SUBMITTED: _compose_attendance_submitted,
    NotificationType.CUSTOM_ADMIN_MESSAGE: _compose_custom_admin_message,
    NotificationType.SYSTEM_ALERT: _compose_system_alert,
}


class PushPayloadBuilder:
    """
    Resolves the appropriate composer for a given notification type and produces
    a localized PushPayload. Must be invoked inside a translation.override()
    context — composers call gettext() at build time.
    """

    @classmethod
    def build(
        cls,
        notification_type: str,
        level: str,
        metadata: Dict[str, Any],
        *,
        is_manager: bool,
    ) -> PushPayload:
        ctx = PushContext(
            notification_type=notification_type,
            level=level or NotificationLevel.INFO,
            metadata=metadata or {},
            is_manager=is_manager,
        )
        composer = _COMPOSERS.get(notification_type, _compose_default)
        try:
            return composer(ctx)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "[PushPayloadBuilder] Composer for %s failed (%s); using default.",
                notification_type, exc,
            )
            return _compose_default(ctx)

    @classmethod
    def build_test(cls, *, is_manager: bool) -> PushPayload:
        """Synthetic payload used by the Settings → Test push action."""
        return PushPayload(
            title=_("Push notifications are active"),
            body=_(
                "VoctManager will notify you here about rehearsals, casting, and"
                " messages from your management team."
            ),
            url=_settings_notifications_url(),
            tag="voct-test-push",
            notification_type="SYSTEM_TEST",
            level=NotificationLevel.INFO,
            actions=(_open_action(),),
        )
