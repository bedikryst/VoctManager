"""
@file signals.py
@description Domain event listeners for the messaging app:
    • Project-channel membership is kept in sync with roster Participation — a member
      joins when their participation is CONFIRMED and is dropped when they leave/decline
      (or the participation is soft/hard-deleted). The channel is created lazily on the
      first confirmed member; removals never create one.
    • GDPR (Right to Erasure) on `account_soft_deleted`: blanks message content authored
      by the user (1:1 threads AND channels) and drops their conversations/memberships.
@architecture Enterprise SaaS 2026
@module messaging/signals
"""
import logging

from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from django.utils import timezone

from core.signals import account_soft_deleted
from roster.models import Participation

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
# Project-channel membership sync (driven by Participation)                    #
# --------------------------------------------------------------------------- #

def _drop_membership(project_id, user_id) -> None:
    """Soft-delete a member's row if (and only if) the channel already exists."""
    channel = ProjectChannel.objects.filter(project_id=project_id).first()
    if channel is None:
        return
    ChannelMembership.all_objects.filter(channel=channel, user_id=user_id).update(
        is_deleted=True, updated_at=timezone.now()
    )


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
        channel, _ = ProjectChannel.objects.get_or_create(project_id=participation.project_id)
        # all_objects so a previously-removed member reactivates their existing row.
        ChannelMembership.all_objects.update_or_create(
            channel=channel,
            user_id=user_id,
            defaults={"role": ChannelRole.MEMBER, "is_deleted": False},
        )
    else:
        _drop_membership(participation.project_id, user_id)


@receiver(post_save, sender=Participation)
def sync_channel_membership_on_save(sender, instance: Participation, **kwargs) -> None:
    """Covers create, status changes, and soft-delete (soft-delete goes through save())."""
    _reconcile_membership(instance)


@receiver(post_delete, sender=Participation)
def sync_channel_membership_on_delete(sender, instance: Participation, **kwargs) -> None:
    """Hard-delete of a participation drops the member (channel not created)."""
    user_id = getattr(getattr(instance, "artist", None), "user_id", None)
    if user_id is not None:
        _drop_membership(instance.project_id, user_id)


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
