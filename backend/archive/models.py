"""
Database models for the Archive application.
Author: Krystian Bugalski

Defines the structure for storing musical repertoire, including 
composers, musical pieces (sheet music, lyrics), and isolated audio tracks.
"""

import uuid
from django.db import models

__author__ = "Krystian Bugalski"

# Unified vocal lines for the Octet (synchronized with the Roster application)
VOICE_LINES = [
    ('S1', 'Sopran 1'), ('S2', 'Sopran 2'),
    ('A1', 'Alt 1'), ('A2', 'Alt 2'),
    ('T1', 'Tenor 1'), ('T2', 'Tenor 2'),
    ('B1', 'Bas 1'), ('B2', 'Bas 2'),
    ('SOLO', 'Solo'), ('VP', 'Vocal Percussion / Beatbox'),
    ('TUTTI', 'Tutti (Wszyscy)'), 
    ('ACC', 'Akompaniament'),
    ('PRON', 'Wymowa (Dykcja/Język)')  # Crucial for foreign language pronunciation guides
]

class EnterpriseBaseModel(models.Model):
    """
    Abstract base model providing UUID primary keys and automated audit timestamps.
    Inherited by all models in the system to ensure database integrity and security.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Composer(EnterpriseBaseModel):
    first_name = models.CharField(max_length=100, blank=True, null=True, verbose_name="Imię")
    last_name = models.CharField(max_length=100, verbose_name="Nazwisko")
    birth_year = models.CharField(max_length=50, null=True, blank=True, help_text="np. 1885", verbose_name="Rok urodzenia")
    death_year = models.CharField(max_length=50, null=True, blank=True, verbose_name="Rok śmierci")

    class Meta:
        verbose_name = "Kompozytor"
        verbose_name_plural = "Kompozytorzy"
        ordering = ['last_name']

    def __str__(self):
        # Gracefully handle anonymous composers or traditional melodies
        if self.first_name:
            return f"{self.first_name} {self.last_name}"
        return self.last_name 


class Piece(EnterpriseBaseModel):
    title = models.CharField(max_length=200, verbose_name="Tytuł utworu")
    
    composer = models.ForeignKey(
        Composer, on_delete=models.SET_NULL, null=True, blank=True, 
        related_name='pieces', verbose_name="Kompozytor"
    )
    
    # --- VOCAL ENSEMBLE SPECIFIC METADATA ---
    arranger = models.CharField(max_length=150, blank=True, null=True, verbose_name="Aranżer")
    composition_year = models.CharField(max_length=100, blank=True, null=True, help_text="np. 1638 lub XVI w.", verbose_name="Czas powstania")
    language = models.CharField(max_length=50, blank=True, null=True, help_text="np. Łacina, Angielski", verbose_name="Język")
    estimated_duration = models.PositiveIntegerField(blank=True, null=True, help_text="Czas trwania w sekundach", verbose_name="Szacowany czas trwania")
    
    voicing = models.CharField(max_length=50, blank=True, help_text="np. SSAATTBB", verbose_name="Obsada wokalna")
    description = models.TextField(blank=True, verbose_name="Uwagi / Opis")
    sheet_music = models.FileField(upload_to='sheet_music/', blank=True, null=True, verbose_name="Nuty (Plik PDF)")

    # --- CONDUCTOR & REHEARSAL WORKSPACE ---
    lyrics_original = models.TextField(blank=True, null=True, help_text="Tekst w języku oryginału", verbose_name="Tekst utworu")
    lyrics_translation = models.TextField(blank=True, null=True, help_text="Polskie tłumaczenie", verbose_name="Tłumaczenie")
    reference_recording = models.URLField(blank=True, null=True, help_text="Link do YouTube/Spotify", verbose_name="Nagranie referencyjne")

    class Meta:
        verbose_name = "Utwór"
        verbose_name_plural = "Utwory"
        ordering = ['title']

    def __str__(self):
        suffix = f" (arr. {self.arranger})" if self.arranger else ""
        if self.composer:
            return f"{self.composer.last_name}: {self.title}{suffix}"
        return f"{self.title}{suffix}"


class Track(EnterpriseBaseModel):
    piece = models.ForeignKey(Piece, on_delete=models.CASCADE, related_name='tracks', verbose_name="Utwór")
    voice_part = models.CharField(max_length=10, choices=VOICE_LINES, verbose_name="Linia melodyczna")
    audio_file = models.FileField(upload_to='audio_tracks/', verbose_name="Plik Audio (MIDI/MP3)")

    class Meta:
        verbose_name = "Ścieżka dźwiękowa"
        verbose_name_plural = "Ścieżki dźwiękowe"

    def __str__(self):
        return f"{self.piece.title} - {self.get_voice_part_display()}"