# notifications/email_service.py
import logging
from typing import Dict, Any, Optional
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
from django.utils import translation
from django.contrib.auth import get_user_model
from django.utils.translation import gettext as _

logger = logging.getLogger(__name__)
User = get_user_model()


class EmailType:
    """
    Enum-like classification of emails to enforce delivery rules.
    """
    CRITICAL_SECURITY = 'CRITICAL_SECURITY'  
    OPERATIONAL = 'OPERATIONAL'              


class EmailDispatcherService:
    """
    Enterprise service for compiling and dispatching emails.
    Handles dynamic user preferences resolution, i18n context, and template rendering.
    """

    @classmethod
    def dispatch(
        cls, 
        recipient_email: str, 
        subject: str, 
        template_name: str, 
        context: Dict[str, Any],
        fallback_language: str = 'en',
        email_type: str = EmailType.CRITICAL_SECURITY
    ) -> None:
        """
        Compiles templates and dispatches email. 
        Resolves the user's current language synchronously from the DB to avoid race conditions.
        Respects user opt-out preferences for non-critical emails.
        """
        resolved_language = fallback_language
        
        # 1. Resolve User State (Language and Preferences)
        try:
            user = User.objects.select_related('profile').get(email=recipient_email)
            if hasattr(user, 'profile'):
                resolved_language = user.profile.language
                
                # Enforce operational email preferences
                if email_type == EmailType.OPERATIONAL and not user.profile.email_notifications_enabled:
                    logger.info(f"Skipped dispatching [{template_name}] to {recipient_email}: User opted out.")
                    return
        except User.DoesNotExist:
            if email_type == EmailType.OPERATIONAL:
                logger.warning(f"Attempted to send operational email to non-existent user: {recipient_email}")
                return
            # For non-users (e.g., invites), we proceed with the fallback_language

        # 2. Render and Dispatch securely within the i18n context
        with translation.override(resolved_language):
            context['lang'] = resolved_language
            translated_subject = _(subject)
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
                logger.info(
                    f"Successfully dispatched {email_type} email [{template_name}] "
                    f"to {recipient_email} (lang: {resolved_language})"
                )
            except Exception as e:
                logger.error(f"Failed to dispatch email [{template_name}] to {recipient_email}: {str(e)}", exc_info=True)
                raise