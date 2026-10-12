"""
@file services.py
@description Copy desk domain service. Owns the two derived states §4 names —
             stale and new-since-last-visit — the proposal lifecycle, and the
             extractor's write path into the git mirror.
@architecture Enterprise SaaS 2026
@module copydesk/services
"""
from __future__ import annotations

import logging
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.db.models import Q, QuerySet
from django.utils import timezone

from .dtos import (
    ApplyStampResultDTO,
    PatchScopeDTO,
    PatchSummaryDTO,
    ProposalDTO,
    ProposalReviewDTO,
    ProposalWriteDTO,
    ScopeSummaryDTO,
    SegmentDTO,
    SegmentIngestResultDTO,
    SegmentUpsertDTO,
    SiteIndexProposalDTO,
    SiteIndexRowDTO,
    SkippedProposalDTO,
)
from .hashing import source_hash
from .models import (
    OPEN_STATUSES,
    CopyProposal,
    CopyScopeVisit,
    CopySegment,
    ProposalStatus,
    SegmentKind,
    SiteLocale,
    scope_from_key,
    self_accepted_filter,
)
from .permissions import user_is_trusted_translator
from .sanitizers import sanitize_html, sanitize_text
from .trust import HoldReason, hold_reason

logger = logging.getLogger(__name__)

#: Above this many keys withdrawn in one run, the ingest raises its voice.
#:
#: A deliberate editorial deletion removes a field or two; a list that gained an
#: entry re-keys everything below it, which is dozens. The threshold cannot tell
#: those apart — it is a smoke alarm, not a proof — and it deliberately does not
#: refuse: the extractor is the authority on what the site holds, and a run that
#: blocked on its own reading would leave the mirror describing a page that no
#: longer exists. Retirement is a soft delete, so the answer to a false alarm is
#: `restore()`, not a rebuild.
BULK_RETIREMENT_KEYS = 5

#: How many key names one warning prints before it stops. Enough to recognise a
#: shifted list by eye (the keys share a prefix and run consecutively), short
#: enough that the line stays readable in a terminal and a log aggregator.
_RETIREMENT_NAMES_IN_LOG = 20


@dataclass
class _ScopeCounts:
    """Running totals for one line of the contents list, before it becomes a DTO."""

    label: str = ""
    path: str = ""
    segments: int = 0
    touched: int = 0
    accepted: int = 0
    new: int = 0
    changed: int = 0
    stale: int = 0
    seen_at: datetime | None = None


@dataclass(frozen=True)
class _Retirement:
    """What one prune withdrew, before it becomes part of the ingest's report."""

    keys: tuple[str, ...] = ()
    rows: int = 0
    orphaned_proposals: int = 0


class SegmentNotFoundError(Exception):
    """The segment named by a proposal is not in the mirror (or was removed from the site)."""


class ProposalNotFoundError(Exception):
    """No such proposal, or it belongs to somebody else."""


class ProposalClosedError(Exception):
    """A settled proposal cannot be edited — a further change is a new proposal."""


class EmptyAcceptanceError(Exception):
    """An empty value cannot be accepted: `copy:apply` would refuse to write it.

    Proposing an empty value is allowed (clearing a field is an editorial decision),
    but writing one into the YAML would delete the field rather than change it.
    """


class UnknownProposalsError(Exception):
    """The apply stamp named proposals the database does not have.

    Not a race and not a permission: the ids come from the patch endpoint, so an
    id that resolves to nothing means the script and the database disagree about
    what was written. Nothing is stamped.
    """

    def __init__(self, ids: Sequence[UUID]) -> None:
        super().__init__(", ".join(str(value) for value in ids))
        self.ids = tuple(ids)


def sanitize_for_kind(value: str, kind: str) -> str:
    """Rebuild a submitted value against its segment's kind.

    The one entry point, so nothing can reach the database by a path that skipped
    it: a `text` segment has no HTML route at all, and an `html` one keeps only
    the inline vocabulary the site's prose uses.
    """
    if kind == SegmentKind.HTML:
        return sanitize_html(value)
    return sanitize_text(value)


def _display_name(user: User | None) -> str:
    if user is None:
        return ""
    full_name = getattr(user, "get_full_name", lambda: "")()
    return str(full_name or getattr(user, "email", "") or "")


def _iso(moment: datetime | None) -> str | None:
    return moment.isoformat() if moment is not None else None


class CopyDeskService:
    """Reads and writes for the editorial surface over the site's text."""

    # -- the mirror (stage C's extractor writes through here) ---------------- #

    @classmethod
    def upsert_segments(
        cls, rows: Sequence[SegmentUpsertDTO], *, prune: bool = True
    ) -> SegmentIngestResultDTO:
        """Reconcile the mirror with what the extractor read out of the repository.

        Idempotent by construction: a re-run over an unchanged repository writes
        the same values and reports zero created. `created_at` is therefore a
        true "first seen", which is what the new-since-last-visit state stands on
        — a reconciliation that recreated rows would flag the whole corpus as new
        every time the extractor ran.

        **And it does not SAVE an unchanged row, for the same reason one level
        down.** `updated_at` is `auto_now`, so an unconditional `update_or_create`
        stamps every row on every run and the column ends up meaning "when the
        extractor last ran" rather than "when this text moved". `CopyScopeVisit`
        computes "changed since you reviewed this page" from exactly that column,
        so a blanket save would tell every reader that the whole corpus had moved
        after any sync at all. `updated` therefore counts real changes, which is
        also what makes the run's own report readable: a no-op sync says zero.

        `scope_path` is kept out of that comparison and written past `auto_now`.
        It says where a page lives, not what it says, and it moves for every row
        of a scope at once — the first sync after the column existed, a concert
        whose page goes up. Stamping those rows would put every reviewed page
        back in the queue with not a word changed, and `updated` would report a
        corpus-wide edit that never happened.

        `source_hash` is deliberately absent from `defaults` and must stay so.
        That column is the provenance `mark_applied` records — the Polish a
        PUBLISHED translation renders — and the extractor knows nothing about it.
        Writing it here (even as `""`) would erase the stamp on the next run and
        put the desk back where §6c's second defect found it: every translation
        reporting `source_known=False` forever, with the stale state never firing
        once.

        A key the payload does not carry has left the site and is retired, but
        only within the scopes the payload actually covers — see
        `_retire_missing`. The whole reconciliation is one transaction: a mirror
        half-refreshed and half-pruned describes no version of the repository.
        """
        created = 0
        updated = 0
        seen: set[tuple[str, str]] = set()
        scopes: set[str] = set()

        with transaction.atomic():
            for row in rows:
                fields = {
                    "kind": row.kind,
                    "value": row.value,
                    "scope": scope_from_key(row.key),
                    "scope_label": row.scope_label,
                    "label": row.label,
                    "order": row.order,
                }
                segment, was_created = CopySegment.objects.get_or_create(
                    key=row.key,
                    locale=row.locale,
                    defaults={**fields, "scope_path": row.scope_path},
                )
                if was_created:
                    created += 1
                else:
                    changed = [
                        name
                        for name, value in fields.items()
                        if getattr(segment, name) != value
                    ]
                    if changed:
                        for name in changed:
                            setattr(segment, name, fields[name])
                        segment.save(update_fields=[*changed, "updated_at"])
                        updated += 1
                    if segment.scope_path != row.scope_path:
                        CopySegment.objects.filter(pk=segment.pk).update(
                            scope_path=row.scope_path
                        )
                seen.add((row.key, row.locale))
                scopes.add(scope_from_key(row.key))

            retirement = (
                cls._retire_missing(scopes=scopes, seen=seen) if prune else _Retirement()
            )

        result = SegmentIngestResultDTO(
            created=created,
            updated=updated,
            retired=retirement.rows,
            retired_keys=retirement.keys,
            orphaned_proposals=retirement.orphaned_proposals,
            scopes=tuple(sorted(scopes)),
            bulk_retirement=len(retirement.keys) > BULK_RETIREMENT_KEYS,
        )
        cls._report_ingest(result)
        return result

    @classmethod
    def _retire_missing(
        cls, *, scopes: set[str], seen: set[tuple[str, str]]
    ) -> _Retirement:
        """Withdraw the rows the extractor stopped emitting, within these scopes only.

        The narrowing is the whole point. A payload is the truth about the pages
        it contains and says nothing at all about the others, so a run over one
        concert must leave the other five standing — the alternative is that
        extracting a single page silently empties the desk.

        Soft-deleted rather than erased, for two reasons. A field removed from
        the site and later restored should not take its editorial history with
        it; and a prune that turns out to have been a shifted list is undone by
        `restore()` instead of by re-deriving what was lost. The returning key
        gets a NEW row, because with positional keys (§6d) `program.3.note`
        coming back is not evidence that it is the same note.
        """
        if not scopes:
            return _Retirement()

        stale_ids: list[UUID] = []
        keys: set[str] = set()
        for segment_id, key, locale in CopySegment.objects.filter(
            scope__in=sorted(scopes)
        ).values_list("id", "key", "locale"):
            if (key, locale) in seen:
                continue
            stale_ids.append(segment_id)
            keys.add(key)

        if not stale_ids:
            return _Retirement()

        orphaned = CopyProposal.objects.filter(
            segment_id__in=stale_ids, status__in=OPEN_STATUSES
        ).count()
        # `.delete()` on this manager's queryset is the soft delete (see
        # `SoftDeleteQuerySet`), which is what keeps the tombstone and the
        # proposals hanging off it.
        CopySegment.objects.filter(id__in=stale_ids).delete()

        return _Retirement(
            keys=tuple(sorted(keys)),
            rows=len(stale_ids),
            orphaned_proposals=orphaned,
        )

    @staticmethod
    def _report_ingest(result: SegmentIngestResultDTO) -> None:
        """Say what the run did, and raise the volume when it withdrew a lot.

        The response carries all of this to whoever ran the command; the log
        exists for the case that matters most, which is nobody having read the
        response. A bulk retirement is a WARNING because it is the signature of a
        shifted list, and because at that point the number of proposals it
        stranded is the fact worth stopping over.
        """
        if not result.retired:
            logger.info(
                "[CopyDesk] Ingest: %d created, %d updated across %d scope(s).",
                result.created, result.updated, len(result.scopes),
            )
            return

        names = list(result.retired_keys[:_RETIREMENT_NAMES_IN_LOG])
        if len(result.retired_keys) > _RETIREMENT_NAMES_IN_LOG:
            names.append(f"(+{len(result.retired_keys) - _RETIREMENT_NAMES_IN_LOG} more)")
        report = logger.warning if result.bulk_retirement else logger.info
        report(
            "[CopyDesk] Ingest retired %d key(s) / %d row(s)%s in %s: %s%s",
            len(result.retired_keys),
            result.retired,
            f", stranding {result.orphaned_proposals} open proposal(s)"
            if result.orphaned_proposals
            else "",
            ", ".join(result.scopes),
            ", ".join(names),
            " — that many keys leaving at once is the signature of a shifted "
            "list; check that no entry was INSERTED into a positionally keyed "
            "list before accepting it."
            if result.bulk_retirement
            else "",
        )

    # -- derived state ------------------------------------------------------- #

    @classmethod
    def effective_source_hashes(cls, keys: Iterable[str]) -> dict[str, str]:
        """The hash of the Polish each key currently means, keyed by key.

        "Currently means" is not the same as "currently ships". A Polish edit
        that is proposed but not yet in the repository has already invalidated
        the translations built on it — §2 is explicit that a translator renders a
        sense, and the sense is what the editor is adjusting. Waiting for the
        commit would leave a window in which a stale translation reads as fresh,
        which is precisely the silence the hash exists to break.

        An accepted-but-unapplied Polish proposal outranks an open one for the
        same reason a decision outranks a suggestion.
        """
        key_list = list(keys)
        if not key_list:
            return {}
        _values, hashes = cls._polish_sources(key_list)
        return hashes

    @staticmethod
    def _polish_sources(
        keys: Sequence[str] | None,
    ) -> tuple[dict[str, str], dict[str, str]]:
        """The Polish of `keys` as it ships, and the hash of what it currently means.

        One read of the Polish serves both, since every caller that needs the
        hashes also shows the Polish. `None` reads the whole locale, which is
        what the site index wants: a filter naming every key would match every
        row anyway.
        """
        polish = CopySegment.objects.filter(locale=SiteLocale.POLISH)
        pending = CopyProposal.objects.filter(
            segment__locale=SiteLocale.POLISH,
            status__in=[*OPEN_STATUSES, ProposalStatus.ACCEPTED],
            applied_at__isnull=True,
        )
        if keys is not None:
            polish = polish.filter(key__in=keys)
            pending = pending.filter(segment__key__in=keys)

        values = dict(polish.values_list("key", "value"))
        hashes = {key: source_hash(value) for key, value in values.items()}
        # Ranked in Python, not by `order_by("status")`: the statuses sort
        # alphabetically (ACCEPTED before DRAFT before PROPOSED), which is the
        # reverse of the precedence wanted here and would have quietly let a
        # stale draft outrank the decision that superseded it.
        for proposal in sorted(
            pending.select_related("segment").order_by("updated_at"),
            key=lambda p: p.status == ProposalStatus.ACCEPTED,
        ):
            hashes[proposal.segment.key] = source_hash(proposal.value)
        return values, hashes

    @staticmethod
    def _staleness(locale: str, stored_hash: str, current_hash: str) -> tuple[bool, bool]:
        """(is_stale, source_known) for one row.

        Polish is never stale: it is the source, so there is nothing above it to
        have moved. A blank stored hash is reported as unknown rather than fresh
        — every translation predating the desk carries one, and calling those
        up-to-date would be an assertion nothing supports.
        """
        if locale == SiteLocale.POLISH:
            return False, True
        if not stored_hash:
            return False, False
        return stored_hash != current_hash, True

    # -- reads --------------------------------------------------------------- #

    @classmethod
    def segments_for_scope(
        cls,
        *,
        scope: str,
        user: User,
        locales: Sequence[str] | None = None,
    ) -> tuple[SegmentDTO, ...]:
        """One page of the desk, in the site's reading order."""
        queryset: QuerySet[CopySegment] = CopySegment.objects.filter(scope=scope)
        if locales:
            queryset = queryset.filter(locale__in=list(locales))
        segments = list(queryset.order_by("order", "key", "locale"))
        return cls._project(segments, user)

    @classmethod
    def _project(
        cls, segments: Sequence[CopySegment], user: User
    ) -> tuple[SegmentDTO, ...]:
        if not segments:
            return ()

        polish_values, current_hashes = cls._polish_sources(
            sorted({segment.key for segment in segments})
        )
        watermarks = cls.watermarks(user=user, scopes={s.scope for s in segments})

        proposals_by_segment: dict[UUID, list[CopyProposal]] = {}
        for proposal in (
            CopyProposal.objects.filter(segment__in=list(segments))
            .select_related("author", "segment")
            .order_by("-created_at")
        ):
            proposals_by_segment.setdefault(proposal.segment_id, []).append(proposal)

        return tuple(
            cls._segment_dto(
                segment,
                proposals=proposals_by_segment.get(segment.id, []),
                current_hash=current_hashes.get(segment.key, ""),
                source_value=polish_values.get(segment.key, ""),
                seen_at=watermarks.get(segment.scope),
                user=user,
            )
            for segment in segments
        )

    @classmethod
    def watermarks(
        cls, *, user: User, scopes: Iterable[str] | None = None
    ) -> dict[str, datetime]:
        """Where this reader has declared each page reviewed.

        A page ABSENT from the result has never been reviewed by them, which is
        not the same as "reviewed a long time ago" and is why this returns a
        sparse map rather than defaulting to the epoch: everything on an unread
        page is new to its reader, and an epoch would report none of it.
        """
        visits: QuerySet[CopyScopeVisit] = CopyScopeVisit.objects.filter(user=user)
        if scopes is not None:
            visits = visits.filter(scope__in=list(scopes))
        return {visit.scope: visit.seen_at for visit in visits}

    @classmethod
    def _segment_dto(
        cls,
        segment: CopySegment,
        *,
        proposals: Sequence[CopyProposal],
        current_hash: str,
        source_value: str,
        seen_at: datetime | None,
        user: User,
    ) -> SegmentDTO:
        is_stale, source_known = cls._staleness(
            segment.locale, segment.source_hash, current_hash
        )
        return SegmentDTO(
            id=segment.id,
            key=segment.key,
            locale=segment.locale,
            kind=segment.kind,
            scope=segment.scope,
            scope_label=segment.scope_label,
            label=segment.label,
            order=segment.order,
            value=segment.value,
            source_value=source_value,
            is_stale=is_stale,
            source_known=source_known,
            # No watermark on this page means the reader has never declared it
            # reviewed, so every row on it is new to them — the state an editor
            # meeting a page for the first time is actually in. `changed` is the
            # complement and never overlaps: a row cannot both have appeared
            # since the mark and have been standing there when it was made.
            is_new=bool(seen_at is None or segment.created_at > seen_at),
            is_changed=bool(
                seen_at is not None
                and segment.created_at <= seen_at < segment.updated_at
            ),
            proposals=tuple(
                cls._proposal_dto(proposal, current_hash=current_hash, user=user)
                for proposal in proposals
            ),
        )

    @classmethod
    def _proposal_dto(
        cls, proposal: CopyProposal, *, current_hash: str, user: User
    ) -> ProposalDTO:
        is_stale, source_known = cls._staleness(
            proposal.segment.locale, proposal.source_hash, current_hash
        )
        return ProposalDTO(
            id=proposal.id,
            value=proposal.value,
            status=proposal.status,
            comment=proposal.comment,
            author_id=proposal.author_id,
            author_name=_display_name(proposal.author),
            is_mine=proposal.author_id == getattr(user, "id", None),
            self_accepted=proposal.is_self_accepted,
            is_stale=is_stale,
            source_known=source_known,
            updated_at=proposal.updated_at.isoformat(),
            reviewed_at=_iso(proposal.reviewed_at),
            applied_at=_iso(proposal.applied_at),
        )

    @classmethod
    def review_queue(cls, *, user: User) -> tuple[SegmentDTO, ...]:
        """Every segment somebody is waiting on a verdict for, across all pages.

        The reviewer's unit is the SEGMENT and not the proposal, because two
        editors may hold competing open proposals on one field (§6b) and the
        whole point of keeping both is that they are read together and chosen
        between. So the queue is a list of segments carrying their proposals —
        the same shape the editor's page returns, which is what lets one set of
        types and one reading of a cell serve both surfaces.

        It exists as its own read because nothing else could answer it. The
        contents list counts touched segments per page but names none of them,
        and the editor's endpoint is one page at a time: composing the queue
        from those would mean six requests fetching 1 281 rows to find the four
        that are waiting, and it would grow a request per page every time the
        corpus does.

        Settled proposals travel too — a field that was rejected last week is
        context for the proposal standing on it today — and the client decides
        what to draw.
        """
        segment_ids = set(
            CopyProposal.objects.filter(status__in=OPEN_STATUSES).values_list(
                "segment_id", flat=True
            )
        )
        if not segment_ids:
            return ()
        segments = list(
            CopySegment.objects.filter(id__in=segment_ids).order_by(
                "scope", "order", "key", "locale"
            )
        )
        return cls._project(segments, user)

    @classmethod
    def site_index(cls, *, locale: str, user: User) -> tuple[SiteIndexRowDTO, ...]:
        """Every field of the site in one locale, for the comment mode.

        The whole locale rather than one scope, because a page prints far more
        than its own scope: the notice block, the vault and every concert title
        in the chrome reach most routes. The mode finds fields by their text, so
        it needs all of them.

        `mine` is the reader's open proposal or, failing that, their accepted
        one that is not yet applied: the preview would otherwise vanish the
        moment a reviewer accepts the edit and stay gone until the deploy. An
        accepted proposal counts only while it is the decision `copy:apply`
        writes last into the field — the latest accepted, the order
        `mark_applied` follows — since a later acceptance of somebody else's
        wording means the reader's will never be published. Rejected and applied
        proposals drop out; the page then shows what it publishes.
        """
        segments = list(
            CopySegment.objects.filter(locale=locale).order_by("scope", "order", "key")
        )
        if not segments:
            return ()

        is_source = locale == SiteLocale.POLISH
        polish_values: dict[str, str] = {}
        current_hashes: dict[str, str] = {}
        if not is_source:
            polish_values, current_hashes = cls._polish_sources(None)

        viewer_id = getattr(user, "id", None)
        own_open: dict[UUID, CopyProposal] = {}
        shipping: dict[UUID, CopyProposal] = {}
        others_open: dict[UUID, int] = {}
        # Oldest decision first, so the last accepted proposal per segment is
        # the one left standing. One open proposal per author per segment, so
        # the reader's open one needs no ordering.
        for proposal in (
            CopyProposal.objects.filter(segment__locale=locale)
            .filter(
                Q(status__in=OPEN_STATUSES)
                | Q(status=ProposalStatus.ACCEPTED, applied_at__isnull=True)
            )
            .order_by("reviewed_at", "created_at")
        ):
            if proposal.status == ProposalStatus.ACCEPTED:
                shipping[proposal.segment_id] = proposal
            elif proposal.author_id == viewer_id:
                own_open[proposal.segment_id] = proposal
            else:
                others_open[proposal.segment_id] = others_open.get(proposal.segment_id, 0) + 1

        rows: list[SiteIndexRowDTO] = []
        for segment in segments:
            own = own_open.get(segment.id)
            if own is None:
                decided = shipping.get(segment.id)
                if decided is not None and decided.author_id == viewer_id:
                    own = decided
            is_stale, _known = cls._staleness(
                segment.locale, segment.source_hash, current_hashes.get(segment.key, "")
            )
            rows.append(
                SiteIndexRowDTO(
                    id=segment.id,
                    key=segment.key,
                    scope=segment.scope,
                    scope_label=segment.scope_label,
                    scope_path=segment.scope_path,
                    label=segment.label,
                    kind=segment.kind,
                    value=segment.value,
                    fallback_value=(
                        polish_values.get(segment.key, "") if not segment.value else ""
                    ),
                    is_stale=is_stale,
                    mine=(
                        SiteIndexProposalDTO(
                            id=own.id,
                            status=own.status,
                            value=own.value,
                            comment=own.comment,
                            self_accepted=own.is_self_accepted,
                        )
                        if own is not None
                        else None
                    ),
                    others_open=others_open.get(segment.id, 0),
                )
            )
        return tuple(rows)

    @staticmethod
    def patch_summary() -> PatchSummaryDTO:
        """What is accepted and still only a decision.

        The counterpart to `CopyDeskPatchView`, which hands the apply script the
        rows themselves: this is the same set, as a person needs to read it —
        how many fields, on which pages, and how long the oldest has been
        waiting. Accepting settles nothing on the public site, so a reviewer who
        never runs `copy:apply` has a growing pile of decisions nobody has
        committed, and this is the only place that says so.
        """
        proposals = list(
            CopyProposal.objects.filter(
                status=ProposalStatus.ACCEPTED, applied_at__isnull=True
            ).select_related("segment")
        )
        if not proposals:
            return PatchSummaryDTO()

        labels: dict[str, str] = {}
        segments_by_scope: dict[str, set[UUID]] = {}
        for proposal in proposals:
            segment = proposal.segment
            labels.setdefault(segment.scope, segment.scope_label or segment.scope)
            segments_by_scope.setdefault(segment.scope, set()).add(segment.id)

        decisions = [p.reviewed_at for p in proposals if p.reviewed_at is not None]
        return PatchSummaryDTO(
            rows=sum(len(ids) for ids in segments_by_scope.values()),
            scopes=tuple(
                PatchScopeDTO(scope=scope, label=labels[scope], rows=len(ids))
                for scope, ids in sorted(segments_by_scope.items())
            ),
            since=_iso(min(decisions)) if decisions else None,
        )

    @classmethod
    def scope_summaries(cls, *, user: User) -> tuple[ScopeSummaryDTO, ...]:
        """The contents list: every page of the corpus with its counts.

        Assembled in Python over the whole mirror rather than as grouped
        aggregates, because `stale` is not a column — it is a comparison against
        a Polish value that may itself only exist as a proposal. At ~500 segments
        across three locales this is one pass over a small table, and a query
        that cannot express the state honestly is not the cheaper option.

        `seen_at` is the reader's watermark on that page and the surface's own
        divider: a page with one is REVIEWED, a page without one has never been,
        and the two counts beside it (`new`, `changed`) say whether it has moved
        since. None of the three is a state anybody maintains — see
        `CopyScopeVisit` — which is what keeps the split free of tick-boxes.
        """
        segments = list(CopySegment.objects.all().order_by("scope", "order", "key"))
        if not segments:
            return ()

        current_hashes = cls.effective_source_hashes({s.key for s in segments})
        watermarks = cls.watermarks(user=user)

        # The two figures answer different questions, which is why one counts
        # everybody's proposals and the other only the reader's. TOUCHED is a
        # state the page is in — work standing on it right now, whoever is doing
        # it — and an editor who cannot see that a colleague is mid-way through a
        # page loses a real fact. ACCEPTED is a verdict, and a verdict is feedback
        # to the person whose words were settled; somebody else's, once written
        # into the repository, is simply the text the site holds. Without the
        # split, a bulk translation import — one accepted proposal per cell —
        # would report a permanent "142 accepted" on every page of the corpus,
        # against work the reader never did and cannot act on.
        viewer_id = getattr(user, "id", None)
        touched_ids: set[UUID] = set()
        accepted_ids: set[UUID] = set()
        for segment_id, proposal_status, author_id in CopyProposal.objects.values_list(
            "segment_id", "status", "author_id"
        ):
            if proposal_status in OPEN_STATUSES:
                touched_ids.add(segment_id)
            elif proposal_status == ProposalStatus.ACCEPTED and author_id == viewer_id:
                accepted_ids.add(segment_id)

        summaries: dict[str, _ScopeCounts] = {}
        for segment in segments:
            bucket = summaries.setdefault(segment.scope, _ScopeCounts())
            if not bucket.label and segment.scope_label:
                bucket.label = segment.scope_label
            if not bucket.path and segment.scope_path:
                bucket.path = segment.scope_path
            bucket.seen_at = watermarks.get(segment.scope)
            bucket.segments += 1
            bucket.touched += int(segment.id in touched_ids)
            bucket.accepted += int(segment.id in accepted_ids)
            # The same pair of comparisons the row-level flags make, and they
            # have to stay the same pair: a page reporting "3 new" whose rows
            # carry four chips is a count nobody can check.
            mark = bucket.seen_at
            bucket.new += int(mark is None or segment.created_at > mark)
            bucket.changed += int(
                mark is not None and segment.created_at <= mark < segment.updated_at
            )
            is_stale, _known = cls._staleness(
                segment.locale, segment.source_hash, current_hashes.get(segment.key, "")
            )
            bucket.stale += int(is_stale)

        return tuple(
            ScopeSummaryDTO(
                scope=scope,
                label=counts.label,
                path=counts.path,
                segments=counts.segments,
                touched=counts.touched,
                accepted=counts.accepted,
                new=counts.new,
                changed=counts.changed,
                stale=counts.stale,
                seen_at=_iso(counts.seen_at),
            )
            for scope, counts in summaries.items()
        )

    # -- writes -------------------------------------------------------------- #

    @staticmethod
    def _decided_polish(key: str) -> str:
        """The Polish a translation of `key` will be published beside.

        The latest accepted Polish proposal `copy:apply` has not written yet,
        else what the repository holds. An open Polish proposal is not counted:
        it may never ship, and a translation checked against it could end up
        published beside the Polish it replaced.
        """
        decided = (
            CopyProposal.objects.filter(
                segment__key=key,
                segment__locale=SiteLocale.POLISH,
                status=ProposalStatus.ACCEPTED,
                applied_at__isnull=True,
            )
            .order_by("-reviewed_at", "-created_at")
            .values_list("value", flat=True)
            .first()
        )
        if decided is not None:
            return decided
        published = (
            CopySegment.objects.filter(key=key, locale=SiteLocale.POLISH)
            .values_list("value", flat=True)
            .first()
        )
        return published or ""

    @classmethod
    def held_back(
        cls, *, segment: CopySegment, value: str, author: User
    ) -> HoldReason | None:
        """Why a trusted translator's save of `value` waits for a review.

        None wherever trust does not apply (a Polish segment, any other author):
        such a proposal is not held back, it goes the usual way. `value` is the
        stored one, after the sanitizer.
        """
        if segment.locale == SiteLocale.POLISH or not user_is_trusted_translator(author):
            return None
        return hold_reason(
            value=value, polish=cls._decided_polish(segment.key), kind=segment.kind
        )

    @classmethod
    def save_proposal(
        cls, *, dto: ProposalWriteDTO, author: User
    ) -> CopyProposal:
        """Create or revise this author's open proposal for a segment.

        One open proposal per person per segment, revised in place: the desk's
        editor autosaves, and a row per keystroke would bury the reviewer. A
        second editor's open proposal on the same segment is left alone — the
        reviewer sees both and decides, rather than one person's words silently
        replacing another's.

        A trusted translator's proposal outside Polish is accepted on save once
        it passes `held_back`, reviewed by its author. Their next save revises
        that row while it is unapplied (`self_accepted_filter`), instead of
        adding one per save; a row somebody else accepted is a decision and
        stays as it is. A held save is an open proposal beside the acceptance,
        and the next save that passes accepts it in place of the acceptance. An
        unchanged value is a note, not a change, so it waits for the reviewers
        like any other proposal, unless it takes back the author's own accepted
        change.
        """
        try:
            segment = CopySegment.objects.get(id=dto.segment_id)
        except CopySegment.DoesNotExist:
            raise SegmentNotFoundError(str(dto.segment_id))

        value = sanitize_for_kind(dto.value, segment.kind)
        # Stamped against the Polish as it stands at THIS moment, which is what
        # makes the row auditable later: the reviewer can tell a translation
        # written against today's source from one written against last month's.
        stamped_hash = (
            ""
            if segment.locale == SiteLocale.POLISH
            else cls.effective_source_hashes([segment.key]).get(segment.key, "")
        )
        accept_on_save = (
            dto.status == ProposalStatus.PROPOSED
            and segment.locale != SiteLocale.POLISH
            and user_is_trusted_translator(author)
            and cls.held_back(segment=segment, value=value, author=author) is None
        )

        def open_proposal() -> CopyProposal | None:
            return (
                CopyProposal.objects.select_for_update()
                .filter(segment=segment, author=author, status__in=OPEN_STATUSES)
                .first()
            )

        def own_acceptance() -> CopyProposal | None:
            return (
                CopyProposal.objects.select_for_update()
                .filter(self_accepted_filter(), segment=segment, author=author)
                .order_by("-reviewed_at", "-created_at")
                .first()
            )

        def accept(existing: CopyProposal | None) -> CopyProposal:
            now = timezone.now()
            if existing is None:
                try:
                    # Two tabs saving an untranslated field at once both find
                    # nothing to revise; the loser's insert fails on
                    # `unique_own_acceptance_per_author` and revises the winner.
                    with transaction.atomic():
                        return CopyProposal.objects.create(
                            segment=segment,
                            author=author,
                            value=value,
                            comment=dto.comment,
                            status=ProposalStatus.ACCEPTED,
                            accepted_on_save=True,
                            source_hash=stamped_hash,
                            reviewed_by=author,
                            reviewed_at=now,
                        )
                except IntegrityError:
                    existing = own_acceptance()
                    if existing is None:
                        raise
            # An open proposal the digest announced as waiting is news again
            # once it is accepted, and so is a new value. The published value
            # is not: nothing waits for publication, so nothing is announced.
            is_news = existing.value != value or existing.status != ProposalStatus.ACCEPTED
            existing.value = value
            existing.comment = dto.comment
            existing.status = ProposalStatus.ACCEPTED
            existing.accepted_on_save = True
            existing.source_hash = stamped_hash
            existing.reviewed_by = author
            # The latest decision is the one `copy:apply` writes last.
            existing.reviewed_at = now
            if value == segment.value:
                existing.notified_at = existing.notified_at or now
            elif is_news:
                existing.notified_at = None
            existing.save(update_fields=[
                "value", "comment", "status", "accepted_on_save", "source_hash",
                "reviewed_by", "reviewed_at", "notified_at", "updated_at",
            ])
            return existing

        def revise(existing: CopyProposal) -> CopyProposal:
            value_changed = existing.value != value
            existing.value = value
            existing.comment = dto.comment
            existing.status = dto.status
            existing.source_hash = stamped_hash
            if value_changed:
                # A revised proposal is news a second time: the digest that
                # already went out described wording that no longer stands.
                existing.notified_at = None
            existing.save(update_fields=[
                "value", "comment", "status", "source_hash", "notified_at", "updated_at",
            ])
            return existing

        with transaction.atomic():
            proposal = open_proposal()
            acceptance = own_acceptance() if accept_on_save else None
            if value == segment.value and acceptance is None:
                accept_on_save = False
            if accept_on_save:
                if proposal is not None and acceptance is not None:
                    # A save the guard held back left this open proposal
                    # beside the acceptance. Accepted, it replaces both: the
                    # acceptance it supersedes must not ship, nor come back
                    # when the author withdraws this one.
                    acceptance.delete()
                proposal = accept(proposal or acceptance)
            elif proposal is not None:
                proposal = revise(proposal)
            else:
                try:
                    # A savepoint of its own: two tabs saving a field for the first
                    # time at once both find nothing to revise, and the loser's
                    # insert fails on `unique_open_proposal_per_author`. Rolling
                    # back to here keeps the outer transaction usable.
                    with transaction.atomic():
                        proposal = CopyProposal.objects.create(
                            segment=segment,
                            author=author,
                            value=value,
                            comment=dto.comment,
                            status=dto.status,
                            source_hash=stamped_hash,
                        )
                except IntegrityError:
                    winner = open_proposal()
                    if winner is None:
                        raise
                    proposal = revise(winner)

        logger.info(
            "[CopyDesk] %s proposal on %s [%s] by UID:%s",
            proposal.status, segment.key, segment.locale, getattr(author, "id", None),
        )
        return proposal

    @classmethod
    def withdraw_proposal(cls, *, proposal_id: UUID, author: User) -> None:
        """An editor takes back their own open proposal.

        Or their own accepted one while nobody but they reviewed it and
        `copy:apply` has not written it: the acceptance was only theirs.

        Soft-deleted rather than erased, so a sitting's record survives even the
        parts of it the editor thought better of.
        """
        proposal = CopyProposal.objects.filter(id=proposal_id, author=author).first()
        if proposal is None:
            raise ProposalNotFoundError(str(proposal_id))
        if not (proposal.is_open or proposal.is_self_accepted):
            raise ProposalClosedError(str(proposal_id))
        proposal.delete()

    @staticmethod
    def _recheck_own_acceptances(*, key: str, polish: str) -> None:
        """Send the translations of `key` accepted on save back to the queue
        when they no longer fit the Polish just decided.

        The guard read them against the Polish decided when they were saved. A
        later Polish decision that changes a slot or a link would ship beside a
        translation nobody has read against it, and `copy:apply` checks neither.
        Where the author already has an open proposal on the field, that one
        holds their later words and waits for the review, so the acceptance is
        withdrawn instead (one open proposal per author per segment).
        """
        stale = (
            CopyProposal.objects.select_for_update()
            .filter(self_accepted_filter(), segment__key=key)
            .exclude(segment__locale=SiteLocale.POLISH)
            .select_related("segment")
        )
        for proposal in stale:
            if hold_reason(
                value=proposal.value, polish=polish, kind=proposal.segment.kind
            ) is None:
                continue
            has_open = CopyProposal.objects.filter(
                segment_id=proposal.segment_id,
                author_id=proposal.author_id,
                status__in=OPEN_STATUSES,
            ).exists()
            if has_open:
                proposal.delete()
            else:
                proposal.status = ProposalStatus.PROPOSED
                proposal.accepted_on_save = False
                proposal.reviewed_by = None
                proposal.reviewed_at = None
                # Announced again, now as a proposal waiting for a verdict.
                proposal.notified_at = None
                proposal.save(update_fields=[
                    "status", "accepted_on_save", "reviewed_by", "reviewed_at",
                    "notified_at", "updated_at",
                ])
            logger.info(
                "[CopyDesk] Own acceptance %s on %s [%s] %s: the Polish changed its slots or links.",
                proposal.id, key, proposal.segment.locale,
                "withdrawn" if has_open else "sent back to the queue",
            )

    @classmethod
    def review_proposal(
        cls, *, proposal_id: UUID, dto: ProposalReviewDTO, reviewer: User
    ) -> CopyProposal:
        """Accept or reject, optionally correcting the wording first.

        Accepting does NOT touch the site and does not touch competing proposals
        on the same segment. It marks a value as one the reviewer intends to
        commit; `apply-copy` writes it into the repository and stamps
        `applied_at`, and only a `git diff` puts it in front of a reader. The
        one exception is a translation accepted on save that the accepted
        Polish no longer fits (`_recheck_own_acceptances`).
        """
        proposal = (
            CopyProposal.objects.select_related("segment").filter(id=proposal_id).first()
        )
        if proposal is None:
            raise ProposalNotFoundError(str(proposal_id))
        if not proposal.is_open:
            raise ProposalClosedError(str(proposal_id))

        value = (
            proposal.value
            if dto.value is None
            else sanitize_for_kind(dto.value, proposal.segment.kind)
        )
        if dto.status == ProposalStatus.ACCEPTED and not value:
            raise EmptyAcceptanceError(str(proposal_id))

        fields = ["status", "reviewed_by", "reviewed_at", "updated_at"]
        if dto.value is not None:
            proposal.value = value
            fields.append("value")
        if dto.comment is not None:
            proposal.comment = dto.comment
            fields.append("comment")

        proposal.status = dto.status
        proposal.reviewed_by = reviewer
        proposal.reviewed_at = timezone.now()
        with transaction.atomic():
            proposal.save(update_fields=fields)
            if (
                proposal.status == ProposalStatus.ACCEPTED
                and proposal.segment.locale == SiteLocale.POLISH
            ):
                cls._recheck_own_acceptances(key=proposal.segment.key, polish=value)

        logger.info(
            "[CopyDesk] %s %s [%s] by UID:%s",
            proposal.status, proposal.segment.key, proposal.segment.locale,
            getattr(reviewer, "id", None),
        )
        return proposal

    @classmethod
    def mark_applied(
        cls, *, proposal_ids: Sequence[UUID], reviewer: User
    ) -> ApplyStampResultDTO:
        """Record that `apply-copy` has written these accepted values into the repo.

        Two things happen together, and they have to: `applied_at` is stamped —
        which is what takes the proposal out of the patch — and the proposal's
        `source_hash` is carried onto its segment. That second half is §6c's
        second defect. Without it nothing ever writes `CopySegment.source_hash`,
        so every translation row reports "provenance unknown" in perpetuity and
        the stale state — §2 made mechanical, the entire reason the hash exists —
        never fires once.

        This is the ONE write into the mirror that is not the extractor's, and it
        is narrow on purpose: the caller has just written this exact string into
        the working tree, so the projection is being told what git now holds
        rather than the database being promoted to source of truth. The extractor
        remains the authority and the next `copy:sync` confirms it (or corrects
        it, if the file write did not land). The segment's VALUE moves for the
        same reason — leaving it behind would mean a Polish edit and the
        translations written against it were applied in one patch and the
        translations still read as stale, because staleness is measured against
        the Polish the mirror holds.

        Applied oldest-decision-first, so that where two accepted proposals
        compete for one segment the row that ends up in the mirror is the one the
        apply script wrote last into the file.
        """
        ids = list(proposal_ids)
        if not ids:
            return ApplyStampResultDTO()

        proposals = list(
            CopyProposal.objects.filter(id__in=ids)
            .select_related("segment")
            .order_by("reviewed_at")
        )
        found = {proposal.id for proposal in proposals}
        missing = [value for value in ids if value not in found]
        if missing:
            raise UnknownProposalsError(missing)

        applied = 0
        skipped: list[SkippedProposalDTO] = []
        now = timezone.now()

        with transaction.atomic():
            for proposal in proposals:
                if proposal.applied_at is not None:
                    # A script that wrote the files and lost the response has to
                    # be able to say so again without being told it is wrong.
                    skipped.append(SkippedProposalDTO(id=proposal.id, reason="already_applied"))
                    continue
                if proposal.status != ProposalStatus.ACCEPTED:
                    # A race: rejected between reading the patch and writing it.
                    # Reported rather than raised, because the files are already
                    # written and the `git diff` is the backstop.
                    skipped.append(SkippedProposalDTO(id=proposal.id, reason="not_accepted"))
                    continue

                segment = proposal.segment
                segment.value = proposal.value
                # Blank on the Polish column by construction: a source renders
                # nothing, so it has no provenance to record.
                segment.source_hash = "" if segment.is_source else proposal.source_hash
                segment.save(update_fields=["value", "source_hash", "updated_at"])

                proposal.applied_at = now
                # `updated_at` left alone deliberately, as in the digest's claim:
                # the desk shows that column as when the EDITOR last worked on
                # the segment, and applying is bookkeeping done by somebody else.
                proposal.save(update_fields=["applied_at"])
                applied += 1

        logger.info(
            "[CopyDesk] Applied %d proposal(s), skipped %d, by UID:%s",
            applied, len(skipped), getattr(reviewer, "id", None),
        )
        return ApplyStampResultDTO(applied=applied, skipped=tuple(skipped))

    @classmethod
    def mark_scope_seen(cls, *, user: User, scope: str) -> datetime:
        """Declare one page reviewed by this reader, and return the new mark.

        The only writer of a watermark, and it is always a deliberate act: the
        desk offers it at the foot of a page, where a reader who has actually
        read one is standing. Nothing stamps on arrival or on departure — see
        `CopyScopeVisit` for why an opened page is not a reviewed page.

        Re-declaring moves the mark forward rather than adding a row, so "changed
        since you reviewed this" is always measured from the last time the reader
        said so. A scope with no segments is still stampable: the mirror is
        refreshed independently of the desk, and refusing would make the answer
        depend on whether the extractor had run.
        """
        now = timezone.now()
        visit, created = CopyScopeVisit.objects.get_or_create(
            user=user, scope=scope, defaults={"seen_at": now}
        )
        if not created:
            visit.seen_at = now
            visit.save(update_fields=["seen_at", "updated_at"])
        return now
