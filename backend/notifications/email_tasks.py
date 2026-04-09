# notifications/email_tasks.py
import logging
from typing import Any, Dict
from celery import shared_task
from .email_service import EmailDispatcherService

logger = logging.getLogger(__name__)

@shared_task(
    name="emails.send_transactional_email",
    bind=True,
    max_retries=3,
    default_retry_delay=10
)
def send_transactional_email_task(
    self, 
    recipient_email: str, 
    subject: str, 
    template_name: str, 
    context: Dict[str, Any],
    language_code: str = 'en'
):
    """
    Background worker task to dispatch transactional emails.
    Supports explicit language context for i18n and automatic retries.
    """
    try:
        EmailDispatcherService.dispatch(
            recipient_email=recipient_email,
            subject=subject,
            template_name=template_name,
            context=context,
            language_code=language_code
        )
    except Exception as exc:
        logger.warning(f"Email task failed for {recipient_email}, retrying...")
        raise self.retry(exc=exc)