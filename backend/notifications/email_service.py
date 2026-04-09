# notifications/email_service.py
import logging
from typing import Dict, Any
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
from core.models import UserProfile

logger = logging.getLogger(__name__)

class EmailDispatcherService:
    """
    Enterprise service for compiling and dispatching operational emails.
    Delegates template rendering and ensures proper MIME composition.
    """

    @classmethod
    def dispatch(cls, recipient_email: str, subject: str, template_name: str, context: Dict[str, Any]) -> None:
        """
        Compiles the HTML/Text templates and dispatches the email payload.
        """
        html_content = render_to_string(f"../templates/emails/{template_name}.html", context)
        text_content = render_to_string(f"../templates/emails/{template_name}.txt", context)

        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[recipient_email],
        )
        msg.attach_alternative(html_content, "text/html")
        
        try:
            msg.send()
            logger.info(f"Successfully dispatched email [{template_name}] to {recipient_email}")
        except Exception as e:
            logger.error(f"Failed to dispatch email [{template_name}] to {recipient_email}: {str(e)}", exc_info=True)
            raise