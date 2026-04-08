# core/models.py
# ==========================================
# Core Database Models & Managers
# ==========================================
import uuid
from django.db import models
from django.utils import timezone
from django.conf import settings
from django.utils.translation import gettext_lazy as _
import zoneinfo
from .constants import DietaryChoices, ClothingSizeChoices

class SoftDeleteQuerySet(models.QuerySet):
    """
    Enterprise safeguard preventing accidental bulk hard-deletions.
    Intercepts standard .delete() calls on querysets and routes them to soft-delete.
    """
    def delete(self):
        return super().update(is_deleted=True, updated_at=timezone.now())

    def hard_delete(self):
        """Explicit escape hatch for GDPR compliance or data purging."""
        return super().delete()

class ActiveManager(models.Manager):
    """Global manager filtering out soft-deleted records."""
    def get_queryset(self):
        return SoftDeleteQuerySet(self.model, using=self._db).filter(is_deleted=False)


class EnterpriseBaseModel(models.Model):
    """
    Abstract base model providing UUID primary keys, timestamp tracking, 
    and soft-delete functionality for all operational models.
    
    CRITICAL ARCHITECTURE NOTE:
    Because this model uses Soft Delete, child models referencing it via ForeignKey 
    SHOULD AVOID using `on_delete=models.CASCADE`. Standard database cascades bypass 
    the soft-delete logic and will permanently delete related objects. 
    Use `on_delete=models.RESTRICT` or custom cascade managers instead.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False, db_index=True)

    # Managers
    objects = ActiveManager()
    all_objects = models.Manager()

    class Meta:
        abstract = True

    def delete(self, using=None, keep_parents=False):
        """Single-instance soft delete."""
        self.is_deleted = True
        self.updated_at = timezone.now()
        self.save(update_fields=['is_deleted', 'updated_at'])

    def restore(self):
        """
        Restores a soft-deleted record.
        """
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
        help_text=_("The core authentication user linked to this profile.")
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

    class Meta:
        db_table = 'core_user_profile'
        verbose_name = _('User Profile')
        verbose_name_plural = _('User Profiles')

    def __str__(self) -> str:
        return f"Profile for {self.user.email}"
    
