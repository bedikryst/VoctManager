"""
@file annotation_stamps.py
@description Server-side mirror of the musical stamp catalogue — the choir-markup
    vocabulary (breath and its refusal, articulation, dynamics, the navigation
    signs, tempo words and the conductor's cues) that `payload.symbol` names. The
    editor's catalogue lives in
    ``frontend/src/features/annotations/lib/stamps.tsx``; this is the same
    vocabulary in the language the print overlay speaks, so a symbol the choir
    placed on screen prints as the same shape on the page.

    Two catalogues is a deliberate trade: the frontend's is TSX (React elements),
    and importing that into Python is not on the table. What matters is that the
    IDS never diverge — a symbol the editor can place but the printer cannot draw
    prints NOTHING where the conductor expected a mark — so a parity test asserts
    the two id sets are identical, and this file must be updated in the same
    change as the TSX one. The editor's palette GROUPS are not mirrored here:
    print has no palette, and a grouping is a fact about a toolbar.
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
    for dynamics); an svg stamp strokes ``paths`` inside ``view_box``, plus any
    filled ``dots`` (cx, cy, r) — the fermata's eye, the segno's pair, or the
    staccato dot, which is nothing but a dot.
    """

    id: str
    size_fraction: float
    glyph: str = ""
    view_box: str = ""
    paths: tuple[str, ...] = ()
    dots: tuple[tuple[float, float, float], ...] = ()

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


def _word(stamp_id: str, glyph: str) -> StampDef:
    return StampDef(id=stamp_id, glyph=glyph, size_fraction=0.026)


STAMPS: tuple[StampDef, ...] = (
    # Breath, holds and silences.
    StampDef(id="breath", glyph="’", size_fraction=0.05),  # noqa: RUF001 — a breath mark IS an apostrophe
    StampDef(
        id="nobreath", size_fraction=0.035,
        view_box="0 0 16 16",
        paths=("M6 3 C 10 5, 10 9, 5 12", "M2 13.5 L 14 2.5"),
    ),
    StampDef(id="caesura", glyph="//", size_fraction=0.03),
    StampDef(
        id="cutoff", size_fraction=0.03,
        view_box="0 0 14 16",
        paths=("M2 1.5 L12 1.5", "M7 1.5 L7 14.5"),
    ),
    StampDef(
        id="fermata", size_fraction=0.035,
        view_box="0 0 24 15",
        paths=("M2 13 A 10 10 0 0 1 22 13",),
        dots=((12.0, 11.0, 2.0),),
    ),
    StampDef(id="gp", glyph="G.P.", size_fraction=0.03),
    # Articulation.
    StampDef(id="accent", glyph=">", size_fraction=0.032),
    StampDef(
        id="marcato", size_fraction=0.024,
        view_box="0 0 16 14",
        paths=("M2 12 L8 2 L14 12",),
    ),
    StampDef(
        id="staccato", size_fraction=0.012,
        view_box="0 0 10 10",
        dots=((5.0, 5.0, 3.0),),
    ),
    StampDef(
        id="tenuto", size_fraction=0.022,
        view_box="0 0 16 6",
        paths=("M2 3 L14 3",),
    ),
    # Dynamics.
    _dynamic("pp"),
    _dynamic("p"),
    _dynamic("mp"),
    _dynamic("mf"),
    _dynamic("f"),
    _dynamic("ff"),
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
    # Navigation.
    StampDef(
        id="segno", size_fraction=0.035,
        view_box="0 0 20 20",
        paths=(
            "M15.5 4.5 C 12 0.5, 6.5 2, 6.5 6 C 6.5 9.5, 13.5 10.5, 13.5 14"
            " C 13.5 18, 8 19.5, 4.5 15.5",
            "M4 5.5 L16 14.5",
        ),
        dots=((15.0, 5.0, 1.3), (5.0, 15.0, 1.3)),
    ),
    StampDef(
        id="coda", size_fraction=0.035,
        view_box="0 0 20 20",
        paths=(
            "M5 10 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0",
            "M10 1.5 L10 18.5",
            "M1.5 10 L18.5 10",
        ),
    ),
    StampDef(id="dc", glyph="D.C.", size_fraction=0.028),
    StampDef(id="ds", glyph="D.S.", size_fraction=0.028),
    # Tempo.
    _word("rit", "rit."),
    _word("accel", "accel."),
    _word("atempo", "a tempo"),
    _word("subito", "subito"),
    # Cues.
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
        id="raise", size_fraction=0.028,
        view_box="0 0 12 18",
        paths=("M6 17 L6 2", "M1.5 7 L6 2 L10.5 7"),
    ),
    StampDef(
        id="lower", size_fraction=0.028,
        view_box="0 0 12 18",
        paths=("M6 1 L6 16", "M1.5 11 L6 16 L10.5 11"),
    ),
)

_INDEX: dict[str, StampDef] = {stamp.id: stamp for stamp in STAMPS}


def get_stamp(symbol: str) -> StampDef | None:
    """The stamp a payload's ``symbol`` names, or None for an id this build does
    not know (a mark placed by a newer client) — the caller draws nothing rather
    than a broken glyph."""
    return _INDEX.get(symbol)


__all__ = ["STAMPS", "StampDef", "get_stamp"]
