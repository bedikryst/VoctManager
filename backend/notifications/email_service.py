"""
===============================================================================
Enterprise Email Dispatcher Service
===============================================================================
Domain: Notifications
Description: 
    Handles dynamic compilation, internationalization (i18n), and dispatch 
    of transactional emails. Incorporates Just-In-Time (JIT) state resolution 
    to prevent stale data propagation in asynchronous message queues.

Standards: SaaS 2026, Event-Driven Architecture (EDA) compatibility.
===============================================================================
"""

import logging
from typing import Dict, Any
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
from django.utils import translation
from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _

logger = logging.getLogger(__name__)
User = get_user_model()


class EmailType:
    """
    Classification of email payloads to enforce strict delivery rules.
    Prevents operational opt-outs from blocking critical security alerts.
    """
    CRITICAL_SECURITY = 'CRITICAL_SECURITY'  
    OPERATIONAL = 'OPERATIONAL'              


class NotificationTemplateRegistry:
    """
    Static registry for notification translation references.
    Decoupled from ORM models to prevent circular imports and allow the 
    Django 'makemessages' utility to correctly index strings for localization.
    """
    SUBJECTS = {
        'PROJECT_INVITATION': _('You have a new project invitation'),
        'REHEARSAL_SCHEDULED': _('New Rehearsal Scheduled'),
        'REHEARSAL_UPDATED': _('Rehearsal Schedule Changed'),
        'MATERIAL_UPLOADED': _('New Sheet Music Available'),
        'PIECE_CASTING_ASSIGNED': _('You have been cast in a piece'),
    }

    @classmethod
    def resolve_subject(cls, notification_type: str) -> str:
        """
        Retrieves the localized subject string.
        Must be evaluated inside a translation.override context.
        """
        # Casting gettext_lazy to string forces evaluation in the active language context
        return str(cls.SUBJECTS.get(notification_type, _('New update from VoctManager')))


class EmailDispatcherService:
    """
    Enterprise service orchestrating localized email delivery.
    Guarantees absolute state integrity by hydrating data at execution time.
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
        Synchronous dispatch interface for direct email operations.
        Enforces contextual internationalization.
        """
        with translation.override(fallback_language):
            cls._dispatch_core(
                recipient_email=recipient_email,
                subject=subject,
                template_name=template_name,
                context=context,
                email_type=email_type
            )

    @classmethod
    def dispatch_from_notification(
        cls, 
        recipient_id: str,
        notification_type: str, 
        template_name: str, 
        metadata: Dict[str, Any],
        email_type: str = EmailType.OPERATIONAL
    ) -> None:
        """
        High-level dispatcher invoked by Celery background workers.
        Rehydrates user state Just-In-Time to ensure preferences are strictly honored.
        
        Args:
            recipient_id (str): UUID of the recipient user.
            notification_type (str): Key mapping to business logic events.
            template_name (str): Identifier for HTML/TXT templates.
            metadata (Dict): Contextual payload for dynamic template rendering.
            email_type (str): Classifies intent (Operational vs Security).
        """
        try:
            # 1. JIT State Resolution (Avoid N+1 with select_related)
            user = User.objects.select_related('profile').get(id=recipient_id)
            
            # 2. Enforce Business Rules (Strict Opt-outs)
            if email_type == EmailType.OPERATIONAL and not getattr(user.profile, 'email_notifications_enabled', True):
                logger.info(f"[EmailService] Suppressed operational email for UID:{recipient_id}. User opted out.")
                return

            # 3. Resolve Execution Context (Language & Payload)
            resolved_language = getattr(user.profile, 'language', 'en')

            # 4. Contextual Override for Thread-Safe Localization
            with translation.override(resolved_language):
                subject = NotificationTemplateRegistry.resolve_subject(notification_type)
                
                context = {
                    "first_name": user.first_name,
                    "notification_type": notification_type,
                    "metadata": metadata,
                    "lang": resolved_language
                }
                
                # 5. Delegate execution to core transport layer
                cls._dispatch_core(
                    recipient_email=user.email,
                    subject=subject,
                    template_name=template_name,
                    context=context,
                    email_type=email_type
                )
                
        except User.DoesNotExist:
            logger.warning(f"[EmailService] Aborted dispatch. User UID:{recipient_id} not found.")
        except Exception as e:
            logger.error(f"[EmailService] Unexpected failure during dispatch prep for UID:{recipient_id}: {e}", exc_info=True)
            raise

    @classmethod
    def _dispatch_core(
        cls, 
        recipient_email: str, 
        subject: str, 
        template_name: str, 
        context: Dict[str, Any],
        email_type: str
    ) -> None:
        """
        Low-level transport orchestrator. 
        Compiles templates and delegates execution to the configured ESP (Anymail).
        """
        try:
            html_content = render_to_string(f"emails/{template_name}.html", context)
            text_content = render_to_string(f"emails/{template_name}.txt", context)

            msg = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[recipient_email],
            )
            msg.attach_alternative(html_content, "text/html")
            
            # Metadata attachments for downstream ESP analytics (e.g., Resend, Postmark)
            if hasattr(msg, 'tags'):
                msg.tags = [email_type, template_name]
            
            msg.send()
            logger.info(f"[EmailService] Successfully dispatched {email_type} [{template_name}] to {recipient_email}")
            
        except Exception as e:
            logger.error(f"[EmailService] Transport layer failed for [{template_name}] to {recipient_email}: {e}", exc_info=True)
            raise