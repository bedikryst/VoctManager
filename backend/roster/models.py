# roster/models.py
# ==========================================
# Roster & Logistics Database Models
# Standard: Enterprise SaaS 2026
# ==========================================
"""
Database models for HR and Logistics entities.
"""
import uuid
from datetime import datetime, timedelta
from typing import Any

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import (
    FileExtensionValidator,
    MaxValueValidator,
    MinValueValidator,
)
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django.utils.translation import pgettext_lazy

from core.constants import VoiceLine
from core.models import EnterpriseBaseModel
from roster.domain.day_timeline import MINUTES_PER_DAY
from roster.domain.liturgy import SLOT_CHOICES

DEFAULT_EVENT_TIMEZONE = 'Europe/Warsaw'

# How long a calendar entry reserves for a rehearsal nobody has timed yet.
#
# It exists for ONE reader: a calendar client. An .ics VEVENT without an end is
# rendered by Google and Apple as a zero-length mark, so a subscribed member
# would see the evening vanish from their week. Every in-app surface asks
# ``Rehearsal.end_date_time`` instead and simply says nothing when it is unset —
# a stated end must be one somebody entered, never one derived here.
FALLBACK_REHEARSAL_DURATION_MINUTES = 120
# The same reservation for a concert, whose end is likewise never stored.
FALLBACK_EVENT_DURATION_MINUTES = 240


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
    # Names, e-mail and phone are a projection of the linked account, not a second
    # place to edit them: `ArtistHRService` and the `user_pii_updated` signal are
    # the only writers, and both copy downward from `User`/`UserProfile`. The
    # columns exist because `user` is SET_NULL — after GDPR erasure this row is all
    # that keeps concert history and ZAiKS contracts readable, so the last known
    # values have to survive here. Widths match `AbstractUser` (150) deliberately:
    # the signal writes through without serializer validation, so a narrower column
    # would reject a legal account name outright.
    first_name = models.CharField(max_length=150, verbose_name=_("First Name"))
    last_name = models.CharField(max_length=150, verbose_name=_("Last Name"))

    # Removed standard unique=True to prevent SoftDelete ghost conflicts. Handled in Meta.
    email = models.EmailField(verbose_name=_("Email"))
    
    # Width matches core.UserProfile.phone_number: the member's own settings write
    # through to this field via the `user_pii_updated` signal, which bypasses
    # serializer validation — a narrower column here would fail that write outright.
    phone_number = models.CharField(max_length=32, blank=True, verbose_name=_("Phone"))
    voice_type = models.CharField(max_length=5, choices=VoiceType.choices, verbose_name=_("Voice Type"))
    is_active = models.BooleanField(
        default=True,
        verbose_name=_("Is Active"),
        help_text=_("Roster standing. Owned exclusively by ArtistHRService.archive_artist / "
                    "restore_artist, which move it in lockstep with `is_deleted` and the "
                    "account's login gate — never write it directly.")
    )

    sight_reading_skill = models.IntegerField(
        choices=[(i, str(i)) for i in range(1, 6)], 
        blank=True, null=True, verbose_name=_("Sight Reading Skill (1-5)")
    )
    vocal_range_bottom = models.CharField(max_length=5, blank=True, help_text=_("e.g. G2"), verbose_name=_("Range (Bottom)"))
    vocal_range_top = models.CharField(max_length=5, blank=True, help_text=_("e.g. C5"), verbose_name=_("Range (Top)"))
    activation_email_sent_at = models.DateTimeField(
        null=True, blank=True,
        verbose_name=_("Activation Email Sent At"),
        help_text=_("When the account-activation invite was last dispatched — at initial "
                    "provisioning or a manual resend. Lets the roster show when the singer "
                    "was invited and confirm a resend actually went out. Irrelevant once "
                    "the account is activated.")
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

    @property
    def first_name_vocative(self) -> str:
        """Polish vocative for greetings, owned by `UserProfile`.

        Read-through rather than a column of its own: a vocative belongs to the
        person, not to their place in the choir, and managers and crew are greeted
        without ever having an Artist row. Empty for a detached (erased) row —
        nothing is addressed to an account that no longer exists.
        """
        user = self.user
        if user is None:
            return ""
        return getattr(getattr(user, "profile", None), "first_name_vocative", "") or ""


class Project(EnterpriseBaseModel):
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', _('Draft / Planned')
        ACTIVE = 'ACTIVE', _('Active / In Prep')
        COMPLETED = 'DONE', _('Completed')
        CANCELLED = 'CANC', _('Cancelled')

    class EventKind(models.TextChoices):
        """What the ensemble is singing at. Not a status and not a layout setting:
        it is the fact that decides whether a programme item has a place in a rite
        to name, and it is the one answer `ScorePackage.density_mode` defaults
        from — so a Mass does not get a concert book by omission."""

        # Contexts, not bare msgids: "Concert" already exists as a word in this
        # catalogue for something else, and a choice label that follows somebody
        # else's copy edit is a bug waiting for a translator.
        CONCERT = 'CONCERT', pgettext_lazy('event kind', 'Concert')
        MASS = 'MASS', pgettext_lazy('event kind', 'Mass')
        WEDDING = 'WEDDING', pgettext_lazy('event kind', 'Wedding Mass')
        OTHER = 'OTHER', pgettext_lazy('event kind', 'Other event')

    # The two kinds whose programme is an order of service rather than a running
    # order. Read by every surface that decides whether to offer or show a
    # liturgical slot, so the definition of "liturgical" lives in one place.
    LITURGICAL_EVENT_KINDS = (EventKind.MASS, EventKind.WEDDING)

    # What a project in either state has to say to its cast: nothing. One has not
    # been announced, the other has been called off — and a concert that is not
    # happening takes its rehearsals, its programme and its music with it. The
    # archive is untouched: the pieces belong to the choir, not to one project.
    #
    # Read through `Participation.live_seats`, which every chorister-facing door
    # goes through — the two dashboards, the score and annotation gate, and the
    # plain REST endpoints underneath them — so a project cannot be missing from
    # one and present in another. The conductor's own slice is the deliberate
    # exception and keeps drafts: they are the one assembling them.
    HIDDEN_FROM_CAST_STATUSES = (Status.DRAFT, Status.CANCELLED)

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
    event_kind = models.CharField(
        max_length=12, choices=EventKind.choices, default=EventKind.CONCERT,
        verbose_name=_("Event kind"),
        help_text=_("A Mass is programmed against the order of the rite, a concert against a running order."),
    )
    reminder_sent_at = models.DateTimeField(
        null=True, blank=True, db_index=True,
        help_text=_("When the automated upcoming-event reminder was dispatched. Null = not yet sent.")
    )
    announcement_nudged_at = models.DateTimeField(
        null=True, blank=True, db_index=True,
        help_text=_(
            "When the managers were last told this project's announcement queue is "
            "waiting. Unlike reminder_sent_at this is a cooldown, not a one-shot "
            "claim: the sweep re-raises a queue that is still sitting, and a short "
            "fuse on urgent news can break through a stamp left by a calm one."
        )
    )
    run_sheet = models.JSONField(default=list, blank=True, verbose_name=_("Run-sheet"))

    # --- Day-of logistics. The facts a call sheet exists to carry, and the ones
    #     that had nowhere to live: they used to be prose inside `description` or
    #     `Location.internal_notes`, so neither reached a sheet as a fact.
    #
    #     They sit on the project, not on the Location, because they change per
    #     concert: the same church lends a different door, a different room and a
    #     different parking arrangement to a Christmas vigil and to a recording
    #     session. The venue owns what is permanent (address, coordinates, zone);
    #     this owns what is true on the day.
    entrance_note = models.CharField(
        max_length=200, blank=True,
        verbose_name=_("Entrance / gate"),
        help_text=_("Which door the ensemble uses, e.g. 'side entrance from Rakowiecka, gate 2'."),
    )
    parking_note = models.CharField(
        max_length=200, blank=True,
        verbose_name=_("Parking"),
        help_text=_("Where to leave a car, and under what conditions."),
    )
    dressing_room_note = models.CharField(
        max_length=200, blank=True,
        verbose_name=_("Dressing room"),
        help_text=_("Where to change and leave belongings."),
    )

    # Two moments of the day that are typed rather than free text, and that is
    # the whole point: a run-sheet row carries a title someone wrote in Polish,
    # so a francophone conductor's sheet printed it in Polish. These print in the
    # reader's own language, and the printed day merges them with the run sheet
    # (`roster.domain.day_timeline`) so the sheet keeps ONE axis for the day.
    # Wall-clock times without a date: concert day is the run sheet's frame and
    # these belong to the same frame.
    warmup_start = models.TimeField(null=True, blank=True, verbose_name=_("Warm-up (from)"))
    warmup_end = models.TimeField(null=True, blank=True, verbose_name=_("Warm-up (until)"))
    soundcheck_start = models.TimeField(null=True, blank=True, verbose_name=_("Sound check (from)"))
    soundcheck_end = models.TimeField(null=True, blank=True, verbose_name=_("Sound check (until)"))

    # The number a lost or late singer calls. Typed for this concert rather than
    # harvested from someone's profile — which is precisely what makes it
    # printable on all forty sheets: the producer publishes it knowingly, where
    # a crew member's private mobile is theirs and stays off the choir's card.
    onsite_contact_name = models.CharField(
        max_length=120, blank=True,
        verbose_name=_("On-site contact"),
        help_text=_("Who answers on the day — stage manager, sacristan, production."),
    )
    onsite_contact_phone = models.CharField(
        max_length=32, blank=True,
        verbose_name=_("On-site phone"),
        help_text=_("Reachable on the day of the concert. Printed on every sheet, including the singers'."),
    )

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

    @property
    def is_liturgical(self) -> bool:
        """Whether this project's programme is an order of service."""
        return self.event_kind in Project.LITURGICAL_EVENT_KINDS


class ProgramItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.RESTRICT, related_name='program_items')
    piece = models.ForeignKey('archive.Piece', on_delete=models.RESTRICT, verbose_name=_("Piece"))
    order = models.PositiveIntegerField(verbose_name=_("Order (1, 2, 3...)"))
    is_encore = models.BooleanField(default=False, verbose_name=_("Is Encore?"))

    # Where in the rite this piece happens. Typed rather than written out, for the
    # reason the day's warm-up and sound-check windows are typed: a prefix somebody
    # keys in Polish prints in Polish for a francophone singer, and the singer's
    # app, the day card and the score book would each carry their own wording of
    # one moment. The vocabulary, the derived section and the numbering of a slot
    # used twice all live in `roster.domain.liturgy` — nothing derives them again.
    # Blank is the resting state: a concert item has no place in a liturgy.
    liturgical_slot = models.CharField(
        max_length=24, blank=True, choices=SLOT_CHOICES,
        verbose_name=_("Liturgical slot"),
        help_text=_("Where in the Mass this piece belongs. Blank for a concert item."),
    )

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
        help_text=_("Overrides the section heading. Blank = the liturgical slot's own part of the rite, or the piece's text source."),
        verbose_name=_("Section Label"),
    )
    role_prefix = models.CharField(
        max_length=60, blank=True,
        help_text=_("Overrides the line printed before the title. Blank = derived from the liturgical slot."),
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
    translation = models.ForeignKey(
        'archive.Translation', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='+',
        help_text=_("Explicit translation to print on this item's card. Blank = auto-select "
                    "in the package language (literal preferred)."),
        verbose_name=_("Pinned Translation"),
    )
    performers = models.CharField(
        max_length=200, blank=True,
        help_text=_("Concert-specific performers line for the card, "
                    "e.g. 'Sopran solo: J. Kowalska · organy: A. Nowak'."),
        verbose_name=_("Performers"),
    )
    hide_source_page_numbers = models.BooleanField(
        null=True, blank=True,
        help_text=_("Per-item override of the package's source-numbering setting. Null = inherit."),
        verbose_name=_("Hide Edition's Page Numbers"),
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


def default_card_elements() -> list[str]:
    """Book-wide default set of card elements for a new package — mirrors the
    historical always-on eyebrow+meta+text+translation+note behaviour. Per-item
    cards inherit this list unless they pin their own; the canonical element
    vocabulary (and ordering) lives in ``score_package_config.CARD_ELEMENTS``."""
    return ["eyebrow", "meta", "text", "translation", "note"]


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
    hide_source_page_numbers = models.BooleanField(
        default=True,
        help_text=_("Cover the page numbers the editions print themselves, so the book "
                    "carries only its own continuous folio. Detected from the PDF's text "
                    "layer by proving a value that steps by one from page to page; a "
                    "scanned edition without a text layer is left untouched."),
        verbose_name=_("Hide Editions' Own Page Numbers"),
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
    card_default_elements = models.JSONField(
        default=default_card_elements,
        help_text=_("Book-wide default list of card element keys (metryka, tekst, "
                    "tłumaczenie, nota, obsada, części, IPA…). Every item's card "
                    "inherits this set unless it pins its own via ProgramItem.card_elements."),
        verbose_name=_("Card: Default Elements"),
    )
    translation_language = models.CharField(
        max_length=8, default='pl',
        help_text=_("ISO 639-1 code of the translation/programme-note language shown on the cards."),
        verbose_name=_("Card Language"),
    )
    include_markings = models.BooleanField(
        default=False,
        help_text=_("Print the conductor's 'shared' markings onto the music pages. Only that "
                    "layer: it is his message to the whole choir. A reader's own 'personal' "
                    "pencil marks are never baked in here — they are composed per download, "
                    "and nobody may switch on marks they are not allowed to see."),
        verbose_name=_("Include Conductor's Markings"),
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
    page_map = models.JSONField(
        default=list, blank=True,
        help_text=_("What each page of the stored book physically is: one row per page, in "
                    "order, carrying its kind, printed folio, the program item / edition / "
                    "source page it came from, and — for music — the box the source page was "
                    "placed into, in A4 points. The binder trims, scales and re-centres every "
                    "source page, so this is the ONLY record of where a given spot on an "
                    "edition ended up in the book; without it nothing can be drawn onto the "
                    "finished PDF at a musically correct position. Written by the generator "
                    "only, and cleared whenever the file it describes is replaced or removed."),
        verbose_name=_("Page Map"),
    )
    generated_at = models.DateTimeField(null=True, blank=True, verbose_name=_("Generated At"))
    build_started_at = models.DateTimeField(
        null=True, blank=True,
        help_text=_("When the current build attempt was queued, refreshed when a worker "
                    "actually picks it up. A build has no other heartbeat, so this is what "
                    "lets an attempt abandoned by a dead worker (or never dispatched at all) "
                    "be reclaimed instead of pinning the package in 'building' forever."),
        verbose_name=_("Build Started At"),
    )

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

    # Where this singer sits in THIS concert's line-up: the seat they take when a
    # piece's board is filled from the line-up rather than by hand. It lives on the
    # participation and not on the Artist because a line is not a property of a
    # person — the same soprano sits on S1 in one programme and S2 in the next.
    #
    # It is an INPUT to casting and never a substitute for it: [ProjectPieceCasting]
    # stays the only record of who sings what, so no surface ever has to ask whether
    # a seat it is reading is real or merely implied. Blank is the resting state and
    # means "derive from their voice type", which is enough for every piece whose
    # divisi leaves a family undivided.
    default_voice_line = models.CharField(
        max_length=5, blank=True, choices=VoiceLine.choices,
        verbose_name=_("Line-up Seat"),
        help_text=_("Voice line this singer takes when a piece's casting is filled "
                    "from the line-up. Blank = derived from their voice type."),
    )
    # Who the rest of the section follows in THIS concert. On the participation
    # for the same reason the seat is: leading is a job somebody takes for one
    # programme, not a rank they carry between them, and the soprano who leads a
    # Requiem may sing an inner line in the next piece the choir opens.
    #
    # Deliberately not unique per section. A manager marking a new leader before
    # unmarking the old one is mid-edit, not in error, and a database that
    # refuses the write turns a checkbox into a puzzle; two marked leaders read
    # as exactly what was recorded, on screen, where it can be fixed.
    is_section_leader = models.BooleanField(
        default=False,
        verbose_name=_("Section Leader"),
        help_text=_("Leads their voice section in this project. Listed first within it."),
    )
    # Where this singer stands inside their voice section, as the conductor
    # arranged it for this project. A SCORE, not a slot: one integer per singer
    # projects onto any subset of the cast, so a divisi line holding half the
    # sopranos reads in the order the section was given without that order being
    # stored a second time per piece.
    #
    # Null means nobody has arranged this section yet. Those rows fall to the end
    # and settle among themselves exactly as they did before the field existed —
    # leader, then seat, then surname — so an untouched project looks untouched.
    # The rank therefore outranks both: a singer dragged above the marked leader
    # has to stay there, or the gesture would silently do nothing.
    #
    # Ranks are dense within a section because that is how they are written (the
    # whole section goes up at once), but nothing depends on it: they are only
    # ever compared, never counted, and a collision inherited from an earlier
    # project simply falls through to the tie-breakers below it.
    section_rank = models.PositiveIntegerField(
        null=True, blank=True,
        verbose_name=_("Order in Section"),
        help_text=_("Position within this project's voice section. "
                    "Blank = this section has not been arranged."),
    )
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

    @classmethod
    def live_seats(cls, **artist_lookup: Any) -> models.QuerySet["Participation"]:
        """Every seat a singer actually holds, named by whichever key the caller
        has: ``artist_id=…`` for one person, ``artist__user=…`` for the one asking.

        Three conditions that are really one idea — the seat exists, it was not
        turned down, and the project is one the cast may see at all. Everything a
        chorister is offered about their own projects resolves through this: the
        schedule and the absence range, the songbook, the score and its shared
        markings, and the plain REST endpoints underneath all of them.

        It is one method because it kept being six, and the six disagreed. A
        cancelled concert left the timeline while its programme stayed open in
        the songbook; a project somebody had declined went on handing them its
        music. Both were the same bug wearing different clothes — a rule copied
        rather than called.

        Score access narrows this further (a licensed score stops being theirs
        once the concert is over) but never widens it, so `CLOSED_PROJECT_STATUSES`
        composes on top rather than replacing anything here.
        """
        return (
            cls.objects.filter(is_deleted=False, **artist_lookup)
            .exclude(status=cls.Status.DECLINED)
            .exclude(project__status__in=Project.HIDDEN_FROM_CAST_STATUSES)
        )


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
    Powers the chorister's own Songbook checklist and the progress ring on their
    dashboard — nothing manager-facing reads it. One row per (participation,
    piece); written only by the artist it describes.
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
    duration_minutes = models.PositiveIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(5), MaxValueValidator(MINUTES_PER_DAY)],
        verbose_name=_("Duration (minutes)"),
        help_text=_(
            "How long the session runs. Stored as a length rather than a closing "
            "instant so it survives a move of the start and a DST boundary; "
            "null means nobody has timed it and no surface may state an end."
        ),
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

    @property
    def end_date_time(self) -> datetime | None:
        """When the session ends, or ``None`` when its length was never entered.

        The single reader of ``duration_minutes``: every surface that shows or
        exports an end asks this, so none of them can invent one. Added to the
        stored instant rather than to a wall clock — the result is the same
        physical moment on both sides of a DST boundary, and crossing midnight
        needs no special case.
        """
        if self.duration_minutes is None:
            return None
        return self.date_time + timedelta(minutes=self.duration_minutes)

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
    # Optional: a driver or a stagehand is often reachable by phone only. An
    # absent address is stored as NULL (the serializer folds blank into it), so
    # that "no e-mail" is one value the uniqueness rule below can ignore.
    email = models.EmailField(blank=True, null=True, verbose_name=_("Email"))
    # Same width as every other phone field in the project: a real number written
    # with a country code and separators does not fit in 15 characters.
    phone_number = models.CharField(max_length=32, blank=True, verbose_name=_("Phone"))
    company_name = models.CharField(max_length=100, blank=True, verbose_name=_("Company / Brand"))
    specialty = models.CharField(max_length=15, choices=Specialty.choices, default=Specialty.OTHER, verbose_name=_("Specialty"))

    class Meta:
        verbose_name = _("Collaborator (Crew)")
        verbose_name_plural = _("Collaborators")
        constraints = [
            # Only a real address is a shared identity worth rejecting a duplicate
            # over — an address-less crew member must be storable any number of
            # times. Blank is excluded alongside NULL because Postgres treats ''
            # as a value (NULLs never collide, '' does), and because DRF derives a
            # UniqueValidator from this very condition: a condition covering ''
            # rejects the second contactless collaborator with a spurious
            # "already exists" long before the database is asked.
            models.UniqueConstraint(
                fields=['email'],
                condition=(
                    models.Q(is_deleted=False)
                    & models.Q(email__isnull=False)
                    & ~models.Q(email='')
                ),
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