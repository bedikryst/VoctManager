"""
@file delivery.py
@description Delivery policy shared by the notification router and the settings
             matrix: which preference group each event type belongs to, what that
             group's channels default to, which routine manager alerts the daily
             digest e-mail batches, and `plan_delivery` — the one decision of what
             each outbound channel does with an event.
@architecture Enterprise SaaS 2026
@module notifications/delivery
"""
from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum

from .models import NotificationLevel, NotificationType


@dataclass(frozen=True)
class PreferenceGroup:
    """One control in the settings ledger, and the delivery contract behind it.

    A group is a **consequence, not a category**. A reader answers "do I want to
    hear when what I have committed to changes?" — never "do I want
    PROJECT_UPDATED but not REHEARSAL_UPDATED?", which is a question about our
    internal event names and one nobody outside this repository can answer.

    Because a single control may only state a single answer, the member types of
    a group share one default per channel. That is enforced by construction:
    ``DEFAULT_EMAIL_ENABLED_TYPES`` below is *derived* from these groups rather
    than written beside them, so the ledger a reader is shown and the defaults the
    router applies cannot drift apart. A type that disagrees with its neighbours
    does not get an exception — it gets its own group.

    A one-member group is therefore legitimate, and ``safety_net`` is one. It is
    not a control over nothing: it governs exactly one type, honestly, and names a
    consequence its reader can state, which is the only test a group has to pass.
    """

    id: str
    types: tuple[str, ...]
    email: bool
    push: bool = True
    manager_only: bool = False
    # Narrower than manager_only, and needed because one group's audience is
    # narrower than "manager": the copy desk's reviewer is whoever applies an
    # accepted proposal to the repository and commits it, which is a staff
    # account by definition. Showing that control to a manager who will never
    # receive the notification would be a switch over nothing — the same fault
    # the module's whole shape exists to avoid.
    staff_only: bool = False


# The declaration order is the render order of the ledger. Team operations sit
# last so the manager-only daily digest lands beneath it as the ledger's footer,
# batching exactly the routine alerts listed directly above it — after the safety
# net moved out, that group's membership *is* DIGESTIBLE_TYPES.
#
# The organizing line is what a change *costs the reader*, which is also the line
# the router has always drawn:
#   • commitments — something you have said yes to has changed. E-mail ON + push
#     ON: the reader must not miss these even if they never open the app.
#   • requests — the verdict on something the reader themselves asked for. Push
#     ON, e-mail OFF: they opened the app to file it and they come back to see
#     how it went, which is the one case where the app is certain to be looked
#     at. The two directions share a group deliberately — a group that e-mailed
#     only refusals would turn its own arrival into the answer.
#   • messages — a person is writing to you. E-mail ON + push ON, for the same
#     reason a direct message deserves an inbox.
#   • materials — preparation and nudges: new scores and recordings, reminders.
#     Push ON, e-mail OFF. Timely, but not worth an inbox.
#   • safety_net — "tell me when I have forgotten to announce something". E-mail
#     ON + push ON: alone among the manager's alerts it reports that something
#     has *not* happened, and the failure it guards against is a conductor who
#     stopped opening the app — precisely the reader push and the in-app badge
#     cannot reach.
#   • site_copy — an editor has proposed changes to the public site's text.
#     E-mail ON + push ON. Deliberately NOT folded into the daily digest below:
#     it is already a digest — one message per editor per sitting — and batching
#     a batch would only cost it up to a day for nothing. Staff-only, because
#     the reader is whoever applies the proposals to the repository.
#   • debriefs — the leader's written account of an evening they ran. E-mail ON
#     + push ON, and deliberately NOT in the digest below, which is what put it
#     in a group of its own rather than in `team`. The digest exists for routine
#     fan-out — one row per singer per rehearsal — while a debrief is written
#     once, only for an evening somebody other than the conductor ran, and it is
#     the one thing the conductor wanted to read that night rather than at
#     breakfast. Same split, and the same reason, as `safety_net`.
#   • team — the manager's job console: routine reports of things that already
#     happened. Push ON + e-mail ON. The push is always immediate, one per
#     singer's burst (see push_fold). The e-mail takes the shape the reader's
#     digest switch gives it: at INFO, one daily digest, or one e-mail per event
#     with the digest off. An absence request for a rehearsal within 48 hours is
#     WARNING and never waits for the digest.
PREFERENCE_GROUPS: tuple[PreferenceGroup, ...] = (
    PreferenceGroup(
        id="commitments",
        email=True,
        types=(
            NotificationType.PROJECT_INVITATION,
            NotificationType.PROJECT_UPDATED,
            NotificationType.PROJECT_CANCELLED,
            NotificationType.REHEARSAL_SCHEDULED,
            NotificationType.REHEARSAL_UPDATED,
            NotificationType.REHEARSAL_CANCELLED,
            # Being handed a programme — and having it handed back — is a
            # commitment by the group's own definition: something the reader
            # must not miss even if they never open the app. It is also the one
            # pair here the reader did not ask for, which is exactly why the
            # e-mail matters: a stand-in who learns of the change by turning up
            # is the failure this type exists to prevent.
            NotificationType.REHEARSAL_DELEGATED,
            NotificationType.REHEARSAL_DELEGATION_ENDED,
            # One evening handed over is the same commitment at a finer grain —
            # and the same failure if it does not arrive.
            NotificationType.REHEARSAL_LEAD_ASSIGNED,
            # Casting belongs here, not with the sheet music. "You now sing S2
            # instead of S1" changes what the reader has to prepare — it is far
            # nearer to a moved rehearsal than to "a new recording was uploaded".
            # The volume objection that once kept it push-only died with the
            # announcement queue: casting no longer fans out per edit, so the
            # ceiling is one envelope per recipient per publication, exactly as
            # for a rehearsal. Keeping every event a briefing can carry inside one
            # group is a second, load-bearing effect — see NotificationRouter.
            NotificationType.PIECE_CASTING_ASSIGNED,
            NotificationType.PIECE_CASTING_UPDATED,
        ),
    ),
    PreferenceGroup(
        id="requests",
        email=False,
        types=(
            NotificationType.ABSENCE_APPROVED,
            NotificationType.ABSENCE_REJECTED,
        ),
    ),
    PreferenceGroup(
        id="messages",
        email=True,
        types=(
            NotificationType.MESSAGE_RECEIVED,
            # Management writing to you directly — parity with a DM, not a
            # broadcast the reader can safely miss.
            NotificationType.CUSTOM_ADMIN_MESSAGE,
        ),
    ),
    PreferenceGroup(
        id="materials",
        email=False,
        types=(
            NotificationType.MATERIAL_UPLOADED,
            NotificationType.PROJECT_REMINDER,
            NotificationType.REHEARSAL_REMINDER,
        ),
    ),
    PreferenceGroup(
        id="safety_net",
        email=True,
        manager_only=True,
        types=(NotificationType.ANNOUNCEMENT_PENDING,),
    ),
    PreferenceGroup(
        id="site_copy",
        email=True,
        manager_only=True,
        staff_only=True,
        types=(NotificationType.SITE_COPY_PROPOSED,),
    ),
    PreferenceGroup(
        id="debriefs",
        email=True,
        manager_only=True,
        types=(NotificationType.REHEARSAL_DEBRIEF_POSTED,),
    ),
    PreferenceGroup(
        id="team",
        email=True,
        manager_only=True,
        types=(
            NotificationType.PARTICIPATION_RESPONSE,
            NotificationType.ATTENDANCE_SUBMITTED,
            NotificationType.ABSENCE_REQUESTED,
        ),
    ),
)

# Types with no row in the ledger, and therefore no group: a group *is* a
# control, so a type nobody can control has nothing to belong to. Their defaults
# are stated per type here because no group speaks for them.
#
#  • CHANNEL_MESSAGE — project-channel push is an opt-in per channel
#    (ChannelMembership.push_enabled), not a global preference, and channel
#    traffic is deliberately never e-mailed.
#  • NOTIFICATION_READ_RECEIPT — in-app only; the router returns before either
#    channel, so toggles would be inert.
#  • CONTRACT_ISSUED — a commitment by nature, but contracts are still issued and
#    signed off-platform. The e-mail default is the answer for the day an in-app
#    contract flow ships; until then nothing emits it.
#  • SYSTEM_ALERT — no emitter yet (no admin broadcast UI), so a toggle would
#    govern an event that cannot fire.
#  • PROJECT_BRIEFING — a delivery *shape*, not a category. Which events it
#    gathers is an accident of how many things the conductor changed that week,
#    so a toggle on it would govern nothing the reader can name. The router
#    answers each item it carries by that item's own type instead (see
#    NotificationRouter._route_briefing); this entry is never consulted for
#    delivery and survives only as the answer if the type is ever re-exposed.
UNGROUPED_DEFAULTS: dict[str, tuple[bool, bool]] = {
    NotificationType.CHANNEL_MESSAGE: (False, True),
    NotificationType.NOTIFICATION_READ_RECEIPT: (False, True),
    NotificationType.CONTRACT_ISSUED: (True, True),
    NotificationType.SYSTEM_ALERT: (False, True),
    NotificationType.PROJECT_BRIEFING: (True, True),
}

GROUP_OF_TYPE: dict[str, str] = {
    ntype: group.id for group in PREFERENCE_GROUPS for ntype in group.types
}

MANAGER_ONLY_TYPES: frozenset[str] = frozenset(
    ntype
    for group in PREFERENCE_GROUPS
    if group.manager_only
    for ntype in group.types
)

STAFF_ONLY_TYPES: frozenset[str] = frozenset(
    ntype
    for group in PREFERENCE_GROUPS
    if group.staff_only
    for ntype in group.types
)

HIDDEN_FROM_PREFS: frozenset[str] = frozenset(UNGROUPED_DEFAULTS)

# Derived, never written by hand — see PreferenceGroup. Push therefore defaults ON
# for every routed type (it only ever reaches a user who has explicitly subscribed
# a device) while e-mail is reserved for the groups whose news is worth an inbox.
DEFAULT_EMAIL_ENABLED_TYPES: frozenset[str] = frozenset(
    [
        ntype
        for group in PREFERENCE_GROUPS
        for ntype in group.types
        if group.email
    ]
    + [ntype for ntype, (email, _push) in UNGROUPED_DEFAULTS.items() if email]
)

# Nothing is push-off by default. Kept as a derived seam rather than dropped, so a
# future noisy group can be demoted by flipping one flag on its declaration.
DEFAULT_PUSH_DISABLED_TYPES: frozenset[str] = frozenset(
    [
        ntype
        for group in PREFERENCE_GROUPS
        for ntype in group.types
        if not group.push
    ]
    + [ntype for ntype, (_email, push) in UNGROUPED_DEFAULTS.items() if not push]
)

# Routine, high-volume manager fan-out alerts. At INFO level, for a reader with
# the digest on, their e-mail is collected into one daily digest instead of one
# e-mail per event. Their push is never held back.
DIGESTIBLE_TYPES: frozenset[str] = frozenset({
    NotificationType.ATTENDANCE_SUBMITTED,
    NotificationType.PARTICIPATION_RESPONSE,
    NotificationType.ABSENCE_REQUESTED,
})

# Types that live in the bell and nowhere else. The router returns before
# reading a preference for them, so no row is ever minted for a type nobody
# can control.
IN_APP_ONLY_TYPES: frozenset[str] = frozenset({NotificationType.NOTIFICATION_READ_RECEIPT})


class EmailOutcome(StrEnum):
    """What the e-mail channel does with one event for one reader."""
    NOW = "now"
    DIGEST = "digest"
    OFF = "off"
    NEVER = "never"


class PushOutcome(StrEnum):
    """What the push channel does with one event for one reader."""
    NOW = "now"
    OFF = "off"
    NEVER = "never"


@dataclass(frozen=True)
class ChannelPlan:
    """The answer `plan_delivery` gives, one outcome per outbound channel.

    It states intent from preferences alone. Whether a device takes the push, or
    the account can receive e-mail at all, is known only to a read of the
    recipient's state, and the dispatchers check it at send time.
    """
    email: EmailOutcome
    push: PushOutcome


def assert_preference_policy_is_coherent() -> None:
    """Raise if the group map and the ledger it feeds could disagree.

    Two invariants, each of which has a failure mode this codebase has already met
    once: a type in two groups appears twice in the ledger, and a type in no group
    and no exception list silently renders the raw English Django label. Called
    from the app's ``ready()`` and asserted directly by the test suite.

    A group's control promising something its members do not hold needs no check
    here — the defaults are derived from the group, so the two cannot differ.
    """
    grouped: list[str] = [
        ntype for group in PREFERENCE_GROUPS for ntype in group.types
    ]
    duplicates = {ntype for ntype in grouped if grouped.count(ntype) > 1}
    if duplicates:
        raise ValueError(f"Notification types in more than one group: {sorted(duplicates)}")

    covered = set(grouped) | set(UNGROUPED_DEFAULTS)
    missing = {choice.value for choice in NotificationType} - covered
    if missing:
        raise ValueError(f"Notification types with no delivery group: {sorted(missing)}")

    # Staff is the narrower audience, so a staff-only group that forgot to also
    # be manager-only would be rendered to every reader by the first gate and
    # then contradicted by the second.
    inconsistent = [
        group.id for group in PREFERENCE_GROUPS if group.staff_only and not group.manager_only
    ]
    if inconsistent:
        raise ValueError(f"Staff-only groups must also be manager-only: {sorted(inconsistent)}")


def is_digestible(notification_type: str, level: str) -> bool:
    """
    True when an event is a routine informational manager alert whose e-mail
    belongs in the daily digest rather than in an e-mail of its own. WARNING and
    URGENT always return False, so actionable events are never deferred.
    """
    return (
        notification_type in DIGESTIBLE_TYPES
        and (level or NotificationLevel.INFO) == NotificationLevel.INFO
    )


def plan_delivery(
    notification_type: str,
    level: str,
    *,
    preference: Mapping[str, bool],
    digest_enabled: bool,
) -> ChannelPlan:
    """What each outbound channel does with one event for one reader.

    The router acts on this and nothing else decides. `preference` is the
    reader's effective choice for the type, in the shape of
    `default_channel_preferences`: their stored row where one exists, the shared
    default where it does not.

    The digest shapes e-mail only. An event held for it sends no e-mail now and
    still pushes at once: the digest batches an inbox, and a conductor who
    enabled push for these reports asked to hear them when they happen.
    """
    if notification_type in IN_APP_ONLY_TYPES:
        return ChannelPlan(email=EmailOutcome.NEVER, push=PushOutcome.NEVER)

    if not preference["email_enabled"]:
        email = EmailOutcome.OFF
    elif digest_enabled and is_digestible(notification_type, level):
        email = EmailOutcome.DIGEST
    else:
        email = EmailOutcome.NOW

    push = PushOutcome.NOW if preference["push_enabled"] else PushOutcome.OFF
    return ChannelPlan(email=email, push=push)


def default_channel_preferences(notification_type: str) -> dict[str, bool]:
    """Default email/push state for a notification type before user overrides."""
    return {
        "email_enabled": notification_type in DEFAULT_EMAIL_ENABLED_TYPES,
        "push_enabled": notification_type not in DEFAULT_PUSH_DISABLED_TYPES,
    }
