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

from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from core.constants import VoiceLine
from core.models import EnterpriseBaseModel


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


class IngestionStatus(models.TextChoices):
    PENDING    = 'PEND', _('Pending')
    EXTRACTING = 'EXTR', _('Extracting metadata')
    ENRICHING  = 'ENRI', _('Looking up external sources')
    GENERATING = 'GENR', _('Generating program note & translations')
    AWAITING   = 'AWAI', _('Awaiting conductor review')
    READY      = 'RDY ', _('Ready')
    FAILED     = 'FAIL', _('Failed')


class IngestionProgress(models.TextChoices):
    """Fine-grained, human-facing label for the step the pipeline is on *right
    now* — the live "what is the AI doing?" signal, streamed to the UI over SSE.

    Distinct from `IngestionStatus` (the coarse, persisted phase). Empty string
    = no step active (queued, or terminal). `WAITING_OVERLOAD` is special: the
    step did not change, but Claude is temporarily overloaded and we are waiting
    to retry — the UI shows this so a long pause never looks like a freeze."""
    PREPARING        = 'preparing',        _('Preparing the document')
    ANALYZING        = 'analyzing',        _('Reading the score (AI)')
    RESOLVING        = 'resolving',        _('Matching against MusicBrainz & Wikidata')
    PERSISTING       = 'persisting',       _('Saving the results')
    PROGRAM_NOTE     = 'program_note',     _('Writing the programme note')
    RECORDINGS       = 'recordings',       _('Finding reference recordings')
    WAITING_OVERLOAD = 'waiting_overload', _('AI service is busy — retrying shortly')


class ProvenanceSource(models.TextChoices):
    MANUAL      = 'MAN', _('Manual entry')
    AI_HAIKU    = 'AIH', _('AI — Haiku 4.5')
    AI_SONNET   = 'AIS', _('AI — Sonnet 4.6')
    AI_OPUS     = 'AIO', _('AI — Opus 4.7')
    MUSICBRAINZ = 'MBZ', _('MusicBrainz')
    WIKIDATA    = 'WKD', _('Wikidata')
    SPOTIFY     = 'SPF', _('Spotify Web API')
    YOUTUBE     = 'YTB', _('YouTube Data API')
    IMSLP       = 'IMS', _('IMSLP')


class Composer(EnterpriseBaseModel):
    """
    Dictionary entity representing a musical composer or arranger.
    Enriched on demand from canonical external sources (MusicBrainz, Wikidata).
    """
    first_name = models.CharField(max_length=100, blank=True, verbose_name=_("First Name"))
    last_name = models.CharField(max_length=100, verbose_name=_("Last Name"))
    birth_year = models.CharField(max_length=50, blank=True, help_text=_("e.g. 1885"), verbose_name=_("Birth Year"))
    death_year = models.CharField(max_length=50, blank=True, verbose_name=_("Death Year"))

    # Canonical identity — highest-priority dedup key when present.
    mbid = models.UUIDField(null=True, blank=True, unique=True, verbose_name=_("MusicBrainz ID"))
    wikidata_qid = models.CharField(max_length=20, blank=True, db_index=True, verbose_name=_("Wikidata QID"))

    nationality = models.CharField(max_length=80, blank=True, verbose_name=_("Nationality"))
    period = models.CharField(max_length=4, choices=EpochChoices.choices, blank=True, verbose_name=_("Period"))
    bio = models.TextField(blank=True, verbose_name=_("Biography"))
    portrait_url = models.URLField(blank=True, verbose_name=_("Portrait URL"))
    portrait_license = models.CharField(max_length=40, blank=True, verbose_name=_("Portrait License"))
    # Alternative names for fuzzy match against AI-extracted strings ("J.S. Bach", "Bach, J.S.").
    aliases = models.JSONField(default=list, blank=True, verbose_name=_("Aliases"))

    class Meta:
        verbose_name = _("Composer")
        verbose_name_plural = _("Composers")
        ordering = ['last_name']
        indexes = [
            models.Index(fields=['last_name', 'first_name']),
        ]

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()


class Piece(EnterpriseBaseModel):
    """
    Aggregate Root for the musical repertoire.

    PDFs of this work live in [ScoreEdition] (one Piece → many editions,
    e.g. Bärenreiter, IMSLP scan, custom arrangement). Reference recordings
    live in [Recording]. Translations live in [Translation]. Ingestion status
    is per-edition — derived in the serializer if a piece-level signal is
    needed.
    """
    title = models.CharField(max_length=200, verbose_name=_("Title"))
    composer = models.ForeignKey(
        Composer,
        on_delete=models.RESTRICT,
        null=True,
        blank=True,
        related_name='pieces',
        verbose_name=_("Composer"),
    )
    arranger = models.CharField(max_length=150, blank=True, verbose_name=_("Arranger"))
    language = models.CharField(max_length=50, blank=True, help_text=_("e.g. Latin, English"), verbose_name=_("Language"))
    estimated_duration = models.PositiveIntegerField(blank=True, null=True, help_text=_("Duration in seconds"), verbose_name=_("Estimated Duration"))
    voicing = models.CharField(max_length=50, blank=True, help_text=_("e.g. SSAATTBB"), verbose_name=_("Voicing"))
    description = models.TextField(blank=True, verbose_name=_("Notes / Description"))

    lyrics_original = models.TextField(blank=True, help_text=_("Original sung text"), verbose_name=_("Lyrics (Original)"))

    composition_year = models.IntegerField(blank=True, null=True, verbose_name=_("Year of Composition"))
    epoch = models.CharField(max_length=4, choices=EpochChoices.choices, blank=True, verbose_name=_("Epoch"))

    # Canonical identity from MusicBrainz (one work can have many editions/recordings).
    mbid_work = models.UUIDField(null=True, blank=True, unique=True, verbose_name=_("MusicBrainz Work ID"))
    opus_catalog = models.CharField(
        max_length=40, blank=True,
        help_text=_("e.g. BWV 243, K. 626, Op. 110 No. 2"),
        verbose_name=_("Opus / Catalog"),
    )
    musical_key = models.CharField(
        max_length=20, blank=True,
        help_text=_("e.g. D major, F# minor"),
        verbose_name=_("Key"),
    )
    text_source = models.CharField(
        max_length=200, blank=True,
        help_text=_("e.g. Luke 1:46-55, Psalm 23"),
        verbose_name=_("Text Source"),
    )
    lyrics_ipa = models.TextField(
        blank=True,
        help_text=_("IPA pronunciation guide for the sung text"),
        verbose_name=_("Lyrics (IPA)"),
    )

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


# ==========================================================================
# Score Package Compiler — domain extensions
# Added 2026-05: AI-driven concert score assembly. See ARCHITECTURE.md.
# ==========================================================================


class Movement(EnterpriseBaseModel):
    """
    One movement of a multi-movement Piece (e.g., the 12 movements of Bach's Magnificat).
    Single-movement works use a single Movement with order_index=0.
    """
    piece = models.ForeignKey(
        Piece, on_delete=models.CASCADE, related_name='movements',
        verbose_name=_("Piece"),
    )
    order_index = models.PositiveIntegerField(verbose_name=_("Order"))
    title = models.CharField(max_length=200, verbose_name=_("Title"))
    tempo_marking = models.CharField(max_length=80, blank=True, verbose_name=_("Tempo Marking"))
    duration_seconds = models.PositiveIntegerField(null=True, blank=True, verbose_name=_("Duration (s)"))
    voicing_override = models.CharField(max_length=50, blank=True, verbose_name=_("Voicing Override"))
    starts_on_page = models.PositiveIntegerField(
        null=True, blank=True,
        help_text=_("Page in the source PDF where this movement begins"),
        verbose_name=_("Starts On Page"),
    )

    class Meta:
        verbose_name = _("Movement")
        verbose_name_plural = _("Movements")
        ordering = ['piece', 'order_index']
        constraints = [
            models.UniqueConstraint(
                fields=['piece', 'order_index'],
                condition=models.Q(is_deleted=False),
                name='unique_active_movement_order_per_piece',
            ),
        ]

    def __str__(self) -> str:
        return f"{self.piece.title} — {self.order_index + 1}. {self.title}"


class ScoreEdition(EnterpriseBaseModel):
    """
    A specific published PDF of a Piece (Bärenreiter vs. IMSLP scan vs. custom arrangement).
    One Piece can have many editions; conductors pick one per Concert.

    `piece` is nullable: at upload time the AI hasn't yet identified which
    work the PDF is. The Workflow A pipeline assigns it during
    `resolve_composer_and_piece`. A FAILED edition can stay pieceless.
    """
    piece = models.ForeignKey(
        Piece, on_delete=models.RESTRICT, related_name='editions',
        null=True, blank=True,
        verbose_name=_("Piece"),
    )
    pdf_file = models.FileField(
        upload_to='score_editions/',
        validators=[FileExtensionValidator(['pdf']), validate_file_size],
        verbose_name=_("PDF File"),
    )
    original_filename = models.CharField(max_length=255, verbose_name=_("Original Filename"))
    page_count = models.PositiveIntegerField(null=True, blank=True, verbose_name=_("Page Count"))
    publisher = models.CharField(max_length=120, blank=True, verbose_name=_("Publisher"))
    edition_year = models.PositiveIntegerField(null=True, blank=True, verbose_name=_("Edition Year"))
    editor_name = models.CharField(max_length=120, blank=True, verbose_name=_("Editor"))
    is_default = models.BooleanField(default=False, verbose_name=_("Default Edition"))
    sha256 = models.CharField(
        max_length=64, db_index=True,
        help_text=_("Hex SHA-256 of the uploaded PDF — used for dedup across uploads"),
        verbose_name=_("SHA-256"),
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='+',
        verbose_name=_("Uploaded By"),
    )
    ingestion_status = models.CharField(
        max_length=4, choices=IngestionStatus.choices,
        default=IngestionStatus.PENDING, db_index=True,
        verbose_name=_("Ingestion Status"),
    )
    ingestion_cost_cents = models.PositiveIntegerField(
        default=0,
        help_text=_("AI cost of the CURRENT ingestion run, in USD cents. "
                    "Reset to 0 on every (re)ingest — enforces the per-run ceiling."),
        verbose_name=_("Ingestion Cost — this run (¢)"),
    )
    ingestion_cost_cents_lifetime = models.PositiveIntegerField(
        default=0,
        help_text=_("Cumulative AI cost across ALL ingestion runs of this edition, "
                    "in USD cents. Never reset — the true money spent on this PDF."),
        verbose_name=_("Ingestion Cost — lifetime (¢)"),
    )
    ingestion_progress = models.CharField(
        max_length=20, blank=True, choices=IngestionProgress.choices,
        help_text=_("Fine-grained current pipeline step, for the live ingestion UI. "
                    "Blank when queued or finished."),
        verbose_name=_("Ingestion Progress Step"),
    )
    ingestion_run_started_at = models.DateTimeField(
        null=True, blank=True,
        help_text=_("When the CURRENT ingestion run was dispatched. Reset on every "
                    "(re)ingest — the live elapsed timer counts from here, not from "
                    "created_at (which, on a re-ingest, can be days old)."),
        verbose_name=_("Ingestion Run Started At"),
    )
    ingestion_error = models.TextField(blank=True, verbose_name=_("Ingestion Error"))

    class Meta:
        verbose_name = _("Score Edition")
        verbose_name_plural = _("Score Editions")
        constraints = [
            models.UniqueConstraint(
                fields=['piece'],
                condition=models.Q(is_default=True, is_deleted=False),
                name='one_default_edition_per_piece',
            ),
        ]
        indexes = [
            models.Index(fields=['piece', 'ingestion_status']),
        ]

    def __str__(self) -> str:
        suffix = f" ({self.publisher})" if self.publisher else ""
        title = self.piece.title if self.piece else _("Unassigned edition")
        return f"{title}{suffix}"


class Translation(EnterpriseBaseModel):
    """
    A translation of a Piece (or a single Movement) into a target language.
    Multiple translations per piece are common (English, French, Polish singers in one ensemble).
    """
    piece = models.ForeignKey(
        Piece, on_delete=models.CASCADE, related_name='translations',
        verbose_name=_("Piece"),
    )
    movement = models.ForeignKey(
        Movement, on_delete=models.CASCADE,
        null=True, blank=True, related_name='translations',
        verbose_name=_("Movement"),
    )
    target_language = models.CharField(
        max_length=8,
        help_text=_("ISO 639-1, e.g. 'en', 'pl', 'fr'"),
        verbose_name=_("Target Language"),
    )
    text = models.TextField(verbose_name=_("Translated Text"))
    is_singable = models.BooleanField(
        default=False,
        help_text=_("True if the translation preserves meter for singing; False if literal."),
        verbose_name=_("Singable"),
    )
    translator = models.CharField(
        max_length=120, blank=True,
        help_text=_("Credited translator, printed under the translation in concert materials."),
        verbose_name=_("Translator"),
    )

    class Meta:
        verbose_name = _("Translation")
        verbose_name_plural = _("Translations")
        indexes = [
            models.Index(fields=['piece', 'target_language']),
        ]

    def __str__(self) -> str:
        scope = self.movement.title if self.movement else self.piece.title
        return f"{scope} [{self.target_language}]"


class RecordingSource(models.TextChoices):
    SPOTIFY = 'SPF', _('Spotify')
    YOUTUBE = 'YTB', _('YouTube')
    APPLE   = 'APL', _('Apple Music')
    OTHER   = 'OTH', _('Other')


class Recording(EnterpriseBaseModel):
    """
    A specific recording of a Piece on Spotify / YouTube / etc.
    Replaces the single-URL fields on Piece (which remain for legacy compatibility).
    """
    piece = models.ForeignKey(
        Piece, on_delete=models.CASCADE, related_name='recordings',
        verbose_name=_("Piece"),
    )
    source = models.CharField(max_length=3, choices=RecordingSource.choices, verbose_name=_("Source"))
    external_id = models.CharField(max_length=100, db_index=True, verbose_name=_("External ID"))
    url = models.URLField(verbose_name=_("URL"))
    performer = models.CharField(max_length=200, blank=True, verbose_name=_("Performer / Ensemble"))
    year = models.PositiveIntegerField(null=True, blank=True, verbose_name=_("Year"))
    duration_seconds = models.PositiveIntegerField(null=True, blank=True, verbose_name=_("Duration (s)"))
    is_featured = models.BooleanField(default=False, verbose_name=_("Featured"))

    class Meta:
        verbose_name = _("Recording")
        verbose_name_plural = _("Recordings")
        constraints = [
            models.UniqueConstraint(
                fields=['source', 'external_id'],
                condition=models.Q(is_deleted=False),
                name='unique_active_recording_per_source',
            ),
        ]

    def __str__(self) -> str:
        return f"{self.piece.title} — {self.get_source_display()} ({self.performer or 'unknown'})"


class AnnotationType(models.TextChoices):
    HIGHLIGHT = 'HL', _('Highlight')
    COMMENT   = 'CM', _('Text Comment')
    FREEHAND  = 'FH', _('Freehand Pen')
    STAMP     = 'ST', _('Stamp / Symbol')


class Annotation(EnterpriseBaseModel):
    """
    A markup layer rendered on top of a ScoreEdition's PDF.
    Stored as data — never mutates the source PDF — and flattened into the
    final concert binder at compile time.
    """
    edition = models.ForeignKey(
        ScoreEdition, on_delete=models.CASCADE, related_name='annotations',
        verbose_name=_("Edition"),
    )
    page_number = models.PositiveIntegerField(verbose_name=_("Page Number"))
    annotation_type = models.CharField(max_length=2, choices=AnnotationType.choices, verbose_name=_("Type"))
    payload = models.JSONField(
        help_text=_(
            "Shape varies by annotation_type, validated + sanitized server-side: "
            "FH/HL store {paths:[[[x,y],...]], width} (normalized 0..1, width as a "
            "fraction of page width); CM stores {x, y, text, display:'pin'|'inline'}; "
            "ST stores {x, y, symbol}."
        ),
        verbose_name=_("Payload"),
    )
    color = models.CharField(max_length=9, default='#FFD700FF', verbose_name=_("Color (RGBA Hex)"))
    layer_name = models.CharField(
        max_length=80, default='conductor',
        help_text=_("e.g. 'conductor', 'shared', 'rehearsal-2026-05-18'"),
        verbose_name=_("Layer Name"),
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='+',
        verbose_name=_("Created By"),
    )

    class Meta:
        verbose_name = _("Annotation")
        verbose_name_plural = _("Annotations")
        indexes = [
            models.Index(fields=['edition', 'page_number']),
            models.Index(fields=['edition', 'layer_name']),
        ]

    def __str__(self) -> str:
        return f"{self.get_annotation_type_display()} on {self.edition} p.{self.page_number}"


class ProgramNote(EnterpriseBaseModel):
    """
    Audience-facing program note for a Piece. May be canonical (no project)
    or concert-specific (tied to a roster.Project).
    """
    piece = models.ForeignKey(
        Piece, on_delete=models.CASCADE, related_name='program_notes',
        verbose_name=_("Piece"),
    )
    project = models.ForeignKey(
        'roster.Project', on_delete=models.CASCADE,
        null=True, blank=True, related_name='program_notes',
        verbose_name=_("Project"),
    )
    language = models.CharField(max_length=8, default='en', verbose_name=_("Language"))
    target_tone = models.CharField(
        max_length=40, default='accessible',
        help_text=_("e.g. 'accessible', 'scholarly', 'devotional'"),
        verbose_name=_("Target Tone"),
    )
    word_count_target = models.PositiveIntegerField(default=250, verbose_name=_("Word Count Target"))
    content = models.TextField(verbose_name=_("Content"))
    is_approved = models.BooleanField(default=False, verbose_name=_("Approved by Conductor"))

    class Meta:
        verbose_name = _("Program Note")
        verbose_name_plural = _("Program Notes")
        indexes = [
            models.Index(fields=['piece', 'language']),
            models.Index(fields=['project', 'language']),
        ]

    def __str__(self) -> str:
        scope = f"{self.project.title} / " if self.project else ""
        return f"{scope}{self.piece.title} ({self.language})"


class ProvenanceRecord(EnterpriseBaseModel):
    """
    Records WHERE a specific field's value came from. Powers the
    "AI-suggested vs. verified" UI, one-click regenerate, and audit reporting.

    Every field populated by AI or by an external API gets a row here.
    The generic FK lets one log table serve every domain entity.
    """
    content_type = models.ForeignKey(
        'contenttypes.ContentType', on_delete=models.CASCADE,
        verbose_name=_("Content Type"),
    )
    object_id = models.UUIDField(verbose_name=_("Object ID"))
    target = GenericForeignKey('content_type', 'object_id')

    field_name = models.CharField(max_length=80, verbose_name=_("Field Name"))
    source = models.CharField(max_length=3, choices=ProvenanceSource.choices, verbose_name=_("Source"))
    source_reference = models.CharField(
        max_length=200, blank=True,
        help_text=_("mbid, Wikidata QID, Spotify track ID, URL, etc."),
        verbose_name=_("Source Reference"),
    )
    confidence = models.FloatField(default=1.0, verbose_name=_("Confidence"))
    prompt_version = models.CharField(max_length=80, blank=True, verbose_name=_("Prompt Version"))
    model_version = models.CharField(max_length=80, blank=True, verbose_name=_("Model Version"))
    retrieved_at = models.DateTimeField(auto_now_add=True, verbose_name=_("Retrieved At"))

    class Meta:
        verbose_name = _("Provenance Record")
        verbose_name_plural = _("Provenance Records")
        indexes = [
            models.Index(fields=['content_type', 'object_id', 'field_name']),
            models.Index(fields=['source', 'retrieved_at']),
        ]

    def __str__(self) -> str:
        return f"{self.field_name} ← {self.get_source_display()} @ {self.retrieved_at:%Y-%m-%d}"