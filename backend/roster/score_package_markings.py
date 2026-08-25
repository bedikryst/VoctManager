"""
@file score_package_markings.py
@description Read-side census of the conductor's ``shared`` markings for a whole
    programme: per program item, how many of his marks the book would actually
    print, how many the page trim drops on the floor, when the newest one was
    made, and whether the marks live on an edition the item no longer binds.

    Two consumers, one query. The staleness hash needs a fingerprint — draw a new
    mark and the finished book must stop reading "Gotowa". The cockpit needs the
    same numbers as a warning, because the two ways a marking silently fails to
    print (it sits outside the bound page range; it belongs to a different
    edition of the piece) are both invisible in the built PDF: the page simply
    comes out blank where the conductor expected his cue.
@architecture Enterprise SaaS 2026
@module roster/score_package_markings
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from archive.models import SHARED_ANNOTATION_LAYER, Annotation
from roster.models import ProgramItem
from roster.score_package_config import resolve_item_edition, resolve_item_page_window

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
    #: Newest ``updated_at`` among the marks that print; drives the staleness hash.
    latest: datetime | None = None

    @property
    def total_relevant(self) -> int:
        return self.inside + self.outside

    def fingerprint(self) -> str:
        """Stable string for the source hash. Only marks that actually print
        belong in it: a mark outside the trim changes nothing about the book, so
        it must not flag a perfectly current book as stale."""
        if not self.inside:
            return "0"
        stamp = self.latest.isoformat() if self.latest else ""
        return f"{self.inside}:{stamp}"


def compute_program_markings(items: list[ProgramItem]) -> dict[Any, ItemMarkings]:
    """Census for every item, keyed by item id. One query for the whole
    programme — including the other editions of each piece, which is what makes
    the "your marks are on the edition you unpinned" alarm possible."""
    if not items:
        return {}

    piece_ids = {item.piece_id for item in items}
    rows = (
        Annotation.objects
        .filter(
            edition__piece_id__in=piece_ids,
            edition__is_deleted=False,
            layer_name=SHARED_ANNOTATION_LAYER,
            is_deleted=False,
        )
        .values_list("edition_id", "edition__piece_id", "page_number", "updated_at")
    )

    # (piece, edition) -> [(page, updated_at), …]
    by_edition: dict[tuple[Any, Any], list[tuple[int, datetime]]] = {}
    for edition_id, piece_id, page_number, updated_at in rows:
        by_edition.setdefault((piece_id, edition_id), []).append((page_number, updated_at))

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
        inside = [(page, ts) for page, ts in bound if first <= page <= last]
        outside = len(bound) - len(inside)
        elsewhere = sum(
            len(marks)
            for (piece_id, edition_id), marks in by_edition.items()
            if piece_id == item.piece_id and edition_id != edition.pk
        )
        result[item.pk] = ItemMarkings(
            inside=len(inside),
            outside=outside,
            elsewhere=elsewhere,
            latest=max((ts for _, ts in inside), default=None),
        )
    return result


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
    "ItemMarkings",
    "compute_program_markings",
    "markings_status",
]
