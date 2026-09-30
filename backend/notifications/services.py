# notifications/services.py
"""
===============================================================================
Enterprise Notification Service
===============================================================================
Domain: Notifications
Description: 
    Core domain service responsible for provisioning in-app notifications.
    Adheres strictly to the Event-Driven Architecture (EDA) paradigm by 
    decoupling primary domain logic from downstream asynchronous side-effects 
    (like email dispatch) via transactional outbox or on_commit hooks.

Standards: SaaS 2026, ACID Compliant, Zero-State Leakage, Celery Safe-Serialization.
===============================================================================
"""

import logging
from datetime import datetime

from django.db import transaction
from django.utils import timezone

from .delivery import default_channel_preferences
from .dtos import NotificationCreateDTO, NotificationPreferenceUpdateDTO
from .models import Notification, NotificationPreference

logger = logging.getLogger(__name__)


class NotificationService:
    """
    Orchestrates the lifecycle of in-app notifications and triggers downstream events.
    """

    @classmethod
    def create_notification(cls, dto: NotificationCreateDTO) -> Notification | None:
        """
        Provisions a new notification entity synchronously and registers 
        asynchronous side-effects (e.g., operational emails) upon transaction commit.
        """
        try:
            with transaction.atomic():
                metadata_payload = dto.metadata if isinstance(dto.metadata, dict) else dto.metadata.model_dump(mode="json")
                
                # Provision the In-App Notification
                notification = Notification.objects.create(
                    recipient_id=dto.recipient_id,
                    notification_type=dto.notification_type,
                    level=dto.level,
                    metadata=metadata_payload
                )
            
                def dispatch_task():
                    from .tasks import route_notification_task
                    route_notification_task.delay(
                        recipient_id=str(dto.recipient_id),
                        notification_type=dto.notification_type,
                        metadata=notification.metadata,
                        level=dto.level,
                        notification_id=str(notification.id),
                    )

                transaction.on_commit(dispatch_task)
            
            logger.info(f"[NotificationService] Provisioned [{dto.notification_type}] for UID:{dto.recipient_id}")
            return notification
            
        except Exception as e:
            # Catch-all for database integrity errors or serialization failures
            logger.error(f"[NotificationService] Provisioning failed for UID:{dto.recipient_id}. Reason: {e}", exc_info=True)
            return None

    @staticmethod
    def mark_resolved(
        notification_type: str,
        *,
        recipient_id: int | None = None,
        created_before: datetime | None = None,
        **metadata: str,
    ) -> int:
        """Mark read the unread rows of one type that are no longer news.

        For the rows a later event answers: a nudge about a queue that has since
        been sent, a message in a thread its reader has since opened. Left
        unread, the bell keeps asserting something the reader already dealt
        with. `metadata` narrows by payload keys (`project_id=…`, `thread_id=…`);
        without `recipient_id` it reaches every reader. Returns how many rows it
        marked.
        """
        rows = Notification.objects.filter(
            notification_type=notification_type,
            is_read=False,
            **{f"metadata__{key}": value for key, value in metadata.items()},
        )
        if recipient_id is not None:
            rows = rows.filter(recipient_id=recipient_id)
        if created_before is not None:
            rows = rows.filter(created_at__lte=created_before)
        now = timezone.now()
        return rows.update(is_read=True, read_at=now, updated_at=now)

class NotificationRecipientPolicy:
    """
    Resolves who a project notification is addressed to.
    Accepts either a Django QuerySet or a plain list of Participation objects.

    Two audiences, and the difference matters: `from_participations` narrows to
    CON (a report about people who committed), while `in_conversation` is the one
    to use for anything the cast is *told* about a live project.
    """

    @staticmethod
    def from_participations(participations, *, confirmed_only: bool = True) -> list[str]:
        from django.db.models import QuerySet
        if confirmed_only:
            if isinstance(participations, QuerySet):
                participations = participations.filter(status='CON').select_related('artist')
            else:
                participations = [p for p in participations if getattr(p, 'status', None) == 'CON']
        return [
            str(p.artist.user_id)
            for p in participations
            if p.artist_id and p.artist.user_id
        ]

    @staticmethod
    def in_conversation(participations) -> list[str]:
        """Everyone a live project's news still concerns: confirmed *and* still
        deciding, never declined.

        The single rule for the audience of a project announcement, so the queue
        and the alarms that bypass it (a cancellation) cannot drift apart. They
        did: cancellations addressed CON only while the queue reached CON+INV, and
        since publication leaves the whole cast INVITED by mechanism, a concert
        called off the day after it went live reached nobody at all.

        Someone still weighing the invitation needs the news most — what they are
        deciding on has changed. A decline ends the conversation.
        """
        from django.db.models import QuerySet

        if isinstance(participations, QuerySet):
            participations = participations.exclude(status='DEC').select_related('artist')
        else:
            participations = [
                p for p in participations if getattr(p, 'status', None) != 'DEC'
            ]
        return NotificationRecipientPolicy.from_participations(
            participations, confirmed_only=False
        )


class NotificationPreferenceService:
    """
    Service layer for managing user delivery channel preferences.
    """

    @classmethod
    def update_preferences(cls, dto: NotificationPreferenceUpdateDTO) -> NotificationPreference:
        """
        Updates or creates granular notification channel preferences for a user.

        Only the channels named in the payload are written, so a single-channel
        toggle never clobbers the user's existing choice on the other channel. When
        the row does not exist yet, the untouched channel is seeded from the shared
        default contract (``default_channel_preferences``) rather than the model's
        blanket ``True`` — otherwise enabling one channel could silently diverge from
        the defaults the settings UI displayed (e.g. flipping push on for a casting
        notification the user never touched).
        """
        provided = {
            k: v for k, v in [
                ('email_enabled', dto.email_enabled),
                ('push_enabled', dto.push_enabled),
            ] if v is not None
        }
        preference, _created = NotificationPreference.objects.update_or_create(
            user_id=dto.user_id,
            notification_type=dto.notification_type,
            defaults=provided,
            create_defaults={
                **default_channel_preferences(dto.notification_type),
                **provided,
            },
        )

        logger.info(
            f"[NotificationPreferenceService] Updated preferences for UID:{dto.user_id}, "
            f"Type:{dto.notification_type}"
        )
        return preference

    @classmethod
    def bulk_update_preferences(
        cls, user_id: int, items: list[dict],
    ) -> list[NotificationPreference]:
        """
        Applies several preference updates atomically (all-or-nothing), reusing the
        per-row SSOT-seeding contract. Backs Restore-recommended, so resetting a
        whole section is one request and one consistent transaction.
        """
        with transaction.atomic():
            return [
                cls.update_preferences(
                    NotificationPreferenceUpdateDTO(user_id=user_id, **item)
                )
                for item in items
            ]