# roster/models.py
# ==========================================
# Roster & Logistics Database Models
# Standard: Enterprise SaaS 2026
# ==========================================
"""
Database models for HR and Logistics entities.
"""
import uuid
from collections.abc import Collection, Iterable
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
from django.db.models import Exists, ExpressionWrapper, OuterRef
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django.utils.translation import pgettext_lazy

from core.constants import VoiceLine
from core.models import EnterpriseBaseModel
from core.voice_labels import (
    SECTION_LETTERS,
    canonical_section_letters,
    section_letters_of_seat,
)
from roster.domain.day_timeline import MINUTES_PER_DAY
from roster.domain.liturgy import SLOT_CHOICES
from roster.domain.rehearsal_plan import evening_is_over

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


def validate_called_sections(value: str) -> None:
    """`Rehearsal.called_sections` is a subset of SATB written in that order,
    with no repeats — the one spelling a `__contains` lookup per letter and an
    equality test on the whole can both rely on."""
    if value != canonical_section_letters(value):
        raise ValidationError(
            _('Called sections must be letters from "%(letters)s" in that order, each at most once.')
            % {'letters': SECTION_LETTERS},
            code='invalid',
        )


def validate_excluded_voice_lines(value: object) -> None:
    """`RehearsalPlanItem.excluded_voice_lines` is a list of `VoiceLine` codes,
    each at most once — a JSON column has no choices of its own."""
    if not isinstance(value, list) or any(not isinstance(code, str) for code in value):
        raise ValidationError(_('Excluded voice lines must be a list of voice line codes.'), code='invalid')
    unknown = [code for code in value if code not in VoiceLine.values]
    if unknown or len(set(value)) != len(value):
        raise ValidationError(
            _('Excluded voice lines must be voice line codes, each at most once.'),
            code='invalid',
        )


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
    # One value for every player, not one per instrument: the organist and the
    # trumpeter differ in `Artist.instrument`, a label, and nothing in the
    # system sorts, groups or casts by which instrument it is. A value per
    # instrument would cost three locales, two sort tables and the salutation
    # map for each new one, and buy nothing.
    INSTRUMENTALIST = 'INS', _('Instrumentalist')


# The voice types that stand in a choir section. Everything that reads the
# cast as S/A/T/B — divisi families, section balance, vocal range and sight
# reading, "section mates" on the personal sheet — asks this set rather than
# spelling the two exceptions out, so a third non-singing kind would need one
# edit, not a hunt.
SINGING_VOICE_TYPES: frozenset[str] = frozenset({
    VoiceType.SOPRANO,
    VoiceType.MEZZO,
    VoiceType.ALTO,
    VoiceType.COUNTERTENOR,
    VoiceType.TENOR,
    VoiceType.BARITONE,
    VoiceType.BASS,
})


def is_instrumentalist_account(user: Any) -> bool:
    """Whether the asking account's roster row is a player's — the one fact
    `Rehearsal.calling_q` needs about the member whose schedule it filters.
    False for managers and crew, who hold no roster row at all."""
    artist = getattr(user, 'artist_profile', None)
    return artist is not None and artist.voice_type == VoiceType.INSTRUMENTALIST


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
    # What an instrumentalist plays, as it should print next to their name
    # ("Organy", "Trąbka"). Meaningful only for `VoiceType.INSTRUMENTALIST`;
    # the DTO requires it there and blanks it everywhere else, so a singer row
    # never carries a stale instrument.
    instrument = models.CharField(
        max_length=60, blank=True,
        verbose_name=_("Instrument"),
        help_text=_("Instrument played. Required for an instrumentalist, empty for everyone else."),
    )
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
    def is_singer(self) -> bool:
        """Whether this artist stands in a voice section — see `SINGING_VOICE_TYPES`."""
        return self.voice_type in SINGING_VOICE_TYPES

    @property
    def role_label(self) -> str:
        """What to print after the name: the instrument for a player, the voice
        for everyone else. A player whose instrument was never entered falls back
        to the generic "Instrumentalist" rather than an empty bracket."""
        if self.voice_type == VoiceType.INSTRUMENTALIST and self.instrument:
            return self.instrument
        return str(self.get_voice_type_display())

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

    # After either of these, a score stops being anyone's but the conductor's: the
    # music is often licensed or personally owned and is not retained on members'
    # devices once the concert is behind them. Narrower than the pair above and
    # composed on top of it, never instead of it — `HIDDEN_FROM_CAST_STATUSES`
    # decides whether a project exists for a singer at all, this decides how long
    # its music does. Exported as `CLOSED_PROJECT_STATUSES` by
    # `roster.queries.materials_queries`, which is where most callers read it.
    CLOSED_STATUSES = (Status.COMPLETED, Status.CANCELLED)

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

    @property
    def section_letters(self) -> str:
        """The SATB letters a sectional calls this seat by — the declared seat
        first, the voice type otherwise (`core.voice_labels.section_letters_of_seat`).
        Reads `artist`, so load it with the seat."""
        return section_letters_of_seat(self.artist.voice_type, self.default_voice_line)

    @classmethod
    def section_letters_of_seats(cls, seats: Iterable["Participation"]) -> str:
        """The union of `section_letters` over a member's seats, canonical.

        What `Rehearsal.calling_q` needs about the reader: a member holds one
        seat per project and a rehearsal belongs to one project, so the union
        can only over-call — a mezzo seated as an alto here and a soprano
        there sees both sectionals of both concerts — which is the failure
        mode the section rule chose. Evaluates ``seats``; pass a queryset that
        selects `artist`.
        """
        return canonical_section_letters(
            letter for seat in seats for letter in seat.section_letters
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


# An item is INSTRUMENTAL in a project when the piece has at least one live
# casting there and every one of them is a player's. Derived from the board,
# never stored: the board already says "organ plays in the Mass, not in the
# motet" per piece, and a flag beside it would be a second truth that can
# contradict it. Zero castings is a choir piece — the four-part reading an
# uncast programme has always had. The two shapes below are the one rule for
# the queryset side (score access, the book's programme) and the prefetched
# side (the songbook serializer), as `Rehearsal.calling_q` / `calls_seat` are
# for who a rehearsal calls.
def instrumental_item_exists() -> ExpressionWrapper:
    """Annotation for a `ProgramItem` queryset: whether the item is instrumental
    in ITS project. Castings are scoped to the item's own project — a piece's
    castings span every project it was ever programmed in."""
    scoped = ProjectPieceCasting.objects.filter(
        piece_id=OuterRef('piece_id'),
        participation__project_id=OuterRef('project_id'),
        participation__is_deleted=False,
    )
    non_player = scoped.exclude(
        participation__artist__voice_type=VoiceType.INSTRUMENTALIST,
    )
    return ExpressionWrapper(
        Exists(scoped) & ~Exists(non_player),
        output_field=models.BooleanField(),
    )


def castings_are_instrumental(castings: Iterable["ProjectPieceCasting"]) -> bool:
    """`instrumental_item_exists` asked about one item's prefetched castings, in
    memory. The rows must already be sliced to ONE project and carry
    `participation__artist`; a cross-project slice would let an organist cast
    elsewhere hide a choir piece here."""
    rows = list(castings)
    return bool(rows) and all(
        row.participation.artist.voice_type == VoiceType.INSTRUMENTALIST
        for row in rows
    )


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
    # Whether a whole-cast call reaches the instrumentalists. The choir
    # rehearses alone for weeks and the organist joins for the last evening, so
    # the default is "not called" and the exception is a property of the
    # rehearsal, not of the person: the same organist is absent from every
    # sectional and present at the dress rehearsal. Irrelevant when
    # `invited_participations` names people — an explicit list is the call.
    calls_instrumentalists = models.BooleanField(
        default=False,
        verbose_name=_("Calls Instrumentalists"),
        help_text=_("Whether a whole-cast rehearsal also calls the project's instrumentalists. "
                    "Ignored when specific participants are invited."),
    )
    reminder_sent_at = models.DateTimeField(
        null=True, blank=True, db_index=True,
        help_text=_("When the automated upcoming-rehearsal reminder was dispatched. Null = not yet sent.")
    )
    invited_participations = models.ManyToManyField(
        Participation, blank=True, related_name='invited_rehearsals', verbose_name=_("Invited Singers")
    )
    # A sectional calls a RULE, not a list: the SATB letters of the sections
    # called, in canonical order ("SA", "TB"), resolved against the cast on
    # every read — so a singer who joins the project after the sectional was
    # booked is called without anyone re-saving it. Empty = the whole cast.
    # Which letters a given singer answers to is `Participation.section_letters`
    # (a mezzo answers to S and A). Letters in a CharField rather than an
    # ArrayField because the test suite runs on sqlite, where `__contains`
    # works and an array does not. Ignored when `invited_participations` names
    # people — the hand-picked call (a quartet, the soloists) stays a list.
    called_sections = models.CharField(
        max_length=len(SECTION_LETTERS),
        blank=True,
        validators=[validate_called_sections],
        verbose_name=_("Called Sections"),
        help_text=_("Sections this rehearsal calls, as SATB letters. Blank = the whole cast. "
                    "Ignored when specific participants are invited."),
    )
    # Who stands in front of the choir this evening. Null = the project's
    # conductor, which is the resting case and is never written explicitly. A
    # value is an ANNOUNCEMENT, not a permission: what the person may do (roll
    # call, markings, materials) stays on the project-wide `RehearsalDelegate`
    # grant, and the serializer only accepts an artist who holds one. Two
    # parallel sectionals are two rehearsals with two different values here.
    # SET_NULL rather than CASCADE: a past evening keeps its record when the
    # leader's row is soft-deleted, because "who led" feeds the dossier.
    led_by = models.ForeignKey(
        Artist,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='led_rehearsals',
        verbose_name=_("Led By"),
        help_text=_("Who runs this rehearsal. Blank = the project's conductor. "
                    "Names a person; the powers come from the project's leader grant."),
    )
    # The evening handed back: a few sentences from whoever stood in front of
    # the choir, written once the rehearsal has started and read by the
    # managers where the rehearsal lives. One text per rehearsal, last write
    # wins — a running log would be the project channel's job. `debrief_by`
    # is SET_NULL for the same reason `led_by` is: the report outlives the
    # author's row, and it is stamped for a manager writing it too.
    debrief = models.TextField(blank=True, verbose_name=_("Debrief"))
    debrief_by = models.ForeignKey(
        Artist,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
        verbose_name=_("Debrief By"),
    )
    debrief_at = models.DateTimeField(null=True, blank=True, verbose_name=_("Debrief At"))
    # When the conductor last SENT the plan to the cast. Plan edits themselves
    # are silent (the plan is redrawn a dozen times the day before); the send
    # is an explicit act and this is its receipt. Until the first send the plan
    # is a draft the choir does not see (`plan_is_public`).
    plan_announced_at = models.DateTimeField(
        null=True, blank=True, verbose_name=_("Plan Announced At"),
    )
    # When the plan last changed in any way the cast could notice: a row
    # added, edited, moved or DELETED. Stamped by `replace_plan`, never by a
    # tick. Read against `plan_announced_at` for "zmieniony po wysłaniu" — a
    # per-row stamp cannot answer it, because a deleted row leaves nothing
    # behind to carry a later time.
    plan_changed_at = models.DateTimeField(
        null=True, blank=True, verbose_name=_("Plan Changed At"),
    )

    class Meta:
        verbose_name = _("Rehearsal")
        verbose_name_plural = _("Rehearsals")
        ordering = ['date_time']
        indexes = [
            models.Index(fields=['project', 'date_time']),
        ]

    def calls_sections(self, letters: str) -> bool:
        """Whether a seat answering to ``letters`` is inside this rehearsal's
        section rule: every rehearsal without a rule, a sectional when any one
        of the seat's letters is called. Players have no letters and are never
        asked this — `calls_voice` speaks for them."""
        return not self.called_sections or any(
            letter in self.called_sections for letter in letters
        )

    def calls_voice(self, letters: str, *, instrumentalist: bool) -> bool:
        """The whole-cast rule for one voice: a player answers to
        `calls_instrumentalists`, a singer to the section rule.

        The two axes are independent on purpose. A section names singers and
        says nothing about the players, so a sectional that calls them reaches
        its sections and the rehearsal pianist — the commonest accompaniment
        case, and the only way to keep it without falling back to a hand-picked
        list, which gives up the rule that a cast change updates the call.
        """
        if instrumentalist:
            return self.calls_instrumentalists
        return self.calls_sections(letters)

    def called_participations(self) -> models.QuerySet["Participation"]:
        """Who this rehearsal calls, before any status narrowing.

        The one reading of "invited list, else the called sections, else the
        whole cast": named participations when the manager picked some,
        otherwise every live participation of the project whose section is
        called (`Participation.section_letters`, resolved now — a joiner is on
        the list the moment they hold a seat) — minus the instrumentalists,
        unless this rehearsal calls them. Recipients of an announcement, the
        reminder, the roll-call grid and the printed sheet all start from this
        set and narrow it by status themselves (a roll-call drops the declined,
        a cancellation notice keeps them), which is why status is not applied
        here.
        """
        invited = self.invited_participations.filter(is_deleted=False)
        if invited.exists():
            return invited
        cast = Participation.objects.filter(project=self.project, is_deleted=False)
        if not self.calls_instrumentalists:
            cast = cast.exclude(artist__voice_type=VoiceType.INSTRUMENTALIST)
        if self.called_sections:
            # Decided in Python: the letters come from the seat AND the voice
            # type, and the intermediate voices' mapping is a table, not a
            # column expression. Narrowed back to a queryset so every reader
            # can keep chaining its own status filter. A player that survived
            # the exclusion above is called by the flag, not by a section.
            called_ids = [
                seat.id
                for seat in cast.select_related('artist')
                if self.calls_voice(
                    seat.section_letters,
                    instrumentalist=seat.artist.voice_type == VoiceType.INSTRUMENTALIST,
                )
            ]
            cast = Participation.objects.filter(id__in=called_ids)
        return cast

    @staticmethod
    def calling_q(seat_ids: Any, *, instrumentalist: bool, section_letters: str) -> models.Q:
        """The `Rehearsal` rows that call a member holding ``seat_ids``.

        Mirror of `called_participations` from the member's side, for the
        schedule, the absence window, the calendar feed and the dossier. A
        named invitation always reaches them; a player is reached by the
        rehearsal's flag alone, sectional or not, having no section to be
        called by; a singer is reached by a rehearsal that calls any of
        ``section_letters`` (`Participation.section_letters_of_seats` over the
        same seats), or by one that calls no sections at all.
        """
        tutti = models.Q(invited_participations__isnull=True)
        if instrumentalist:
            tutti &= models.Q(calls_instrumentalists=True)
        else:
            sections = models.Q(called_sections="")
            for letter in section_letters:
                sections |= models.Q(called_sections__contains=letter)
            tutti &= sections
        return models.Q(invited_participations__in=seat_ids) | tutti

    def calls_seat(self, seat: "Participation", invited_ids: Collection[uuid.UUID]) -> bool:
        """`called_participations` asked about one seat, in memory.

        For the printed sheets, which walk a prefetched invited list per
        rehearsal and must not pay a query per (rehearsal, reader) pair.
        ``invited_ids`` is that list; empty means a cast call, narrowed by the
        section rule. Reads ``seat.artist``.
        """
        if invited_ids:
            return seat.id in invited_ids
        return self.calls_voice(
            seat.section_letters,
            instrumentalist=seat.artist.voice_type == VoiceType.INSTRUMENTALIST,
        )

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

    def plan_is_public(self, now: datetime | None = None) -> bool:
        """Whether the cast may read the plan: once the conductor has sent it,
        or once the evening has started — from then on the plan is a record
        of the evening and the ticks are the truth.

        The one gate for every reader that is not the conductor's side: the
        rehearsal read and its window, `GET plan/`, and the reminder's lines
        and windows. A half-laid plan saved on Sunday must not put "Twoja
        część" on a tenor's card.
        """
        moment = now or timezone.now()
        return self.plan_announced_at is not None or moment >= self.date_time

    def is_over(self, now: datetime | None = None) -> bool:
        """Whether the evening is behind us — the moment an untouched plan row
        stops reading "not known" and starts reading as the plan said
        (`roster.domain.rehearsal_plan.row_done`)."""
        return evening_is_over(self.date_time, self.end_date_time, now or timezone.now())

    def __str__(self):
        return f"Rehearsal: {self.date_time.strftime('%d.%m %H:%M')}"


class RehearsalPlanItem(models.Model):
    """One row of a rehearsal's plan: what is rehearsed, in what order, from
    when, and who is not needed for it.

    One entity carries both the conductor's ordered list and the assistant's
    timetable: a row is a position, an optional clock, a piece OR a free label,
    a one-line note, optional voice exclusions and a done stamp. Rows without a
    clock flow under the last clocked row, so "18:15 Orff / Lumen / Bach" is
    three rows and one time (`roster.domain.rehearsal_plan`). The clock is a
    wall-clock in the rehearsal's zone and is never validated against the
    rehearsal's window — ordering carries the warning.

    Two kinds of row beside the ordinary one. A reserve row ("Jeśli starczy
    czasu") is rehearsed only if the evening allows; reserve rows form a
    suffix of the plan, and they still count toward a reader's window, which
    promises the worst case. A break calls nobody — no piece, no exclusions —
    so the men's evening can end at the break before a ladies-only closer.

    A plain model, not `EnterpriseBaseModel`: the plan is saved whole and a
    dropped row is gone, while a soft-deleted row would keep its
    `(rehearsal, position)` slot and collide with the next save. Its siblings
    on the roster (`ProgramItem`, `ProjectPieceCasting`) are shaped the same
    way. "Changed after it was sent" is read off `Rehearsal.plan_changed_at`,
    not off the rows: a deleted row cannot carry a later stamp.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    rehearsal = models.ForeignKey(
        Rehearsal, on_delete=models.CASCADE, related_name='plan_items', verbose_name=_("Rehearsal"),
    )
    position = models.PositiveIntegerField(verbose_name=_("Position"))
    # RESTRICT, as `ProgramItem.piece`: a piece somebody planned an evening
    # around is not deleted out from under that evening. Validated to sit in
    # the rehearsal's project programme at write — one project per rehearsal.
    piece = models.ForeignKey(
        'archive.Piece',
        on_delete=models.RESTRICT,
        null=True,
        blank=True,
        related_name='rehearsal_plan_items',
        verbose_name=_("Piece"),
    )
    # The title of a row that is not a piece ("Rozśpiewanie", "Przerwa").
    label = models.CharField(max_length=120, blank=True, verbose_name=_("Label"))
    # "od t. 40 do końca, pierwsze czytanie" — what makes a title a plan a
    # chorister can prepare for.
    note = models.CharField(max_length=200, blank=True, verbose_name=_("Note"))
    starts_at = models.TimeField(null=True, blank=True, verbose_name=_("Starts At"))
    # Voice LINES (`VoiceLine` codes), resolved through the piece's casting:
    # Florent's "bez B2" exists only per piece. A seat cast on the row's piece
    # is excluded by its own line; an uncast seat stays called as long as any
    # line of its section remains.
    excluded_voice_lines = models.JSONField(
        default=list,
        blank=True,
        validators=[validate_excluded_voice_lines],
        verbose_name=_("Excluded Voice Lines"),
    )
    # A player is not a voice line, so the organist's "not before 19:30" is a
    # flag per row. Meaningful only on a rehearsal that calls the players.
    excludes_instrumentalists = models.BooleanField(
        default=False, verbose_name=_("Excludes Instrumentalists"),
    )
    is_reserve = models.BooleanField(default=False, verbose_name=_("Reserve"))
    is_break = models.BooleanField(default=False, verbose_name=_("Break"))
    # The debrief's explicit verdict, written only by the tick door and never
    # live: `done_at` for "we did it", `skipped_at` for "we did not" — at most
    # one of the two. With neither, the plan is the default once the evening
    # is over, so a missed debrief does not read as "nothing happened". No
    # reader checks these stamps for "done"; every one reads
    # `roster.domain.rehearsal_plan.row_done`. No author: `Rehearsal.debrief_by`
    # already stamps whoever handed the evening back.
    done_at = models.DateTimeField(null=True, blank=True, verbose_name=_("Done At"))
    skipped_at = models.DateTimeField(null=True, blank=True, verbose_name=_("Skipped At"))

    class Meta:
        verbose_name = _("Rehearsal Plan Item")
        verbose_name_plural = _("Rehearsal Plan Items")
        ordering = ['position']
        constraints = [
            models.UniqueConstraint(
                fields=['rehearsal', 'position'], name='unique_rehearsal_plan_position',
            ),
            models.CheckConstraint(
                condition=models.Q(done_at__isnull=True) | models.Q(skipped_at__isnull=True),
                name='rehearsal_plan_one_verdict',
            ),
            models.CheckConstraint(
                condition=models.Q(is_break=False) | models.Q(piece__isnull=True),
                name='rehearsal_plan_break_names_no_piece',
            ),
        ]

    @property
    def title(self) -> str:
        """What the row is called on every surface: the piece's title, else
        the label. Reads `piece`; load it with the row."""
        if self.piece_id and self.piece:
            return str(self.piece.title)
        return self.label

    def __str__(self):
        return f"Plan {self.rehearsal_id} #{self.position}: {self.title}"


class RehearsalDelegate(EnterpriseBaseModel):
    """The assistant conductor on one project: the person who may run its
    rehearsals in the conductor's place. Read by people as "Asystent dyrygenta".

    Appointing settles who MAY stand in front, never which evenings they do:
    that is `Rehearsal.led_by`, chosen per rehearsal, and an assistant can be
    appointed for a whole programme and lead none of it.

    A relationship, deliberately not a fourth AppRole. Every gate in this project
    asks `user_is_manager` and branches in two, so a new role would land in the
    not-a-manager half of ~180 of them and grant nothing; what an assistant needs
    is not a rank but a named, bounded tie to ONE programme. Normally it is the
    same person for every programme, but the conductor decides it per concert, and
    nothing here grants it on its own — the form may suggest the last assistant,
    the manager still clicks.

    Scoped to a project rather than to a single rehearsal because that is the
    shape of the thing being lent: score markings hang off editions, which hang
    off pieces, which reach a person through a project's programme — the same
    path `artist_live_piece_ids` already walks. It is also the shape of the
    favour, which is usually "I'm away for a fortnight", not one evening.

    The scopes are separate because they leak differently: marks expose the
    conductor's thinking, the roll call writes other people's records, and
    materials open a programme the assistant may not be singing in. A grant that
    bundled them would be easy to give and impossible to reason about afterwards.
    The fourth, writing the choir's official markings, is the one power that
    speaks to the whole choir in the conductor's voice, so it alone is off
    unless he switches it on.

    A live grant also seats the assistant in the project's channel (a LEADER
    membership, created on grant and dropped on revoke by `messaging.signals`),
    so they can talk to the cast they run.

    The class, table and internal vocabulary ("leader") keep their original
    names: renaming them would be a table migration plus a data migration of
    stored notifications for zero behaviour.
    """

    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name='rehearsal_delegates',
        verbose_name=_("Project"),
    )
    artist = models.ForeignKey(
        Artist, on_delete=models.CASCADE, related_name='rehearsal_delegations',
        verbose_name=_("Assistant Conductor"),
    )
    can_see_leader_marks = models.BooleanField(
        default=True,
        verbose_name=_("Sees Markings for the Lead"),
        help_text=_("Read access to the 'leader' annotation layer on this "
                    "project's music. Never the conductor's private layer."),
    )
    can_take_roll_call = models.BooleanField(
        default=True,
        verbose_name=_("Takes Roll Call"),
        help_text=_("May record attendance for this project's rehearsals, "
                    "including other singers' rows."),
    )
    can_open_materials = models.BooleanField(
        default=True,
        verbose_name=_("Opens Materials"),
        help_text=_("Reaches this project's scores and programme even without a "
                    "seat in its cast."),
    )
    can_mark_for_choir = models.BooleanField(
        default=False,
        verbose_name=_("Marks for the Choir"),
        help_text=_("Writes the 'shared' annotation layer on this project's "
                    "music — the choir's official markings, which every singer "
                    "sees. Off unless the conductor lends his voice on purpose."),
    )
    # Null is "until the project closes", not "forever": every branch of the
    # predicate drops a project that is completed or cancelled, so an open-ended
    # grant still ends on its own. A date is for ending it sooner than that.
    expires_at = models.DateTimeField(
        null=True, blank=True,
        verbose_name=_("Expires At"),
        help_text=_("After this moment the appointment opens nothing. "
                    "Blank = until the project closes."),
    )
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='+',
        verbose_name=_("Appointed By"),
    )
    note = models.CharField(
        max_length=200, blank=True,
        verbose_name=_("Note"),
        help_text=_("Why this person assists on the project, for whoever reads "
                    "the list later."),
    )

    class Meta:
        verbose_name = _("Assistant Conductor")
        verbose_name_plural = _("Assistant Conductors")
        constraints = [
            models.UniqueConstraint(
                fields=['project', 'artist'],
                condition=models.Q(is_deleted=False),
                name='unique_active_rehearsal_delegate',
            ),
        ]
        indexes = [
            # The hot direction: "which projects does the person asking lead?",
            # resolved on every annotation read and every attendance write.
            models.Index(fields=['artist', 'project']),
        ]

    def __str__(self) -> str:
        return f"{self.artist.last_name} leads {self.project.title}"


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