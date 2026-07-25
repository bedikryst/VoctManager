"""
@file delivery.py
@description Delivery policy shared by the notification router and the settings
             matrix: which preference group each event type belongs to, what that
             group's channels default to, and which routine manager alerts are
             batched into the daily digest.
@architecture Enterprise SaaS 2026
@module notifications/delivery
"""
from __future__ import annotations

from dataclasses import dataclass

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


# The declaration order is the render order of the ledger. Team operations sit
# last so the manager-only daily digest lands beneath it as the ledger's footer,
# batching exactly the routine alerts listed directly above it — after the safety
# net moved out, that group's membership *is* DIGESTIBLE_TYPES.
#
# The organizing line is what a change *costs the reader*, which is also the line
# the router has always drawn:
#   • commitments — something you have said yes to has changed, or a decision on
#     your own request has landed. E-mail ON + push ON: the reader must not miss
#     these even if they never open the app.
#   • messages — a person is writing to you. E-mail ON + push ON, for the same
#     reason a direct message deserves an inbox.
#   • materials — preparation and nudges: new scores and recordings, reminders.
#     Push ON, e-mail OFF. Timely, but not worth an inbox.
#   • team — the manager's job console: routine reports of things that already
#     happened. Push ON, e-mail OFF; at INFO level the daily digest carries them.
#   • safety_net — "tell me when I have forgotten to announce something". E-mail
#     ON + push ON: alone among the manager's alerts it reports that something
#     has *not* happened, and the failure it guards against is a conductor who
#     stopped opening the app — precisely the reader push and the in-app badge
#     cannot reach.
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
            # The outcome of the reader's own request, in both directions, so good
            # news is not the only kind that stays in-app.
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
        id="team",
        email=False,
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

# Routine, high-volume manager fan-out alerts. At INFO level these are collected
# into the daily digest instead of firing an immediate email + push per event.
DIGESTIBLE_TYPES: frozenset[str] = frozenset({
    NotificationType.ATTENDANCE_SUBMITTED,
    NotificationType.PARTICIPATION_RESPONSE,
    NotificationType.ABSENCE_REQUESTED,
})


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


def is_digestible(notification_type: str, level: str) -> bool:
    """
    True when an event is a routine informational manager alert that belongs in the
    daily digest rather than a real-time channel. WARNING/URGENT always returns
    False so actionable events are never deferred.
    """
    return (
        notification_type in DIGESTIBLE_TYPES
        and (level or NotificationLevel.INFO) == NotificationLevel.INFO
    )


def default_channel_preferences(notification_type: str) -> dict[str, bool]:
    """Default email/push state for a notification type before user overrides."""
    return {
        "email_enabled": notification_type in DEFAULT_EMAIL_ENABLED_TYPES,
        "push_enabled": notification_type not in DEFAULT_PUSH_DISABLED_TYPES,
    }
