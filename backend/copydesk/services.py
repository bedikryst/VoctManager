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
from django.db import transaction
from django.db.models import QuerySet
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
    SkippedProposalDTO,
)
from .hashing import source_hash
from .models import (
    OPEN_STATUSES,
    CopyProposal,
    CopySegment,
    ProposalStatus,
    SegmentKind,
    SiteLocale,
    scope_from_key,
)
from .sanitizers import sanitize_html, sanitize_text

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
    segments: int = 0
    touched: int = 0
    accepted: int = 0
    new: int = 0
    stale: int = 0


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
                _segment, was_created = CopySegment.objects.update_or_create(
                    key=row.key,
                    locale=row.locale,
                    defaults={
                        "kind": row.kind,
                        "value": row.value,
                        "scope": scope_from_key(row.key),
                        "scope_label": row.scope_label,
                        "label": row.label,
                        "order": row.order,
                    },
                )
                created += int(was_created)
                updated += int(not was_created)
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

    @staticmethod
    def effective_source_hashes(keys: Iterable[str]) -> dict[str, str]:
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

        polish = CopySegment.objects.filter(key__in=key_list, locale=SiteLocale.POLISH)
        hashes = {segment.key: source_hash(segment.value) for segment in polish}

        pending = (
            CopyProposal.objects.filter(
                segment__key__in=key_list,
                segment__locale=SiteLocale.POLISH,
                status__in=[*OPEN_STATUSES, ProposalStatus.ACCEPTED],
                applied_at__isnull=True,
            )
            .select_related("segment")
            .order_by("updated_at")
        )
        # Ranked in Python, not by `order_by("status")`: the statuses sort
        # alphabetically (ACCEPTED before DRAFT before PROPOSED), which is the
        # reverse of the precedence wanted here and would have quietly let a
        # stale draft outrank the decision that superseded it.
        for proposal in sorted(
            pending, key=lambda p: p.status == ProposalStatus.ACCEPTED
        ):
            hashes[proposal.segment.key] = source_hash(proposal.value)
        return hashes

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

        keys = {segment.key for segment in segments}
        current_hashes = cls.effective_source_hashes(keys)
        polish_values = {
            segment.key: segment.value
            for segment in CopySegment.objects.filter(
                key__in=keys, locale=SiteLocale.POLISH
            )
        }
        seen_at = getattr(getattr(user, "profile", None), "copy_desk_seen_at", None)

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
                seen_at=seen_at,
                user=user,
            )
            for segment in segments
        )

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
            is_new=bool(seen_at is not None and segment.created_at > seen_at),
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
        """The contents list: every page of the corpus with its four counts.

        Assembled in Python over the whole mirror rather than as grouped
        aggregates, because `stale` is not a column — it is a comparison against
        a Polish value that may itself only exist as a proposal. At ~500 segments
        across three locales this is one pass over a small table, and a query
        that cannot express the state honestly is not the cheaper option.
        """
        segments = list(CopySegment.objects.all().order_by("scope", "order", "key"))
        if not segments:
            return ()

        current_hashes = cls.effective_source_hashes({s.key for s in segments})
        seen_at = getattr(getattr(user, "profile", None), "copy_desk_seen_at", None)

        touched_ids: set[UUID] = set()
        accepted_ids: set[UUID] = set()
        for segment_id, proposal_status in CopyProposal.objects.values_list(
            "segment_id", "status"
        ):
            if proposal_status in OPEN_STATUSES:
                touched_ids.add(segment_id)
            elif proposal_status == ProposalStatus.ACCEPTED:
                accepted_ids.add(segment_id)

        summaries: dict[str, _ScopeCounts] = {}
        for segment in segments:
            bucket = summaries.setdefault(segment.scope, _ScopeCounts())
            if not bucket.label and segment.scope_label:
                bucket.label = segment.scope_label
            bucket.segments += 1
            bucket.touched += int(segment.id in touched_ids)
            bucket.accepted += int(segment.id in accepted_ids)
            bucket.new += int(seen_at is not None and segment.created_at > seen_at)
            is_stale, _known = cls._staleness(
                segment.locale, segment.source_hash, current_hashes.get(segment.key, "")
            )
            bucket.stale += int(is_stale)

        return tuple(
            ScopeSummaryDTO(
                scope=scope,
                label=counts.label,
                segments=counts.segments,
                touched=counts.touched,
                accepted=counts.accepted,
                new=counts.new,
                stale=counts.stale,
            )
            for scope, counts in summaries.items()
        )

    # -- writes -------------------------------------------------------------- #

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

        with transaction.atomic():
            proposal = (
                CopyProposal.objects.select_for_update()
                .filter(segment=segment, author=author, status__in=OPEN_STATUSES)
                .first()
            )
            if proposal is None:
                proposal = CopyProposal.objects.create(
                    segment=segment,
                    author=author,
                    value=value,
                    comment=dto.comment,
                    status=dto.status,
                    source_hash=stamped_hash,
                )
            else:
                value_changed = proposal.value != value
                proposal.value = value
                proposal.comment = dto.comment
                proposal.status = dto.status
                proposal.source_hash = stamped_hash
                if value_changed:
                    # A revised proposal is news a second time: the digest that
                    # already went out described wording that no longer stands.
                    proposal.notified_at = None
                proposal.save(update_fields=[
                    "value", "comment", "status", "source_hash", "notified_at", "updated_at",
                ])

        logger.info(
            "[CopyDesk] %s proposal on %s [%s] by UID:%s",
            proposal.status, segment.key, segment.locale, getattr(author, "id", None),
        )
        return proposal

    @classmethod
    def withdraw_proposal(cls, *, proposal_id: UUID, author: User) -> None:
        """An editor takes back their own open proposal.

        Soft-deleted rather than erased, so a sitting's record survives even the
        parts of it the editor thought better of.
        """
        proposal = CopyProposal.objects.filter(id=proposal_id, author=author).first()
        if proposal is None:
            raise ProposalNotFoundError(str(proposal_id))
        if not proposal.is_open:
            raise ProposalClosedError(str(proposal_id))
        proposal.delete()

    @classmethod
    def review_proposal(
        cls, *, proposal_id: UUID, dto: ProposalReviewDTO, reviewer: User
    ) -> CopyProposal:
        """Accept or reject, optionally correcting the wording first.

        Accepting does NOT touch the site and does not touch competing proposals
        on the same segment. It marks a value as one the reviewer intends to
        commit; `apply-copy` writes it into the repository and stamps
        `applied_at`, and only a `git diff` puts it in front of a reader.
        """
        proposal = (
            CopyProposal.objects.select_related("segment").filter(id=proposal_id).first()
        )
        if proposal is None:
            raise ProposalNotFoundError(str(proposal_id))
        if not proposal.is_open:
            raise ProposalClosedError(str(proposal_id))

        fields = ["status", "reviewed_by", "reviewed_at", "updated_at"]
        if dto.value is not None:
            proposal.value = sanitize_for_kind(dto.value, proposal.segment.kind)
            fields.append("value")
        if dto.comment is not None:
            proposal.comment = dto.comment
            fields.append("comment")

        proposal.status = dto.status
        proposal.reviewed_by = reviewer
        proposal.reviewed_at = timezone.now()
        proposal.save(update_fields=fields)

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
    def mark_seen(cls, *, user: User) -> None:
        """Stamp the visit that the new-since-last-visit state is measured from."""
        profile = getattr(user, "profile", None)
        if profile is None:
            return
        profile.copy_desk_seen_at = timezone.now()
        profile.save(update_fields=["copy_desk_seen_at", "updated_at"])
