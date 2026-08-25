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
from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass, field
from typing import Any

from django.utils.translation import gettext as _
from django.utils.translation import ngettext, pgettext

from core.constants import VoiceLine
from core.voice_labels import voice_line_label

from .models import (
    AnnouncementKind,
    AnnouncementSubject,
    NotificationLevel,
    NotificationType,
)
from .time_metadata import display_event_end, display_event_time

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


@dataclass(frozen=True)
class BriefingItem:
    """One change inside a briefing, as three lines of decreasing weight: what it
    is, the fact that identifies it, and what is different about it."""
    primary: str
    secondary: str = ""
    detail: str = ""


@dataclass(frozen=True)
class MessageSection:
    """A titled run of briefing items. Only the briefing email renders these; every
    other type leaves the tuple empty and uses `details` as before."""
    title: str
    items: tuple[BriefingItem, ...]


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
    # Grouped items for the composite briefing layout; empty for every other type.
    sections: tuple[MessageSection, ...] = field(default_factory=tuple)
    cta_label: str = ""                          # email button label (falls back to "Open VoctManager")
    # "hello" (genderless, the default) or the warmer, gendered "dear" reserved for
    # the ceremonial moments — an invitation, a part, a contract.
    greeting_style: str = "hello"

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
            # The lead is the one place that says what the event MEANS for the
            # reader and what is expected of them — the facts themselves belong to
            # the detail card below it. Falling back to the push body is a last
            # resort for free-form types, not a pattern to reach for: the push body
            # is written for a lock screen and repeats the headline by design.
            "lead": self.email_lead or self.body,
            "details": [{"label": d.label, "value": d.value} for d in self.details],
            "sections": [
                {
                    "title": s.title,
                    "count": len(s.items),
                    "items": [
                        {"primary": i.primary, "secondary": i.secondary, "detail": i.detail}
                        for i in s.items
                    ],
                }
                for s in self.sections
            ],
            "cta_label": self.cta_label or _("Open VoctManager"),
            "cta_url": _absolute(self.url_path, base_url),
            "level": self.level,
            "greeting_style": self.greeting_style,
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


def _project_status_label(code: str | None) -> str:
    """
    Localized label for a Project.Status CODE. Deliberately the same msgids as the
    model's choices, so a status chip reads exactly as the status does everywhere
    else. Unknown codes pass through so a legacy row never renders blank.
    """
    return {
        "DRAFT": _("Draft / Planned"),
        "ACTIVE": _("Active / In Prep"),
        "DONE": _("Completed"),
        "CANC": _("Cancelled"),
    }.get(code or "", code or "")


def _event_kind_label(code: str | None) -> str:
    """
    Localized label for a Project.EventKind CODE. Same msgids as the model's
    choices, for the reason the status labels share theirs: a change row must
    name the kind exactly as every other surface names it. Unknown codes pass
    through so a legacy row never renders blank.
    """
    return {
        "CONCERT": pgettext("event kind", "Concert"),
        "MASS": pgettext("event kind", "Mass"),
        "WEDDING": pgettext("event kind", "Wedding Mass"),
        "OTHER": pgettext("event kind", "Other event"),
    }.get(code or "", code or "")


def _event_moment_label(code: str | None) -> str:
    """
    The event named as the moment it is — the word that leads a reminder and heads
    the briefing's project section.

    A second table beside `_event_kind_label` rather than a reuse of it: that one
    answers "which kind is this?" and therefore says "Other event", which is an
    answer to a question the recipient never asked. Kept local for the reason the
    status labels are: notifications compose from language-neutral codes and own
    their own vocabulary, so a copy edit in the roster's picker cannot silently
    rewrite a push title. An unknown code reads as a concert — the model default,
    and what every row stored before the kind existed is.
    """
    return {
        "CONCERT": pgettext("event moment", "Concert"),
        "MASS": pgettext("event moment", "Mass"),
        "WEDDING": pgettext("event moment", "Wedding Mass"),
        "OTHER": pgettext("event moment", "Event"),
    }.get(code or "", pgettext("event moment", "Concert"))


def _voice_line_label(code: str | None, scope: Iterable[str] = ()) -> str:
    """Localized label for a VoiceLine CODE (e.g. 'B1' → 'Bas 1').

    `scope` is the arrangement the part is read in, carried on the metadata as
    `voice_scope`: a family with one line there loses its index ('T1' → 'Tenor').
    Tolerant of a legacy pre-rendered value or an unknown code — returns it
    unchanged so an old row never renders blank.
    """
    if not code:
        return ""
    try:
        VoiceLine(code)
    except ValueError:
        return str(code)
    return voice_line_label(code, scope)


def _voice_scope(m: Mapping[str, Any]) -> tuple[str, ...]:
    """The naming scope carried on a metadata payload. Empty on legacy rows,
    which then read exactly as they used to."""
    raw = m.get("voice_scope") or ()
    return tuple(str(code) for code in raw if code)


def _change_field_label(field_key: str) -> str:
    """Localized human label for a structured change key."""
    return {
        "title": _("Title"),
        "date_time": _("Date & time"),
        "location": _("Venue"),
        "call_time": _("Call time"),
        "status": _("Status"),
        # Same msgid as the model's own verbose name, for the reason the status
        # labels share theirs: one fact, one word, everywhere it is named.
        "event_kind": _("Event kind"),
        "conductor": _("Conductor"),
        "dress_code": _("Dress code"),
        "focus": _("Focus"),
        "duration": _("Duration"),
        "is_mandatory": _("Attendance"),  # legacy rows; new rows use now_mandatory/now_optional
        "now_mandatory": _("Now mandatory"),
        "now_optional": _("Now optional"),
        "voice_line": _("Voice part"),
        "gives_pitch": _("Starting pitch"),
        "notes": _("Part note"),
        "run_sheet": _("Day schedule"),
        # The day-of logistics. Same words the printed day card uses, which is
        # deliberate: the singer reads "Wejście" on the card and has to
        # recognise it in the message that says it changed.
        "warmup": _("Warm-up"),
        "soundcheck": _("Sound check"),
        "entrance": _("Entrance"),
        "parking": _("Parking"),
        "dressing_room": _("Dressing room"),
        "onsite_contact": _("On-site contact"),
    }.get(field_key, field_key.replace("_", " ").capitalize())


def _boolean_label(value: str) -> str:
    """Localized Yes/No for a flag stored as Python's `str(bool)`. An unrecognized
    value passes through, so a legacy row never renders as a blank."""
    return {"True": _("Yes"), "False": _("No")}.get(value, value)


def _duration_label(value: str) -> str:
    """A stored minute count spelled out ("2 h 30 min").

    The diff carries the number because it is written once and read in three
    languages; this is where it becomes words. The whole-hour case drops the
    minutes rather than printing "2 h 0 min", and an unparsable value passes
    through so a malformed row never renders blank.
    """
    try:
        minutes = int(value)
    except (TypeError, ValueError):
        return value
    hours, remainder = divmod(minutes, 60)
    if hours and remainder:
        return _("%(hours)d h %(minutes)d min") % {"hours": hours, "minutes": remainder}
    if hours:
        return _("%(hours)d h") % {"hours": hours}
    return _("%(minutes)d min") % {"minutes": remainder}


def _change_value(field_key: str, value: Any, scope: Iterable[str] = ()) -> Any:
    """Localizes a change value where the field carries a language-neutral code
    (voice line, project status, boolean flag); passes pre-formatted display values
    through unchanged. Without this the diff shows the raw database code
    ("ACTIVE → CANC")."""
    if not value:
        return value
    if field_key == "voice_line":
        return _voice_line_label(str(value), scope)
    if field_key == "status":
        return _project_status_label(str(value))
    if field_key == "event_kind":
        return _event_kind_label(str(value))
    if field_key == "gives_pitch":
        return _boolean_label(str(value))
    if field_key == "duration":
        return _duration_label(str(value))
    return value


def _render_change(change: dict[str, Any], scope: Iterable[str] = ()) -> str:
    """One change as a compact localized phrase: 'Venue: A → B' / 'Conductor'."""
    field_key = str(change.get("field", ""))
    label = _change_field_label(field_key)
    old = _change_value(field_key, change.get("old"), scope)
    new = _change_value(field_key, change.get("new"), scope)
    if old and new:
        return _("%(label)s: %(old)s → %(new)s") % {"label": label, "old": old, "new": new}
    if new:
        return _("%(label)s: %(new)s") % {"label": label, "new": new}
    return label


def _summarize_changes(changes: Any, limit: int = 3, scope: Iterable[str] = ()) -> str:
    """A scannable, localized one-liner summarizing structured field changes.

    `scope` names any voice line inside the diff the way the rest of the message
    names it — a move between two lines of an undivided family would otherwise
    read "Tenor 1 → Tenor 2" beside a heading that says plain "Tenor"."""
    if not isinstance(changes, (list, tuple)) or not changes:
        return ""
    rendered = [_render_change(c, scope) for c in changes if isinstance(c, dict)]
    head = "; ".join(rendered[:limit])
    if len(rendered) > limit:
        head += " " + _("(+%(count)d more)") % {"count": len(rendered) - limit}
    return head


def _change_rows(changes: Any, scope: Iterable[str] = ()) -> tuple[DetailRow, ...]:
    """Structured changes as labelled email detail rows."""
    if not isinstance(changes, (list, tuple)):
        return ()
    rows: list[DetailRow] = []
    for c in changes:
        if not isinstance(c, dict):
            continue
        field_key = str(c.get("field", ""))
        label = _change_field_label(field_key)
        old = _change_value(field_key, c.get("old"), scope)
        new = _change_value(field_key, c.get("new"), scope)
        value = f"{old} → {new}" if old and new else (new or old or "—")
        rows.append(DetailRow(label=label, value=str(value)))
    return tuple(rows)


def _facts(*parts: Any) -> str:
    """
    Joins the glance facts of a push body: "Wcielenie · Sala prób, ul. Freta 10".
    Empty parts drop out, so a missing venue leaves no dangling separator.

    The first character is upper-cased: a rendered moment is lowercase in Polish
    and French ("jutro o 19:00"), and a fact line often opens with one.
    """
    line = " · ".join(str(p).strip() for p in parts if p and str(p).strip())
    return line[:1].upper() + line[1:] if line else ""


# A rendered event moment reads "jutro o 19:00" / "piątek, 6 listopada o 19:00" —
# lowercase, because Polish and French write weekdays that way. It must therefore
# never open a sentence: keep it after a noun, a dash, or inside a fact list.


def _rehearsal_detail_rows(
    project: str,
    when: Any = None,
    venue: Any = None,
    focus: Any = None,
    ends: Any = None,
) -> list[DetailRow]:
    """Current rehearsal facts rendered as email detail rows.

    The closing hour gets a row of its own rather than being folded into "When":
    a singer plans the rest of their evening around it, and it is absent on every
    session nobody has timed — a merged range would have to invent one to stay a
    single line.
    """
    rows: list[DetailRow] = [_row(_("Project"), project)]
    if when:
        rows.append(_row(_("When"), when))
    if ends:
        rows.append(_row(_("Ends"), ends))
    if venue:
        rows.append(_row(_("Where"), venue))
    if focus:
        rows.append(_row(_("Focus"), focus))
    return rows


# --------------------------------------------------------------------------- #
# Per-type composers                                                          #
# --------------------------------------------------------------------------- #

def _invitation_rehearsal_lines(entries: Any) -> list[str]:
    """One line per rehearsal: its moment, its venue, and — only when it is not
    obligatory — that it is optional. Marking the exception rather than the rule
    keeps a five-rehearsal block readable.

    Joined without `_facts`, whose leading capital is meant for a push body: here
    each line is a value under a label, and the row above it ("When: piątek…")
    renders the same kind of moment lowercase.
    """
    lines: list[str] = []
    for entry in entries or ():
        if not isinstance(entry, dict):
            continue
        parts = (display_event_time(entry), entry.get("location"), entry.get("focus"))
        line = " · ".join(str(part).strip() for part in parts if part and str(part).strip())
        if not line:
            continue
        if entry.get("is_mandatory") is False:
            line = _("%(rehearsal)s (optional)") % {"rehearsal": line}
        lines.append(line)
    return lines


def _compose_project_invitation(ctx: MessageContext) -> MessageContent:
    m = ctx.metadata
    project = m.get("project_name") or _("a new project")
    inviter = m.get("inviter_name") or _("the management team")
    dates = display_event_time(m, "date_range")
    venue = m.get("location")

    rehearsal_lines = _invitation_rehearsal_lines(m.get("rehearsals"))
    rehearsal_count = len(rehearsal_lines)
    # The rehearsals are the real price of saying yes, so their number belongs in
    # the glance itself — the singer is deciding, not being kept informed.
    rehearsal_summary = ngettext(
        "%(count)d rehearsal", "%(count)d rehearsals", rehearsal_count
    ) % {"count": rehearsal_count} if rehearsal_count else ""

    invitation_scope = _voice_scope(m)
    voice_lines = ", ".join(
        dict.fromkeys(
            _voice_line_label(str(code), invitation_scope)
            for code in (m.get("voice_lines") or ())
            if code
        )
    )

    # Push carries the glance facts; the invitation's warmth lives in the email
    # lead, where there is room for it.
    body = _facts(dates, venue, rehearsal_summary)
    if m.get("inviter_name"):
        body = _("%(facts)s. Invited by %(inviter)s.") % {"facts": body, "inviter": inviter} if body \
            else _("Invited by %(inviter)s.") % {"inviter": inviter}
    elif body:
        body = f"{body}."

    details: list[DetailRow] = []
    if m.get("inviter_name"):
        details.append(_row(_("Invited by"), inviter))
    if dates:
        details.append(_row(_("When"), dates))
    if venue:
        details.append(_row(_("Where"), venue))
    call_time = display_event_time({
        "starts_at": m.get("call_time_at"),
        "starts_at_display": m.get("call_time_display"),
        "timezone": m.get("timezone"),
    })
    if call_time:
        details.append(_row(_("Call time"), call_time))
    if voice_lines:
        details.append(_row(_("Your part"), voice_lines))
    # Multi-value rows are newline-separated; the email detail card renders them
    # as separate lines, and nothing else consumes `details`.
    if rehearsal_lines:
        details.append(_row(_("Rehearsals"), "\n".join(rehearsal_lines)))
    program = [str(title) for title in (m.get("program") or ()) if title]
    if program:
        details.append(_row(_("Programme"), "\n".join(program)))
    if m.get("dress_code"):
        details.append(_row(_("Dress code"), m["dress_code"]))

    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level,
        title=_("You're invited: %(project)s") % {"project": project},
        body=body or _("Open the invitation to see the details."),
        url_path=_projects_url(ctx),
        tag=f"project-invitation:{m.get('participation_id') or m.get('project_id') or ''}",
        actions=(_open_action(),),
        subject=_("An invitation to sing — %(project)s") % {"project": project},
        eyebrow=_("Invitation"),
        email_lead=_(
            "%(inviter)s has invited you to join %(project)s. Everything you need is"
            " below — let us know whether you can be part of it."
        ) % {"inviter": inviter, "project": project},
        details=tuple(details),
        cta_label=_("See the invitation"),
        greeting_style="dear",
    )


def _compose_project_updated(ctx: MessageContext) -> MessageContent:
    m = ctx.metadata
    project = m.get("project_name") or _("your project")

    if m.get("event") == "removed":
        return MessageContent(
            notification_type=ctx.notification_type,
            level=ctx.level or NotificationLevel.WARNING,
            title=_("Change of plans: %(project)s") % {"project": project},
            body=_("You're no longer on this roster. Reach out if that's unexpected."),
            url_path=_projects_url(ctx),
            tag=f"project-removed:{m.get('project_id') or project}",
            actions=(_open_action(),),
            subject=_("You've been removed from %(project)s") % {"project": project},
            eyebrow=_("Project"),
            email_lead=_(
                "You're no longer part of %(project)s, so nothing is expected of you"
                " for it. If that seems wrong, please get in touch with the office."
            ) % {"project": project},
            cta_label=_("Open dashboard"),
        )

    summary = _summarize_changes(m.get("changes"))
    body = summary or _("Open the schedule to see what's new.")

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
        email_lead=_(
            "Some details of %(project)s have changed. Here is what is different now"
            " — check that the new plan still works for you."
        ) % {"project": project},
        details=_change_rows(m.get("changes")),
        cta_label=_("See the changes"),
    )


# --------------------------------------------------------------------------- #
# The composite briefing                                                       #
# --------------------------------------------------------------------------- #
# Sections in the order a singer reads them: what is theirs alone, then the dates
# they have to keep, then the concert itself. The same order drives the push
# glance, so the lock screen leads with the personal news too.
_BRIEFING_SECTION_ORDER: tuple[str, ...] = (
    AnnouncementSubject.CASTING,
    AnnouncementSubject.REHEARSAL,
    AnnouncementSubject.PROJECT,
)

# How many item headlines fit a push body before the rest becomes a count.
_BRIEFING_GLANCE_LIMIT = 3


def _briefing_section_title(subject_type: str, event_kind: str | None = None) -> str:
    titles: dict[str, str] = {
        AnnouncementSubject.CASTING: _("Your part"),
        AnnouncementSubject.REHEARSAL: _("Rehearsals"),
        # The event itself, headed by its own name: the two sections above it are
        # named for what they contain, and this one has to be too.
        AnnouncementSubject.PROJECT: _event_moment_label(event_kind),
    }
    return titles.get(subject_type, _("Other changes"))


def _briefing_casting_items(kind: str, m: dict[str, Any]) -> list[BriefingItem]:
    """A seat on one piece. The piece names the item; the voice line and what moved
    sit underneath it."""
    piece = str(m.get("piece_title") or _("a piece"))
    if kind == AnnouncementKind.REMOVED:
        return [BriefingItem(primary=piece, detail=_("You're no longer singing this one."))]

    scope = _voice_scope(m)
    voice = _voice_line_label(m.get("voice_line"), scope)
    if kind == AnnouncementKind.CREATED:
        return [BriefingItem(primary=piece, secondary=voice, detail=_("A new part for you."))]
    return [
        BriefingItem(
            primary=piece,
            secondary=voice,
            detail=_summarize_changes(m.get("changes"), limit=4, scope=scope),
        )
    ]


def _briefing_rehearsal_items(kind: str, m: dict[str, Any]) -> list[BriefingItem]:
    """A rehearsal names itself by its moment — that is what the reader has to put
    in a diary. The moment follows a dash so it never opens the line, which Polish
    and French both render lowercase."""
    when = display_event_time(m, "starts_at", "rehearsal_date")
    venue = str(m.get("location") or "")

    if kind == AnnouncementKind.CREATED:
        primary = (
            _("New rehearsal — %(when)s") % {"when": when}
            if when
            else _("A new rehearsal has been added")
        )
        return [BriefingItem(primary=primary, secondary=venue, detail=str(m.get("focus") or ""))]

    primary = (
        _("Rehearsal — %(when)s") % {"when": when} if when else _("A rehearsal has changed")
    )
    return [
        BriefingItem(
            primary=primary,
            secondary=venue,
            detail=_summarize_changes(m.get("changes"), limit=4),
        )
    ]


def _briefing_project_items(m: dict[str, Any]) -> list[BriefingItem]:
    """One item per field. A briefing lists "Venue — A → B" the way the conductor's
    review sheet does, rather than folding four changes into one dense line."""
    return [
        BriefingItem(primary=row.label, detail=row.value)
        for row in _change_rows(m.get("changes"))
    ]


def _briefing_sections(items: Any, event_kind: str | None = None) -> tuple[MessageSection, ...]:
    """Group the briefing's items into rendered sections.

    Each item carries the payload its own emitter built, so the line a briefing
    shows is composed from the same facts the standalone message would have used.
    An item of an unknown subject is dropped rather than guessed at — a briefing
    that half-renders is worse than one that is merely shorter.
    """
    builders: dict[str, Any] = {
        AnnouncementSubject.CASTING: _briefing_casting_items,
        AnnouncementSubject.REHEARSAL: _briefing_rehearsal_items,
    }
    grouped: dict[str, list[BriefingItem]] = {}

    for item in items or ():
        if not isinstance(item, dict):
            continue
        subject = str(item.get("subject_type") or "")
        payload = item.get("metadata")
        payload = payload if isinstance(payload, dict) else {}

        if subject == AnnouncementSubject.PROJECT:
            built = _briefing_project_items(payload)
        elif subject in builders:
            built = builders[subject](str(item.get("kind") or AnnouncementKind.CHANGED), payload)
        else:
            continue
        grouped.setdefault(subject, []).extend(entry for entry in built if entry.primary)

    return tuple(
        MessageSection(
            title=_briefing_section_title(subject, event_kind),
            items=tuple(grouped[subject]),
        )
        for subject in _BRIEFING_SECTION_ORDER
        if grouped.get(subject)
    )


def _compose_project_briefing(ctx: MessageContext) -> MessageContent:
    """Everything one singer has not been told about one project, in one message.

    This is what the announcement queue publishes when a recipient has more than
    one piece of news waiting — five rehearsal changes and a part reach them as a
    single briefing instead of six separate alarms. A recipient with exactly one
    item never sees this type: they get that item's own message, which says more
    precisely what happened.
    """
    m = ctx.metadata
    project = m.get("project_name") or _("your project")
    sections = _briefing_sections(m.get("items"), str(m.get("event_kind") or ""))
    headlines = [item.primary for section in sections for item in section.items]
    note = str(m.get("note") or "").strip()

    glance = "; ".join(headlines[:_BRIEFING_GLANCE_LIMIT])
    if len(headlines) > _BRIEFING_GLANCE_LIMIT:
        glance += " " + _("(+%(count)d more)") % {
            "count": len(headlines) - _BRIEFING_GLANCE_LIMIT
        }

    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level,
        # The count leads so a long concert name can never push it off a lock
        # screen — the same reasoning as the reminder titles.
        title=ngettext(
            "%(count)d update — %(project)s",
            "%(count)d updates — %(project)s",
            len(headlines),
        ) % {"count": len(headlines), "project": project},
        # The conductor's own words come first when there are any; the facts follow
        # and are truncated from the tail, so the note is never the part that is cut.
        body=_facts(note, glance) or _("Open the schedule to see what's new."),
        url_path=_projects_url(ctx),
        tag=f"project-briefing:{m.get('project_id') or project}",
        actions=(_open_action(),),
        subject=_("What changed — %(project)s") % {"project": project},
        preheader=glance,
        eyebrow=_("Project update"),
        email_lead=_(
            "Here is everything that has changed since we last wrote to you about"
            " %(project)s. Anything to do with your own part comes first."
        ) % {"project": project},
        sections=sections,
        cta_label=_("See the changes"),
    )


def _compose_project_cancelled(ctx: MessageContext) -> MessageContent:
    m = ctx.metadata
    project = m.get("project_name") or _("a project")
    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level or NotificationLevel.WARNING,
        title=_("Cancelled: %(project)s") % {"project": project},
        body=_("This one won't be going ahead. Your other dates are unaffected."),
        url_path=_projects_url(ctx),
        tag=f"project-cancelled:{m.get('project_id') or project}",
        actions=(_open_action(),),
        subject=_("%(project)s has been cancelled") % {"project": project},
        eyebrow=_("Project cancelled"),
        email_lead=_(
            "%(project)s has been cancelled — you can free up the date. Everything"
            " else in your schedule stands."
        ) % {"project": project},
        cta_label=_("Open dashboard"),
    )


def _compose_project_reminder(ctx: MessageContext) -> MessageContent:
    m = ctx.metadata
    # The event's own name, which is also the only thing left to call it when the
    # project has no title on the row.
    moment = _event_moment_label(m.get("event_kind"))
    project = m.get("project_name") or moment
    when = display_event_time(m, "date_range", "starts_at")
    venue = m.get("location")
    # The moment leads the title, so a long project name can never push it off a
    # lock screen; the name and venue follow in the body. Both forms keep the
    # event's name in the nominative — Polish declines it after a preposition and
    # French needs its article, and neither survives a shared slot.
    title = (
        _("%(event)s — %(when)s") % {"event": moment, "when": when}
        if when
        else _("Coming up: %(event)s") % {"event": moment}
    )
    details: list[DetailRow] = []
    if when:
        details.append(_row(_("When"), when))
    if venue:
        details.append(_row(_("Where"), venue))
    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level,
        title=title,
        body=_facts(project, venue) or project,
        url_path=_projects_url(ctx),
        tag=f"project-reminder:{m.get('project_id') or project}",
        actions=(_open_action(),),
        subject=(
            _("Coming up: %(project)s — %(when)s") % {"project": project, "when": when}
            if when
            else _("Coming up: %(project)s") % {"project": project}
        ),
        eyebrow=_("Reminder"),
        email_lead=_(
            "%(project)s is almost here. Below is everything you need for the day —"
            " give it a look before you set off."
        ) % {"project": project},
        details=tuple(details),
        cta_label=_("View schedule"),
    )


def _compose_rehearsal_scheduled(ctx: MessageContext) -> MessageContent:
    m = ctx.metadata
    project = m.get("project_name") or _("your project")
    when = display_event_time(m, "starts_at", "rehearsal_date")
    venue = m.get("location")
    focus = m.get("focus")
    body = _facts(project, venue)
    if focus:
        body = _("%(facts)s. Focus: %(focus)s.") % {"facts": body, "focus": focus} if body \
            else _("Focus: %(focus)s.") % {"focus": focus}
    details = _rehearsal_detail_rows(project, when, venue, focus, display_event_end(m))
    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level,
        title=(
            _("New rehearsal — %(when)s") % {"when": when}
            if when
            else _("A new rehearsal has been added")
        ),
        body=body or project,
        url_path=_rehearsals_url(ctx),
        tag=f"rehearsal-scheduled:{m.get('rehearsal_id') or ''}",
        actions=(_open_action(),),
        subject=(
            _("New rehearsal — %(project)s, %(when)s") % {"project": project, "when": when}
            if when
            else _("New rehearsal — %(project)s") % {"project": project}
        ),
        eyebrow=_("Rehearsal"),
        email_lead=_(
            "A rehearsal has been added to %(project)s. If you can't make this one,"
            " mark it in the panel so we know who to count on."
        ) % {"project": project},
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
    body = _facts(project, summary) if summary else _facts(project, venue)
    details = list(_change_rows(m.get("changes")))
    details.extend(
        _rehearsal_detail_rows(project, when, venue, focus, display_event_end(m))
    )
    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level or NotificationLevel.WARNING,
        title=(
            _("Rehearsal moved — %(when)s") % {"when": when}
            if when
            else _("A rehearsal has changed")
        ),
        body=body or project,
        url_path=_rehearsals_url(ctx),
        tag=f"rehearsal-updated:{m.get('rehearsal_id') or ''}",
        actions=(_open_action(),),
        subject=_("Rehearsal changed — %(project)s") % {"project": project},
        eyebrow=_("Rehearsal change"),
        email_lead=_(
            "A rehearsal for %(project)s is not where it was. Check that the new"
            " arrangement still works for you."
        ) % {"project": project},
        details=tuple(details),
        cta_label=_("View schedule"),
    )


def _compose_rehearsal_cancelled(ctx: MessageContext) -> MessageContent:
    m = ctx.metadata
    project = m.get("project_name") or _("your project")
    when = display_event_time(m, "starts_at", "rehearsal_date")
    venue = m.get("location")
    focus = m.get("focus")
    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level or NotificationLevel.WARNING,
        title=(
            _("Rehearsal cancelled — %(when)s") % {"when": when}
            if when
            else _("Rehearsal cancelled")
        ),
        body=_("%(project)s — don't set off.") % {"project": project},
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
        email_lead=_(
            "This %(project)s rehearsal will not take place — please don't travel"
            " for it. Any new date will appear in your schedule."
        ) % {"project": project},
        details=tuple(_rehearsal_detail_rows(project, when, venue, focus)),
        cta_label=_("View schedule"),
    )


def _compose_rehearsal_reminder(ctx: MessageContext) -> MessageContent:
    m = ctx.metadata
    project = m.get("project_name") or _("your project")
    when = display_event_time(m, "starts_at", "rehearsal_date")
    venue = m.get("location")
    focus = m.get("focus")
    body = _facts(project, venue)
    if focus:
        body = _("%(facts)s. Focus: %(focus)s.") % {"facts": body, "focus": focus} if body \
            else _("Focus: %(focus)s.") % {"focus": focus}
    details = _rehearsal_detail_rows(project, when, venue, focus, display_event_end(m))
    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level,
        title=(
            _("Rehearsal %(when)s") % {"when": when}
            if when
            else _("Your rehearsal is coming up")
        ),
        body=body or project,
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
        email_lead=_(
            "A quick reminder about your next %(project)s rehearsal. The details are"
            " below — see you at the stands."
        ) % {"project": project},
        details=tuple(details),
        cta_label=_("View schedule"),
    )


def _compose_piece_casting_assigned(ctx: MessageContext) -> MessageContent:
    m = ctx.metadata
    piece = m.get("piece_title") or _("a new piece")
    voice = _voice_line_label(m.get("voice_line"), _voice_scope(m))
    project = m.get("project_name")
    when = display_event_time(m, "starts_at")
    score_url = _materials_url(ctx)
    actions = (
        _open_action(score_url),
        PushAction(action="schedule", title=_("Schedule"), url=_rehearsals_url(ctx)),
    )
    title = (
        _("You're singing %(voice)s — %(piece)s") % {"voice": voice, "piece": piece}
        if voice
        else _("New part for you — %(piece)s") % {"piece": piece}
    )
    # The title already names the part; the body adds the programme it belongs to
    # and what to do next.
    body = (
        _("%(facts)s. The score and recordings are waiting.") % {"facts": _facts(project, when)}
        if project or when
        else _("The score and recordings are waiting.")
    )
    details: list[DetailRow] = [_row(_("Piece"), piece)]
    if project:
        details.append(_row(_("Project"), project))
    if voice:
        details.append(_row(_("Voice part"), voice))
    if when:
        details.append(_row(_("When"), when))
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
        email_lead=_(
            "You have a part in this one. The score and the recordings are already in"
            " your materials — the earlier you look at them, the calmer the first"
            " rehearsal will be."
        ),
        details=tuple(details),
        cta_label=_("Open the score"),
        greeting_style="dear",
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
            body=_("You're no longer singing this one."),
            url_path=_projects_url(ctx),
            tag=f"casting-removed:{m.get('piece_id') or piece}",
            actions=(_open_action(),),
            subject=_("Casting change — %(piece)s") % {"piece": piece},
            eyebrow=_("Casting"),
            email_lead=_(
                "You're no longer cast in %(piece)s, so there is nothing left to"
                " prepare for it. The rest of your repertoire is unchanged."
            ) % {"piece": piece},
            cta_label=_("Open dashboard"),
        )

    project = m.get("project_name")
    scope = _voice_scope(m)
    summary = _summarize_changes(m.get("changes"), scope=scope)
    body = summary or _("Open the score to see your part.")
    details = list(_change_rows(m.get("changes"), scope))
    if project:
        details.append(_row(_("Project"), project))
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
        email_lead=_(
            "Your part in %(piece)s is not what it was. Open the score and check the"
            " new line before the next rehearsal."
        ) % {"piece": piece},
        details=tuple(details),
        cta_label=_("Open the score"),
    )


def _compose_material_uploaded(ctx: MessageContext) -> MessageContent:
    m = ctx.metadata
    piece = m.get("piece_title") or m.get("project_name") or _("your repertoire")
    composer = m.get("composer_name")
    kind = m.get("material_kind")
    score_url = _materials_url(ctx)

    if kind == "recording":
        title = _("New recording — %(piece)s") % {"piece": piece}
        lead = _(
            "A new recording for %(piece)s is in your materials — a good way to get"
            " the piece into your ear before the next rehearsal."
        ) % {"piece": piece}
    elif kind == "score":
        title = _("New sheet music — %(piece)s") % {"piece": piece}
        lead = _(
            "Fresh sheet music for %(piece)s is in your materials. Do have a look"
            " before you next sing it."
        ) % {"piece": piece}
    else:
        title = _("Fresh material — %(piece)s") % {"piece": piece}
        lead = _(
            "New material for %(piece)s has landed in your library."
        ) % {"piece": piece}

    details: list[DetailRow] = [_row(_("Piece"), piece)]
    if composer:
        details.append(_row(_("Composer"), composer))

    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level,
        title=title,
        body=(
            _("%(composer)s — open it in your materials.") % {"composer": composer}
            if composer
            else _("Open it in your materials.")
        ),
        url_path=score_url,
        tag=f"material-uploaded:{m.get('piece_id') or m.get('material_id') or piece}",
        actions=(_open_action(score_url),),
        subject=_("New material — %(piece)s") % {"piece": piece},
        eyebrow=_("Library"),
        email_lead=lead,
        details=tuple(details),
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
        body=_("Read it through and sign it in the panel."),
        url_path=contracts_url,
        tag=f"contract-issued:{m.get('contract_id') or m.get('project_id') or ''}",
        actions=(_open_action(contracts_url),),
        subject=_("Contract ready to sign — %(project)s") % {"project": project},
        eyebrow=_("Contract"),
        email_lead=_(
            "Your contract for %(project)s is ready. Please read it through and sign"
            " it in the panel — your place is confirmed once it is signed."
        ) % {"project": project},
        details=(_row(_("Project"), project),),
        cta_label=_("Review the contract"),
        greeting_style="dear",
    )


def _span_rows(metadata: Mapping[str, Any], when: str) -> list[DetailRow]:
    """
    How an absence states the ground it covers.

    One evening names the rehearsal. A span names both edges and how many
    rehearsals fell between them — the count is what the reader acts on, and it
    is never the number of days, because most days hold no rehearsal at all.
    """
    count = metadata.get("rehearsal_count")
    if not isinstance(count, int) or count < 2:
        return [_row(_("Rehearsal"), when)] if when else []

    until = display_event_end(metadata)
    rows = [_row(_("From"), when)] if when else []
    if until:
        rows.append(_row(_("Until"), until))
    rows.append(_row(_("Rehearsals covered"), count))
    return rows


def _is_span(metadata: Mapping[str, Any]) -> bool:
    count = metadata.get("rehearsal_count")
    return isinstance(count, int) and count > 1


def _compose_absence_requested(ctx: MessageContext) -> MessageContent:
    m = ctx.metadata
    artist = m.get("artist_name") or _("A singer")
    project = m.get("project_name") or _("a project")
    when = display_event_time(m, "rehearsal_date")
    note = m.get("excuse_note")
    rehearsals_url = _rehearsals_url(ctx)
    details: list[DetailRow] = [_row(_("Singer"), artist), _row(_("Project"), project)]
    details.extend(_span_rows(m, when))
    if note:
        details.append(_row(_("Note"), note))
    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level,
        title=_("Absence request — %(artist)s") % {"artist": artist},
        body=_facts(project, when) or project,
        url_path=rehearsals_url,
        tag=f"absence-requested:{m.get('rehearsal_id') or ''}",
        actions=(_open_action(rehearsals_url),),
        subject=_("Absence request — %(artist)s") % {"artist": artist},
        eyebrow=_("Attendance"),
        email_lead=(
            _(
                "%(artist)s is asking to be excused from a run of rehearsals. The"
                " dates are below — approve or decline them in the panel."
            )
            if _is_span(m)
            else _(
                "%(artist)s is asking to be excused from a rehearsal. The request is"
                " below — approve or decline it in the panel."
            )
        ) % {"artist": artist},
        details=tuple(details),
        cta_label=_("Review the request"),
    )


def _compose_absence_approved(ctx: MessageContext) -> MessageContent:
    m = ctx.metadata
    project = m.get("project_name") or _("your project")
    when = display_event_time(m, "rehearsal_date")
    details: list[DetailRow] = [_row(_("Project"), project)]
    details.extend(_span_rows(m, when))
    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level,
        title=_("You're excused — %(project)s") % {"project": project},
        body=(
            _("Rehearsal %(when)s — you're not expected.") % {"when": when}
            if when and not _is_span(m)
            else _("You're not expected at these rehearsals.")
            if _is_span(m)
            else _("You're not expected at this rehearsal.")
        ),
        url_path=_rehearsals_url(ctx),
        tag=f"absence-approved:{m.get('rehearsal_id') or ''}",
        actions=(_open_action(),),
        subject=_("Absence approved — %(project)s") % {"project": project},
        eyebrow=_("Attendance"),
        email_lead=_(
            "Your absence is recorded and there is nothing else you need to do."
            " Thank you for the early warning — it makes planning the rehearsal"
            " much easier."
        ),
        details=tuple(details),
        cta_label=_("View schedule"),
    )


def _compose_absence_rejected(ctx: MessageContext) -> MessageContent:
    m = ctx.metadata
    project = m.get("project_name") or _("your project")
    when = display_event_time(m, "rehearsal_date")
    details: list[DetailRow] = [_row(_("Project"), project)]
    details.extend(_span_rows(m, when))
    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level or NotificationLevel.WARNING,
        title=_("Absence not approved — %(project)s") % {"project": project},
        body=(
            _("We're counting on you at the rehearsal %(when)s.") % {"when": when}
            if when and not _is_span(m)
            else _("We're counting on you at these rehearsals.")
            if _is_span(m)
            else _("We're counting on you at this rehearsal.")
        ),
        url_path=_rehearsals_url(ctx),
        tag=f"absence-rejected:{m.get('rehearsal_id') or ''}",
        actions=(_open_action(),),
        subject=_("Absence not approved — %(project)s") % {"project": project},
        eyebrow=_("Attendance"),
        email_lead=_(
            "We weren't able to excuse you this time, so you are still expected at"
            " the rehearsal below. If that is genuinely impossible, write to us."
        ),
        details=tuple(details),
        cta_label=_("View schedule"),
    )


def _compose_participation_response(ctx: MessageContext) -> MessageContent:
    m = ctx.metadata
    artist = m.get("artist_name") or _("A singer")
    project = m.get("project_name") or _("a project")
    phrase = _participation_status_phrase(m.get("status"))
    # The person and their answer are the scanning line; the project is the body.
    headline = _("%(artist)s %(phrase)s") % {"artist": artist, "phrase": phrase}
    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level,
        title=headline,
        body=str(project),
        url_path=_projects_url(ctx),
        tag=f"participation:{m.get('project_id') or ''}:{m.get('artist_id') or artist}",
        actions=(_open_action(),),
        subject=_("%(headline)s — %(project)s") % {"headline": headline, "project": project},
        eyebrow=_("RSVP"),
        email_lead=_("%(headline)s.") % {"headline": headline},
        details=(_row(_("Singer"), artist), _row(_("Project"), project)),
        cta_label=_("Review the roster"),
    )


def _compose_attendance_submitted(ctx: MessageContext) -> MessageContent:
    m = ctx.metadata
    artist = m.get("artist_name") or _("A singer")
    project = m.get("project_name") or _("a project")
    when = display_event_time(m, "rehearsal_date")
    phrase = _attendance_status_phrase(m.get("status"))
    minutes = m.get("minutes_late")
    if m.get("status") == "LATE" and minutes:
        phrase = _("will be about %(minutes)d min late") % {"minutes": int(minutes)}
    headline = _("%(artist)s %(phrase)s") % {"artist": artist, "phrase": phrase}
    rehearsals_url = _rehearsals_url(ctx)
    details: list[DetailRow] = [_row(_("Singer"), artist), _row(_("Project"), project)]
    if when:
        details.append(_row(_("Rehearsal"), when))
    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level,
        title=headline,
        body=_facts(project, when) or project,
        url_path=rehearsals_url,
        tag=f"attendance:{m.get('rehearsal_id') or ''}:{m.get('artist_id') or artist}",
        actions=(_open_action(rehearsals_url),),
        subject=_("%(headline)s — %(project)s") % {"headline": headline, "project": project},
        eyebrow=_("Attendance"),
        email_lead=_("%(headline)s.") % {"headline": headline},
        details=tuple(details),
        cta_label=_("Open rehearsals"),
    )


def _waiting_phrase(hours: int) -> str:
    """How long the queue has been sitting, in the unit a reader would use.

    Under two days a conductor thinks in hours ("since this morning"); past that
    only the number of days carries any meaning, and "51 hours" reads as a machine
    talking. Both forms are plural-correct — Polish alone needs three.
    """
    if hours < 48:
        return ngettext(
            "waiting %(count)d hour", "waiting %(count)d hours", max(hours, 1)
        ) % {"count": max(hours, 1)}
    days = hours // 24
    return ngettext("waiting %(count)d day", "waiting %(count)d days", days) % {
        "count": days
    }


def _compose_announcement_pending(ctx: MessageContext) -> MessageContent:
    """The announcement queue has been sitting; the cast still does not know.

    Addressed to the managers, and the only project notification raised by the
    clock rather than by an edit. Its whole job is to be answerable in one tap, so
    the deep-link opens the review sheet itself rather than the project — a nudge
    that lands the reader somewhere they still have to go looking is the same
    silence with extra steps.
    """
    m = ctx.metadata
    project = m.get("project_name") or _("a project")
    changes = int(m.get("change_count") or 0)
    listeners = int(m.get("recipient_count") or 0)
    waiting = _waiting_phrase(int(m.get("waiting_hours") or 0))
    # Straight to the sheet. `?announce=1` is the hub's own contract for opening it.
    review_url = f"/panel/projects/{m.get('project_id') or ''}?announce=1"

    changes_phrase = ngettext(
        "%(count)d change", "%(count)d changes", changes
    ) % {"count": changes}
    details: list[DetailRow] = [
        _row(_("Project"), project),
        _row(_("Waiting to be sent"), changes_phrase),
    ]
    if listeners:
        details.append(_row(
            _("Not yet told"),  # paired with a count: "Not yet told: 12 people"
            ngettext("%(count)d person", "%(count)d people", listeners)
            % {"count": listeners},
        ))

    return MessageContent(
        notification_type=ctx.notification_type,
        level=ctx.level,
        # The situation leads, the project follows: a manager scanning a lock
        # screen needs to know it is the queue speaking before they read which
        # concert it is about.
        title=_("The cast hasn't been told — %(project)s") % {"project": project},
        body=_facts(changes_phrase, waiting),
        url_path=review_url,
        # Per project, so a second nudge about the same queue replaces the first
        # rather than stacking beside it.
        tag=f"announcement-pending:{m.get('project_id') or project}",
        actions=(_open_action(review_url),),
        subject=_("Changes waiting to be announced — %(project)s") % {"project": project},
        eyebrow=_("Announcement queue"),
        email_lead=_(
            "%(project)s is holding changes the cast has not been told about."
            " Nothing goes out until you send it — review what is waiting, add a"
            " word of your own if it helps, and press send. If it is no longer"
            " worth announcing, discard it and this will stop."
        ) % {"project": project},
        details=tuple(details),
        cta_label=_("Review what's waiting"),
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
    # A broadcast with no link of its own belongs on the dashboard — sending the
    # reader to their notification preferences answers a question nobody asked.
    cta_url = m.get("cta_url") or "/panel"

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

    # The title already says a message arrived — the body spends its room on what
    # it is about, and stops short of the content itself (lock-screen safe).
    body = str(subject)

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
    NotificationType.PROJECT_BRIEFING: _compose_project_briefing,
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
    NotificationType.ANNOUNCEMENT_PENDING: _compose_announcement_pending,
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
