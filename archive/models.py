"""
Database models for the Archive application.
Author: Krystian Bugalski

Defines the structure for storing musical repertoire, including 
composers, musical pieces (sheet music), and isolated audio tracks for practice.
"""

from django.db import models

__author__ = "Krystian Bugalski"

class Composer(models.Model):
    first_name = models.CharField(max_length=100, verbose_name="Imię")
    last_name = models.CharField(max_length=100, verbose_name="Nazwisko")
    birth_year = models.IntegerField(null=True, blank=True, verbose_name="Rok urodzenia")
    death_year = models.IntegerField(null=True, blank=True, verbose_name="Rok śmierci")

    class Meta:
        verbose_name = "Kompozytor"
        verbose_name_plural = "Kompozytorzy"

    def __str__(self):
        return f"{self.first_name} {self.last_name}"


class Piece(models.Model):
    title = models.CharField(max_length=200, verbose_name="Tytuł utworu")
    
    # One-to-Many relationship: One composer can have multiple pieces.
    # SET_NULL ensures that if a composer is deleted, the piece remains in the archive.
    composer = models.ForeignKey(
        Composer, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='pieces',
        verbose_name="Kompozytor"
    )
    
    voicing = models.CharField(max_length=50, blank=True, verbose_name="Obsada wokalna (np. SATB)")
    description = models.TextField(blank=True, verbose_name="Uwagi / Opis")
    sheet_music = models.FileField(
        upload_to='sheet_music/', 
        blank=True, 
        null=True, 
        verbose_name="Nuty (Plik PDF)"
    )

    class Meta:
        verbose_name = "Utwór"
        verbose_name_plural = "Utwory"

    def __str__(self):
        if self.composer:
            return f"{self.title} - {self.composer.last_name}"
        return self.title


class Track(models.Model):
    VOICE_CHOICES = [
        ('SOPRAN', 'Sopran'),
        ('SOPRAN_1', 'Sopran 1'),
        ('SOPRAN_2', 'Sopran 2'),
        ('ALT', 'Alt'),
        ('ALT_1', 'Alt 1'),
        ('ALT_2', 'Alt 2'),
        ('TENOR', 'Tenor'),
        ('TENOR_1', 'Tenor 1'),
        ('TENOR_2', 'Tenor 2'),
        ('BAS', 'Bas'),
        ('BAS_1', 'Bas 1'),
        ('BAS_2', 'Bas 2'),
        ('TUTTI', 'Tutti (Wszyscy)'),
        ('ACC', 'Akompaniament (Pianino)'),
    ]
    
    piece = models.ForeignKey(
        Piece, 
        on_delete=models.CASCADE, 
        related_name='tracks', 
        verbose_name="Utwór"
    )
    voice_part = models.CharField(max_length=20, choices=VOICE_CHOICES, verbose_name="Głos / Partia")
    audio_file = models.FileField(upload_to='audio_tracks/', verbose_name="Plik Audio (MIDI/MP3)")

    class Meta:
        verbose_name = "Ścieżka dźwiękowa"
        verbose_name_plural = "Ścieżki dźwiękowe"

    def __str__(self):
        return f"{self.get_voice_part_display()} - {self.piece.title}"