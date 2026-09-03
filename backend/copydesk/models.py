"""
@file models.py
@description The copy desk's three tables. `CopySegment` is a PROJECTION of the
             site's text as git holds it, refreshed by the extractor;
             `CopyProposal` is what the database actually owns — an editor's
             proposed change, which reaches the public site only by being
             written into the repo and passing through a `git diff`;
             `CopyScopeVisit` is one reader's watermark on one page, and the
             only thing the contents list's two halves are computed from.
@architecture Enterprise SaaS 2026
@module copydesk/models
"""
from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from core.models import EnterpriseBaseModel

#: A dotted, namespaced id: `concert.wcielenie.program.3.note`,
#: `page.kontakt.hero.lede`. At least two parts, because the first two ARE the
#: scope (see `scope_from_key`) and a single-part key would name a page with no
#: field in it.
KEY_PATTERN = r"^[a-z][a-z0-9]*(?:\.[A-Za-z0-9_-]+)+$"

key_validator = RegexValidator(
    regex=KEY_PATTERN,
    message=_(
        "A segment key is dotted and namespaced, e.g. 'concert.wcielenie.essence'."
    ),
)


def scope_from_key(key: str) -> str:
    """The page a segment belongs to: the first two parts of its key.

    Derived rather than stored independently, because §4 of the copy-desk spec
    requires the key to be reversible in both directions — the extractor builds
    it and the apply script writes back through it. A scope the extractor could
    set freely would be a second, quietly divergent answer to "which page is
    this on".
    """
    parts = key.split(".")
    return ".".join(parts[:2])


class SiteLocale(models.TextChoices):
    """The public site's locales. Mirrors `LOCALES` in `web/src/i18n/config.ts`;
    a fourth language is added in both places or the desk offers a column the
    site cannot render.

    Polish is first because it is the source: a translation exists only as the
    rendering of a Polish value, which is also why `LocalizedText` requires `pl`
    and why a non-Polish segment carries a source hash and a Polish one does not.
    """

    POLISH = "pl", _("Polish")
    ENGLISH = "en", _("English")
    FRENCH = "fr", _("French")


class SegmentKind(models.TextChoices):
    """What an editor is allowed to type, and therefore which sanitizer runs.

    Not a cosmetic hint: a `TEXT` segment has no HTML path at all, and an `HTML`
    one is rebuilt from a whitelist. See `copydesk/sanitizers.py`.
    """

    TEXT = "TEXT", _("Plain text")
    HTML = "HTML", _("Inline markup")


class ProposalStatus(models.TextChoices):
    """An editor's change, from written to settled.

    `DRAFT` and `PROPOSED` are the open states — one open proposal per person
    per segment, editable in place. `ACCEPTED` and `REJECTED` are terminal and
    are never edited: a further change to a settled segment is a new proposal,
    so the record of what was decided, by whom, and against which Polish
    survives the next edit.
    """

    DRAFT = "DRAFT", _("Draft")
    PROPOSED = "PROPOSED", _("Proposed")
    ACCEPTED = "ACCEPTED", _("Accepted")
    REJECTED = "REJECTED", _("Rejected")


#: The states an editor may still write to, and the states the digest counts.
OPEN_STATUSES: frozenset[str] = frozenset({ProposalStatus.DRAFT, ProposalStatus.PROPOSED})


class CopySegment(EnterpriseBaseModel):
    """One editable field of one page or concert, in one locale.

    **Git is the source of truth and this table is a mirror of it.** Rows are
    written by the extractor (stage C), never by the desk's API: an editor's
    change lands as a `CopyProposal` and only reaches this row after the apply
    script has written it into the repo and the extractor has read it back. A
    write path from the desk into this table would be the CMS §3 rejected.

    The mirror exists because two of the desk's states cannot be answered from
    proposals alone — "is this translation stale" needs the current Polish, and
    "is this new since my last visit" needs to know when the segment first
    appeared.
    """

    key = models.CharField(
        max_length=200,
        db_index=True,
        validators=[key_validator],
        help_text=_(
            "Stable dotted id, reversible in both directions: the extractor "
            "produces it and the apply script writes back through it."
        ),
    )
    locale = models.CharField(
        max_length=5,
        choices=SiteLocale.choices,
        db_index=True,
        help_text=_("Which column of the desk this value belongs to."),
    )
    kind = models.CharField(
        max_length=10,
        choices=SegmentKind.choices,
        default=SegmentKind.TEXT,
        help_text=_("Decides the editor the desk offers and the sanitizer the API runs."),
    )
    value = models.TextField(
        blank=True,
        help_text=_("The text as the repository currently holds it."),
    )
    source_hash = models.CharField(
        max_length=64,
        blank=True,
        help_text=_(
            "For a non-Polish segment: hash of the Polish that this PUBLISHED "
            "value renders, stamped when a proposal was applied. Blank means no "
            "provenance was ever recorded — which is not the same as up to date."
        ),
    )
    scope = models.CharField(
        max_length=120,
        db_index=True,
        help_text=_("The page this segment sits on. Always `scope_from_key(key)`."),
    )
    scope_label = models.CharField(
        max_length=200,
        blank=True,
        help_text=_("Human name of the page, for the contents list (e.g. 'Kontemplacja Wcielenia')."),
    )
    label = models.CharField(
        max_length=200,
        blank=True,
        help_text=_("Human name of the field itself, for the row (e.g. 'Program · 3 · nota')."),
    )
    order = models.PositiveIntegerField(
        default=0,
        help_text=_(
            "Reading order within the page. The desk renders the text in the "
            "site's own sequence, not as a table sorted by key."
        ),
    )

    class Meta:
        db_table = "copydesk_segment"
        ordering = ["scope", "order", "key", "locale"]
        verbose_name = _("Copy Segment")
        verbose_name_plural = _("Copy Segments")
        constraints = [
            # Conditional so a segment deleted from the site and later restored
            # does not collide with its own tombstone. Nothing writes this table
            # through a ModelSerializer, which is what keeps the condition from
            # reaching DRF's unique validators (they read condition fields
            # straight out of a PATCH payload and raise KeyError when absent).
            models.UniqueConstraint(
                fields=["key", "locale"],
                condition=models.Q(is_deleted=False),
                name="unique_active_segment_per_locale",
            ),
        ]
        indexes = [
            # Declared explicitly: overriding Meta drops EnterpriseBaseModel's own.
            models.Index(fields=["is_deleted", "-created_at"], name="copydesk_seg_isdel_idx"),
            # The desk is always read one page at a time, in reading order.
            models.Index(fields=["scope", "locale", "order"], name="copydesk_seg_scope_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.key} [{self.locale}]"

    @property
    def is_source(self) -> bool:
        """True for the Polish column — the value a translation renders."""
        return self.locale == SiteLocale.POLISH


class CopyProposal(EnterpriseBaseModel):
    """One editor's proposed value for one segment.

    Attribution is not bookkeeping. §2's two-iteration rule turns on knowing who
    wrote a value and which Polish they wrote it against, which is the whole
    reason the desk refuses anonymous access: an unattributed edit destroys the
    only fact the rule depends on.
    """

    segment = models.ForeignKey(
        CopySegment,
        on_delete=models.CASCADE,
        related_name="proposals",
        help_text=_("The field and locale this proposal is for."),
    )
    value = models.TextField(
        blank=True,
        help_text=_("The proposed text, as rebuilt by the sanitizer for the segment's kind."),
    )
    source_hash = models.CharField(
        max_length=64,
        blank=True,
        help_text=_(
            "Hash of the Polish this proposal was written against. Blank on a "
            "Polish proposal — a source renders nothing and so goes stale against nothing."
        ),
    )
    status = models.CharField(
        max_length=10,
        choices=ProposalStatus.choices,
        default=ProposalStatus.PROPOSED,
        db_index=True,
        help_text=_("Where this proposal stands. ACCEPTED and REJECTED are terminal."),
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="copy_proposals",
        help_text=_(
            "Who wrote it. SET_NULL so a GDPR purge of an account leaves the "
            "editorial record — and any accepted wording still live on the site — intact."
        ),
    )
    comment = models.TextField(
        blank=True,
        help_text=_("The editor's note to the reviewer about this one segment."),
    )
    notified_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        help_text=_(
            "When this proposal was carried by a digest to the reviewers. NULL "
            "means it is still unannounced; cleared again whenever the value "
            "changes, because a revised proposal is news a second time."
        ),
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="copy_reviews",
        help_text=_("Who accepted or rejected it."),
    )
    reviewed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text=_("When the proposal reached a terminal status."),
    )
    applied_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text=_(
            "When `apply-copy` wrote this accepted value into the repository. "
            "Accepted-and-unapplied is the patch waiting to be committed."
        ),
    )

    class Meta:
        db_table = "copydesk_proposal"
        ordering = ["-created_at"]
        verbose_name = _("Copy Proposal")
        verbose_name_plural = _("Copy Proposals")
        constraints = [
            # One open proposal per person per segment: an editor revises their
            # own words in place. Two editors may hold competing open proposals
            # on one segment on purpose — the reviewer sees both and chooses,
            # rather than one of them silently overwriting the other.
            models.UniqueConstraint(
                fields=["segment", "author"],
                condition=models.Q(is_deleted=False, status__in=["DRAFT", "PROPOSED"]),
                name="unique_open_proposal_per_author",
            ),
        ]
        indexes = [
            models.Index(fields=["is_deleted", "-created_at"], name="copydesk_prop_isdel_idx"),
            # The reviewer queue, and the sweep that finds what has not been announced.
            models.Index(fields=["status", "notified_at"], name="copydesk_prop_status_idx"),
        ]

    def __str__(self) -> str:
        return f"[{self.status}] {self.segment.key} [{self.segment.locale}]"

    @property
    def is_open(self) -> bool:
        return self.status in OPEN_STATUSES


class CopyScopeVisit(EnterpriseBaseModel):
    """One reader's watermark on one page of the corpus.

    **A row means "I have read this page", and only an explicit act writes one.**
    Opening a page does not: an editor who taps into a 213-row concert to check a
    single line has not reviewed it, and a stamp written on the way out would say
    they had — permanently, since nothing ever puts a page back. That was the
    defect in the single profile-wide stamp this table replaces, where merely
    entering the desk cleared the new-since-last-visit state for the whole corpus.

    Everything the contents list shows is a COMPARISON against `seen_at`, never a
    stored state, which is what keeps it from needing to be maintained:

    - **no row at all** — this page has never been reviewed by this reader, and
      every segment on it is new to them. The absence is the honest starting
      point, so nothing migrates a profile stamp in here: "when were you last on
      the desk" is not an answer to "have you read this page".
    - **new** — segments created after `seen_at`.
    - **changed** — segments already present at `seen_at` whose published value
      has moved since. This is what makes `CopySegment.updated_at` load-bearing:
      the ingest must not save a row it did not change (`upsert_segments`), or
      every reader is told the whole corpus moved every time the extractor ran.

    Staleness is deliberately NOT one of them. It is reader-independent and it
    does not clear by being read, so a page carrying it could never leave the
    "to review" half however often it was reviewed.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="copy_scope_visits",
        help_text=_("Whose reading this records. CASCADE: a watermark outlives nobody."),
    )
    scope = models.CharField(
        max_length=120,
        db_index=True,
        help_text=_("The page reviewed. Always a `scope_from_key` value."),
    )
    seen_at = models.DateTimeField(
        help_text=_(
            "When this reader last declared the page reviewed. Set explicitly "
            "rather than on arrival or departure — see the class docstring."
        ),
    )

    class Meta:
        db_table = "copydesk_scope_visit"
        ordering = ["scope"]
        verbose_name = _("Copy Scope Visit")
        verbose_name_plural = _("Copy Scope Visits")
        constraints = [
            # One watermark per person per page: re-declaring a page reviewed
            # moves the mark forward, it does not accumulate a history. The
            # condition matches the sibling tables so a soft-deleted row cannot
            # collide with its own replacement.
            models.UniqueConstraint(
                fields=["user", "scope"],
                condition=models.Q(is_deleted=False),
                name="unique_scope_visit_per_user",
            ),
        ]
        indexes = [
            # Declared explicitly: overriding Meta drops EnterpriseBaseModel's own.
            models.Index(fields=["is_deleted", "-created_at"], name="copydesk_visit_isdel_idx"),
            # The contents list reads every one of a reader's watermarks at once.
            models.Index(fields=["user", "scope"], name="copydesk_visit_user_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.scope} seen by UID:{self.user_id}"
