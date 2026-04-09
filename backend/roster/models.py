# roster/models.py
# ==========================================
# Roster & Logistics Database Models
# Standard: Enterprise SaaS 2026
# ==========================================
"""
Database models for HR and Logistics entities.
"""
import uuid
from django.utils import timezone
from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _

from core.models import EnterpriseBaseModel
from core.constants import VoiceLine


class VoiceType(models.TextChoices):
    SOPRANO = 'SOP', _('Soprano')
    MEZZO = 'MEZ', _('Mezzo-Soprano')
    ALTO = 'ALT', _('Alto')
    COUNTERTENOR = 'CT', _('Countertenor')
    TENOR = 'TEN', _('Tenor')
    BARITONE = 'BAR', _('Baritone')
    BASS = 'BAS', _('Bass')
    CONDUCTOR = 'DIR', _('Conductor')


class Artist(EnterpriseBaseModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='artist_profile', 
        verbose_name=_("Account"),
        help_text=_("Linked authentication identity. SET_NULL preserves historical HR data if account is deleted.")
    )
    first_name = models.CharField(max_length=50, verbose_name=_("First Name"))
    last_name = models.CharField(max_length=50, verbose_name=_("Last Name"))
    
    # Removed standard unique=True to prevent SoftDelete ghost conflicts. Handled in Meta.
    email = models.EmailField(verbose_name=_("Email")) 
    
    phone_number = models.CharField(max_length=15, blank=True, verbose_name=_("Phone"))
    voice_type = models.CharField(max_length=5, choices=VoiceType.choices, verbose_name=_("Voice Type"))
    is_active = models.BooleanField(default=True, verbose_name=_("Is Active"))

    sight_reading_skill = models.IntegerField(
        choices=[(i, str(i)) for i in range(1, 6)], 
        blank=True, null=True, verbose_name=_("Sight Reading Skill (1-5)")
    )
    vocal_range_bottom = models.CharField(max_length=5, blank=True, help_text=_("e.g. G2"), verbose_name=_("Range (Bottom)"))
    vocal_range_top = models.CharField(max_length=5, blank=True, help_text=_("e.g. C5"), verbose_name=_("Range (Top)"))

    class Meta:
        verbose_name = _("Artist")
        verbose_name_plural = _("Artists")
        constraints = [
            # Enterprise Solution: Ensures email is unique ONLY among non-deleted artists
            models.UniqueConstraint(
                fields=['email'],
                condition=models.Q(is_deleted=False),
                name='unique_active_artist_email'
            )
        ]

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.get_voice_type_display()})"


class Project(EnterpriseBaseModel):
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', _('Draft / Planned')
        ACTIVE = 'ACTIVE', _('Active / In Prep')
        COMPLETED = 'DONE', _('Completed')
        CANCELLED = 'CANC', _('Cancelled')

    title = models.CharField(max_length=200, verbose_name=_("Project Title"))
    date_time = models.DateTimeField(verbose_name=_("Event Date & Time"), default=timezone.now)
    call_time = models.DateTimeField(blank=True, null=True, help_text=_("Call time for performers"), verbose_name=_("Call Time"))
    dress_code_male = models.CharField(max_length=100, blank=True, verbose_name=_("Dress Code (Male)"))
    dress_code_female = models.CharField(max_length=100, blank=True, verbose_name=_("Dress Code (Female)"))
    location = models.CharField(max_length=200, blank=True, verbose_name=_("Location"))
    description = models.TextField(blank=True, verbose_name=_("Description"))
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT, verbose_name=_("Status"))
    run_sheet = models.JSONField(default=list, blank=True, verbose_name=_("Run-sheet"))
    spotify_playlist_url = models.URLField(blank=True, help_text=_("Spotify playlist URL"), verbose_name=_("Spotify Playlist"))

    class Meta:
        verbose_name = _("Project")
        verbose_name_plural = _("Projects")
        indexes = [
            # Speeds up dashboard queries filtering by status and ordering by date
            models.Index(fields=['status', 'date_time']),
        ]

    def __str__(self):
        return f"[{self.get_status_display()}] {self.title}"


class ProgramItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.RESTRICT, related_name='program_items')
    piece = models.ForeignKey('archive.Piece', on_delete=models.RESTRICT, verbose_name=_("Piece"))
    order = models.PositiveIntegerField(verbose_name=_("Order (1, 2, 3...)"))
    is_encore = models.BooleanField(default=False, verbose_name=_("Is Encore?"))

    class Meta:
        ordering = ['order']
        verbose_name = _("Program Item")
        verbose_name_plural = _("Concert Program (Setlist)")
        constraints = [
            models.UniqueConstraint(fields=['project', 'order'], name='unique_order_per_project')
        ]

    def __str__(self):
        return f"{self.order}. {self.piece.title}"


class Participation(EnterpriseBaseModel):
    class Status(models.TextChoices):
        INVITED = 'INV', _('Invited')
        CONFIRMED = 'CON', _('Confirmed')
        DECLINED = 'DEC', _('Declined')

    artist = models.ForeignKey(Artist, on_delete=models.RESTRICT, related_name='participations', verbose_name=_("Artist"))
    project = models.ForeignKey(Project, on_delete=models.RESTRICT, related_name='participations', verbose_name=_("Project"))
    status = models.CharField(max_length=3, choices=Status.choices, default=Status.INVITED, verbose_name=_("Status"))
    fee = models.DecimalField(max_digits=8, decimal_places=2, blank=True, null=True, verbose_name=_("Fee"))

    class Meta:
        verbose_name = _("Participation")
        verbose_name_plural = _("Participations")
        constraints = [
            # Ensure an artist is only invited to a project once
            models.UniqueConstraint(
                fields=['artist', 'project'], 
                condition=models.Q(is_deleted=False),
                name='unique_active_project_participation'
            )
        ]

    def __str__(self):
        return f"{self.artist.last_name} -> {self.project.title}"


class ProjectPieceCasting(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    participation = models.ForeignKey(Participation, on_delete=models.RESTRICT, related_name='castings', verbose_name=_("Participant"))
    piece = models.ForeignKey('archive.Piece', on_delete=models.RESTRICT, related_name='castings', verbose_name=_("Piece"))
    voice_line = models.CharField(max_length=5, choices=VoiceLine.choices, verbose_name=_("Voice Line (Divisi)"))
    gives_pitch = models.BooleanField(default=False, verbose_name=_("Gives Pitch (Tuning Fork)"))
    notes = models.CharField(max_length=200, blank=True, verbose_name=_("Notes"))

    class Meta:
        verbose_name = _("Piece Casting")
        verbose_name_plural = _("Piece Castings")
        indexes = [
            models.Index(fields=['participation', 'piece']),
        ]


class Rehearsal(EnterpriseBaseModel):
    project = models.ForeignKey(Project, on_delete=models.RESTRICT, related_name='rehearsals', verbose_name=_("Project"))
    date_time = models.DateTimeField(verbose_name=_("Date & Time"))
    location = models.CharField(max_length=200, verbose_name=_("Rehearsal Venue"))
    focus = models.CharField(max_length=200, blank=True, verbose_name=_("Rehearsal Focus"))
    is_mandatory = models.BooleanField(default=True, verbose_name=_("Is Mandatory"))
    invited_participations = models.ManyToManyField(
        'Participation', blank=True, related_name='invited_rehearsals', verbose_name=_("Invited Singers")
    )
    
    class Meta:
        verbose_name = _("Rehearsal")
        verbose_name_plural = _("Rehearsals")
        ordering = ['date_time']
        indexes = [
            models.Index(fields=['project', 'date_time']),
        ]

    def __str__(self):
        return f"Rehearsal: {self.date_time.strftime('%d.%m %H:%M')}"


class Attendance(models.Model):
    class Status(models.TextChoices):
        PRESENT = 'PRESENT', _('Present')
        LATE = 'LATE', _('Late')
        ABSENT = 'ABSENT', _('Absent')
        EXCUSED = 'EXCUSED', _('Excused')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rehearsal = models.ForeignKey(Rehearsal, on_delete=models.RESTRICT, related_name='attendances', verbose_name=_("Rehearsal"))
    participation = models.ForeignKey(Participation, on_delete=models.RESTRICT, related_name='attendances', verbose_name=_("Participant"))
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PRESENT, verbose_name=_("Status"))
    minutes_late = models.PositiveIntegerField(blank=True, null=True, verbose_name=_("Minutes Late"))
    excuse_note = models.CharField(max_length=255, blank=True, verbose_name=_("Excuse Note"))

    class Meta:
        verbose_name = _("Attendance")
        verbose_name_plural = _("Attendances")
        constraints = [
            models.UniqueConstraint(fields=['rehearsal', 'participation'], name='unique_rehearsal_attendance')
        ]
        indexes = [
            models.Index(fields=['rehearsal', 'status']), # Performance optimization for conductor dashboards
        ]


class Collaborator(EnterpriseBaseModel):
    class Specialty(models.TextChoices):
        SOUND = 'SOUND', _('Sound Engineering')
        LIGHT = 'LIGHT', _('Lighting Design')
        VISUALS = 'VISUALS', _('Visual Arts')
        INSTRUMENT = 'INSTRUMENT', _('Instrumentalist')
        LOGISTICS = 'LOGISTICS', _('Logistics')
        OTHER = 'OTHER', _('Other')

    first_name = models.CharField(max_length=50, verbose_name=_("First Name"))
    last_name = models.CharField(max_length=50, verbose_name=_("Last Name"))
    email = models.EmailField(blank=True, null=True, verbose_name=_("Email")) # Removed unique=True
    phone_number = models.CharField(max_length=15, blank=True, verbose_name=_("Phone"))
    company_name = models.CharField(max_length=100, blank=True, verbose_name=_("Company / Brand"))
    specialty = models.CharField(max_length=15, choices=Specialty.choices, default=Specialty.OTHER, verbose_name=_("Specialty"))

    class Meta:
        verbose_name = _("Collaborator (Crew)")
        verbose_name_plural = _("Collaborators")
        constraints = [
            models.UniqueConstraint(
                fields=['email'],
                condition=models.Q(is_deleted=False) & models.Q(email__isnull=False),
                name='unique_active_collaborator_email'
            )
        ]

    def __str__(self):
        return f"{self.first_name} {self.last_name}"


class CrewAssignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    class Status(models.TextChoices):
        INVITED = 'INV', _('Tentatively Booked')
        CONFIRMED = 'CON', _('Confirmed')
        
    collaborator = models.ForeignKey(Collaborator, on_delete=models.CASCADE, related_name='assignments', verbose_name=_("Collaborator"))
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='crew_assignments', verbose_name=_("Project"))
    role_description = models.CharField(max_length=150, blank=True, verbose_name=_("Role Description"))
    status = models.CharField(max_length=3, choices=Status.choices, default=Status.INVITED, verbose_name=_("Status"))
    fee = models.DecimalField(max_digits=8, decimal_places=2, blank=True, null=True, verbose_name=_("Fee"))

    class Meta:
        verbose_name = _("Crew Assignment")
        verbose_name_plural = _("Crew Assignments")
        indexes = [
            models.Index(fields=['project', 'status']),
        ]