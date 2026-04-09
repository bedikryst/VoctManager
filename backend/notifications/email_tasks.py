# notifications/email_tasks.py
from celery import shared_task
from typing import Dict, Any
from .email_service import EmailDispatcherService

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
    context: Dict[str, Any]
):
    """
    Background worker task to dispatch transactional emails.
    """
    try:
        EmailDispatcherService.dispatch(
            recipient_email=recipient_email,
            subject=subject,
            template_name=template_name,
            context=context
        )
    except Exception as exc:
        raise self.retry(exc=exc)