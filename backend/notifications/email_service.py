"""
===============================================================================
Enterprise Email Dispatcher Service
===============================================================================
Domain: Notifications
Description:
    Handles dynamic compilation, internationalization (i18n), and dispatch
    of transactional emails. Incorporates Just-In-Time (JIT) state resolution
    to prevent stale data propagation in asynchronous message queues.

    Notification emails are composed through the channel-agnostic message layer
    (notifications/message_content.py), so the email subject, body and detail
    rows share a single source of truth with the push notification — and the
    call-to-action deep-links to the same destination as the in-app click.

Standards: SaaS 2026, Event-Driven Architecture (EDA) compatibility.
===============================================================================
"""

import logging
from typing import Any

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import translation

from core.constants import AppRole

from .message_content import MessageContentBuilder
from .models import NotificationLevel

logger = logging.getLogger(__name__)
User = get_user_model()

# Notification types whose email is rendered by a dedicated, hand-tuned template
# (free-form message body) rather than the structured transactional layout.
# These read metadata.* directly; only their subject is taken from the message layer.
_BESPOKE_TEMPLATES = frozenset({"message_received", "custom_admin_message"})


class EmailType:
    """
    Classification of email payloads to enforce strict delivery rules.
    Prevents operational opt-outs from blocking critical security alerts.
    """
    CRITICAL_SECURITY = 'CRITICAL_SECURITY'
    OPERATIONAL = 'OPERATIONAL'


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
        context: dict[str, Any],
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
        metadata: dict[str, Any],
        level: str = NotificationLevel.INFO,
        email_type: str = EmailType.OPERATIONAL
    ) -> None:
        """
        High-level dispatcher invoked by Celery background workers.
        Rehydrates user state Just-In-Time to ensure preferences are strictly honored.

        Args:
            recipient_id: UUID of the recipient user.
            notification_type: Key mapping to business logic events.
            template_name: Identifier for HTML/TXT templates.
            metadata: Contextual payload for dynamic template rendering.
            level: Notification urgency (mirrors the push channel).
            email_type: Classifies intent (Operational vs Security).
        """
        try:
            # 1. JIT State Resolution (Avoid N+1 with select_related)
            user = User.objects.select_related('profile').get(id=recipient_id)

            # 2. Enforce Business Rules (Strict Opt-outs)
            if email_type == EmailType.OPERATIONAL and not getattr(user.profile, 'email_notifications_enabled', True):
                logger.info(f"[EmailService] Suppressed operational email for UID:{recipient_id}. User opted out.")
                return

            # 3. Resolve Execution Context (Language, Role & Payload)
            profile = getattr(user, 'profile', None)
            resolved_language = getattr(profile, 'language', 'en') or 'en'
            is_manager = getattr(profile, 'role', None) == AppRole.MANAGER or bool(getattr(user, 'is_staff', False))

            # 4. Contextual Override for Thread-Safe Localization
            with translation.override(resolved_language):
                # Compose canonical content once — shared with the push channel.
                content = MessageContentBuilder.build(
                    notification_type=notification_type,
                    level=level,
                    metadata=metadata,
                    is_manager=is_manager,
                )
                subject = content.subject or content.title

                artist_profile = getattr(user, 'artist_profile', None)
                raw_vocative = getattr(artist_profile, 'first_name_vocative', '') if artist_profile else ''
                first_name_vocative = (
                    (raw_vocative or user.first_name) if resolved_language == 'pl' else user.first_name
                )

                context: dict[str, Any] = {
                    "first_name": user.first_name,
                    "first_name_vocative": first_name_vocative,
                    "notification_type": notification_type,
                    "metadata": metadata,
                    "lang": resolved_language,
                    "site_url": getattr(settings, 'SITE_URL', 'https://voctensemble.com/panel'),
                }

                # Structured transactional layout gets the projected email content;
                # bespoke templates read metadata directly and only borrow the subject.
                if template_name not in _BESPOKE_TEMPLATES:
                    context.update(
                        content.to_email_context(base_url=getattr(settings, 'FRONTEND_URL', 'https://voctensemble.com'))
                    )

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
        context: dict[str, Any],
        email_type: str
    ) -> None:
        """
        Low-level transport orchestrator.
        Compiles templates and delegates execution to the configured ESP (Anymail).
        """
        try:
            full_context = {
                'logo_url': getattr(settings, 'EMAIL_LOGO_URL', ''),
                **context,
            }
            html_content = render_to_string(f"emails/{template_name}.html", full_context)
            text_content = render_to_string(f"emails/{template_name}.txt", full_context)

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
