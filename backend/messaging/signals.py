"""
@file signals.py
@description Domain event listeners for the messaging app:
    • Project-channel membership is kept in sync with two roster sources. A MEMBER
      joins when their participation is CONFIRMED and is dropped when they leave/decline
      (or the participation is soft/hard-deleted); a LEADER joins when a
      RehearsalDelegate goes live and is dropped when it is revoked or its scope
      closes. Each source only ever takes back a seat it owns, and a seat both
      sources hold passes to the other one instead of vanishing. The channel is
      created lazily on the first seat; removals never create one.
    • GDPR (Right to Erasure) on `account_soft_deleted`: blanks message content authored
      by the user (1:1 threads AND channels) and drops their conversations/memberships.
@architecture Enterprise SaaS 2026
@module messaging/signals
"""
import logging

from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from core.signals import account_soft_deleted
from roster.models import Participation, RehearsalDelegate
from roster.permissions import live_delegate_q

from .models import (
    ChannelMembership,
    ChannelMessage,
    ChannelRole,
    Message,
    ProjectChannel,
    Thread,
)

logger = logging.getLogger(__name__)

_ERASED_BODY = "[treść usunięta]"


# --------------------------------------------------------------------------- #
# Project-channel membership sync (driven by Participation and leadership)     #
# --------------------------------------------------------------------------- #
#
# One row per (channel, user), and its `role` names the SOURCE that seated the
# person. Two sources can hold one seat — a leader who also sings in the cast —
# so a source that ends must ask whether the other one still stands before it
# takes the seat away, and must never take a seat it does not own: the cast sync
# dropping by (channel, user) alone would have thrown the leader out of the
# channel of the project they run the evening they left its cast.


def _seat(project_id, user_id, *, role: str) -> None:
    """Give `user_id` a seat owned by `role`, creating the channel if needed.

    A seat the person already holds live is left as it is, whichever source
    owns it: the leader sync does not turn a MANAGER row into a LEADER one, and
    the cast sync does not turn a LEADER row into a MEMBER one — the second
    would let the cast sync drop it later. `all_objects` so a seat taken back
    earlier is revived rather than duplicated against the unique constraint.
    """
    channel, _ = ProjectChannel.objects.get_or_create(project_id=project_id)
    membership = ChannelMembership.all_objects.filter(
        channel=channel, user_id=user_id,
    ).first()
    if membership is None:
        ChannelMembership.objects.create(channel=channel, user_id=user_id, role=role)
        return
    if membership.is_deleted:
        membership.role = role
        membership.is_deleted = False
        membership.save(update_fields=["role", "is_deleted", "updated_at"])


def _unseat(project_id, user_id, *, role: str, handover: str | None) -> None:
    """Take back the seat `role` owns, if the channel exists and the seat is
    that source's. `handover` names the other source's role: when that source
    still stands, the seat passes to it instead of closing."""
    channel = ProjectChannel.objects.filter(project_id=project_id).first()
    if channel is None:
        return
    membership = ChannelMembership.objects.filter(
        channel=channel, user_id=user_id, role=role,
    ).first()
    if membership is None:
        return
    if handover is not None:
        membership.role = handover
        membership.save(update_fields=["role", "updated_at"])
        return
    membership.is_deleted = True
    membership.save(update_fields=["is_deleted", "updated_at"])


def _has_confirmed_seat(project_id, user_id) -> bool:
    return Participation.objects.filter(
        project_id=project_id,
        artist__user_id=user_id,
        status=Participation.Status.CONFIRMED,
    ).exists()


def _leads_live(project_id, user_id) -> bool:
    return RehearsalDelegate.objects.filter(
        live_delegate_q(scope="any"),
        project_id=project_id,
        artist__user_id=user_id,
    ).exists()


def _reconcile_membership(participation: Participation) -> None:
    artist = getattr(participation, "artist", None)
    user_id = getattr(artist, "user_id", None)
    if user_id is None:
        return

    is_member = (
        not participation.is_deleted
        and participation.status == Participation.Status.CONFIRMED
    )
    if is_member:
        _seat(participation.project_id, user_id, role=ChannelRole.MEMBER)
    else:
        _unseat(
            participation.project_id, user_id, role=ChannelRole.MEMBER,
            handover=(
                ChannelRole.LEADER
                if _leads_live(participation.project_id, user_id) else None
            ),
        )


@receiver(post_save, sender=Participation)
def sync_channel_membership_on_save(sender, instance: Participation, **kwargs) -> None:
    """Covers create, status changes, and soft-delete (soft-delete goes through save())."""
    _reconcile_membership(instance)


@receiver(post_delete, sender=Participation)
def sync_channel_membership_on_delete(sender, instance: Participation, **kwargs) -> None:
    """Hard-delete of a participation drops the member (channel not created)."""
    user_id = getattr(getattr(instance, "artist", None), "user_id", None)
    if user_id is not None:
        _unseat(
            instance.project_id, user_id, role=ChannelRole.MEMBER,
            handover=(
                ChannelRole.LEADER
                if _leads_live(instance.project_id, user_id) else None
            ),
        )


@receiver(post_save, sender=RehearsalDelegate)
def sync_channel_membership_on_leadership(
    sender, instance: RehearsalDelegate, **kwargs,
) -> None:
    """A live grant seats the leader; a revoke (soft delete goes through
    save()), a past expiry or a grant with every switch off takes the seat
    back — unless a confirmed seat in the cast keeps them in as a MEMBER.

    Expiry by the clock alone raises no signal; `ProjectChannelViewSet` asks
    `led_projects_q` again before opening a LEADER row, so a row that outlives
    its grant opens nothing.
    """
    user_id = getattr(getattr(instance, "artist", None), "user_id", None)
    if user_id is None:
        return
    is_live = (
        not instance.is_deleted
        and RehearsalDelegate.objects.filter(
            live_delegate_q(scope="any"), pk=instance.pk,
        ).exists()
    )
    if is_live:
        _seat(instance.project_id, user_id, role=ChannelRole.LEADER)
    else:
        _unseat(
            instance.project_id, user_id, role=ChannelRole.LEADER,
            handover=(
                ChannelRole.MEMBER
                if _has_confirmed_seat(instance.project_id, user_id) else None
            ),
        )


# --------------------------------------------------------------------------- #
# GDPR — Right to Erasure                                                      #
# --------------------------------------------------------------------------- #

@receiver(account_soft_deleted)
def handle_gdpr_messaging_erasure(sender, user, **kwargs) -> None:
    """
    Erases conversation content tied to a deleted account across both surfaces:
    1:1 threads and project channels. Bodies are personal data with no legal-retention
    requirement, so they are blanked; the user's threads / channel memberships are dropped.
    """
    with transaction.atomic():
        blanked_threads = Message.objects.filter(sender=user).update(body=_ERASED_BODY)
        thread_count = Thread.objects.filter(artist__user=user).delete()
        blanked_channel = ChannelMessage.objects.filter(sender=user).update(body=_ERASED_BODY)
        ChannelMembership.objects.filter(user=user).delete()

    logger.info(
        "[Messaging] GDPR erasure UID:%s — %d thread + %d channel message(s) blanked; "
        "threads soft-deleted (%s); channel memberships dropped.",
        getattr(user, "id", "?"), blanked_threads, blanked_channel, thread_count,
    )
