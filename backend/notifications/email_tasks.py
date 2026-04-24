# notifications/email_tasks.py
import logging
from typing import Any, Dict
from celery import shared_task

logger = logging.getLogger(__name__)

@shared_task(
    name="emails.send_transactional_email",
    bind=True,
    autoretry_for=(Exception,),
    retry_kwargs={'max_retries': 4},
    retry_backoff=True,
    retry_jitter=True
)
def send_transactional_email_task(
    self,
    recipient_email: str,
    subject: str,
    template_name: str,
    context: Dict[str, Any],
    fallback_language: str = 'en',
    email_type: str = 'CRITICAL_SECURITY'
):
    """
    Direct email dispatch — caller supplies already-resolved email, subject and context.
    Used for account lifecycle emails (activation, welcome, password change, deletion).
    """
    from .email_service import EmailDispatcherService

    EmailDispatcherService.dispatch(
        recipient_email=recipient_email,
        subject=subject,
        template_name=template_name,
        context=context,
        fallback_language=fallback_language,
        email_type=email_type
    )


@shared_task(
    name="emails.send_notification_email",
    bind=True,
    autoretry_for=(Exception,),
    retry_kwargs={'max_retries': 3},
    retry_backoff=True,
    retry_jitter=True
)
def send_notification_email_task(
    self,
    recipient_id: str,
    notification_type: str,
    template_name: str,
    metadata: Dict[str, Any],
    email_type: str = 'OPERATIONAL'
):
    """
    Notification-based email dispatch — resolves user language and preferences JIT.
    Used by NotificationRouter for all business notification emails.
    """
    from .email_service import EmailDispatcherService

    EmailDispatcherService.dispatch_from_notification(
        recipient_id=recipient_id,
        notification_type=notification_type,
        template_name=template_name,
        metadata=metadata,
        email_type=email_type
    )