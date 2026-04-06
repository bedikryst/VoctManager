# archive/models.py
# ==========================================
# Archive Database Models
# ==========================================
"""
Database models for the Archive application.
@author Krystian Bugalski

Defines the structure for storing musical repertoire, including 
composers, musical pieces (sheet music, lyrics), and isolated audio tracks.
ENTERPRISE UPGRADE: Consolidated duplicated fields and transitioned to 
strict English documentation standards.
"""

import uuid
from django.db import models
from django.core.validators import FileExtensionValidator
from django.core.exceptions import ValidationError

def validate_file_size(value):
    """Validate file size to prevent abuse."""
    max_size = 50 * 1024 * 1024  # 50MB
    if value.size > max_size:
        raise ValidationError(f'File size must be under {max_size / (1024*1024)}MB. Current: {value.size / (1024*1024):.2f}MB')

from core.models import EnterpriseBaseModel
from core.constants import VoiceLine


class Composer(EnterpriseBaseModel):
    """
    Represents a musical composer or arranger.
    Handles traditional/anonymous works gracefully via its string representation.
    """
    first_name = models.CharField(max_length=100, blank=True, verbose_name="Imię")
    last_name = models.CharField(max_length=100, verbose_name="Nazwisko")
    birth_year = models.CharField(max_length=50, blank=True, help_text="np. 1885", verbose_name="Rok urodzenia")
    death_year = models.CharField(max_length=50, blank=True, verbose_name="Rok śmierci")

    class Meta:
        verbose_name = "Kompozytor"
        verbose_name_plural = "Kompozytorzy"
        ordering = ['last_name']

    def __str__(self):
        if self.first_name:
            return f"{self.first_name} {self.last_name}"
        return self.last_name 

class EpochChoices(models.TextChoices):
    """Enumeration for standard musical epochs to enable precise repertoire filtering."""
    MEDIEVAL = 'MED', 'Średniowiecze'
    RENAISSANCE = 'REN', 'Renesans'
    BAROQUE = 'BAR', 'Barok'
    CLASSICAL = 'CLA', 'Klasycyzm'
    ROMANTIC = 'ROM', 'Romantyzm'
    MODERN_20 = 'M20', 'XX wiek'
    CONTEMPORARY = 'CON', 'Muzyka Współczesna'
    POP = 'POP', 'Muzyka Rozrywkowa'
    FOLK = 'FOLK', 'Folk / Ludowa'
    OTHER = 'OTH', 'Inne'

class Piece(EnterpriseBaseModel):
    """
    Represents a single musical work in the ensemble's repertoire.
    Stores metadata, sheet music files, and resources for the conductor's workspace.
    """
    title = models.CharField(max_length=200, verbose_name="Tytuł utworu")
    
    # Safe nullification instead of cascading deletion
    composer = models.ForeignKey(
        Composer, on_delete=models.SET_NULL, null=True, blank=True, 
        related_name='pieces', verbose_name="Kompozytor"
    )
    
    # --- VOCAL ENSEMBLE SPECIFIC METADATA ---
    arranger = models.CharField(max_length=150, blank=True, verbose_name="Aranżer")
    language = models.CharField(max_length=50, blank=True, help_text="np. Łacina, Angielski", verbose_name="Język")
    estimated_duration = models.PositiveIntegerField(blank=True, null=True, help_text="Czas trwania w sekundach", verbose_name="Szacowany czas trwania")
    
    voicing = models.CharField(max_length=50, blank=True, help_text="np. SSAATTBB", verbose_name="Obsada wokalna")
    description = models.TextField(blank=True, verbose_name="Uwagi / Opis")
    sheet_music = models.FileField(upload_to='sheet_music/', blank=True, validators=[FileExtensionValidator(['pdf']), validate_file_size], verbose_name="Nuty (Plik PDF)")

    # --- CONDUCTOR & REHEARSAL WORKSPACE ---
    lyrics_original = models.TextField(blank=True, help_text="Tekst w języku oryginału", verbose_name="Tekst utworu")
    lyrics_translation = models.TextField(blank=True, help_text="Polskie tłumaczenie", verbose_name="Tłumaczenie")
    reference_recording_youtube = models.URLField(blank=True, help_text="Link do YouTube", verbose_name="Nagranie (Youtube)")
    reference_recording_spotify = models.URLField(blank=True, help_text="Link do Spotify", verbose_name="Nagranie (Spotify)")
    
    
    # --- HISTORICAL CONTEXT ---
    composition_year = models.IntegerField(blank=True, null=True, verbose_name="Rok powstania")
    epoch = models.CharField(max_length=4, choices=EpochChoices.choices, blank=True, verbose_name="Epoka")

    class Meta:
        verbose_name = "Utwór"
        verbose_name_plural = "Utwory"
        ordering = ['title']

    def __str__(self):
        suffix = f" (arr. {self.arranger})" if self.arranger else ""
        year_str = f" ({self.composition_year})" if self.composition_year else ""
        if self.composer:
            return f"{self.composer.last_name}: {self.title}{year_str}{suffix}"
        return f"{self.title}{year_str}{suffix}"

# 2. Zmiana: Wymagania dziedziczą po zwykłym models.Model, NIE po EnterpriseBaseModel.
class PieceVoiceRequirement(models.Model): 
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    piece = models.ForeignKey(Piece, on_delete=models.CASCADE, related_name='voice_requirements', verbose_name="Utwór")
    voice_line = models.CharField(max_length=12, choices=VoiceLine.choices, verbose_name="Głos / Linia")
    quantity = models.PositiveIntegerField(default=1, verbose_name="Wymagana ilość śpiewaków")

    class Meta:
        verbose_name = "Wymaganie głosowe"
        verbose_name_plural = "Wymagania głosowe"
        unique_together = ('piece', 'voice_line')

    def __str__(self):
        return f"{self.piece.title}: {self.quantity}x {self.get_voice_line_display()}"


# 1. Zmiana: Track powraca do CASCADE. Skoro używamy Soft Delete na Piece, 
# Django i tak nie wywoła tego kaskadowo, ale zapobiegnie to błędom ProtectedError
# przy próbach twardego czyszczenia bazy przez panel Admina.
class Track(EnterpriseBaseModel):
    piece = models.ForeignKey(Piece, on_delete=models.CASCADE, related_name='tracks', verbose_name="Utwór")
    voice_part = models.CharField(max_length=10, choices=VoiceLine.choices, verbose_name="Linia melodyczna")
    audio_file = models.FileField(upload_to='audio_tracks/', validators=[FileExtensionValidator(['mp3', 'wav', 'midi']), validate_file_size], verbose_name="Plik Audio (MIDI/MP3)")

    class Meta:
        verbose_name = "Ścieżka dźwiękowa"
        verbose_name_plural = "Ścieżki dźwiękowe"

    def __str__(self):
        return f"{self.piece.title} - {self.get_voice_part_display()}"