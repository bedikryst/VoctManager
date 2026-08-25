"""
@file score_page_map.py
@description The vocabulary of the score book's page map: what one page of the
    assembled PDF is, and — for a music page — where on the A4 sheet the source
    page was placed. Pure domain (no PDF/ORM deps) so the builder that writes the
    map, the service that stores it and the overlay renderer that reads it all
    speak one language.

    The map exists because the book is a binder: it trims a range out of an
    edition, scales it and re-centres it onto A4. Nothing about that transform
    survives in the finished PDF, so a spot the choir marked on screen — stored
    normalized against the EDITION's page — has no way back to a position in the
    book unless the build records it. This is that record.
@architecture Enterprise SaaS 2026
@module roster/score_page_map
"""

from __future__ import annotations

from typing import Any, Literal, TypedDict

# A4 in PDF points (1pt = 1/72"), 210mm x 297mm. It lives here, in the module
# with no PDF dependencies, because the sheet size is a fact about the book —
# everything that places something on a page derives its frame from these.
A4_WIDTH_PT: float = 595.2756
A4_HEIGHT_PT: float = 841.8898

# What one physical page of the assembled book is.
PageKind = Literal["front", "pad", "spacer", "card", "music"]

KIND_FRONT: PageKind = "front"      # title page / TOC / the Mass texts section
KIND_PAD: PageKind = "pad"          # blank so the body opens on a recto (duplex)
KIND_SPACER: PageKind = "spacer"    # blank verso before a recto-starting item
KIND_CARD: PageKind = "card"        # a rendered frontispiece or placeholder divider
KIND_MUSIC: PageKind = "music"      # one bound source page of an edition

# A placed source page's box on the A4 sheet, in PDF points with the origin at
# the sheet's BOTTOM-LEFT: (x, y, width, height).
PlacedBox = tuple[float, float, float, float]


class PageMapRow(TypedDict, total=False):
    """One page of the assembled book.

    ``phys`` is the 0-based page index in the stored PDF — the index an overlay
    merges onto, so it counts front matter and blanks like any other page.
    ``folio`` is the printed page number, absent on anything unnumbered.
    ``item`` / ``edition`` / ``src_page`` say what the page came from (``src_page``
    is 1-based, matching ``Annotation.page_number``), and ``box`` is where the
    source page landed.
    """

    phys: int
    kind: PageKind
    folio: int | None
    item: str | None
    edition: str | None
    src_page: int | None
    box: list[float] | None


def normalized_to_sheet(box: PlacedBox, nx: float, ny: float) -> tuple[float, float]:
    """Map a normalized point on a source page to a point on the A4 sheet,
    measured in points from the sheet's TOP-LEFT — the frame CSS and SVG use.

    Normalized coordinates run 0..1 across the source page with ``ny`` measured
    from its top (the screen convention the annotation editor stores), while a
    placed box is anchored at the sheet's bottom-left, so the vertical axis
    flips exactly once here and nowhere else.
    """
    x, y, width, height = box
    from_top = A4_HEIGHT_PT - (y + height)
    return x + nx * width, from_top + ny * height


def music_pages(page_map: list[Any]) -> list[PageMapRow]:
    """The rows that carry engraved music, i.e. the only ones a marking can land
    on. Defensive about shape: a map is JSON that outlived the code that wrote
    it, so anything unrecognisable is skipped rather than trusted."""
    rows: list[PageMapRow] = []
    for raw in page_map or []:
        if not isinstance(raw, dict) or raw.get("kind") != KIND_MUSIC:
            continue
        box = raw.get("box")
        if not isinstance(box, (list, tuple)) or len(box) != 4:
            continue
        try:
            phys = int(raw["phys"])
            src_page = int(raw["src_page"])
            values = [float(v) for v in box]
        except (KeyError, TypeError, ValueError):
            continue
        edition = raw.get("edition")
        if not edition:
            continue
        rows.append(PageMapRow(
            phys=phys,
            kind=KIND_MUSIC,
            folio=raw.get("folio"),
            item=raw.get("item"),
            edition=str(edition),
            src_page=src_page,
            box=values,
        ))
    return rows


__all__ = [
    "A4_HEIGHT_PT",
    "A4_WIDTH_PT",
    "KIND_CARD",
    "KIND_FRONT",
    "KIND_MUSIC",
    "KIND_PAD",
    "KIND_SPACER",
    "PageKind",
    "PageMapRow",
    "PlacedBox",
    "music_pages",
    "normalized_to_sheet",
]
