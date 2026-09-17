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
from django.core.exceptions import ImproperlyConfigured
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import translation

from core.greetings import resolve_vocative
from core.permissions import user_is_manager

from .message_content import MessageContentBuilder
from .models import NotificationLevel

logger = logging.getLogger(__name__)
User = get_user_model()

#: What each sending backend cannot work without, keyed by the backend actually selected
#: rather than by `EMAIL_PROVIDER`: the console and locmem backends need nothing, and
#: keying on the outcome means a test that swaps the backend is not asked for keys it
#: will never use.
_ESP_REQUIRED_CREDENTIALS: dict[str, tuple[str, ...]] = {
    "notifications.emaillabs_backend.EmailBackend": (
        "EMAILLABS_APP_KEY", "EMAILLABS_SECRET_KEY", "EMAILLABS_SMTP_ACCOUNT",
    ),
    "anymail.backends.resend.EmailBackend": ("RESEND_API_KEY",),
}


def assert_esp_is_configured() -> None:
    """
    Refuse to boot with a provider selected but not credentialled.

    THE FAILURE THIS EXISTS TO PREVENT IS A 401, NOT A CRASH. Every ESP setting defaults
    to an empty string so that a deployment using another provider still boots — and
    Anymail hands an empty credential to the API exactly as readily as a real one. A
    variable that never reached the container therefore arrives at EmailLabs as an empty
    App Key and comes back as "App Key is invalid": a message that sends whoever reads it
    to inspect the key they pasted, which is the one place the fault is not. The name of
    the missing variable is the whole answer, and it is knowable at startup.

    Whitespace counts as absent. A credential pasted out of a web panel with a trailing
    newline is not a credential, and it fails the same 401 way.
    """
    required = _ESP_REQUIRED_CREDENTIALS.get(settings.EMAIL_BACKEND)
    if not required:
        return

    anymail: dict[str, Any] = getattr(settings, "ANYMAIL", {}) or {}
    missing = [name for name in required if not str(anymail.get(name) or "").strip()]
    if missing:
        raise ImproperlyConfigured(
            f"EMAIL_BACKEND is {settings.EMAIL_BACKEND}, but these are empty: "
            f"{', '.join(missing)}. Set them in the environment (and recreate the "
            f"container — a restart keeps the old one), or clear EMAIL_PROVIDER to "
            f"fall back to the console backend."
        )

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
        email_type: str = EmailType.CRITICAL_SECURITY,
        from_email: str | None = None,
        reply_to: list[str] | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        """
        Synchronous dispatch interface for direct email operations.
        Enforces contextual internationalization.

        `from_email` overrides the panel's own sender for mail addressed to somebody
        outside the ensemble — see `settings.PUBLIC_FROM_EMAIL`. Everything else keeps
        `DEFAULT_FROM_EMAIL`, so no existing caller changes.

        `reply_to` and `headers` exist for the same recipient. A member replying to a
        notification is replying to the panel that produced it; a stranger replying to a
        public mail is replying to the foundation, and the address they are answering is
        printed in that mail's own footer. `headers` carries what a bulk-mail recipient's
        client reads rather than displays — `List-Unsubscribe` above all.
        """
        # Ensure the template's <html lang> matches the render language even for
        # account emails (notification emails already inject `lang`).
        context = {"lang": fallback_language, **context}
        with translation.override(fallback_language):
            cls._dispatch_core(
                recipient_email=recipient_email,
                subject=subject,
                template_name=template_name,
                context=context,
                email_type=email_type,
                from_email=from_email,
                reply_to=reply_to,
                headers=headers,
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

            # 2. Enforce Business Rules (Strict Opt-outs + ESP suppression)
            if getattr(user.profile, 'email_undeliverable', False):
                logger.info(f"[EmailService] Suppressed email for UID:{recipient_id}. Address marked undeliverable.")
                return
            if email_type == EmailType.OPERATIONAL and not getattr(user.profile, 'email_notifications_enabled', True):
                logger.info(f"[EmailService] Suppressed operational email for UID:{recipient_id}. User opted out.")
                return
            # An invited-but-not-yet-activated account must first meet the
            # activation email, not business notifications pointing at a panel it
            # cannot enter. The in-app row is already persisted; the first login
            # presents it instead (see welcome-invitation spec, Part A).
            if not user.is_active:
                logger.info(
                    f"[EmailService] Suppressed notification email for UID:{recipient_id}. "
                    f"Account not activated (type={notification_type})."
                )
                return

            # 3. Resolve Execution Context (Language, Role & Payload)
            profile = getattr(user, 'profile', None)
            resolved_language = getattr(profile, 'language', 'en') or 'en'
            is_manager = user_is_manager(user)

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

                first_name_vocative = resolve_vocative(user, resolved_language)

                frontend_url = getattr(settings, 'FRONTEND_URL', 'https://voctensemble.com')
                context: dict[str, Any] = {
                    "first_name": user.first_name,
                    "first_name_vocative": first_name_vocative,
                    "salutation": getattr(profile, "salutation", "N"),
                    "notification_type": notification_type,
                    "metadata": metadata,
                    "lang": resolved_language,
                    "site_url": getattr(settings, 'SITE_URL', 'https://voctensemble.com/panel'),
                    # Operational emails expose a one-click route to channel preferences.
                    "manage_prefs_url": f"{frontend_url}/panel/settings?tab=notifications",
                }

                # Structured transactional layout gets the projected email content;
                # bespoke templates read metadata directly and only borrow the subject.
                if template_name not in _BESPOKE_TEMPLATES:
                    context.update(
                        content.to_email_context(base_url=frontend_url)
                    )

                # Calendar attachment is built inside the language override so the
                # event title/description land in the recipient's language.
                attachments = cls._build_ics_attachment(metadata)

                # 5. Delegate execution to core transport layer
                cls._dispatch_core(
                    recipient_email=user.email,
                    subject=subject,
                    template_name=template_name,
                    context=context,
                    email_type=email_type,
                    attachments=attachments,
                )

        except User.DoesNotExist:
            logger.warning(f"[EmailService] Aborted dispatch. User UID:{recipient_id} not found.")
        except Exception as e:
            logger.error(f"[EmailService] Unexpected failure during dispatch prep for UID:{recipient_id}: {e}", exc_info=True)
            raise

    @staticmethod
    def _build_ics_attachment(metadata: dict[str, Any]) -> list[tuple[str, str, str]] | None:
        """
        Builds a localized 'add to calendar' .ics attachment from the `ics` payload
        in the notification metadata (rehearsal/concert events). Must run inside the
        recipient's translation.override so the event title/description are localized.

        The payload is one event for a single-event notification, or several for a
        briefing announcing more than one date — in which case they travel as ONE
        multi-event calendar. Several separate attachments would read as several
        pieces of news, which is exactly what the briefing exists to prevent.
        """
        payload = (metadata or {}).get("ics")
        candidates = payload if isinstance(payload, list) else [payload]
        entries: list[dict[str, Any]] = [
            entry for entry in candidates
            if isinstance(entry, dict) and entry.get("start") and entry.get("end")
        ]
        if not entries:
            return None

        from django.utils.translation import gettext as _gettext

        from core.ical_service import ICalGeneratorService
        from roster.domain.event_kind import event_moment_label

        events = []
        for entry in entries:
            project_name = entry.get("project_name") or ""
            # A project entry is named by what the ensemble is singing at, from
            # the code the emitter carried; a rehearsal is a rehearsal whatever
            # it prepares. The bracket lands in the recipient's own calendar and
            # outlives the email, so "[Koncert] Ślub Anny i Piotra" is a mistake
            # they keep re-reading for months.
            label = (
                event_moment_label(str(entry.get("event_kind") or ""))
                if entry.get("kind") == "project"
                else _gettext("Rehearsal")
            )
            description_parts = []
            if entry.get("focus"):
                description_parts.append(f"{_gettext('Focus')}: {entry['focus']}")
            if project_name:
                description_parts.append(f"{_gettext('Project')}: {project_name}")

            events.append({
                "uid": entry.get("uid") or "voct-event@voctensemble.com",
                "summary": f"[{label}] {project_name}".strip(),
                "start_iso": str(entry["start"]),
                "end_iso": str(entry["end"]),
                "location": entry.get("location") or "",
                "description": "\n".join(description_parts),
            })

        try:
            content = ICalGeneratorService.build_events(events)
        except Exception:
            logger.warning("[EmailService] Failed to build .ics attachment.", exc_info=True)
            return None

        filename = "invite.ics" if len(events) == 1 else "schedule.ics"
        return [(filename, content, "text/calendar; charset=utf-8; method=PUBLISH")]

    @classmethod
    def _dispatch_core(
        cls,
        recipient_email: str,
        subject: str,
        template_name: str,
        context: dict[str, Any],
        email_type: str,
        attachments: list[tuple[str, str, str]] | None = None,
        from_email: str | None = None,
        reply_to: list[str] | None = None,
        headers: dict[str, str] | None = None,
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
                from_email=from_email or settings.DEFAULT_FROM_EMAIL,
                to=[recipient_email],
                reply_to=reply_to,
                headers=headers,
            )
            msg.attach_alternative(html_content, "text/html")

            for filename, payload, mimetype in (attachments or []):
                msg.attach(filename, payload, mimetype)

            # Metadata attachments for downstream ESP analytics (e.g., Resend, Postmark).
            # Anymail reads `tags` off any message it is handed; Django's own backends
            # ignore the attribute. It is therefore set unconditionally — a `hasattr`
            # guard here can only ever be false, since the attribute is precisely what
            # this line creates, and the tags would never reach the ESP.
            msg.tags = [email_type, template_name]  # type: ignore[attr-defined]

            msg.send()
            logger.info(f"[EmailService] Successfully dispatched {email_type} [{template_name}] to {recipient_email}")

        except Exception as e:
            logger.error(f"[EmailService] Transport layer failed for [{template_name}] to {recipient_email}: {e}", exc_info=True)
            raise
