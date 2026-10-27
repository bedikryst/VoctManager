"""
@file score_package_markings.py
@description What the database knows about the marks on a book — the read side of
    every layer that can reach a printed copy.

    For the conductor's ``shared`` layer, a census of the whole programme: per
    program item, how many of his marks a copy of the book would actually carry,
    how many the page trim drops on the floor, and whether the marks live on an
    edition the item no longer binds. The cockpit shows these as warnings,
    because the two ways a marking silently fails to print (it sits outside the
    bound page range; it belongs to a different edition of the piece) are both
    invisible in the PDF: the page simply comes out blank where the conductor
    expected his cue.

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
)
from roster.infrastructure.score_markings import PrintMark, marks_from_annotations
from roster.models import ProgramItem
from roster.score_package_config import resolve_item_edition, resolve_item_page_window
from roster.score_page_map import music_pages

# The cockpit's traffic light for an item's markings.
MARKINGS_OFF = "off"                       # the book does not print markings
MARKINGS_NONE = "none"                     # nothing drawn on this piece
MARKINGS_READY = "ready"                   # every mark prints
MARKINGS_PARTIAL = "partial"               # some fall outside the bound pages
MARKINGS_WRONG_EDITION = "wrong_edition"   # the marks are on an edition not bound


@dataclass(frozen=True)
class ItemMarkings:
    """What the conductor's shared layer means for one program item."""

    #: Marks on the bound edition, inside the pages the book binds — these print.
    inside: int = 0
    #: Marks on the bound edition but outside the trim — these are dropped.
    outside: int = 0
    #: Marks on a DIFFERENT edition of the same piece. Pinning another edition
    #: discards every one of them, and nothing else in the cockpit says so.
    elsewhere: int = 0

    @property
    def total_relevant(self) -> int:
        return self.inside + self.outside


def compute_program_markings(items: list[ProgramItem]) -> dict[Any, ItemMarkings]:
    """Census for every item, keyed by item id. One query for the whole
    programme — including the other editions of each piece, which is what makes
    the "your marks are on the edition you unpinned" alarm possible."""
    if not items:
        return {}

    piece_ids = {item.piece_id for item in items}
    # Marks the conductor set aside print nowhere, so they warn about nothing.
    rows = (
        Annotation.objects
        .filter(
            edition__piece_id__in=piece_ids,
            edition__is_deleted=False,
            layer_name=SHARED_ANNOTATION_LAYER,
            is_deleted=False,
            archived_at__isnull=True,
        )
        .values_list("edition_id", "edition__piece_id", "page_number")
    )

    # (piece, edition) -> [page, …]
    by_edition: dict[tuple[Any, Any], list[int]] = {}
    for edition_id, piece_id, page_number in rows:
        by_edition.setdefault((piece_id, edition_id), []).append(page_number)

    result: dict[Any, ItemMarkings] = {}
    for item in items:
        edition = resolve_item_edition(item)
        if edition is None:
            # No edition binds, so nothing of his prints — but marks may still be
            # waiting on an edition that exists; count them as "elsewhere".
            elsewhere = sum(
                len(marks)
                for (piece_id, _), marks in by_edition.items()
                if piece_id == item.piece_id
            )
            result[item.pk] = ItemMarkings(elsewhere=elsewhere)
            continue

        first, last = resolve_item_page_window(item, edition)
        bound = by_edition.get((item.piece_id, edition.pk), [])
        inside = sum(1 for page in bound if first <= page <= last)
        elsewhere = sum(
            len(marks)
            for (piece_id, edition_id), marks in by_edition.items()
            if piece_id == item.piece_id and edition_id != edition.pk
        )
        result[item.pk] = ItemMarkings(
            inside=inside,
            outside=len(bound) - inside,
            elsewhere=elsewhere,
        )
    return result


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


def servable_layers(layers: Sequence[str], *, include_markings: bool) -> list[str]:
    """The asked-for layers this book may actually carry.

    ``shared`` only while the book's ``include_markings`` is on: whether the
    conductor's marks travel with copies of the book is his switch, and a reader
    asking for them does not overrule it. Asking anyway is not an error — the
    copy is the plain book, which is exactly what the switch says it is.
    """
    return [
        layer for layer in layers
        if include_markings or layer != SHARED_ANNOTATION_LAYER
    ]


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
    rows = list(
        Annotation.objects
        .filter(
            scope, edition_id__in=editions, edition__is_deleted=False,
            is_deleted=False, archived_at__isnull=True,
        )
        .order_by("created_at")
    )
    if not rows:
        return ReaderMarks(by_source={}, fingerprint="0")
    # Full precision: an edit in the same second as the copy cached before it
    # must still name a new composition.
    latest = max(row.updated_at for row in rows)
    return ReaderMarks(
        by_source=marks_from_annotations(rows),
        fingerprint=f"{'+'.join(sorted(wanted))}:{len(rows)}:{latest.isoformat()}",
        per_reader=PERSONAL_ANNOTATION_LAYER in wanted,
    )


def markings_status(markings: ItemMarkings, enabled: bool) -> str:
    """The cockpit's traffic light for one item's markings.

    ``enabled`` is the book-wide toggle: with markings off nothing is wrong with
    an item that has none, so the light is 'off' rather than a gap to nag about.
    """
    if not enabled:
        return MARKINGS_OFF
    if markings.inside == 0 and markings.elsewhere > 0:
        # The marks exist but the bound edition is not the annotated one.
        return MARKINGS_WRONG_EDITION
    if markings.inside == 0:
        return MARKINGS_NONE
    if markings.outside > 0:
        return MARKINGS_PARTIAL
    return MARKINGS_READY


__all__ = [
    "MARKINGS_NONE",
    "MARKINGS_OFF",
    "MARKINGS_PARTIAL",
    "MARKINGS_READY",
    "MARKINGS_WRONG_EDITION",
    "READER_MARK_LAYERS",
    "ItemMarkings",
    "ReaderMarks",
    "compute_program_markings",
    "markings_status",
    "reader_marks_for_book",
    "servable_layers",
]
