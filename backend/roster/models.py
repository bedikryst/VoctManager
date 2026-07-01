# roster/models.py
# ==========================================
# Roster & Logistics Database Models
# Standard: Enterprise SaaS 2026
# ==========================================
"""
Database models for HR and Logistics entities.
"""
import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from core.constants import VoiceLine
from core.models import EnterpriseBaseModel

DEFAULT_EVENT_TIMEZONE = 'Europe/Warsaw'


def validate_pdf_file_size(value) -> None:
    """Validates uploaded PDF size against the environment-configured limit."""
    max_size_mb = getattr(settings, 'MAX_UPLOAD_SIZE_MB', 50)
    max_size_bytes = max_size_mb * 1024 * 1024
    if value.size > max_size_bytes:
        raise ValidationError(
            _('File size must be under %(size)s MB. Current: %(current)s MB') % {
                'size': max_size_mb,
                'current': round(value.size / (1024 * 1024), 2),
            }
        )


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
    first_name_vocative = models.CharField(
        max_length=50, blank=True,
        verbose_name=_("First Name (Vocative)"),
        help_text=_("Polish vocative form, e.g. 'Krystianie' for 'Krystian'. Used in personalized greetings and emails.")
    )

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
    timezone = models.CharField(
        max_length=63,
        default=DEFAULT_EVENT_TIMEZONE,
        help_text=_("Local timezone for this project's primary location. Critical for UI rendering and iCal feeds.")
    )    
    dress_code_male = models.CharField(max_length=100, blank=True, verbose_name=_("Dress Code (Male)"))
    dress_code_female = models.CharField(max_length=100, blank=True, verbose_name=_("Dress Code (Female)"))
    conductor = models.ForeignKey(
        'Artist',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='conducted_projects',
        limit_choices_to={'voice_type': VoiceType.CONDUCTOR},
        verbose_name=_("Conductor"),
        help_text=_("The Maestro leading this project.")
    )
    location = models.ForeignKey(
        'logistics.Location',
        on_delete=models.RESTRICT,
        null=True,
        blank=True,
        related_name='projects',
        help_text=_("Primary location for the project. Dictates the default timezone.")
    )
    description = models.TextField(blank=True, verbose_name=_("Description"))
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT, verbose_name=_("Status"))
    reminder_sent_at = models.DateTimeField(
        null=True, blank=True, db_index=True,
        help_text=_("When the automated upcoming-event reminder was dispatched. Null = not yet sent.")
    )
    run_sheet = models.JSONField(default=list, blank=True, verbose_name=_("Run-sheet"))
    spotify_playlist_url = models.URLField(blank=True, help_text=_("Spotify playlist URL"), verbose_name=_("Spotify Playlist"))
    score_pdf = models.FileField(
        upload_to='project_scores/',
        blank=True,
        null=True,
        validators=[FileExtensionValidator(['pdf']), validate_pdf_file_size],
        verbose_name=_("Score PDF"),
        help_text=_("Main concert program PDF. In the future: auto-generated from piece sheets and analyzed by AI.")
    )

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

    # --- Score-package build cockpit (Phase 3). Per-item overrides of the
    #     package defaults; all nullable/blank so an untouched item simply
    #     inherits the package's settings and the auto-selected edition. ---
    score_edition = models.ForeignKey(
        'archive.ScoreEdition', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='+',
        help_text=_("Explicit edition to bind for this piece. Blank = auto-select the default edition."),
        verbose_name=_("Score Edition"),
    )
    pdf_page_start = models.PositiveSmallIntegerField(
        null=True, blank=True,
        help_text=_("1-based first source page to bind (trims publisher front matter). Blank = page 1."),
        verbose_name=_("PDF Page Start"),
    )
    pdf_page_end = models.PositiveSmallIntegerField(
        null=True, blank=True,
        help_text=_("1-based last source page to bind (inclusive). Blank = last page."),
        verbose_name=_("PDF Page End"),
    )
    section_label = models.CharField(
        max_length=80, blank=True,
        help_text=_("Section heading shown as the card eyebrow, e.g. 'LITURGIA EUCHARYSTYCZNA'. Blank = the piece's text source."),
        verbose_name=_("Section Label"),
    )
    role_prefix = models.CharField(
        max_length=60, blank=True,
        help_text=_("Liturgical/role prefix shown before the title, e.g. 'Ofiarowanie:'."),
        verbose_name=_("Role Prefix"),
    )
    card_enabled = models.BooleanField(
        null=True, blank=True,
        help_text=_("Per-item override of the package's card master switch. Null = inherit."),
        verbose_name=_("Card Enabled"),
    )
    card_elements = models.JSONField(
        null=True, blank=True,
        help_text=_("Explicit list of card element keys to render for this item. Null = derive from the package's card toggles."),
        verbose_name=_("Card Elements"),
    )
    text_override = models.TextField(
        blank=True,
        help_text=_("Replaces the original text on this item's card for this concert."),
        verbose_name=_("Text Override"),
    )
    note_override = models.TextField(
        blank=True,
        help_text=_("Replaces the programme note on this item's card for this concert."),
        verbose_name=_("Note Override"),
    )

    class Meta:
        ordering = ['order']
        verbose_name = _("Program Item")
        verbose_name_plural = _("Concert Program (Setlist)")
        constraints = [
            models.UniqueConstraint(fields=['project', 'order'], name='unique_order_per_project')
        ]

    def __str__(self):
        return f"{self.order}. {self.piece.title}"


class ScorePackage(EnterpriseBaseModel):
    """
    Configuration + build state for a Project's auto-assembled concert score book.

    One package per Project. The generated PDF itself is stored on
    ``Project.score_pdf`` (served, gated, through the existing ``score_pdf``
    action) — this row only holds the conductor's chosen settings, the async
    build status, and a content hash of the inputs, so the output can be flagged
    stale when the repertoire or settings change.

    @architecture Enterprise SaaS 2026
    @module roster/ScorePackage
    """

    class Status(models.TextChoices):
        IDLE     = 'IDLE', _('Not generated')
        QUEUED   = 'QUED', _('Queued')
        BUILDING = 'BLDG', _('Building')
        READY    = 'RDY', _('Ready')
        FAILED   = 'FAIL', _('Failed')

    class Density(models.TextChoices):
        CONCERT = 'CONCERT', _('Concert — frontispiece per piece')
        MASS    = 'MASS',    _('Mass — light dividers, consolidated texts')

    project = models.OneToOneField(
        Project,
        on_delete=models.CASCADE,
        related_name='score_package',
        verbose_name=_("Project"),
    )

    # --- Layout configuration. Phase 1 honours the booleans below; `density_mode`
    #     is persisted now but only drives the per-piece frontispiece work in Phase 2. ---
    density_mode = models.CharField(
        max_length=8, choices=Density.choices, default=Density.CONCERT,
        verbose_name=_("Density Mode"),
    )
    include_title_page = models.BooleanField(default=True, verbose_name=_("Title Page"))
    include_toc = models.BooleanField(default=True, verbose_name=_("Table of Contents"))
    include_page_numbers = models.BooleanField(default=True, verbose_name=_("Page Numbers"))
    include_bookmarks = models.BooleanField(default=True, verbose_name=_("PDF Bookmarks"))
    normalize_to_a4 = models.BooleanField(
        default=True,
        help_text=_("Scale and centre every source page onto a uniform A4 sheet so the "
                    "assembled book does not 'wobble' between differently-sized editions."),
        verbose_name=_("Normalize to A4"),
    )
    duplex_mode = models.BooleanField(
        default=False,
        help_text=_("Lay the book out for double-sided printing: the page number moves to "
                    "the outer bottom corner (recto-right / verso-left) behind a white "
                    "knockout for legibility, and — in Concert density — every piece opens "
                    "on a right-hand page (a blank verso is inserted where needed)."),
        verbose_name=_("Double-sided print"),
    )

    # --- Per-piece text content (Phase 2). `include_cards` is the master switch;
    #     `density_mode` then decides CONCERT (a frontispiece before each piece) vs
    #     MASS (one consolidated "Teksty i tłumaczenia" section in the front matter). ---
    include_cards = models.BooleanField(
        default=True,
        help_text=_("Render per-piece text content (frontispiece in CONCERT mode, "
                    "consolidated texts section in MASS mode)."),
        verbose_name=_("Include Text Content"),
    )
    card_include_text = models.BooleanField(default=True, verbose_name=_("Card: Original Text"))
    card_include_translation = models.BooleanField(default=True, verbose_name=_("Card: Translation"))
    card_include_program_note = models.BooleanField(default=True, verbose_name=_("Card: Programme Note"))
    translation_language = models.CharField(
        max_length=8, default='pl',
        help_text=_("ISO 639-1 code of the translation/programme-note language shown on the cards."),
        verbose_name=_("Card Language"),
    )

    # --- Async build state ---
    status = models.CharField(
        max_length=4, choices=Status.choices, default=Status.IDLE,
        db_index=True, verbose_name=_("Build Status"),
    )
    error = models.TextField(blank=True, verbose_name=_("Build Error"))
    source_hash = models.CharField(
        max_length=64, blank=True,
        help_text=_("SHA-256 of the inputs (ordered repertoire, chosen editions, settings) "
                    "that produced the current score_pdf. The output is stale when the live "
                    "hash differs from this value."),
        verbose_name=_("Source Hash"),
    )
    page_count = models.PositiveIntegerField(null=True, blank=True, verbose_name=_("Page Count"))
    generated_at = models.DateTimeField(null=True, blank=True, verbose_name=_("Generated At"))

    # --- Distribution trail. Singers download the finished book through the gated
    #     `score_pdf` action; once they have it, a rebuild silently replaces what is
    #     already in their folders (and may shift page numbers). These let the
    #     cockpit stamp a version and warn — but only when the book is actually out. ---
    build_version = models.PositiveIntegerField(
        default=0,
        help_text=_("Increments on every successful build, so a printed/distributed copy "
                    "can be reconciled against the live book."),
        verbose_name=_("Build Version"),
    )
    distributed_at = models.DateTimeField(
        null=True, blank=True,
        help_text=_("When a non-manager (singer) first downloaded the current build. "
                    "Null until the book leaves the building; reset on every rebuild."),
        verbose_name=_("First Distributed At"),
    )
    is_manual_upload = models.BooleanField(
        default=False,
        help_text=_("True when the current score_pdf was hand-uploaded by the conductor "
                    "rather than assembled by the generator. The cockpit then shows "
                    "'manually uploaded' instead of a (meaningless) build version / "
                    "staleness, and the two paths stop fighting over project.score_pdf."),
        verbose_name=_("Manually Uploaded"),
    )

    class Meta:
        verbose_name = _("Score Package")
        verbose_name_plural = _("Score Packages")

    def __str__(self) -> str:
        return f"Score package · {self.project.title} [{self.get_status_display()}]"


class Participation(EnterpriseBaseModel):
    class Status(models.TextChoices):
        INVITED = 'INV', _('Invited')
        CONFIRMED = 'CON', _('Confirmed')
        DECLINED = 'DEC', _('Declined')

    artist = models.ForeignKey(Artist, on_delete=models.RESTRICT, related_name='participations', verbose_name=_("Artist"))
    project = models.ForeignKey(Project, on_delete=models.RESTRICT, related_name='participations', verbose_name=_("Project"))
    status = models.CharField(max_length=3, choices=Status.choices, default=Status.INVITED, verbose_name=_("Status"))
    fee = models.DecimalField(max_digits=8, decimal_places=2, blank=True, null=True, verbose_name=_("Fee"))
    is_paid = models.BooleanField(
        default=False,
        verbose_name=_("Is Paid"),
        help_text=_("Whether the agreed fee for this participation has been settled.")
    )
    paid_at = models.DateTimeField(
        blank=True, null=True,
        verbose_name=_("Paid At"),
        help_text=_("Timestamp the fee was marked as settled. Cleared if the payment is reverted.")
    )

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


class PieceReadiness(models.Model):
    """
    Artist self-reported practice readiness for a single piece within a project.
    Powers the chorister's Songbook checklist and the conductor's pre-rehearsal
    readiness heatmap. One row per (participation, piece); upserted by the artist.
    """

    class Status(models.TextChoices):
        NOT_STARTED = 'NOT_STARTED', _('Not started')
        IN_PROGRESS = 'IN_PROGRESS', _('In progress')
        READY = 'READY', _('Ready / Knows the part')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    participation = models.ForeignKey(
        Participation, on_delete=models.CASCADE, related_name='piece_readiness', verbose_name=_("Participant")
    )
    piece = models.ForeignKey(
        'archive.Piece', on_delete=models.CASCADE, related_name='readiness_entries', verbose_name=_("Piece")
    )
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.NOT_STARTED, verbose_name=_("Readiness")
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("Piece Readiness")
        verbose_name_plural = _("Piece Readiness")
        constraints = [
            models.UniqueConstraint(fields=['participation', 'piece'], name='unique_participation_piece_readiness')
        ]
        indexes = [
            models.Index(fields=['participation', 'piece']),
        ]

    def __str__(self):
        return f"{self.participation} / {self.piece_id}: {self.status}"


class Rehearsal(EnterpriseBaseModel):
    project = models.ForeignKey(Project, on_delete=models.RESTRICT, related_name='rehearsals', verbose_name=_("Project"))
    date_time = models.DateTimeField(verbose_name=_("Date & Time"))
    timezone = models.CharField(
        max_length=63,
        default=DEFAULT_EVENT_TIMEZONE,
        help_text=_("Local timezone for this specific rehearsal. Essential for tours crossing multiple timezones.")
    )
    location = models.ForeignKey(
        'logistics.Location',
        on_delete=models.RESTRICT,
        null=True,
        blank=True,
        related_name='rehearsals',
        help_text=_("Specific location for this rehearsal. Overrides project default if needed.")
    )
    focus = models.CharField(max_length=200, blank=True, verbose_name=_("Rehearsal Focus"))
    is_mandatory = models.BooleanField(default=True, verbose_name=_("Is Mandatory"))
    reminder_sent_at = models.DateTimeField(
        null=True, blank=True, db_index=True,
        help_text=_("When the automated upcoming-rehearsal reminder was dispatched. Null = not yet sent.")
    )
    invited_participations = models.ManyToManyField(
        Participation, blank=True, related_name='invited_rehearsals', verbose_name=_("Invited Singers")
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
    is_paid = models.BooleanField(
        default=False,
        verbose_name=_("Is Paid"),
        help_text=_("Whether the agreed fee for this assignment has been settled.")
    )
    paid_at = models.DateTimeField(
        blank=True, null=True,
        verbose_name=_("Paid At"),
        help_text=_("Timestamp the fee was marked as settled. Cleared if the payment is reverted.")
    )

    class Meta:
        verbose_name = _("Crew Assignment")
        verbose_name_plural = _("Crew Assignments")
        indexes = [
            models.Index(fields=['project', 'status']),
        ]