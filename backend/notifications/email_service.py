# notifications/email_service.py
import logging
from typing import Dict, Any, Optional
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
from django.utils import translation

logger = logging.getLogger(__name__)

class EmailDispatcherService:
    """
    Enterprise service for compiling and dispatching operational emails.
    Delegates template rendering, handles i18n context, and ensures proper MIME composition.
    """

    @classmethod
    def dispatch(
        cls, 
        recipient_email: str, 
        subject: str, 
        template_name: str, 
        context: Dict[str, Any],
        language_code: Optional[str] = 'en'
    ) -> None:
        """
        Compiles the HTML/Text templates in the user's preferred language 
        and dispatches the email payload.
        """
        # Context manager ensures language is only overridden for this specific rendering task
        with translation.override(language_code):
            # Pass the language code to the context for conditional HTML rendering (e.g., dir="ltr")
            context['lang'] = language_code
            
            html_content = render_to_string(f"emails/{template_name}.html", context)
            text_content = render_to_string(f"emails/{template_name}.txt", context)

            msg = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[recipient_email],
            )
            msg.attach_alternative(html_content, "text/html")
            
            try:
                msg.send()
                logger.info(f"Successfully dispatched email [{template_name}] to {recipient_email} in language [{language_code}]")
            except Exception as e:
                logger.error(f"Failed to dispatch email [{template_name}] to {recipient_email}: {str(e)}", exc_info=True)
                raise