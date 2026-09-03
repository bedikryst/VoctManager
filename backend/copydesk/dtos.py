"""
@file dtos.py
@description Copy desk Data Transfer Objects. The read side is what the desk
             renders — a segment together with the two derived states §4 names,
             stale and new-since-last-visit. The write side is validated before
             anything reaches the database.
@architecture Enterprise SaaS 2026 (Pydantic V2)
@module copydesk/dtos
"""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .models import KEY_PATTERN, ProposalStatus, SegmentKind, SiteLocale

LOCALE_VALUES = frozenset(SiteLocale.values)
KIND_VALUES = frozenset(SegmentKind.values)
STATUS_VALUES = frozenset(ProposalStatus.values)

#: Generous enough for the longest prose in the corpus (`note` runs to several
#: hundred words) and tight enough that a stuck client cannot post a book.
MAX_VALUE_LENGTH = 20_000
MAX_COMMENT_LENGTH = 1_000

#: How many rows one ingest may carry. Today's corpus is 1 281 (427 keys in three
#: locales) and stage G roughly doubles it, so this is about four times what the
#: site can hold — a stop on a runaway client, not an estimate. Raising it much
#: further is a decision rather than a number: past roughly ten thousand rows the
#: body approaches Django's 2.5 MB `DATA_UPLOAD_MAX_MEMORY_SIZE` and the seam
#: needs a shape that chunks, which is not something to discover as a 500.
MAX_INGEST_ROWS = 6_000


class CopyDeskBaseDTO(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid", validate_by_name=True, validate_by_alias=True)


# --------------------------------------------------------------------------- #
# Write side                                                                    #
# --------------------------------------------------------------------------- #

class ProposalWriteDTO(CopyDeskBaseDTO):
    """An editor's change to one segment.

    `status` is limited to the open states: a proposal is accepted or rejected
    through the reviewer's own action, never by an editor naming the outcome
    they would like.
    """

    segment_id: UUID
    value: str = Field(default="", max_length=MAX_VALUE_LENGTH)
    comment: str = Field(default="", max_length=MAX_COMMENT_LENGTH)
    status: str = ProposalStatus.PROPOSED

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        allowed = {ProposalStatus.DRAFT.value, ProposalStatus.PROPOSED.value}
        if value not in allowed:
            raise ValueError(f"status must be one of: {', '.join(sorted(allowed))}.")
        return value


class ProposalReviewDTO(CopyDeskBaseDTO):
    """A reviewer's verdict.

    `value` is optional and present only when the reviewer edited the wording
    before accepting it — §4's "accept / reject / edit further" as one act, so
    the record shows what was actually put into the repository rather than what
    was proposed and then silently altered.
    """

    status: str
    value: str | None = Field(default=None, max_length=MAX_VALUE_LENGTH)
    comment: str | None = Field(default=None, max_length=MAX_COMMENT_LENGTH)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        allowed = {ProposalStatus.ACCEPTED.value, ProposalStatus.REJECTED.value}
        if value not in allowed:
            raise ValueError(f"status must be one of: {', '.join(sorted(allowed))}.")
        return value


class SegmentUpsertDTO(CopyDeskBaseDTO):
    """One row of the extractor's reading of the repository (stage C).

    Every field here comes from git. Nothing in this DTO may be set by the desk's
    API — a write path from the panel into the mirror would make the database the
    source of truth, which is the CMS §3 rejected.
    """

    key: str = Field(..., min_length=3, max_length=200, pattern=KEY_PATTERN)
    locale: str
    kind: str = SegmentKind.TEXT
    value: str = Field(default="", max_length=MAX_VALUE_LENGTH)
    scope_label: str = Field(default="", max_length=200)
    label: str = Field(default="", max_length=200)
    order: int = Field(default=0, ge=0)

    @field_validator("locale")
    @classmethod
    def validate_locale(cls, value: str) -> str:
        if value not in LOCALE_VALUES:
            raise ValueError(f"locale must be one of: {', '.join(sorted(LOCALE_VALUES))}.")
        return value

    @field_validator("kind")
    @classmethod
    def validate_kind(cls, value: str) -> str:
        if value not in KIND_VALUES:
            raise ValueError(f"kind must be one of: {', '.join(sorted(KIND_VALUES))}.")
        return value


# --------------------------------------------------------------------------- #
# Read side                                                                     #
# --------------------------------------------------------------------------- #

class ProposalDTO(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    id: UUID
    value: str
    status: str
    comment: str
    author_id: int | None
    author_name: str
    is_mine: bool
    #: A translation whose Polish has moved since it was written. Always False on
    #: a Polish proposal — a source renders nothing, so it goes stale against
    #: nothing — and False when the provenance is unknown, which `source_known`
    #: reports separately rather than dressing up as freshness.
    is_stale: bool = False
    source_known: bool = True
    updated_at: str
    reviewed_at: str | None = None
    applied_at: str | None = None


class SegmentDTO(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    id: UUID
    key: str
    locale: str
    kind: str
    scope: str
    scope_label: str
    label: str
    order: int
    #: What the repository holds today — the value the public site is serving.
    value: str
    #: The Polish this row's locale renders. Equal to `value` on a Polish row.
    #: Carried per segment so the desk can show the original under a toggle
    #: without a second request per row.
    source_value: str = ""
    #: The published translation is out of date against the current Polish.
    is_stale: bool = False
    source_known: bool = True
    #: Created after the reader's last visit to the desk.
    is_new: bool = False
    proposals: tuple[ProposalDTO, ...] = ()


class SegmentIngestResultDTO(BaseModel):
    """What one reconciliation of the mirror did, as the ingest reports it back.

    The counts exist to be read by a person at a terminal, not to be stored.
    `retired_keys` is the load-bearing one: a key leaves the desk only because
    the extractor stopped emitting it, and the two reasons for that look
    identical from here — the field was genuinely deleted from the site, or a
    list gained an entry and every positional key below it shifted. The second
    silently discards proposals and first-seen dates for rows that still exist
    under a new name, so the run names what it withdrew instead of reporting a
    number.
    """

    model_config = ConfigDict(frozen=True, extra="forbid")

    created: int = 0
    updated: int = 0
    #: Rows (one key in one locale) soft-deleted, and the keys they came from.
    retired: int = 0
    retired_keys: tuple[str, ...] = ()
    #: Open proposals that were sitting on a row this run withdrew. The number
    #: that turns "pruned 40 dead rows" into "threw away somebody's evening".
    orphaned_proposals: int = 0
    #: The pages this payload covered — the only pages the prune could touch.
    scopes: tuple[str, ...] = ()
    #: More keys left at once than a single editorial deletion plausibly
    #: explains. Reported, not refused: see `BULK_RETIREMENT_KEYS`.
    bulk_retirement: bool = False


class SkippedProposalDTO(BaseModel):
    """One proposal the apply stamp declined to touch, and why."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    id: UUID
    reason: str


class ApplyStampResultDTO(BaseModel):
    """What `apply-copy` managed to stamp.

    Re-running the same batch is not an error — a script that wrote the files
    and lost the response has to be able to say so again — so an already-applied
    proposal is skipped rather than refused.
    """

    model_config = ConfigDict(frozen=True, extra="forbid")

    applied: int = 0
    skipped: tuple[SkippedProposalDTO, ...] = ()


class PatchScopeDTO(BaseModel):
    """One page's share of the patch that is waiting to be written."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    scope: str
    label: str
    rows: int = 0


class PatchSummaryDTO(BaseModel):
    """What has been accepted and has not yet reached the repository.

    Counted in SEGMENTS rather than in proposals, because a segment is what the
    apply script writes: where two accepted proposals compete for one field, the
    patch collapses to the last decision and the file gains one changed line.
    Reporting two would promise the reviewer a diff twice the size of the one
    they are about to read.

    `since` is the oldest decision still unwritten — the fact that turns "eight
    changes waiting" into "eight changes waiting since Tuesday", which is the
    only thing on this surface that says the command has been forgotten.
    """

    model_config = ConfigDict(frozen=True, extra="forbid")

    rows: int = 0
    scopes: tuple[PatchScopeDTO, ...] = ()
    since: str | None = None


class ScopeSummaryDTO(BaseModel):
    """One line of the contents list.

    Four counts because the editor asked to see what they had already done:
    how much there is, how much has been touched, how much has been settled, and
    what has appeared since they were last here.
    """

    model_config = ConfigDict(frozen=True, extra="forbid")

    scope: str
    label: str
    segments: int = 0
    touched: int = 0
    accepted: int = 0
    new: int = 0
    stale: int = 0
