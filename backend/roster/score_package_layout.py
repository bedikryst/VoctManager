"""
@file score_package_layout.py
@description Pure pagination planner for the concert score book's music body.
    Given each program item's content-page count, it produces the ordered physical
    body pages (with their printed folio and recto/verso side) and, per item, the
    printed page it opens on (for the TOC), its 0-based physical offset (for the PDF
    outline) and whether a blank verso was inserted before it. Isolating this here —
    with no PDF/WeasyPrint/ORM dependency — lets the recto-start + duplex-numbering
    parity be proven in fast unit tests, independent of the (host-unavailable)
    WeasyPrint renderer the builder needs.
@architecture Enterprise SaaS 2026
@module roster/score_package_layout
"""

from __future__ import annotations

from dataclasses import dataclass

# The music body always begins on a recto (odd) page: the builder pads the front
# matter to an even physical page count in duplex mode, and there is no front
# matter to offset it otherwise. So a body page's side is a pure function of its
# 0-based position within the body: even position → recto, odd → verso.


@dataclass(frozen=True)
class BodyPage:
    """One physical page of the music body, in order."""

    kind: str            # "content" (carries music/card) or "spacer" (blank verso)
    folio: int | None    # 1-based printed page number; None for an unnumbered spacer
    is_recto: bool       # right-hand page (outer edge = right) when True


@dataclass(frozen=True)
class ItemPlacement:
    """Where one program item lands in the body, aligned with the input order."""

    folio_start: int     # printed page the item opens on (drives the TOC)
    phys_start: int      # 0-based physical offset of that opening page (drives the outline)
    leading_blank: bool  # a recto-start spacer was inserted immediately before it


@dataclass(frozen=True)
class BodyLayout:
    """The planned body: its ordered pages plus per-item placements."""

    pages: list[BodyPage]
    placements: list[ItemPlacement]
    content_count: int   # numbered pages (excludes spacers)
    physical_count: int  # total body pages (includes spacers)


def plan_body_layout(
    item_page_counts: list[int],
    *,
    recto_start: bool,
) -> BodyLayout:
    """
    Plan the body page sequence from each item's content-page count (cards + music).

    ``recto_start`` (duplex + Concert density) forces every item to open on a recto
    by inserting a blank verso before any item that would otherwise begin on the
    back of a leaf. Spacers never consume a folio, so the printed numbering — and
    therefore the TOC references — stay continuous over content pages only.

    The caller guarantees the body starts on a recto (front matter padded to an even
    page count in duplex mode), so a page's side follows its 0-based body position.
    """
    pages: list[BodyPage] = []
    placements: list[ItemPlacement] = []
    phys = 0     # physical body pages emitted so far (0-based index of the next page)
    folio = 1    # printed page number of the next content page

    for count in item_page_counts:
        leading_blank = False
        # An even ``phys`` means the next page is a recto. If the item would open on
        # a verso, slip in a blank verso so it opens on the following recto instead.
        if recto_start and phys % 2 == 1:
            pages.append(BodyPage(kind="spacer", folio=None, is_recto=False))
            phys += 1
            leading_blank = True

        placements.append(
            ItemPlacement(folio_start=folio, phys_start=phys, leading_blank=leading_blank)
        )

        for _ in range(max(count, 0)):
            pages.append(BodyPage(kind="content", folio=folio, is_recto=(phys % 2 == 0)))
            folio += 1
            phys += 1

    return BodyLayout(
        pages=pages,
        placements=placements,
        content_count=folio - 1,
        physical_count=phys,
    )


__all__ = ["BodyLayout", "BodyPage", "ItemPlacement", "plan_body_layout"]
