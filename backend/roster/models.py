# roster/models.py
# ==========================================
# Roster & Logistics Database Models
# ==========================================
"""
Database models for the Roster application.
@author Krystian Bugalski

Manages the core HR and logistical entities for the vocal ensemble, including 
artists, projects, participation contracts, casting, and rehearsal scheduling.
"""
import uuid

from django.utils import timezone
from django.db import models
from django.contrib.auth.models import User
from django.conf import settings

from core.models import EnterpriseBaseModel
from core.constants import VoiceLine


class VoiceType(models.TextChoices):
    """Enumeration for general vocal classifications."""
    SOPRANO = 'SOP', 'Sopran'
    MEZZO = 'MEZ', 'Mezzosopran'
    ALTO = 'ALT', 'Alt'
    COUNTERTENOR = 'CT', 'Kontratenor'
    TENOR = 'TEN', 'Tenor'
    BARITONE = 'BAR', 'Baryton'
    BASS = 'BAS', 'Bas'
    CONDUCTOR = 'DIR', 'Dyrygent'


class Artist(EnterpriseBaseModel):
    """
    Represents a vocal ensemble member and their specific musical capabilities.
    Automatically provisions and links a Django User model for platform access.
    """
    user = models.OneToOneField(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='artist_profile', 
        verbose_name="Konto"
    )
    first_name = models.CharField(max_length=50, verbose_name="Imię")
    last_name = models.CharField(max_length=50, verbose_name="Nazwisko")
    email = models.EmailField(unique=True, verbose_name="E-mail")
    phone_number = models.CharField(max_length=15, blank=True, null=True, verbose_name="Telefon")
    voice_type = models.CharField(max_length=5, choices=VoiceType.choices, verbose_name="Rodzaj głosu")
    is_active = models.BooleanField(default=True, verbose_name="Aktywny")

    # --- VOCAL PROFILE DATA ---
    sight_reading_skill = models.IntegerField(
        choices=[(i, str(i)) for i in range(1, 6)], 
        blank=True, 
        null=True, 
        verbose_name="Czytanie a vista (1-5)"
    )
    vocal_range_bottom = models.CharField(max_length=5, blank=True, null=True, help_text="np. G2", verbose_name="Skala (dół)")
    vocal_range_top = models.CharField(max_length=5, blank=True, null=True, help_text="np. C5", verbose_name="Skala (góra)")

    class Meta:
        verbose_name = "Artysta"
        verbose_name_plural = "Artyści"

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.get_voice_type_display()})"

    def save(self, *args, **kwargs):
        """
        Intercepts the save transaction to automatically provision a Django User account.
        Implements sequential collision resolution for usernames (e.g., jsmith, jsmith2).
        """
        if self.first_name and self.last_name and not self.user:
            base_username = f"{self.first_name[0].lower()}{self.last_name.lower()}"
            username = base_username.replace(' ', '')
            counter = 2
            
            while User.objects.filter(username=username).exists():
                username = f"{base_username}{counter}"
                counter += 1
                
            user = User.objects.create(username=username, email=self.email)
            default_password = getattr(settings, 'DEFAULT_ARTIST_PASSWORD', 'fallback_secure_password123')  
            user.set_password(default_password) 
            user.save()
            
            self.user = user
            
        super().save(*args, **kwargs)


class Project(EnterpriseBaseModel):
    """
    Represents a specific production lifecycle (e.g., event, concert series, recording session).
    Acts as the central entity for logistics, casting, and rehearsal associations.
    """
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Szkic / Planowany'
        ACTIVE = 'ACTIVE', 'W przygotowaniu'
        COMPLETED = 'DONE', 'Zrealizowany'
        CANCELLED = 'CANC', 'Anulowany'

    title = models.CharField(max_length=200, verbose_name="Nazwa Projektu")
    date_time = models.DateTimeField(verbose_name="Data i godzina wydarzenia", default=timezone.now)
    call_time = models.DateTimeField(blank=True, null=True, help_text="Godzina zbiórki", verbose_name="Call Time")
    dress_code_male = models.CharField(max_length=100, blank=True, null=True, verbose_name="Dress Code (Mężczyźni)")
    dress_code_female = models.CharField(max_length=100, blank=True, null=True, verbose_name="Dress Code (Kobiety)")
    location = models.CharField(max_length=200, blank=True, null=True, verbose_name="Lokalizacja")
    description = models.TextField(blank=True, null=True, verbose_name="Opis")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT, verbose_name="Status")
    run_sheet = models.JSONField(default=list, blank=True, verbose_name="Harmonogram Dnia (Run-sheet)")
    spotify_playlist_url = models.URLField(blank=True, null=True, help_text="Link do playlisty Spotify", verbose_name="Playlista (Spotify)")


    class Meta:
        verbose_name = "Projekt"
        verbose_name_plural = "Projekty"

    def __str__(self):
        return f"[{self.get_status_display()}] {self.title}"


class ProgramItem(models.Model):
    """Junction table mapping musical pieces to a project to form an ordered concert setlist."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.RESTRICT, related_name='program_items')
    piece = models.ForeignKey('archive.Piece', on_delete=models.RESTRICT, verbose_name="Utwór")
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
    """
    Junction table representing an artist's contractual involvement in a specific project.
    Stores negotiation status and financial remuneration (fees).
    """
    class Status(models.TextChoices):
        INVITED = 'INV', 'Zaproszony'
        CONFIRMED = 'CON', 'Potwierdzony'
        DECLINED = 'DEC', 'Odrzucił'

    artist = models.ForeignKey(Artist, on_delete=models.RESTRICT, related_name='participations', verbose_name="Artysta")
    project = models.ForeignKey(Project, on_delete=models.RESTRICT, related_name='participations', verbose_name="Projekt")
    status = models.CharField(max_length=3, choices=Status.choices, default=Status.INVITED, verbose_name="Status")
    fee = models.DecimalField(max_digits=8, decimal_places=0, blank=True, null=True, verbose_name="Wynagrodzenie")

    class Meta:
        verbose_name = "Uczestnictwo"
        verbose_name_plural = "Uczestnictwa"
        constraints = [models.UniqueConstraint(fields=['artist', 'project'], name='unique_project_participation')]

    def __str__(self):
        return f"{self.artist.last_name} -> {self.project.title}"


class ProjectPieceCasting(models.Model):
    """
    Micro-casting resolution table. 
    Assigns a specific vocal line (divisi) and role to an artist for an individual piece within a project.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    participation = models.ForeignKey(Participation, on_delete=models.RESTRICT, related_name='castings', verbose_name="Uczestnik")
    piece = models.ForeignKey('archive.Piece', on_delete=models.RESTRICT, related_name='castings', verbose_name="Utwór")
    voice_line = models.CharField(max_length=5, choices=VoiceLine.choices, verbose_name="Linia melodyczna (Divisi)")
    gives_pitch = models.BooleanField(default=False, verbose_name="Daje dźwięk (Kamerton)")
    notes = models.CharField(max_length=200, blank=True, null=True, verbose_name="Notatki")

    class Meta:
        verbose_name = "Obsada Utworu"
        verbose_name_plural = "Obsady Utworów"
        # Unique constraint is intentionally omitted to support edge cases where an artist splits divisi mid-piece.


class Rehearsal(EnterpriseBaseModel):
    """Represents a scheduled rehearsal session contextualized to a specific project."""
    project = models.ForeignKey(Project, on_delete=models.RESTRICT, related_name='rehearsals', verbose_name="Projekt")
    date_time = models.DateTimeField(verbose_name="Data i godzina")
    location = models.CharField(max_length=200, verbose_name="Sala prób")
    focus = models.CharField(max_length=200, blank=True, null=True, verbose_name="Cel próby")
    is_mandatory = models.BooleanField(default=True, verbose_name="Obowiązkowa")

    invited_participations = models.ManyToManyField(
        'Participation', 
        blank=True, 
        related_name='invited_rehearsals',
        verbose_name="Wezwani chórzyści"
    )
    
    class Meta:
        verbose_name = "Próba"
        verbose_name_plural = "Próby"
        ordering = ['date_time']

    def __str__(self):
        return f"Próba: {self.date_time.strftime('%d.%m %H:%M')}"


class Attendance(models.Model):
    """Tracks individual attendance and absence justifications for rehearsal sessions."""
    class Status(models.TextChoices):
        PRESENT = 'PRESENT', 'Obecny'
        LATE = 'LATE', 'Spóźniony'
        ABSENT = 'ABSENT', 'Nieobecny'
        EXCUSED = 'EXCUSED', 'Usprawiedliwiony'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rehearsal = models.ForeignKey(Rehearsal, on_delete=models.RESTRICT, related_name='attendances', verbose_name="Próba")
    participation = models.ForeignKey(Participation, on_delete=models.RESTRICT, related_name='attendances', verbose_name="Uczestnik")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PRESENT, verbose_name="Status")
    minutes_late = models.PositiveIntegerField(blank=True, null=True, verbose_name="Minuty spóźnienia")
    excuse_note = models.CharField(max_length=255, blank=True, null=True, verbose_name="Powód nieobecności (Notatka chórzysty)")

    class Meta:
        verbose_name = "Obecność"
        verbose_name_plural = "Obecności"
        constraints = [models.UniqueConstraint(fields=['rehearsal', 'participation'], name='unique_rehearsal_attendance')]


class Collaborator(EnterpriseBaseModel):
    """Defines external production staff (e.g., sound engineers, lighting designers, instrumentalists)."""
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


class CrewAssignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    class Status(models.TextChoices):
        INVITED = 'INV', 'Wstępnie umówiony'
        CONFIRMED = 'CON', 'Potwierdzony'

    # Zmiana z RESTRICT na CASCADE, by usunięcie projektu usuwało powiązania ekipy
    collaborator = models.ForeignKey(Collaborator, on_delete=models.CASCADE, related_name='assignments', verbose_name="Współtwórca")
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='crew_assignments', verbose_name="Projekt")
    role_description = models.CharField(max_length=150, blank=True, null=True, verbose_name="Zakres obowiązków")
    status = models.CharField(max_length=3, choices=Status.choices, default=Status.INVITED, verbose_name="Status")
    fee = models.DecimalField(max_digits=8, decimal_places=0, blank=True, null=True, verbose_name="Stawka (PLN)")

    class Meta:
        verbose_name = "Przypisanie ekipy"
        verbose_name_plural = "Przypisania ekipy"