"""
===============================================================================
Archive Database Models (Entities)
===============================================================================
Domain: Archive
Description: 
    Data persistence layer for musical repertoire. Uses Django ORM with 
    EnterpriseBaseModel for consistent audit trailing and soft-deletion.
    Adheres to Cloud-Native principles by externalizing limits to configurations.

Standards: SaaS 2026, Cloud-Native Storage Ready, Soft-Delete Compliant.
===============================================================================
"""

from django.db import models
from django.conf import settings
from django.core.validators import FileExtensionValidator
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

from core.models import EnterpriseBaseModel
from core.constants import VoiceLine


def validate_file_size(value) -> None:
    """
    Validates uploaded file size dynamically based on environment configuration.
    Eliminates 'Magic Numbers' to support tier-based SaaS limits (e.g., Free vs Pro).
    """
    max_size_mb = getattr(settings, 'MAX_UPLOAD_SIZE_MB', 50)
    max_size_bytes = max_size_mb * 1024 * 1024
    
    if value.size > max_size_bytes:
        raise ValidationError(
            _('File size must be under %(size)s MB. Current: %(current)s MB') % {
                'size': max_size_mb,
                'current': round(value.size / (1024 * 1024), 2)
            }
        )


class Composer(EnterpriseBaseModel):
    """
    Dictionary entity representing a musical composer or arranger.
    """
    first_name = models.CharField(max_length=100, blank=True, verbose_name=_("First Name"))
    last_name = models.CharField(max_length=100, verbose_name=_("Last Name"))
    birth_year = models.CharField(max_length=50, blank=True, help_text=_("e.g. 1885"), verbose_name=_("Birth Year"))
    death_year = models.CharField(max_length=50, blank=True, verbose_name=_("Death Year"))

    class Meta:
        verbose_name = _("Composer")
        verbose_name_plural = _("Composers")
        ordering = ['last_name']
        indexes = [
            models.Index(fields=['last_name', 'first_name']),
        ]

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()


class EpochChoices(models.TextChoices):
    MEDIEVAL = 'MED', _('Medieval')
    RENAISSANCE = 'REN', _('Renaissance')
    BAROQUE = 'BAR', _('Baroque')
    CLASSICAL = 'CLA', _('Classical')
    ROMANTIC = 'ROM', _('Romantic')
    MODERN_20 = 'M20', _('20th Century')
    CONTEMPORARY = 'CON', _('Contemporary')
    POP = 'POP', _('Popular Music')
    FOLK = 'FOLK', _('Folk / Traditional')
    OTHER = 'OTH', _('Other')


class Piece(EnterpriseBaseModel):
    """
    Aggregate Root entity for the musical repertoire.
    Orchestrates related sub-entities (Tracks, Voice Requirements).
    """
    title = models.CharField(max_length=200, verbose_name=_("Title"))
    composer = models.ForeignKey(
        Composer, 
        on_delete=models.RESTRICT, 
        null=True, 
        blank=True, 
        related_name='pieces', 
        verbose_name=_("Composer")
    )
    arranger = models.CharField(max_length=150, blank=True, verbose_name=_("Arranger"))
    language = models.CharField(max_length=50, blank=True, help_text=_("e.g. Latin, English"), verbose_name=_("Language"))
    estimated_duration = models.PositiveIntegerField(blank=True, null=True, help_text=_("Duration in seconds"), verbose_name=_("Estimated Duration"))
    voicing = models.CharField(max_length=50, blank=True, help_text=_("e.g. SSAATTBB"), verbose_name=_("Voicing"))
    description = models.TextField(blank=True, verbose_name=_("Notes / Description"))
    
    # Cloud-Native Note: When django-storages is configured in settings.py, 
    # FileField automatically routes these uploads to AWS S3 / GCP Storage.
    sheet_music = models.FileField(
        upload_to='sheet_music/', 
        blank=True, 
        validators=[FileExtensionValidator(['pdf']), validate_file_size], 
        verbose_name=_("Sheet Music (PDF)")
    )

    lyrics_original = models.TextField(blank=True, help_text=_("Original language text"), verbose_name=_("Lyrics (Original)"))
    lyrics_translation = models.TextField(blank=True, help_text=_("Translated text"), verbose_name=_("Lyrics (Translation)"))
    reference_recording_youtube = models.URLField(blank=True, help_text=_("YouTube URL"), verbose_name=_("Recording (YouTube)"))
    reference_recording_spotify = models.URLField(blank=True, help_text=_("Spotify URL"), verbose_name=_("Recording (Spotify)"))
    
    composition_year = models.IntegerField(blank=True, null=True, verbose_name=_("Year of Composition"))
    epoch = models.CharField(max_length=4, choices=EpochChoices.choices, blank=True, verbose_name=_("Epoch"))

    class Meta:
        verbose_name = _("Piece")
        verbose_name_plural = _("Pieces")
        ordering = ['title']
        indexes = [
            models.Index(fields=['title']),
            models.Index(fields=['epoch']),
        ]

    def __str__(self) -> str:
        suffix = f" (arr. {self.arranger})" if self.arranger else ""
        year_str = f" ({self.composition_year})" if self.composition_year else ""
        composer_str = f"{self.composer.last_name}: " if self.composer else ""
        return f"{composer_str}{self.title}{year_str}{suffix}"


class PieceVoiceRequirement(EnterpriseBaseModel): 
    """
    Defines the specific vocal divisi requirements for a piece.
    Strictly managed as a sub-entity of the Piece Aggregate Root.
    """
    piece = models.ForeignKey(
        Piece, 
        on_delete=models.RESTRICT, 
        related_name='voice_requirements', 
        verbose_name=_("Piece")
    )
    voice_line = models.CharField(max_length=12, choices=VoiceLine.choices, verbose_name=_("Voice Line"))
    quantity = models.PositiveIntegerField(default=1, verbose_name=_("Required Singers"))

    class Meta:
        verbose_name = _("Voice Requirement")
        verbose_name_plural = _("Voice Requirements")
        constraints = [
            # Advanced constraint aware of the EnterpriseBaseModel soft-deletion mechanism
            models.UniqueConstraint(
                fields=['piece', 'voice_line'],
                condition=models.Q(is_deleted=False),
                name='unique_active_voice_requirement'
            )
        ]

    def __str__(self) -> str:
        return f"{self.piece.title}: {self.quantity}x {self.get_voice_line_display()}"


class Track(EnterpriseBaseModel):
    """
    Audio rehearsal materials (MIDI/MP3) associated with a piece.
    """
    piece = models.ForeignKey(
        Piece, 
        on_delete=models.RESTRICT, 
        related_name='tracks', 
        verbose_name=_("Piece")
    )
    voice_part = models.CharField(max_length=10, choices=VoiceLine.choices, verbose_name=_("Melody Line"))
    
    audio_file = models.FileField(
        upload_to='audio_tracks/', 
        validators=[FileExtensionValidator(['mp3', 'wav', 'midi']), validate_file_size], 
        verbose_name=_("Audio File (MIDI/MP3)")
    )

    class Meta:
        verbose_name = _("Audio Track")
        verbose_name_plural = _("Audio Tracks")

    def __str__(self) -> str:
        return f"{self.piece.title} - {self.get_voice_part_display()}"