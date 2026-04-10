# core/models.py
# ==========================================
# Core Database Models & Managers
# Standard: Enterprise SaaS 2026
# ==========================================
import uuid
import zoneinfo
from django.db import models
from django.utils import timezone
from django.conf import settings
from django.utils.translation import gettext_lazy as _
from .constants import AppRole, DietaryChoices, ClothingSizeChoices

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

    AVAILABLE_ZONES = sorted(list(zoneinfo.available_timezones()))
    TIMEZONE_CHOICES = tuple(zip(AVAILABLE_ZONES, AVAILABLE_ZONES))

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile',
        help_text=_("The core authentication user linked to this profile. Cascades on hard delete.")
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
        default=LanguageChoices.ENGLISH,
        help_text=_("User preferred UI language.")
    )
    timezone = models.CharField(
        max_length=63,
        choices=TIMEZONE_CHOICES,
        default='UTC',
        help_text=_("Critical for rendering rehearsal/project times correctly across regions.")
    )

    dietary_preference = models.CharField(
        max_length=15,
        choices=DietaryChoices.choices,
        default=DietaryChoices.NONE,
        help_text=_("Primary dietary requirement for catering.")
    )
    dietary_notes = models.TextField(
        blank=True,
        help_text=_("Specific allergies or custom dietary instructions.")
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