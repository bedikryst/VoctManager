"""
@file annotation_stamps.py
@description Server-side mirror of the musical stamp catalogue — the choir-markup
    vocabulary (breath, caesura, fermata, accent, "watch the conductor", hairpins
    and the dynamics) that `payload.symbol` names. The editor's catalogue lives in
    ``frontend/src/features/annotations/lib/stamps.tsx``; this is the same
    vocabulary in the language the print overlay speaks, so a symbol the choir
    placed on screen prints as the same shape on the page.

    Two catalogues is a deliberate trade: the frontend's is TSX (React elements),
    and importing that into Python is not on the table. What matters is that the
    IDS never diverge — a symbol the editor can place but the printer cannot draw
    prints NOTHING where the conductor expected a mark — so a parity test asserts
    the two id sets are identical, and this file must be updated in the same
    change as the TSX one.
@architecture Enterprise SaaS 2026
@module archive/annotation_stamps
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class StampDef:
    """One stamp. ``size_fraction`` is its rendered size as a fraction of the page
    width — the same normalized model the coordinates use, so a stamp keeps its
    proportion whatever the edition's page size is.

    A text stamp draws ``glyph`` in a bold italic serif (the engraving convention
    for dynamics); an svg stamp strokes ``paths`` inside ``view_box``, optionally
    with one filled ``dot`` (cx, cy, r) for the fermata's eye.
    """

    id: str
    size_fraction: float
    glyph: str = ""
    view_box: str = ""
    paths: tuple[str, ...] = ()
    dot: tuple[float, float, float] | None = None

    @property
    def is_text(self) -> bool:
        return not self.view_box

    @property
    def aspect(self) -> float:
        """Height / width of the svg box, for sizing the drawn element."""
        parts = self.view_box.split()
        if len(parts) != 4:
            return 1.0
        try:
            width = float(parts[2])
            height = float(parts[3])
        except ValueError:
            return 1.0
        return height / width if width else 1.0


def _dynamic(mark: str) -> StampDef:
    return StampDef(id=mark, glyph=mark, size_fraction=0.03)


STAMPS: tuple[StampDef, ...] = (
    StampDef(id="breath", glyph="’", size_fraction=0.05),  # noqa: RUF001 — a breath mark IS an apostrophe
    StampDef(id="caesura", glyph="//", size_fraction=0.03),
    StampDef(
        id="fermata", size_fraction=0.035,
        view_box="0 0 24 15",
        paths=("M2 13 A 10 10 0 0 1 22 13",),
        dot=(12.0, 11.0, 2.0),
    ),
    StampDef(id="accent", glyph=">", size_fraction=0.032),
    StampDef(
        id="watch", size_fraction=0.045,
        view_box="0 0 34 14",
        paths=(
            "M2 8 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0",
            "M22 8 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0",
            "M12 7 Q 17 3.5 22 7",
        ),
    ),
    StampDef(
        id="cresc", size_fraction=0.06,
        view_box="0 0 48 16",
        paths=("M46 2 L2 8 L46 14",),
    ),
    StampDef(
        id="dim", size_fraction=0.06,
        view_box="0 0 48 16",
        paths=("M2 2 L46 8 L2 14",),
    ),
    _dynamic("pp"),
    _dynamic("p"),
    _dynamic("mp"),
    _dynamic("mf"),
    _dynamic("f"),
    _dynamic("ff"),
)

_INDEX: dict[str, StampDef] = {stamp.id: stamp for stamp in STAMPS}


def get_stamp(symbol: str) -> StampDef | None:
    """The stamp a payload's ``symbol`` names, or None for an id this build does
    not know (a mark placed by a newer client) — the caller draws nothing rather
    than a broken glyph."""
    return _INDEX.get(symbol)


__all__ = ["STAMPS", "StampDef", "get_stamp"]
