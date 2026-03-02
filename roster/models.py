"""
Database models for the Roster application.
Author: Krystian Bugalski

Manages the core entities of the ensemble: Artists (Choir members), Projects (Concerts),
and Participation (the relationship connecting an artist to a project with contract details).
"""

import os
from django.db import models
from django.contrib.auth.models import User
from dotenv import load_dotenv

__author__ = "Krystian Bugalski"

class Artist(models.Model):
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
        ('DYRYGENT', 'Dyrygent'),
    ]

    # OneToOneField securely links the custom HR profile to the built-in Django auth system
    user = models.OneToOneField(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='artist_profile',
        verbose_name="Konto do logowania"
    )

    first_name = models.CharField(max_length=50, verbose_name="Imię")
    last_name = models.CharField(max_length=50, verbose_name="Nazwisko")
    email = models.EmailField(unique=True, verbose_name="E-mail")
    phone_number = models.CharField(max_length=15, blank=True, null=True, verbose_name="Telefon")
    voice_part = models.CharField(max_length=8, choices=VOICE_CHOICES, verbose_name="Głos")
    is_active = models.BooleanField(default=True, verbose_name="Aktywny")

    class Meta:
        verbose_name = "Artysta"
        verbose_name_plural = "Artyści"

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.get_voice_part_display()})"

    def save(self, *args, **kwargs):
        """
        OVERRIDE: Automated User Account Provisioning.
        Intercepts the save process. If a new Artist is created without an associated User account,
        it automatically generates one based on their name and assigns a secure default password.
        """
        if self.first_name and self.last_name and not self.user:
            load_dotenv()
            
            # Generate username pattern: first letter of first name + full last name (e.g., 'kbugalski')
            username = f"{self.first_name[0].lower()}{self.last_name.lower()}"
            
            # get_or_create ensures we don't crash if an admin manually created the user first
            user, created = User.objects.get_or_create(username=username)
            
            if created:
                user.email = self.email
                # Fetch default password from secure environment variables
                default_password = os.environ.get('DEFAULT_ARTIST_PASSWORD', 'fallback_secure_password123')  
                user.set_password(default_password) 
                user.save()
            
            # Link the newly created auth User to this Artist profile
            self.user = user
            
        super().save(*args, **kwargs)   


class Project(models.Model):
    title = models.CharField(max_length=200, verbose_name="Nazwa Projektu")
    start_date = models.DateField(verbose_name="Data Rozpoczęcia")
    end_date = models.DateField(verbose_name="Data Zakończenia")
    location = models.CharField(max_length=200, blank=True, null=True, verbose_name="Lokalizacja")
    description = models.TextField(blank=True, null=True, verbose_name="Opis")

    # ManyToMany relationship linking a specific concert to multiple musical pieces from the Archive
    repertoire = models.ManyToManyField(
        'archive.Piece', 
        blank=True, 
        related_name='projects', 
        verbose_name="Repertuar (Utwory)"
    )

    class Meta:
        verbose_name = "Projekt"
        verbose_name_plural = "Projekty"

    def __str__(self):
        return f"{self.title} ({self.start_date.year})"


class Participation(models.Model):
    """
    Through-model (Junction table) for the Many-To-Many relationship between Artists and Projects.
    Stores additional metadata about the relationship, such as attendance status and financial compensation.
    """
    STATUS_CHOICES = [
        ('INV', 'Zaproszony'),
        ('CON', 'Potwierdzony'),
        ('DEC', 'Odrzucił'),
    ]

    artist = models.ForeignKey(Artist, on_delete=models.CASCADE, related_name='participations', verbose_name="Artysta")
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='participations', verbose_name="Projekt")
    status = models.CharField(max_length=3, choices=STATUS_CHOICES, default='INV', verbose_name="Status")
    fee = models.DecimalField(max_digits=8, decimal_places=0, blank=True, null=True, verbose_name="Wynagrodzenie (PLN)")

    class Meta:
        verbose_name = "Uczestnictwo"
        verbose_name_plural = "Uczestnictwa"
        # Database constraint: Prevent duplicate casting of the same artist to the same project
        unique_together = ('artist', 'project') 

    def __str__(self):
        return f"{self.artist} -> {self.project} [{self.get_status_display()}]"