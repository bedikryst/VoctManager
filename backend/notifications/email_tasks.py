# notifications/email_tasks.py
import logging
from typing import Any, Dict
from celery import shared_task
from .email_service import EmailDispatcherService

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
    language_code: str = 'en',
    email_type: str = 'CRITICAL_SECURITY'  # Import EmailType from service and use its string value
):
    from .email_service import EmailDispatcherService
    
    EmailDispatcherService.dispatch(
        recipient_email=recipient_email,
        subject=subject,
        template_name=template_name,
        context=context,
        language_code=language_code,
        email_type=email_type
    )