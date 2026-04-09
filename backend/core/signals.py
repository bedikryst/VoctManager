# core/signals.py
# ==========================================
# Core Domain Signals (Event Bus)
# Standard: Enterprise SaaS 2026
# ==========================================
import logging
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models.signals import post_save, pre_delete, pre_save
from django.dispatch import receiver

from notifications.email_tasks import send_transactional_email_task
from .models import UserProfile

logger = logging.getLogger(__name__)
User = get_user_model()

@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def handle_user_creation_and_profile(sender, instance, created, **kwargs):
    """
    Ensures every auth user automatically gets a linked UserProfile.
    Queues a welcome email ONLY for active accounts (bypasses invite-only flow).
    """
    if created:
        profile = UserProfile.objects.create(user=instance)

        if instance.is_active and instance.email:
            transaction.on_commit(
                lambda: send_transactional_email_task.delay(
                    recipient_email=instance.email,
                    subject="Welcome to VoctManager",
                    template_name="welcome_email",
                    context={
                        "first_name": getattr(instance, "first_name", ""),
                        "frontend_url": f"{settings.CORS_ALLOWED_ORIGINS[0]}/login",
                    },
                    language_code=profile.language
                )
            )
            logger.info(f"Registered welcome email task for new active user: {instance.email}")

@receiver(pre_save, sender=settings.AUTH_USER_MODEL)
def detect_security_changes(sender, instance, **kwargs):
    """
    Detects security-critical field changes (e.g., password).
    Crucially uses transaction.on_commit to prevent false-positive alerts on failed DB saves.
    """
    if not instance.pk:
        return

    try:
        # Optimization: Fetch only the password hash from DB
        old_user = User.objects.only('password').get(pk=instance.pk)
    except User.DoesNotExist:
        return

    if old_user.password != instance.password:
        language = 'en'
        if hasattr(instance, 'profile'):
            language = instance.profile.language

        transaction.on_commit(
            lambda: send_transactional_email_task.delay(
                recipient_email=instance.email,
                subject="Security Alert: Password Changed",
                template_name="password_changed",
                context={"user_email": instance.email},
                language_code=language
            )
        )
        logger.info(f"Registered password change security email task for: {instance.email}")

@receiver(pre_delete, sender=settings.AUTH_USER_MODEL)
def handle_account_deletion(sender, instance, **kwargs):
    """
    Dispatches GDPR-compliant account deletion confirmation.
    """
    send_transactional_email_task.delay(
        recipient_email=instance.email,
        subject="Your VoctManager Account has been deleted",
        template_name="account_deleted",
        context={"user_email": instance.email},
        # Defaulting to EN as profile might be deleted concurrently
        language_code='en' 
    )
    logger.info(f"Queued account deletion confirmation email for: {instance.email}")