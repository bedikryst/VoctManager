"""
Database models for the Roster application.
Author: Krystian Bugalski

Manages the core HR and logistical entities for the vocal ensemble, including 
artists, projects, participation contracts, casting, and rehearsal scheduling.
"""

import uuid
from django.db import models
from django.contrib.auth.models import User
from django.conf import settings

__author__ = "Krystian Bugalski"

VOICE_TYPES = [
    ('SOP', 'Sopran'), ('MEZ', 'Mezzosopran'), ('ALT', 'Alt'),
    ('CT', 'Kontratenor'), ('TEN', 'Tenor'), ('BAR', 'Baryton'), ('BAS', 'Bas'),
    ('DIR', 'Dyrygent/Kierownik')
]

VOICE_LINES = [
    ('S1', 'Sopran 1'), ('S2', 'Sopran 2'),
    ('A1', 'Alt 1'), ('A2', 'Alt 2'),
    ('T1', 'Tenor 1'), ('T2', 'Tenor 2'),
    ('B1', 'Bas 1'), ('B2', 'Bas 2'),
    ('SOLO', 'Solo'), ('VP', 'Vocal Percussion / Beatbox')
]

class EnterpriseBaseModel(models.Model):
    """
    Abstract base model providing UUID primary keys and automated audit timestamps.
    Implements a soft-delete flag to preserve historical data integrity.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name="Utworzono")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Zaktualizowano")
    is_deleted = models.BooleanField(default=False, db_index=True, verbose_name="Usunięty (Soft Delete)")

    class Meta:
        abstract = True


class Artist(EnterpriseBaseModel):
    """Represents a vocal ensemble member and their specific musical capabilities."""
    user = models.OneToOneField(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='artist_profile', verbose_name="Konto")
    first_name = models.CharField(max_length=50, verbose_name="Imię")
    last_name = models.CharField(max_length=50, verbose_name="Nazwisko")
    email = models.EmailField(unique=True, verbose_name="E-mail")
    phone_number = models.CharField(max_length=15, blank=True, null=True, verbose_name="Telefon")
    voice_type = models.CharField(max_length=5, choices=VOICE_TYPES, verbose_name="Rodzaj głosu")
    is_active = models.BooleanField(default=True, verbose_name="Aktywny")

    # Vocal Profile Data
    sight_reading_skill = models.IntegerField(choices=[(i, str(i)) for i in range(1, 6)], blank=True, null=True, verbose_name="Czytanie a vista (1-5)")
    vocal_range_bottom = models.CharField(max_length=5, blank=True, null=True, help_text="np. G2", verbose_name="Skala (dół)")
    vocal_range_top = models.CharField(max_length=5, blank=True, null=True, help_text="np. C5", verbose_name="Skala (góra)")

    class Meta:
        verbose_name = "Artysta"
        verbose_name_plural = "Artyści"

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.get_voice_type_display()})"

    def save(self, *args, **kwargs):
        """
        Intercepts the save process to automatically provision a Django User account
        for new artists, allowing them immediate access to the frontend application.
        """
        if self.first_name and self.last_name and not self.user:
            username = f"{self.first_name[0].lower()}{self.last_name.lower()}"
            user, created = User.objects.get_or_create(username=username)
            if created:
                user.email = self.email
                default_password = getattr(settings, 'DEFAULT_ARTIST_PASSWORD', 'fallback_secure_password123')  
                user.set_password(default_password) 
                user.save()
            self.user = user
        super().save(*args, **kwargs)   


class Project(EnterpriseBaseModel):
    """Represents a specific event, concert, or recording session."""
    title = models.CharField(max_length=200, verbose_name="Nazwa Projektu")
    start_date = models.DateField(verbose_name="Data Rozpoczęcia")
    end_date = models.DateField(verbose_name="Data Zakończenia")
    call_time = models.DateTimeField(blank=True, null=True, help_text="Godzina zbiórki", verbose_name="Call Time")
    dress_code = models.CharField(max_length=100, blank=True, null=True, verbose_name="Dress Code")
    location = models.CharField(max_length=200, blank=True, null=True, verbose_name="Lokalizacja")
    description = models.TextField(blank=True, null=True, verbose_name="Opis")

    class Meta:
        verbose_name = "Projekt"
        verbose_name_plural = "Projekty"

    def __str__(self):
        return f"{self.title} ({self.start_date.year})"


class ProgramItem(EnterpriseBaseModel):
    """Maps musical pieces to a project to create an ordered concert setlist."""
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='program_items')
    piece = models.ForeignKey('archive.Piece', on_delete=models.CASCADE, verbose_name="Utwór")
    order = models.PositiveIntegerField(verbose_name="Kolejność w programie (1, 2, 3...)")
    is_encore = models.BooleanField(default=False, verbose_name="Czy to BIS?")

    class Meta:
        ordering = ['order']
        verbose_name = "Pozycja w Programie"
        verbose_name_plural = "Program Koncertu (Setlista)"
        constraints = [models.UniqueConstraint(fields=['project', 'order'], name='unique_order_per_project')]

    def __str__(self):
        return f"{self.order}. {self.piece.title}"


class Participation(EnterpriseBaseModel):
    """Junction table linking artists to projects, storing contract status and fees."""
    class Status(models.TextChoices):
        INVITED = 'INV', 'Zaproszony'
        CONFIRMED = 'CON', 'Potwierdzony'
        DECLINED = 'DEC', 'Odrzucił'

    artist = models.ForeignKey(Artist, on_delete=models.CASCADE, related_name='participations', verbose_name="Artysta")
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='participations', verbose_name="Projekt")
    status = models.CharField(max_length=3, choices=Status.choices, default=Status.INVITED, verbose_name="Status")
    fee = models.DecimalField(max_digits=8, decimal_places=0, blank=True, null=True, verbose_name="Wynagrodzenie")

    class Meta:
        verbose_name = "Uczestnictwo"
        verbose_name_plural = "Uczestnictwa"
        constraints = [models.UniqueConstraint(fields=['artist', 'project'], name='unique_project_participation')]

    def __str__(self):
        return f"{self.artist.last_name} -> {self.project.title}"


class ProjectPieceCasting(EnterpriseBaseModel):
    """Micro-casting: Assigns a specific vocal line to an artist for a single piece."""
    class Role(models.TextChoices):
        TUTTI = 'TUTTI', 'Tutti'
        SOLO = 'SOLO', 'Partia Solowa'
        BACKGROUND = 'BACK', 'Chórek'

    participation = models.ForeignKey(Participation, on_delete=models.CASCADE, related_name='castings', verbose_name="Uczestnik")
    piece = models.ForeignKey('archive.Piece', on_delete=models.CASCADE, related_name='castings', verbose_name="Utwór")
    voice_line = models.CharField(max_length=5, choices=VOICE_LINES, verbose_name="Linia melodyczna (Divisi)")
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.TUTTI, verbose_name="Rola")
    gives_pitch = models.BooleanField(default=False, verbose_name="Daje dźwięk (Kamerton)")
    notes = models.CharField(max_length=200, blank=True, null=True, verbose_name="Notatki")

    class Meta:
        verbose_name = "Obsada Utworu"
        verbose_name_plural = "Obsady Utworów"
        constraints = [models.UniqueConstraint(fields=['participation', 'piece'], name='unique_piece_casting')]


class Rehearsal(EnterpriseBaseModel):
    """Represents a scheduled rehearsal session for a specific project."""
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='rehearsals', verbose_name="Projekt")
    date_time = models.DateTimeField(verbose_name="Data i godzina")
    location = models.CharField(max_length=200, verbose_name="Sala prób")
    focus = models.CharField(max_length=200, blank=True, null=True, verbose_name="Cel próby")
    is_mandatory = models.BooleanField(default=True, verbose_name="Obowiązkowa")

    class Meta:
        verbose_name = "Próba"
        verbose_name_plural = "Próby"
        ordering = ['date_time']

    def __str__(self):
        return f"Próba: {self.date_time.strftime('%d.%m %H:%M')}"


class Attendance(EnterpriseBaseModel):
    """Tracks attendance and absence justifications for rehearsals."""
    class Status(models.TextChoices):
        PRESENT = 'PRESENT', 'Obecny'
        LATE = 'LATE', 'Spóźniony'
        ABSENT = 'ABSENT', 'Nieobecny'
        EXCUSED = 'EXCUSED', 'Usprawiedliwiony'

    rehearsal = models.ForeignKey(Rehearsal, on_delete=models.CASCADE, related_name='attendances', verbose_name="Próba")
    participation = models.ForeignKey(Participation, on_delete=models.CASCADE, related_name='attendances', verbose_name="Uczestnik")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PRESENT, verbose_name="Status")
    minutes_late = models.PositiveIntegerField(blank=True, null=True, verbose_name="Minuty spóźnienia")
    excuse_note = models.CharField(max_length=255, blank=True, null=True, verbose_name="Powód nieobecności (Notatka chórzysty)")

    class Meta:
        verbose_name = "Obecność"
        verbose_name_plural = "Obecności"
        constraints = [models.UniqueConstraint(fields=['rehearsal', 'participation'], name='unique_rehearsal_attendance')]


class Collaborator(EnterpriseBaseModel):
    """External production staff (e.g., sound engineers, lighting designers)."""
    class Specialty(models.TextChoices):
        SOUND = 'SOUND', 'Reżyseria Dźwięku'
        LIGHT = 'LIGHT', 'Reżyseria Świateł'
        VISUALS = 'VISUALS', 'Sztuka Wizualna'
        INSTRUMENT = 'INSTRUMENT', 'Instrumentalista'
        LOGISTICS = 'LOGISTICS', 'Logistyka'
        OTHER = 'OTHER', 'Inne'

    first_name = models.CharField(max_length=50, verbose_name="Imię")
    last_name = models.CharField(max_length=50, verbose_name="Nazwisko")
    email = models.EmailField(unique=True, blank=True, null=True, verbose_name="E-mail")
    phone_number = models.CharField(max_length=15, blank=True, null=True, verbose_name="Telefon")
    company_name = models.CharField(max_length=100, blank=True, null=True, verbose_name="Firma / Marka")
    specialty = models.CharField(max_length=15, choices=Specialty.choices, default=Specialty.OTHER, verbose_name="Specjalizacja")

    class Meta:
        verbose_name = "Współtwórca (Crew)"
        verbose_name_plural = "Współtwórcy"

    def __str__(self):
        return f"{self.first_name} {self.last_name}"


class CrewAssignment(EnterpriseBaseModel):
    """Assigns external collaborators to a project with specific duties and fees."""
    class Status(models.TextChoices):
        INVITED = 'INV', 'Wstępnie umówiony'
        CONFIRMED = 'CON', 'Potwierdzony'

    collaborator = models.ForeignKey(Collaborator, on_delete=models.CASCADE, related_name='assignments', verbose_name="Współtwórca")
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='crew_assignments', verbose_name="Projekt")
    role_description = models.CharField(max_length=150, blank=True, null=True, verbose_name="Zakres obowiązków")
    status = models.CharField(max_length=3, choices=Status.choices, default=Status.INVITED, verbose_name="Status")
    fee = models.DecimalField(max_digits=8, decimal_places=0, blank=True, null=True, verbose_name="Wynagrodzenie")

    class Meta:
        verbose_name = "Przydział Współtwórcy"
        verbose_name_plural = "Przydziały Współtwórców"
        constraints = [models.UniqueConstraint(fields=['collaborator', 'project'], name='unique_crew_assignment')]