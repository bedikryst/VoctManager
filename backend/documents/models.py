# documents/models.py
# ==========================================
# Knowledge Base & Chorister Hub Domain Models
# Standard: Enterprise SaaS 2026
# ==========================================
from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _

from core.models import EnterpriseBaseModel
from core.constants import AppRole


class DocumentIconKey(models.TextChoices):
    BOOK_OPEN = 'BookOpen', _('Book Open')
    SHIRT = 'Shirt', _('Shirt / Wardrobe')
    FILE_TEXT = 'FileText', _('File / Document')
    SHIELD = 'Shield', _('Shield / Policy')
    HEART_PULSE = 'HeartPulse', _('Health / Medical')
    MUSIC = 'Music', _('Music')
    USERS = 'Users', _('Group / Team')
    BRIEFCASE = 'Briefcase', _('Briefcase / Work')
    MAP_PIN = 'MapPin', _('Location / Map')
    LANDMARK = 'Landmark', _('Institution / Foundation')
    GRADUATION_CAP = 'GraduationCap', _('Education / Training')
    SCROLL_TEXT = 'ScrollText', _('Scroll / Statute')
    SCALE = 'Scale', _('Scale / Legal')
    MIC_2 = 'Mic2', _('Microphone / Performance')


class DocumentCategory(EnterpriseBaseModel):
    """
    Logical grouping for Knowledge Base documents.
    Role visibility is controlled via the `allowed_roles` JSON array.
    """
    name = models.CharField(max_length=120, verbose_name=_("Category Name"))
    slug = models.SlugField(max_length=120, unique=True, verbose_name=_("URL Slug"))
    description = models.TextField(blank=True, verbose_name=_("Description"))
    icon_key = models.CharField(
        max_length=20,
        choices=DocumentIconKey.choices,
        default=DocumentIconKey.BOOK_OPEN,
        verbose_name=_("Icon"),
    )
    order = models.PositiveSmallIntegerField(default=0, verbose_name=_("Display Order"))
    allowed_roles = models.JSONField(
        default=list,
        verbose_name=_("Allowed Roles"),
        help_text=_("JSON array of role codes that can view this category. E.g. ['ARTIST', 'MANAGER']"),
    )

    class Meta:
        ordering = ['order', 'name']
        verbose_name = _('Document Category')
        verbose_name_plural = _('Document Categories')

    def __str__(self) -> str:
        return self.name


class Document(EnterpriseBaseModel):
    """
    A single file entry within a DocumentCategory.
    Supports per-document role overrides; falls back to category roles when empty.
    Strictly excludes musical scores and audio materials (those belong in the archive app).
    """
    category = models.ForeignKey(
        DocumentCategory,
        on_delete=models.CASCADE,
        related_name='documents',
        verbose_name=_("Category"),
    )
    title = models.CharField(max_length=255, verbose_name=_("Document Title"))
    description = models.TextField(blank=True, verbose_name=_("Description"))
    file = models.FileField(upload_to='documents/%Y/%m/', verbose_name=_("File"))
    file_size_bytes = models.PositiveBigIntegerField(default=0, verbose_name=_("File Size (bytes)"))
    mime_type = models.CharField(max_length=100, default='application/pdf', verbose_name=_("MIME Type"))
    allowed_roles = models.JSONField(
        default=list,
        verbose_name=_("Allowed Roles Override"),
        help_text=_("Overrides category roles when non-empty. Leave empty to inherit from category."),
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='uploaded_documents',
        verbose_name=_("Uploaded By"),
    )
    order = models.PositiveSmallIntegerField(default=0, verbose_name=_("Display Order"))

    class Meta:
        ordering = ['order', 'title']
        verbose_name = _('Document')
        verbose_name_plural = _('Documents')

    def __str__(self) -> str:
        return f"{self.category.name} / {self.title}"

    @property
    def effective_roles(self) -> list[str]:
        """Returns per-document roles if defined, otherwise inherits from parent category."""
        return self.allowed_roles if self.allowed_roles else self.category.allowed_roles
