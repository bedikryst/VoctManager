"""
@file message_content.py
@description Channel-agnostic message composition layer. A single per-notification
             -type composer authors the canonical content once — headline, the
             one-sentence "what happened", structured detail rows, deep-link and
             call-to-action — and projects it to every surface:

               • .to_push()          → short-form Web Push / FCM payload
               • .to_email_context() → long-form transactional email context
               • .subject            → metadata-bearing inbox subject line

             This is the single source of truth for notification copy. Composers
             consume STRUCTURED, language-neutral metadata (status/field codes,
             names, formatted dates) — never pre-rendered prose — and render it in
             the recipient's language. Voice: warm and ensemble-native, addressing
             the singer directly; alarms (cancellations, declines, URGENT) stay
             sober and direct.

             Pure functions, no I/O. Composers call gettext() at build time, so
             the builder must run inside a translation.override() context.
@architecture Enterprise SaaS 2026
@module notifications/message_content
"""
from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from django.utils.translation import gettext as _

from .models import NotificationLevel, NotificationType
from .time_metadata import display_event_time

logger = logging.getLogger(__name__)

# Web Push spec ceiling on the encrypted payload is ~4 KB. Stay well below to
# leave headroom for transport-level encryption overhead and structured fields.
_MAX_TITLE_LEN = 65
_MAX_BODY_LEN = 220
_ELLIPSIS = "…"


# --------------------------------------------------------------------------- #
# Projected payloads                                                          #
# --------------------------------------------------------------------------- #

@dataclass(frozen=True)
class PushAction:
    """Quick-action button rendered alongside the system notification. An optional
    per-action deep-link lets a button route somewhere other than the body click
    (e.g. a casting push offering both 'Open score' and 'Schedule')."""
    action: str
    title: str
    url: str = ""


@dataclass(frozen=True)
class PushPayload:
    """Structured, fully-localized payload consumed by the Service Worker."""
    title: str
    body: str
    url: str
    tag: str
    notification_type: str
    level: str
    actions: tuple[PushAction, ...] = field(default_factory=tuple)

    def to_dict(self) -> dict[str, Any]:
        return {
            "title": _truncate(self.title, _MAX_TITLE_LEN),
            "body": _truncate(self.body, _MAX_BODY_LEN),
            "url": self.url,
            "tag": self.tag,
            "type": self.notification_type,
            "level": self.level,
            "renotify": True,
            "actions": [
                {"action": a.action, "title": a.title, **({"url": a.url} if a.url else {})}
                for a in self.actions
            ],
        }


@dataclass(frozen=True)
class DetailRow:
    """One labelled fact rendered as a row in the email detail card."""
    label: str
    value: str


# --------------------------------------------------------------------------- #
# Canonical content                                                           #
# --------------------------------------------------------------------------- #

@dataclass(frozen=True)
class MessageContent:
    """
    The canonical, fully-localized content for a single notification event.
    Authored once per type; projected to push and email.
    """
    notification_type: str
    level: str
    # Shared
    title: str                                   # push title / email H1
    body: str                                    # push body (the "what happened" line)
    url_path: str                                # deep-link (SPA-relative, or absolute http)
    tag: str
    actions: tuple[PushAction, ...] = field(default_factory=tuple)
    # Email-only enrichment
    subject: str = ""                            # inbox subject (falls back to title)
    preheader: str = ""                          # inbox preview (falls back to email_lead/body)
    eyebrow: str = ""                            # small category kicker above the H1
    email_lead: str = ""                         # email lead paragraph (falls back to body)
    details: tuple[DetailRow, ...] = field(default_factory=tuple)
    cta_label: str = ""                          # email button label (falls back to "Open VoctManager")

    # -- projections -------------------------------------------------------- #

    def to_push(self) -> PushPayload:
        return PushPayload(
            title=self.title,
            body=self.body,
            url=self.url_path,
            tag=self.tag,
            notification_type=self.notification_type,
            level=self.level,
            actions=self.actions,
        )

    def to_email_context(self, *, base_url: str) -> dict[str, Any]:
        return {
            "eyebrow": self.eyebrow,
            "headline": self.title,
            "preheader": self.preheader or self.email_lead or self.body,
            "lead": self.email_lead or self.body,
            "details": [{"label": d.label, "value": d.value} for d in self.details],
            "cta_label": self.cta_label or _("Open VoctManager"),
            "cta_url": _absolute(self.url_path, base_url),
            "level": self.level,
        }


@dataclass(frozen=True)
class MessageContext:
    """Inputs handed to every per-type composer. Frozen for safety."""
    notification_type: str
    level: str
    metadata: dict[str, Any]
    is_manager: bool


# --------------------------------------------------------------------------- #
# Helpers                                                                      #
# --------------------------------------------------------------------------- #

def _truncate(value: str, limit: int) -> str:
    if not value:
        return ""
    return value if len(value) <= limit else value[: limit - 1].rstrip() + _ELLIPSIS


def _absolute(url_path: str, base_url: str) -> str:
    """Resolve an SPA-relative deep-link to an absolute URL for email clients."""
    if not url_path:
        return base_url
    if url_path.startswith(("http://", "https://")):
        return url_path
    return f"{base_url.rstrip('/')}{url_path}"


def _row(label: str, value: Any) -> DetailRow:
    return DetailRow(label=label, value=str(value))


def _open_action(url: str = "") -> PushAction:
    return PushAction(action="view", title=_("Open"), url=url)


def _dismiss_action() -> PushAction:
    return PushAction(action="dismiss", title=_("Dismiss"))


# Role-aware deep-link resolution. Mirrors the in-app navigation contract from
# NotificationItem.tsx so the push, the email CTA and the in-app click all route
# to the same destination.

def _projects_url(ctx: MessageContext) -> str:
    return "/panel/projects" if ctx.is_manager else "/panel/schedule"


def _rehearsals_url(ctx: MessageContext) -> str:
    return "/panel/rehearsals" if ctx.is_manager else "/panel/schedule"


def _materials_url(ctx: MessageContext) -> str:
    return "/panel/archive-management" if ctx.is_manager else "/panel/materials"


def _contracts_url(_ctx: MessageContext) -> str:
    return "/panel/contracts"


def _settings_notifications_url() -> str:
    return "/panel/settings?tab=notifications"


# -- structured-code → localized label maps --------------------------------- #

def _attendance_status_phrase(status: str | None) -> str:
    """Verb phrase for an attendance status, e.g. 'is present'."""
    return {
        "PRESENT": _("will be there"),
        "LATE": _("will be a little late"),
        "ABSENT": _("can't make it"),
        "EXCUSED": _("asked to be excused"),
    }.get(status or "", _("updated their attendance"))


def _participation_status_phrase(status: str | None) -> str:
    """Verb phrase for a participation RSVP, e.g. 'confirmed their place'."""
    return {
        "CON": _("confirmed their place"),
        "DEC": _("declined the invitation"),
        "INV": _("was invited"),
    }.get(status or "", _("responded to the invitation"))


def _change_field_label(field_key: str) -> str:
    """Localized human label for a structured change key."""
    return {
        "title": _("Title"),
        "date_time": _("Date & time"),
        "location": _("Venue"),
        "call_time": _("Call time"),
        "status": _("Status"),
        "conductor": _("Conductor"),
        "dress_code": _("Dress code"),
        "focus": _("Focus"),
        "is_mandatory": _("Attendance"),  # legacy rows; new rows use now_mandatory/now_optional
        "now_mandatory": _("Now mandatory"),
        "now_optional": _("Now optional"),
        "voice_line": _("Voice part"),
    }.get(field_key, field_key.replace("_", " ").capitalize())


def _render_change(change: dict[str, Any]) -> str:
    """One change as a compact localized phrase: 'Venue: A → B' / 'Conductor'."""
    label = _change_field_label(str(change.get("field", "")))
    old, new = change.get("old"), change.get("new")
    if old and new:
        return _("%(label)s: %(old)s → %(new)s") % {"label": label, "old": old, "new": new}
    if new:
        return _("%(label)s: %(new)s") % {"label": label, "new": new}
    return label


def _summarize_changes(changes: Any, limit: int = 3) -> str:
    """A scannable, localized one-liner summarizing structured field changes."""
    if not isinstance(changes, (list, tuple)) or not changes:
        return ""
    rendered = [_render_change(c) for c in changes if isinstance(c, dict)]
    head = "; ".join(rendered[:limit])
    if len(rendered) > limit:
        head += " " + _("(+%(count)d more)") % {"count": len(rendered) - limit}
    return head


def _change_rows(changes: Any) -> tuple[DetailRow, ...]:
    """Structured changes as labelled email detail rows."""
    if not isinstance(changes, (list, tuple)):
        return ()
    rows: list[DetailRow] = []
    for c in changes:
        if not isinstance(c, dict):
            continue
        label = _change_field_label(str(c.get("field", "")))
        old, new = c.get("old"), c.get("new")
        value = f"{old} → {new}" if old and new else (new or old or "—")
        rows.append(DetailRow(label=label, value=str(value)))
    return tuple(rows)


def _rehearsal_detail_rows(project: str, when: Any = None, venue: Any = None, focus: Any = None) -> list[DetailRow]:
    """Current rehearsal facts rendered as email detail rows."""
    rows: list[DetailRow] = [_row(_("Project"), project)]
    if when:
        rows.append(_row(_("When"), when))
    if venue:
        rows.append(_row(_("Where"), venue))
    if focus:
        rows.append(_row(_("Focus"), focus))
    return rows


# --------------------------------------------------------------------------- #
# Per-type composers                                                          #
# --------------------------------------------------------------------------- #

def _compose_project_invitation(ctx: MessageContext) -> MessageContent:
    m = ctx.metadata
    project = m.get("project_name") or _("a new project")
    inviter = m.get("inviter_name") or _("the management team")
    dates = m.get("date_range")
    venue = m.get("location")

    parts = [_("%(inviter)s would love to have you on this one.") % {"inviter": inviter}]
    if dates:
        parts.append(_("When: %(dates)s.") % {"dates": dates})
    if venue:
        parts.append(_("Where: %(venue)s.") % {"venue": venue})

    details: list[DetailRow] = []
    if m.get("inviter_name"):
        details.append(_row(_("Invited by"), inviter))
    if dates:
        details.append(_row(_("When"), dates))
    if venue:
        details.append(_row(_("Where"), venue))

    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level,
        title=_("You're invited: %(project)s") % {"project": project},
        body=" ".join(parts),
        url_path=_projects_url(ctx),
        tag=f"project-invitation:{m.get('participation_id') or m.get('project_id') or ''}",
        actions=(_open_action(),),
        subject=_("An invitation to sing — %(project)s") % {"project": project},
        eyebrow=_("Invitation"),
        email_lead=_("%(inviter)s has invited you to join %(project)s. We hope you can be part of it.")
        % {"inviter": inviter, "project": project},
        details=tuple(details),
        cta_label=_("See the invitation"),
    )


def _compose_project_updated(ctx: MessageContext) -> MessageContent:
    m = ctx.metadata
    project = m.get("project_name") or _("your project")

    if m.get("event") == "removed":
        return MessageContent(
            notification_type=ctx.notification_type,
            level=ctx.level or NotificationLevel.WARNING,
            title=_("Change of plans: %(project)s") % {"project": project},
            body=_("You're no longer on the roster for %(project)s. Reach out if this is unexpected.")
            % {"project": project},
            url_path=_projects_url(ctx),
            tag=f"project-removed:{m.get('project_id') or project}",
            actions=(_open_action(),),
            subject=_("You've been removed from %(project)s") % {"project": project},
            eyebrow=_("Project"),
            email_lead=_("You're no longer part of %(project)s. If that seems wrong, please get in touch with the office.")
            % {"project": project},
            cta_label=_("Open dashboard"),
        )

    summary = _summarize_changes(m.get("changes"))
    body = (
        _("A few things changed — %(summary)s.") % {"summary": summary}
        if summary
        else _("Some details have changed. Tap to see what's new.")
    )

    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level,
        title=_("Updated: %(project)s") % {"project": project},
        body=body,
        url_path=_projects_url(ctx),
        tag=f"project-updated:{m.get('project_id') or project}",
        actions=(_open_action(),),
        subject=_("What changed in %(project)s") % {"project": project},
        eyebrow=_("Project update"),
        email_lead=_("Here's what changed in %(project)s.") % {"project": project},
        details=_change_rows(m.get("changes")),
        cta_label=_("See the changes"),
    )


def _compose_project_cancelled(ctx: MessageContext) -> MessageContent:
    m = ctx.metadata
    project = m.get("project_name") or _("a project")
    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level or NotificationLevel.WARNING,
        title=_("Cancelled: %(project)s") % {"project": project},
        body=_("%(project)s won't be going ahead. Check your schedule for the details.")
        % {"project": project},
        url_path=_projects_url(ctx),
        tag=f"project-cancelled:{m.get('project_id') or project}",
        actions=(_open_action(),),
        subject=_("%(project)s has been cancelled") % {"project": project},
        eyebrow=_("Project cancelled"),
        email_lead=_("%(project)s has been cancelled.") % {"project": project},
        cta_label=_("Open dashboard"),
    )


def _compose_project_reminder(ctx: MessageContext) -> MessageContent:
    m = ctx.metadata
    project = m.get("project_name") or _("your next concert")
    when = display_event_time(m, "date_range", "starts_at")
    venue = m.get("location")
    body = (
        _("%(project)s is coming up on %(when)s. Almost showtime.")
        % {"project": project, "when": when}
        if when
        else _("%(project)s is coming up soon. Almost showtime.") % {"project": project}
    )
    details: list[DetailRow] = []
    if when:
        details.append(_row(_("When"), when))
    if venue:
        details.append(_row(_("Where"), venue))
    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level,
        title=_("Coming up: %(project)s") % {"project": project},
        body=body,
        url_path=_projects_url(ctx),
        tag=f"project-reminder:{m.get('project_id') or project}",
        actions=(_open_action(),),
        subject=(
            _("Coming up: %(project)s — %(when)s") % {"project": project, "when": when}
            if when
            else _("Coming up: %(project)s") % {"project": project}
        ),
        eyebrow=_("Reminder"),
        email_lead=body,
        details=tuple(details),
        cta_label=_("View schedule"),
    )


def _compose_rehearsal_scheduled(ctx: MessageContext) -> MessageContent:
    m = ctx.metadata
    project = m.get("project_name") or _("your project")
    when = display_event_time(m, "starts_at", "rehearsal_date")
    venue = m.get("location")
    focus = m.get("focus")
    body = (
        _("New rehearsal for %(project)s: %(when)s at %(venue)s.") % {
            "project": project, "when": when, "venue": venue,
        }
        if when and venue
        else _("New rehearsal for %(project)s: %(when)s.") % {"project": project, "when": when}
        if when
        else _("A new rehearsal has been added to %(project)s. Check the schedule before you travel.")
        % {"project": project}
    )
    if focus:
        body = _("%(body)s Focus: %(focus)s.") % {"body": body, "focus": focus}
    details = _rehearsal_detail_rows(project, when, venue, focus)
    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level,
        title=_("New rehearsal — %(project)s") % {"project": project},
        body=body,
        url_path=_rehearsals_url(ctx),
        tag=f"rehearsal-scheduled:{m.get('rehearsal_id') or ''}",
        actions=(_open_action(),),
        subject=(
            _("New rehearsal — %(project)s, %(when)s") % {"project": project, "when": when}
            if when
            else _("New rehearsal — %(project)s") % {"project": project}
        ),
        eyebrow=_("Rehearsal"),
        email_lead=body,
        details=tuple(details),
        cta_label=_("View schedule"),
    )


def _compose_rehearsal_updated(ctx: MessageContext) -> MessageContent:
    m = ctx.metadata
    project = m.get("project_name") or _("your project")
    when = display_event_time(m, "starts_at", "rehearsal_date")
    venue = m.get("location")
    focus = m.get("focus")
    summary = _summarize_changes(m.get("changes"))
    body = (
        _("Rehearsal details changed — %(summary)s.") % {"summary": summary}
        if summary
        else _("A rehearsal time or place has changed. Tap to check the schedule.")
    )
    details = list(_change_rows(m.get("changes")))
    details.extend(_rehearsal_detail_rows(project, when, venue, focus))
    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level or NotificationLevel.WARNING,
        title=_("Rehearsal changed — %(project)s") % {"project": project},
        body=body,
        url_path=_rehearsals_url(ctx),
        tag=f"rehearsal-updated:{m.get('rehearsal_id') or ''}",
        actions=(_open_action(),),
        subject=_("Rehearsal changed — %(project)s") % {"project": project},
        eyebrow=_("Rehearsal change"),
        email_lead=_("A rehearsal for %(project)s has changed.") % {"project": project},
        details=tuple(details),
        cta_label=_("View schedule"),
    )


def _compose_rehearsal_cancelled(ctx: MessageContext) -> MessageContent:
    m = ctx.metadata
    project = m.get("project_name") or _("your project")
    when = display_event_time(m, "starts_at", "rehearsal_date")
    venue = m.get("location")
    focus = m.get("focus")
    body = (
        _("The %(project)s rehearsal on %(when)s has been cancelled. Check the schedule before you travel.")
        % {"project": project, "when": when}
        if when
        else _("A %(project)s rehearsal has been cancelled. Check the schedule before you travel.")
        % {"project": project}
    )
    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level or NotificationLevel.WARNING,
        title=_("Rehearsal cancelled — %(project)s") % {"project": project},
        body=body,
        url_path=_rehearsals_url(ctx),
        tag=f"rehearsal-cancelled:{m.get('rehearsal_id') or ''}",
        actions=(_open_action(),),
        subject=(
            _("Rehearsal cancelled — %(project)s, %(when)s")
            % {"project": project, "when": when}
            if when
            else _("Rehearsal cancelled — %(project)s") % {"project": project}
        ),
        eyebrow=_("Rehearsal cancelled"),
        email_lead=body,
        details=tuple(_rehearsal_detail_rows(project, when, venue, focus)),
        cta_label=_("View schedule"),
    )


def _compose_rehearsal_reminder(ctx: MessageContext) -> MessageContent:
    m = ctx.metadata
    project = m.get("project_name") or _("your project")
    when = display_event_time(m, "starts_at", "rehearsal_date")
    venue = m.get("location")
    focus = m.get("focus")
    body = (
        _("%(project)s rehearsal %(when)s at %(venue)s.") % {
            "project": project, "when": when, "venue": venue,
        }
        if when and venue
        else _("%(project)s rehearsal %(when)s.") % {"project": project, "when": when}
        if when
        else _("Your %(project)s rehearsal is coming up. See you at the stands.")
        % {"project": project}
    )
    if focus:
        body = _("%(body)s Focus: %(focus)s.") % {"body": body, "focus": focus}
    details = _rehearsal_detail_rows(project, when, venue, focus)
    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level,
        title=_("Rehearsal reminder — %(project)s") % {"project": project},
        body=body,
        url_path=_rehearsals_url(ctx),
        tag=f"rehearsal-reminder:{m.get('rehearsal_id') or ''}",
        actions=(_open_action(),),
        subject=(
            _("Rehearsal reminder — %(project)s, %(when)s")
            % {"project": project, "when": when}
            if when
            else _("Rehearsal reminder — %(project)s") % {"project": project}
        ),
        eyebrow=_("Reminder"),
        email_lead=body,
        details=tuple(details),
        cta_label=_("View schedule"),
    )


def _compose_piece_casting_assigned(ctx: MessageContext) -> MessageContent:
    m = ctx.metadata
    piece = m.get("piece_title") or _("a new piece")
    voice = m.get("voice_line")
    score_url = _materials_url(ctx)
    actions = (
        _open_action(score_url),
        PushAction(action="schedule", title=_("Schedule"), url=_rehearsals_url(ctx)),
    )
    if voice:
        title = _("You're singing %(voice)s — %(piece)s") % {"voice": voice, "piece": piece}
        body = _("Your part in %(piece)s is %(voice)s. Open the score and recordings to start learning it.") % {
            "piece": piece, "voice": voice,
        }
    else:
        title = _("New part for you — %(piece)s") % {"piece": piece}
        body = _("You've been cast in %(piece)s. Open the score and recordings to start learning it.") % {
            "piece": piece,
        }
    details: list[DetailRow] = [_row(_("Piece"), piece)]
    if voice:
        details.append(_row(_("Voice part"), voice))
    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level,
        title=title,
        body=body,
        url_path=score_url,
        tag=f"casting-assigned:{m.get('piece_id') or piece}",
        actions=actions,
        subject=(
            _("You're singing %(voice)s — %(piece)s") % {"voice": voice, "piece": piece}
            if voice
            else _("A new part for you — %(piece)s") % {"piece": piece}
        ),
        eyebrow=_("Casting"),
        email_lead=body,
        details=tuple(details),
        cta_label=_("Open the score"),
    )


def _compose_piece_casting_updated(ctx: MessageContext) -> MessageContent:
    m = ctx.metadata
    piece = m.get("piece_title") or _("a piece")
    score_url = _materials_url(ctx)

    if m.get("event") == "removed":
        return MessageContent(
            notification_type=ctx.notification_type,
            level=ctx.level or NotificationLevel.WARNING,
            title=_("Casting change — %(piece)s") % {"piece": piece},
            body=_("You're no longer cast in %(piece)s.") % {"piece": piece},
            url_path=_projects_url(ctx),
            tag=f"casting-removed:{m.get('piece_id') or piece}",
            actions=(_open_action(),),
            subject=_("Casting change — %(piece)s") % {"piece": piece},
            eyebrow=_("Casting"),
            email_lead=_("You're no longer cast in %(piece)s.") % {"piece": piece},
            cta_label=_("Open dashboard"),
        )

    summary = _summarize_changes(m.get("changes"))
    body = (
        _("Your part changed — %(summary)s. Tap to review the score.") % {"summary": summary}
        if summary
        else _("Your casting in %(piece)s has changed. Tap to review the score.") % {"piece": piece}
    )
    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level,
        title=_("Casting update — %(piece)s") % {"piece": piece},
        body=body,
        url_path=score_url,
        tag=f"casting-updated:{m.get('piece_id') or piece}",
        actions=(_open_action(score_url),),
        subject=_("Casting update — %(piece)s") % {"piece": piece},
        eyebrow=_("Casting"),
        email_lead=_("Your casting in %(piece)s has been updated.") % {"piece": piece},
        details=_change_rows(m.get("changes")),
        cta_label=_("Open the score"),
    )


def _compose_material_uploaded(ctx: MessageContext) -> MessageContent:
    m = ctx.metadata
    piece = m.get("piece_title") or m.get("project_name") or _("your repertoire")
    score_url = _materials_url(ctx)
    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level,
        title=_("Fresh material — %(piece)s") % {"piece": piece},
        body=_("New sheet music or a recording has landed for %(piece)s. Tap to open it.")
        % {"piece": piece},
        url_path=score_url,
        tag=f"material-uploaded:{m.get('piece_id') or m.get('material_id') or piece}",
        actions=(_open_action(score_url),),
        subject=_("New material — %(piece)s") % {"piece": piece},
        eyebrow=_("Library"),
        email_lead=_("New sheet music or a recording has been added to %(piece)s.") % {"piece": piece},
        details=(_row(_("Piece"), piece),),
        cta_label=_("Open the library"),
    )


def _compose_contract_issued(ctx: MessageContext) -> MessageContent:
    m = ctx.metadata
    project = m.get("project_name") or _("your engagement")
    contracts_url = _contracts_url(ctx)
    return MessageContent(
        notification_type=ctx.notification_type,
        level=NotificationLevel.WARNING,
        title=_("Your contract is ready — %(project)s") % {"project": project},
        body=_("The contract for %(project)s is ready to review and sign.") % {"project": project},
        url_path=contracts_url,
        tag=f"contract-issued:{m.get('contract_id') or m.get('project_id') or ''}",
        actions=(_open_action(contracts_url),),
        subject=_("Contract ready to sign — %(project)s") % {"project": project},
        eyebrow=_("Contract"),
        email_lead=_("Your contract for %(project)s is ready to review and sign.") % {"project": project},
        details=(_row(_("Project"), project),),
        cta_label=_("Review the contract"),
    )


def _compose_absence_requested(ctx: MessageContext) -> MessageContent:
    m = ctx.metadata
    artist = m.get("artist_name") or _("A singer")
    project = m.get("project_name") or _("a project")
    when = m.get("rehearsal_date")
    note = m.get("excuse_note")
    body = (
        _("%(artist)s asked to be excused from the %(project)s rehearsal on %(when)s.")
        % {"artist": artist, "project": project, "when": when}
        if when
        else _("%(artist)s asked to be excused from %(project)s.")
        % {"artist": artist, "project": project}
    )
    rehearsals_url = _rehearsals_url(ctx)
    details: list[DetailRow] = [_row(_("Singer"), artist), _row(_("Project"), project)]
    if when:
        details.append(_row(_("Rehearsal"), when))
    if note:
        details.append(_row(_("Note"), note))
    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level,
        title=_("Absence request — %(artist)s") % {"artist": artist},
        body=body,
        url_path=rehearsals_url,
        tag=f"absence-requested:{m.get('rehearsal_id') or ''}",
        actions=(_open_action(rehearsals_url),),
        subject=_("Absence request — %(artist)s") % {"artist": artist},
        eyebrow=_("Attendance"),
        email_lead=body,
        details=tuple(details),
        cta_label=_("Review the request"),
    )


def _compose_absence_approved(ctx: MessageContext) -> MessageContent:
    m = ctx.metadata
    project = m.get("project_name") or _("your project")
    when = m.get("rehearsal_date")
    body = (
        _("You're excused from the %(project)s rehearsal on %(when)s. Thanks for letting us know.")
        % {"project": project, "when": when}
        if when
        else _("You're excused from %(project)s. Thanks for letting us know.") % {"project": project}
    )
    details: list[DetailRow] = [_row(_("Project"), project)]
    if when:
        details.append(_row(_("Rehearsal"), when))
    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level,
        title=_("You're excused — %(project)s") % {"project": project},
        body=body,
        url_path=_rehearsals_url(ctx),
        tag=f"absence-approved:{m.get('rehearsal_id') or ''}",
        actions=(_open_action(),),
        subject=_("Absence approved — %(project)s") % {"project": project},
        eyebrow=_("Attendance"),
        email_lead=body,
        details=tuple(details),
        cta_label=_("View schedule"),
    )


def _compose_absence_rejected(ctx: MessageContext) -> MessageContent:
    m = ctx.metadata
    project = m.get("project_name") or _("your project")
    when = m.get("rehearsal_date")
    body = (
        _("Your absence for the %(project)s rehearsal on %(when)s wasn't approved. Tap for details.")
        % {"project": project, "when": when}
        if when
        else _("Your absence for %(project)s wasn't approved. Tap for details.")
        % {"project": project}
    )
    details: list[DetailRow] = [_row(_("Project"), project)]
    if when:
        details.append(_row(_("Rehearsal"), when))
    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level or NotificationLevel.WARNING,
        title=_("Absence not approved — %(project)s") % {"project": project},
        body=body,
        url_path=_rehearsals_url(ctx),
        tag=f"absence-rejected:{m.get('rehearsal_id') or ''}",
        actions=(_open_action(),),
        subject=_("Absence not approved — %(project)s") % {"project": project},
        eyebrow=_("Attendance"),
        email_lead=body,
        details=tuple(details),
        cta_label=_("View schedule"),
    )


def _compose_participation_response(ctx: MessageContext) -> MessageContent:
    m = ctx.metadata
    artist = m.get("artist_name") or _("A singer")
    project = m.get("project_name") or _("a project")
    phrase = _participation_status_phrase(m.get("status"))
    body = _("%(artist)s %(phrase)s for %(project)s.") % {
        "artist": artist, "phrase": phrase, "project": project,
    }
    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level,
        title=_("%(artist)s — %(project)s") % {"artist": artist, "project": project},
        body=body,
        url_path=_projects_url(ctx),
        tag=f"participation:{m.get('project_id') or ''}:{m.get('artist_id') or artist}",
        actions=(_open_action(),),
        subject=body,
        eyebrow=_("RSVP"),
        email_lead=body,
        details=(_row(_("Singer"), artist), _row(_("Project"), project)),
        cta_label=_("Review the roster"),
    )


def _compose_attendance_submitted(ctx: MessageContext) -> MessageContent:
    m = ctx.metadata
    artist = m.get("artist_name") or _("A singer")
    project = m.get("project_name") or _("a project")
    when = m.get("rehearsal_date")
    phrase = _attendance_status_phrase(m.get("status"))
    minutes = m.get("minutes_late")
    if m.get("status") == "LATE" and minutes:
        phrase = _("will be about %(minutes)d min late") % {"minutes": int(minutes)}
    body = _("%(artist)s %(phrase)s — %(project)s.") % {
        "artist": artist, "phrase": phrase, "project": project,
    }
    rehearsals_url = _rehearsals_url(ctx)
    details: list[DetailRow] = [_row(_("Singer"), artist), _row(_("Project"), project)]
    if when:
        details.append(_row(_("Rehearsal"), when))
    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level,
        title=_("Attendance — %(project)s") % {"project": project},
        body=body,
        url_path=rehearsals_url,
        tag=f"attendance:{m.get('rehearsal_id') or ''}:{m.get('artist_id') or artist}",
        actions=(_open_action(rehearsals_url),),
        subject=body,
        eyebrow=_("Attendance"),
        email_lead=body,
        details=tuple(details),
        cta_label=_("Open rehearsals"),
    )


def _compose_custom_admin_message(ctx: MessageContext) -> MessageContent:
    """Direct manager → singer message. The sender names the title; the push body
    carries only the subject (lock-screen safe), while the full message is kept to
    the email lead and the in-app row."""
    m = ctx.metadata
    sender = m.get("sender_name") or _("the management team")
    subject = m.get("title") or _("A message for you")
    message = m.get("message") or ""

    body = str(subject) if subject else _("Open VoctManager to read the message.")
    cta_url = m.get("cta_url") or _settings_notifications_url()

    actions: tuple[PushAction, ...] = (_open_action(cta_url),)
    if m.get("cta_label"):
        actions = (PushAction(action="cta", title=str(m["cta_label"]), url=cta_url), _dismiss_action())

    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level or m.get("level") or NotificationLevel.INFO,
        title=_("Message from %(sender)s") % {"sender": sender},
        body=body,
        url_path=cta_url,
        tag=f"admin-message:{m.get('sender_id') or sender}",
        actions=actions,
        subject=str(subject),
        eyebrow=_("Message"),
        email_lead=str(message) or str(subject),
        cta_label=str(m.get("cta_label") or _("Open VoctManager")),
    )


def _compose_message_received(ctx: MessageContext) -> MessageContent:
    """New message in a conversation thread. The sender names the title; the push
    body names only the subject (lock-screen safe), with the snippet kept to the
    email lead and the in-app row."""
    m = ctx.metadata
    sender = m.get("sender_name") or _("the management team")
    subject = m.get("title") or _("New message")
    snippet = m.get("snippet") or m.get("message") or ""
    thread_id = m.get("thread_id") or ""
    thread_url = f"/panel/messages/{thread_id}" if thread_id else "/panel/messages"

    body = _("New message about: %(subject)s") % {"subject": subject}

    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level,
        title=_("Message from %(sender)s") % {"sender": sender},
        body=body,
        url_path=thread_url,
        tag=f"message:{thread_id}",
        actions=(PushAction(action="reply", title=_("Reply"), url=thread_url),),
        subject=_("New message: %(subject)s") % {"subject": subject},
        eyebrow=_("Message"),
        email_lead=str(snippet) or str(subject),
        cta_label=_("Open the conversation"),
    )


def _compose_channel_message(ctx: MessageContext) -> MessageContent:
    """New message in a project group channel. Push stays lock-screen safe."""
    m = ctx.metadata
    project = m.get("project_name") or _("your project")
    sender = m.get("sender_name") or _("someone")
    channel_id = m.get("channel_id") or ""
    channel_url = f"/panel/messages/channel/{channel_id}" if channel_id else "/panel/messages"

    body = _("%(sender)s posted in the channel.") % {"sender": sender}
    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level,
        title=str(project),
        body=body,
        url_path=channel_url,
        tag=f"channel:{channel_id}",
        actions=(PushAction(action="reply", title=_("Reply"), url=channel_url),),
        subject=_("New message in %(project)s") % {"project": project},
        eyebrow=_("Channel"),
        email_lead=body,
        cta_label=_("Open the channel"),
    )


def _compose_system_alert(ctx: MessageContext) -> MessageContent:
    m = ctx.metadata
    title = m.get("title") or _("A quick note")
    body = m.get("message") or _("There's something that needs your attention. Tap to learn more.")
    cta_url = m.get("cta_url") or "/panel"
    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level or NotificationLevel.WARNING,
        title=str(title),
        body=str(body),
        url_path=cta_url,
        tag="system-alert",
        actions=(_open_action(cta_url),),
        subject=str(title),
        eyebrow=_("Notice"),
        email_lead=str(body),
        cta_label=str(m.get("cta_label") or _("Open VoctManager")),
    )


def _compose_default(ctx: MessageContext) -> MessageContent:
    """Fallback for any unmapped or future notification types."""
    m = ctx.metadata
    project = m.get("project_name")
    title = (
        _("Update — %(project)s") % {"project": project}
        if project
        else _("Something new for you")
    )
    body = m.get("message") or _("You have a new update in VoctManager. Tap to take a look.")
    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level,
        title=title,
        body=body,
        url_path="/panel",
        tag=f"voct:{ctx.notification_type}",
        actions=(_open_action(),),
        subject=title,
        eyebrow=_("Notification"),
        email_lead=body,
        cta_label=_("Open VoctManager"),
    )


_Composer = Callable[[MessageContext], MessageContent]

_COMPOSERS: dict[str, _Composer] = {
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
    NotificationType.MESSAGE_RECEIVED: _compose_message_received,
    NotificationType.CHANNEL_MESSAGE: _compose_channel_message,
    NotificationType.SYSTEM_ALERT: _compose_system_alert,
}


class MessageContentBuilder:
    """
    Resolves the appropriate composer for a given notification type and produces
    a localized MessageContent. Must be invoked inside a translation.override()
    context — composers call gettext() at build time.
    """

    @classmethod
    def build(
        cls,
        notification_type: str,
        level: str,
        metadata: dict[str, Any],
        *,
        is_manager: bool,
    ) -> MessageContent:
        ctx = MessageContext(
            notification_type=notification_type,
            level=level or NotificationLevel.INFO,
            metadata=metadata or {},
            is_manager=is_manager,
        )
        composer = _COMPOSERS.get(notification_type, _compose_default)
        try:
            return composer(ctx)
        except Exception as exc:
            logger.warning(
                "[MessageContentBuilder] Composer for %s failed (%s); using default.",
                notification_type, exc,
            )
            return _compose_default(ctx)
