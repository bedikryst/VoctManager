# core/models.py
# ==========================================
# Core Database Models & Managers
# Standard: Enterprise SaaS 2026
# ==========================================
import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from .constants import AppRole, ClothingSizeChoices


def avatar_upload_path(instance: "UserProfile", filename: str) -> str:
    """
    Store avatars under an unguessable per-file UUID name (extension dropped —
    the image is always re-encoded to WebP by the processing service), bucketed
    by the profile id so a user's renders live together and are easy to purge.
    """
    return f"avatars/{instance.id}/{uuid.uuid4().hex}.webp"


class SoftDeleteQuerySet(models.QuerySet):
    """
    Enterprise safeguard preventing accidental bulk hard-deletions.
    Intercepts standard .delete() calls on querysets and routes them to soft-delete.
    """
    def delete(self):
        # We use update() for atomic bulk operations, avoiding race conditions
        return super().update(is_deleted=True, updated_at=timezone.now())

    def hard_delete(self):
        """Explicit escape hatch for GDPR compliance or data purging."""
        return super().delete()

    def restore(self):
        """Bulk restore soft-deleted records."""
        return super().update(is_deleted=False, updated_at=timezone.now())


class ActiveManager(models.Manager):
    """Global manager filtering out soft-deleted records by default."""
    def get_queryset(self):
        return SoftDeleteQuerySet(self.model, using=self._db).filter(is_deleted=False)


class EnterpriseBaseModel(models.Model):
    """
    Abstract base model providing UUID primary keys, timestamp tracking, 
    and soft-delete functionality for all operational models.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False)

    # Base Managers
    objects = ActiveManager()
    all_objects = models.Manager.from_queryset(SoftDeleteQuerySet)()

    class Meta:
        abstract = True
        # Critical Enterprise optimization: 
        # Composite index speeds up default lookups filtering by is_deleted and ordering by creation
        indexes = [
            models.Index(fields=['is_deleted', '-created_at']),
        ]

    def delete(self, using=None, keep_parents=False):
        """Single-instance atomic soft delete."""
        self.is_deleted = True
        self.updated_at = timezone.now()
        self.save(update_fields=['is_deleted', 'updated_at'])

    def hard_delete(self, using=None, keep_parents=False):
        """Bypass soft-delete for GDPR compliance."""
        super().delete(using=using, keep_parents=keep_parents)

    def restore(self):
        """Restores a soft-deleted record."""
        self.is_deleted = False
        self.updated_at = timezone.now()
        self.save(update_fields=['is_deleted', 'updated_at'])


class UserProfile(EnterpriseBaseModel):
    """
    Enterprise user profile and preferences.
    Separates domain-specific user configurations from the core authentication model.
    """
    class LanguageChoices(models.TextChoices):
        ENGLISH = 'en', _('English')
        POLISH = 'pl', _('Polish')
        FRENCH = 'fr', _('French')

    class Salutation(models.TextChoices):
        """Grammatical form of address for personalised greetings (PL/FR have
        gendered salutations). Deliberately a communication preference, not an
        identity attribute — default NEUTRAL never assumes anything."""
        FEMININE = 'F', _('Feminine')
        MASCULINE = 'M', _('Masculine')
        NEUTRAL = 'N', _('Neutral / unspecified')

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile',
        help_text=_("The core authentication user linked to this profile. Cascades on hard delete.")
    )
    
    # Identity / Presence
    avatar = models.ImageField(
        upload_to=avatar_upload_path,
        blank=True,
        null=True,
        help_text=_("Full-size (square, 512px) profile picture, re-encoded to WebP.")
    )
    avatar_thumb = models.ImageField(
        upload_to=avatar_upload_path,
        blank=True,
        null=True,
        help_text=_("Small (96px) thumbnail derived from the avatar for dense lists.")
    )

    # Contact Info
    phone_number = models.CharField(
        max_length=32,
        blank=True,
        help_text=_("International format phone number.")
    )
    
    # Preferences
    language = models.CharField(
        max_length=10,
        choices=LanguageChoices.choices,
        default=LanguageChoices.POLISH,
        help_text=_("Preferred language for the UI and for all outgoing notifications "
                    "(push, email, digest). Single source of truth — kept in sync with "
                    "the client UI language for authenticated users.")
    )
    timezone = models.CharField(
        max_length=63,
        default='Europe/Warsaw',
        help_text=_("Local timezone for this entity. Critical for UI rendering and iCal feeds.")
    )
    salutation = models.CharField(
        max_length=1,
        choices=Salutation.choices,
        default=Salutation.NEUTRAL,
        help_text=_("Grammatical form of address for greetings only (e.g. PL Drogi/Droga, "
                    "FR Cher/Chère). Optional; NEUTRAL makes no assumption.")
    )

    clothing_size = models.CharField(
        max_length=5,
        choices=ClothingSizeChoices.choices,
        blank=True,
        help_text=_("Standard touring or uniform shirt size.")
    )
    shoe_size = models.CharField(
        max_length=10,
        blank=True,
        help_text=_("European shoe size format (e.g., 42, 42.5).")
    )
    height_cm = models.PositiveSmallIntegerField(
        null=True, 
        blank=True,
        help_text=_("Height in centimeters. Crucial for stage risers positioning.")
    )

    # Integrations & Security
    calendar_token = models.UUIDField(
        default=uuid.uuid4, 
        # Removed generic unique=True because of SoftDelete, using UniqueConstraint below
        editable=False,
        help_text=_("Secret token for iCal feed subscription.")
    )
    
    email_notifications_enabled = models.BooleanField(
        default=True,
        help_text=_("Determines if the user receives non-critical operational emails.")
    )

    # System-controlled (set by ESP bounce/complaint webhooks, not the user). When
    # set, all notification email to this address is suppressed until it is cleared
    # (manually, or automatically when the user changes their email).
    email_undeliverable = models.BooleanField(
        default=False,
        help_text=_("Set automatically on a hard bounce or spam complaint. Suppresses notification email.")
    )

    # Routine, high-volume manager alerts (attendance, RSVPs, absence requests) are
    # batched into a once-daily digest instead of a flood of individual emails/pushes.
    # Urgent alerts (declines, cancellations) and personal notifications always break
    # through in real time regardless of this setting.
    digest_enabled = models.BooleanField(
        default=True,
        help_text=_("Batch routine informational manager alerts into a single daily digest email.")
    )
    digest_hour = models.PositiveSmallIntegerField(
        default=8,
        validators=[MinValueValidator(0), MaxValueValidator(23)],
        help_text=_("Local hour (0-23, in the user's timezone) the daily digest is delivered.")
    )
    last_digest_sent_at = models.DateTimeField(
        null=True, blank=True,
        help_text=_("Timestamp of the most recent digest dispatch. Guards against duplicates.")
    )
    notifications_seen_at = models.DateTimeField(
        null=True, blank=True,
        help_text=_("When the user last opened the notification centre. Drives the "
                    "'new since seen' bell badge: opening clears the count without "
                    "marking individual notifications as read.")
    )
    welcome_seen_at = models.DateTimeField(
        null=True, blank=True,
        help_text=_("When the member first completed the one-time home-screen "
                    "welcome. Stamped once, server-side, so the WelcomeMoment card "
                    "greets a new member exactly once per account — on every device "
                    "they sign in from, not once per browser.")
    )
    terms_accepted_at = models.DateTimeField(
        null=True, blank=True,
        help_text=_("Server-side timestamp of the user's acceptance of the Terms of "
                    "Service and Privacy Policy at account activation. Legal evidence "
                    "of consent — stamped once, never updated on later logins.")
    )
    terms_accepted_version = models.CharField(
        max_length=20, blank=True, default='',
        help_text=_("Version identifier (date-stamped, e.g. '2026-07-09') of the "
                    "legal documents the user accepted at activation.")
    )

    # === ENTERPRISE RBAC ===
    role = models.CharField(
        max_length=20,
        choices=AppRole.choices,
        default=AppRole.ARTIST,
        help_text=_("Business role defining application access level.")
    )
    
    @property
    def is_manager(self) -> bool:
        return self.role == AppRole.MANAGER
    
    @property
    def is_artist(self) -> bool:
        """Evaluates if the user possesses Artist-level privileges."""
        return self.role == AppRole.ARTIST

    @property
    def is_crew(self) -> bool:
        """Evaluates if the user possesses Crew-level privileges."""
        return self.role == AppRole.CREW
        
    class Meta:
        db_table = 'core_user_profile'
        verbose_name = _('User Profile')
        verbose_name_plural = _('User Profiles')
        constraints = [
            # Enterprise constraint: Ensures tokens are only unique among ACTIVE profiles.
            # Prevents IntegrityErrors if a deleted profile has the same token by sheer luck (though rare for UUIDs)
            models.UniqueConstraint(
                fields=['calendar_token'],
                condition=models.Q(is_deleted=False),
                name='unique_active_calendar_token'
            )
        ]

    def __str__(self) -> str:
        return f"Profile for {self.user.email}"
