"""
@file score_package_markings.py
@description What the database knows about the marks on a book — the read side of
    every layer that can reach a printed copy.

    For the conductor's ``shared`` layer, a census of the whole programme,
    taken whether or not the book currently hands those marks out: per program
    item, how many of his marks the STORED book carries, how many wait on a
    rebuild because the draft binds pages the stored book lacks, how many the
    page trim drops on the floor, and whether the marks live on an edition the
    item no longer binds. The cockpit shows these as warnings, because every one
    of those ways a marking silently fails to print is invisible in the PDF: the
    page simply comes out blank where the conductor expected his cue.

    For the whole stored book, how many marks of each layer that is not
    per-reader would land on it, so the cockpit can offer exactly the copies
    that differ from the clean one.

    For a download, the serve-time composition: the marks of the asked-for
    layers on the editions this stored book binds, plus a fingerprint of them,
    since the composed copy is cached and a new mark has to invalidate it. The
    stored book itself carries none. The page map is what says which editions
    those are — a hand-uploaded book has none, and then no mark can be placed at
    all.
@module roster/score_package_markings
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

from django.db.models import Q

from archive.models import (
    CONDUCTOR_ANNOTATION_LAYER,
    LEADER_ANNOTATION_LAYER,
    PERSONAL_ANNOTATION_LAYER,
    SHARED_ANNOTATION_LAYER,
    Annotation,
    AnnotationType,
)
from roster.infrastructure.score_markings import (
    RENDERER_VERSION,
    PrintMark,
    marks_from_annotations,
)
from roster.models import ProgramItem
from roster.score_package_config import resolve_item_edition, resolve_item_page_window
from roster.score_page_map import music_pages

# The cockpit's traffic light for an item's markings. It describes the marks,
# not the book's distribution switch: a manager deciding whether to hand the
# marks out needs to know what is there while they are still withheld.
MARKINGS_NONE = "none"                     # nothing drawn on this piece
MARKINGS_READY = "ready"                   # every mark is on the stored book
MARKINGS_PENDING = "pending"               # some wait for a rebuild to reach the book
MARKINGS_PARTIAL = "partial"               # some fall outside the bound pages
MARKINGS_WRONG_EDITION = "wrong_edition"   # the marks are on an edition not bound


@dataclass(frozen=True)
class ItemMarkings:
    """What the conductor's shared layer means for one program item."""

    #: Marks on the bound edition, inside the pages the draft binds — these print
    #: once the book carries those pages.
    inside: int = 0
    #: Marks on the bound edition but outside the trim — these are dropped.
    outside: int = 0
    #: Marks on a DIFFERENT edition of the same piece. Pinning another edition
    #: discards every one of them, and nothing else in the cockpit says so.
    elsewhere: int = 0
    #: Marks that land on this item's pages of the STORED book: what a copy
    #: downloaded right now can carry.
    on_book: int = 0
    #: Marks inside the draft's pages whose source page the stored book does not
    #: bind — a newly chosen edition, a widened range. A rebuild brings them in.
    pending: int = 0

    @property
    def total_relevant(self) -> int:
        return self.inside + self.outside


def _book_sources_by_item(page_map: list[Any]) -> dict[str, list[tuple[str, int]]]:
    """Which (edition, source page) each item's music pages of the stored book
    show, one entry per bound sheet."""
    by_item: dict[str, list[tuple[str, int]]] = {}
    for row in music_pages(page_map):
        item = row.get("item")
        edition = row.get("edition")
        src_page = row.get("src_page")
        if item and edition and src_page is not None:
            by_item.setdefault(str(item), []).append((edition, src_page))
    return by_item


def compute_program_markings(
    items: list[ProgramItem],
    page_map: list[Any] | None = None,
) -> dict[Any, ItemMarkings]:
    """Census for every item, keyed by item id. One query for the whole
    programme — including the other editions of each piece, which is what makes
    the "your marks are on the edition you unpinned" alarm possible.

    ``page_map`` is the stored book's map. Without one (no book yet, or a book
    uploaded by hand) nothing is on a book and nothing is pending against one.
    """
    if not items:
        return {}
    book_sources = _book_sources_by_item(page_map or [])

    piece_ids = {item.piece_id for item in items}
    # Marks the conductor set aside print nowhere, so they warn about nothing;
    # nor does a jump link, which never prints.
    rows = (
        Annotation.objects
        .filter(
            edition__piece_id__in=piece_ids,
            edition__is_deleted=False,
            layer_name=SHARED_ANNOTATION_LAYER,
            is_deleted=False,
            archived_at__isnull=True,
        )
        .exclude(annotation_type=AnnotationType.LINK)
        .values_list("edition_id", "edition__piece_id", "page_number")
    )

    # (piece, edition) -> [page, …]
    by_edition: dict[tuple[Any, Any], list[int]] = {}
    # (edition, page) -> how many marks sit there
    by_source: dict[tuple[str, int], int] = {}
    for edition_id, piece_id, page_number in rows:
        by_edition.setdefault((piece_id, edition_id), []).append(page_number)
        key = (str(edition_id), int(page_number))
        by_source[key] = by_source.get(key, 0) + 1

    result: dict[Any, ItemMarkings] = {}
    for item in items:
        stored = book_sources.get(str(item.pk), [])
        on_book = sum(by_source.get(source, 0) for source in stored)
        edition = resolve_item_edition(item)
        if edition is None:
            # No edition binds, so nothing of his prints — but marks may still be
            # waiting on an edition that exists; count them as "elsewhere".
            elsewhere = sum(
                len(marks)
                for (piece_id, _), marks in by_edition.items()
                if piece_id == item.piece_id
            )
            result[item.pk] = ItemMarkings(elsewhere=elsewhere, on_book=on_book)
            continue

        first, last = resolve_item_page_window(item, edition)
        bound = by_edition.get((item.piece_id, edition.pk), [])
        inside = sum(1 for page in bound if first <= page <= last)
        elsewhere = sum(
            len(marks)
            for (piece_id, edition_id), marks in by_edition.items()
            if piece_id == item.piece_id and edition_id != edition.pk
        )
        stored_pages = set(stored)
        pending = (
            sum(
                1 for page in bound
                if first <= page <= last and (str(edition.pk), page) not in stored_pages
            )
            if page_map else 0
        )
        result[item.pk] = ItemMarkings(
            inside=inside,
            outside=len(bound) - inside,
            elsewhere=elsewhere,
            on_book=on_book,
            pending=pending,
        )
    return result


@dataclass(frozen=True)
class LayerCensus:
    """How one layer's marks fall on the stored book."""

    #: Marks that land, counted once per bound sheet they land on.
    marks: int = 0
    #: Distinct pages of the book carrying at least one of them.
    sheets: int = 0


#: Layers whose marks read the same for every reader allowed to ask for them,
#: so one census of the stored book serves the whole cockpit.
BOOK_WIDE_LAYERS: tuple[str, ...] = (
    SHARED_ANNOTATION_LAYER,
    CONDUCTOR_ANNOTATION_LAYER,
    LEADER_ANNOTATION_LAYER,
)


def book_layer_census(page_map: list[Any]) -> dict[str, LayerCensus]:
    """For each book-wide layer, what a copy carrying it would add to the stored
    book. One query; the payloads are never loaded. Planned the way
    `plan_markings` plans a download — a mark lands on every sheet that binds
    its source page — so these counts are the ones a composed copy shows."""
    rows_by_source: dict[tuple[str, int], list[int]] = {}
    for row in music_pages(page_map):
        edition = row.get("edition")
        src_page = row.get("src_page")
        if edition and src_page is not None:
            rows_by_source.setdefault((edition, src_page), []).append(row["phys"])
    if not rows_by_source:
        return {layer: LayerCensus() for layer in BOOK_WIDE_LAYERS}

    editions = {edition for edition, _ in rows_by_source}
    marks: dict[str, int] = dict.fromkeys(BOOK_WIDE_LAYERS, 0)
    sheets: dict[str, set[int]] = {layer: set() for layer in BOOK_WIDE_LAYERS}
    rows = (
        Annotation.objects
        .filter(
            layer_name__in=BOOK_WIDE_LAYERS,
            edition_id__in=editions,
            edition__is_deleted=False,
            is_deleted=False,
            archived_at__isnull=True,
        )
        .exclude(annotation_type=AnnotationType.LINK)
        .values_list("layer_name", "edition_id", "page_number")
    )
    for layer, edition_id, page_number in rows:
        landed = rows_by_source.get((str(edition_id), int(page_number)), [])
        marks[layer] += len(landed)
        sheets[layer].update(landed)
    return {
        layer: LayerCensus(marks=marks[layer], sheets=len(sheets[layer]))
        for layer in BOOK_WIDE_LAYERS
    }


@dataclass(frozen=True)
class ReaderMarks:
    """The marks one download asked for, on the book it is about to receive."""

    by_source: dict[tuple[str, int], list[PrintMark]]
    #: Changes whenever anything about those marks changes — the serve-time cache
    #: key carries it, so a mark drawn a second ago cannot be served from the copy
    #: composed a minute ago.
    fingerprint: str
    #: Whether the composition depends on who asked. Only ``personal`` is scoped
    #: to the reader; every other layer reads the same for everyone allowed to
    #: ask for it, so a copy without it is one cache entry for the whole choir
    #: rather than one per singer.
    per_reader: bool = False

    def __bool__(self) -> bool:
        return bool(self.by_source)


class MarkAudience(StrEnum):
    """Who may ask for a layer to be drawn onto their own download."""

    #: Anyone who may open the book at all.
    ANY = 'any'
    #: Managers only.
    MANAGER = 'manager'
    #: Managers, and whoever runs the project this book belongs to.
    LEADER = 'leader'


#: What a reader may ask to have drawn onto their download, and who may ask.
#: ``shared`` is the conductor's message to the choir and every copy that leaves
#: the app asks for it, but it is served only while the book's own switch is on
#: (see `servable_layers`); ``personal`` is scoped to the asker; ``conductor`` is
#: the maestro's own cue layer, which nobody else ever receives; ``leader`` is
#: the layer written FOR a stand-in, so it travels to the stand and to the hand
#: that wrote it.
#:
#: A three-valued audience rather than a manager_only boolean because a stand-in
#: is neither a manager nor just any reader, and collapsing that into "not a
#: manager" is what would hand them a printed copy with the one layer they were
#: given missing from it.
READER_MARK_LAYERS: dict[str, MarkAudience] = {
    SHARED_ANNOTATION_LAYER: MarkAudience.ANY,
    PERSONAL_ANNOTATION_LAYER: MarkAudience.ANY,
    CONDUCTOR_ANNOTATION_LAYER: MarkAudience.MANAGER,
    LEADER_ANNOTATION_LAYER: MarkAudience.LEADER,
}


def servable_layers(
    layers: Sequence[str],
    *,
    include_markings: bool,
    is_manager: bool = False,
    legacy_ink: bool = False,
) -> list[str]:
    """The asked-for layers this book may actually carry.

    ``shared`` reaches a singer only while the book's ``include_markings`` is
    on: whether the conductor's marks travel with the choir's copies is his
    switch, and a reader asking for them does not overrule it. Asking anyway is
    not an error — the copy is the plain book, which is exactly what the switch
    says it is. A manager is the one who decides, so his own copies (the music
    desk's, the stand-in's) carry the layer whatever the switch says; the
    cockpit asks for the choir's copy by the switch's value, never past it.

    A book from a builder that still baked the shared layer into its pages
    (``legacy_ink``) is never given it again: composing it would print every
    one of those marks twice.
    """
    def keeps(layer: str) -> bool:
        if layer != SHARED_ANNOTATION_LAYER:
            return True
        if legacy_ink:
            return False
        return include_markings or is_manager

    return [layer for layer in layers if keeps(layer)]


def reader_marks_for_book(
    page_map: list[Any],
    user: Any,
    layers: Sequence[str] = (PERSONAL_ANNOTATION_LAYER,),
) -> ReaderMarks:
    """The marks on the editions this book binds that ``user`` asked to see.

    ``personal`` is scoped by ``created_by`` as well as by layer — a personal
    layer is nobody else's business, and this path composes a file that leaves
    the building. ``shared``, ``conductor`` and ``leader`` are not per-user: one
    is the conductor's word to the choir, one the layer a manager keeps for
    himself, the other the layer he writes for whoever takes the evening, so
    every copy of any of them carries the same cues. WHO may ask for which layer
    is the view's decision, not this function's.

    Which pages of those editions are actually bound is not decided here either
    — the page map decides it later, in one place, exactly as the build does.
    """
    editions = {row["edition"] for row in music_pages(page_map) if row.get("edition")}
    wanted = list(dict.fromkeys(layer for layer in layers if layer in READER_MARK_LAYERS))
    if not editions or not wanted:
        return ReaderMarks(by_source={}, fingerprint="0")
    if user is None or not getattr(user, "is_authenticated", False):
        return ReaderMarks(by_source={}, fingerprint="0")

    scope = Q()
    for layer in wanted:
        clause = Q(layer_name=layer)
        if layer == PERSONAL_ANNOTATION_LAYER:
            clause &= Q(created_by=user)
        scope |= clause

    # A soft-deleted edition takes its marks with it, as in the reader's list.
    # A jump link prints nothing, so it neither composes a copy nor moves the
    # cache key of one.
    rows = list(
        Annotation.objects
        .filter(
            scope, edition_id__in=editions, edition__is_deleted=False,
            is_deleted=False, archived_at__isnull=True,
        )
        .exclude(annotation_type=AnnotationType.LINK)
        .order_by("created_at")
    )
    if not rows:
        return ReaderMarks(by_source={}, fingerprint="0")
    # Full precision: an edit in the same second as the copy cached before it
    # must still name a new composition.
    latest = max(row.updated_at for row in rows)
    # The renderer's version is part of the name: the same marks drawn by a
    # corrected renderer are a different copy, and must not be served from the
    # cache entry the previous one left.
    return ReaderMarks(
        by_source=marks_from_annotations(rows),
        fingerprint=(
            f"r{RENDERER_VERSION}:{'+'.join(sorted(wanted))}:{len(rows)}:"
            f"{latest.isoformat()}"
        ),
        per_reader=PERSONAL_ANNOTATION_LAYER in wanted,
    )


def markings_status(markings: ItemMarkings) -> str:
    """The cockpit's traffic light for one item's markings, most actionable
    first: a rebuild that would bring marks in outranks a trim that drops some.

    Independent of the book's distribution switch, which the cockpit states once
    for the whole book rather than on every row.
    """
    if markings.inside == 0 and markings.elsewhere > 0:
        # The marks exist but the bound edition is not the annotated one.
        return MARKINGS_WRONG_EDITION
    if markings.pending > 0:
        return MARKINGS_PENDING
    if markings.outside > 0:
        # Including the case where the trim drops every one of them.
        return MARKINGS_PARTIAL
    if markings.inside == 0 and markings.on_book == 0:
        return MARKINGS_NONE
    return MARKINGS_READY


__all__ = [
    "BOOK_WIDE_LAYERS",
    "MARKINGS_NONE",
    "MARKINGS_PARTIAL",
    "MARKINGS_PENDING",
    "MARKINGS_READY",
    "MARKINGS_WRONG_EDITION",
    "READER_MARK_LAYERS",
    "ItemMarkings",
    "LayerCensus",
    "ReaderMarks",
    "book_layer_census",
    "compute_program_markings",
    "markings_status",
    "reader_marks_for_book",
    "servable_layers",
]
