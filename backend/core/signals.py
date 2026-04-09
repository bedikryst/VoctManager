# core/signals.py
# ==========================================
# Core Domain Signals (Event Bus)
# Standard: Enterprise SaaS 2026
# ==========================================
import logging
from django.db.models.signals import pre_save, post_save, pre_delete
from django.dispatch import receiver
from django.conf import settings
from django.contrib.auth import get_user_model

from .models import UserProfile
from notifications.email_tasks import send_transactional_email_task

logger = logging.getLogger(__name__)
User = get_user_model()

@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def handle_user_creation_and_profile(sender, instance, created, **kwargs):
    """
    Ensures every Auth User automatically gets a linked UserProfile.
    Dispatches asynchronous welcome email upon initial creation.
    """
    if created:
        profile = UserProfile.objects.create(user=instance)
        
        # Enterprise Event-Driven Email Dispatch
        # Critical transactional emails bypass the 'email_notifications_enabled' preference.
        send_transactional_email_task.delay(
            recipient_email=instance.email,
            subject="Welcome to VoctManager",
            template_name="welcome_email",
            context={
                "user_email": instance.email, 
                "first_name": getattr(instance, 'first_name', '')
            },
            language_code=profile.language
        )
        logger.info(f"Dispatched welcome email task for new user: {instance.email}")
        
        send_transactional_email_task.delay(
            recipient_email=instance.email,
            subject="Welcome to VoctManager",
            template_name="welcome_email",
            context={
                "first_name": getattr(instance, 'first_name', ''),
                "frontend_url": f"{settings.CORS_ALLOWED_ORIGINS[0]}/login" 
            },
            language_code=profile.language
        )
    
    else:
        # Failsafe for missing profiles on existing users
        UserProfile.objects.get_or_create(user=instance)


@receiver(pre_save, sender=settings.AUTH_USER_MODEL)
def detect_security_changes(sender, instance, **kwargs):
    """
    Intercepts user updates before they hit the database to detect critical security changes 
    (e.g., password mutation) without requiring access to raw passwords.
    """
    if instance.pk:
        try:
            user_with_profile = User.objects.select_related('profile').get(pk=instance.pk)
            # Compare the password hashes to detect a password change event
            if user_with_profile.password != instance.password:
                send_transactional_email_task.delay(
                    recipient_email=instance.email,
                    subject="Security Alert: Password Changed",
                    template_name="password_changed",
                    context={"user_email": instance.email},
                    language_code=user_with_profile.profile.language  # Przekazujemy język
                )
                logger.info(f"Dispatched password change security email for: {instance.email}")
        except User.DoesNotExist:
            pass # Failsafe during edge-case migrations or test setups


@receiver(pre_delete, sender=settings.AUTH_USER_MODEL)
def handle_account_deletion(sender, instance, **kwargs):
    """
    Dispatches a final confirmation email before the user record is hard-deleted 
    (GDPR "Right to be Forgotten" fulfillment).
    """
    send_transactional_email_task.delay(
        recipient_email=instance.email,
        subject="Your VoctManager Account has been deleted",
        template_name="account_deleted",
        context={"user_email": instance.email}
    )
    logger.info(f"Dispatched account deletion confirmation email for: {instance.email}")