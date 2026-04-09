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
            logger.info(f"Queued welcome email for new active user: {instance.email}")
        


@receiver(pre_save, sender=settings.AUTH_USER_MODEL)
def detect_security_changes(sender, instance, **kwargs):
    if not instance.pk:
        return

    try:
        user_with_profile = User.objects.select_related("profile").get(pk=instance.pk)
    except User.DoesNotExist:
        return

    if user_with_profile.is_active and user_with_profile.password != instance.password:
        send_transactional_email_task.delay(
            recipient_email=instance.email,
            subject="Security Alert: Password Changed",
            template_name="password_changed",
            context={"user_email": instance.email},
            language_code=getattr(user_with_profile.profile, 'language', 'en')
        )
        logger.info(f"Queued password change security email for: {instance.email}")


@receiver(pre_delete, sender=settings.AUTH_USER_MODEL)
def handle_account_deletion(sender, instance, **kwargs):
    send_transactional_email_task.delay(
        recipient_email=instance.email,
        subject="Your VoctManager Account has been deleted",
        template_name="account_deleted",
        context={"user_email": instance.email},
        # GDPR hard-delete uses default EN to guarantee delivery
    )
    logger.info(f"Queued account deletion confirmation email for: {instance.email}")