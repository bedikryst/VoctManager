"""
@file print_fonts.py
@description Deterministic print typography for WeasyPrint artifacts. The score
    book's templates used to ask for Georgia/Times — fonts that exist on a
    Windows dev host but not in the Linux runtime image, so line wrapping (and
    therefore verse layout) silently differed between preview and production.
    This module is the single source of truth for the bundled faces, shipped in
    ``backend/assets/fonts`` and injected as ``@font-face`` rules with absolute
    file URIs, which WeasyPrint resolves identically on every OS. Two families,
    by audience: Gentium Plus (SIL OFL) for the score book, and the brand pair
    IBM Plex Sans + Cormorant Garamond (both SIL OFL) for documents an outside
    reader receives. Missing files degrade to a generic stack instead of failing
    the render. No template may reach for a webfont CDN: a PDF that fetches its
    type at render time both leaks the request and prints differently the day
    the network blinks.
@architecture Enterprise SaaS 2026
@module roster/infrastructure/print_fonts
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

FONT_DIR: Path = Path(__file__).resolve().parents[2] / "assets" / "fonts"

# (filename, family, font-style, font-weight)
_Face = tuple[str, str, str, str]

# The score book's family: regular for verse, italic for notes, bold for titles/heads.
_BOOK_FACES: tuple[_Face, ...] = (
    ("GentiumPlus-Regular.ttf", "Gentium Plus", "normal", "normal"),
    ("GentiumPlus-Italic.ttf", "Gentium Plus", "italic", "normal"),
    ("GentiumPlus-Bold.ttf", "Gentium Plus", "normal", "bold"),
    ("GentiumPlus-BoldItalic.ttf", "Gentium Plus", "italic", "bold"),
)

# The brand family, for documents that represent the foundation to an outside
# reader (contracts) rather than the ensemble to itself (the score book). Same
# two voices as the panel and the public site, so a signed contract and the app
# that issued it are recognisably one institution. Static instances rather than
# the web build's variable files: WeasyPrint selects a face through fontconfig,
# where a weight axis is not a reliable selector.
_BRAND_FACES: tuple[_Face, ...] = (
    ("IBMPlexSans-Regular.ttf", "IBM Plex Sans", "normal", "400"),
    ("IBMPlexSans-SemiBold.ttf", "IBM Plex Sans", "normal", "600"),
    ("IBMPlexSans-Bold.ttf", "IBM Plex Sans", "normal", "700"),
    ("CormorantGaramond-Regular.ttf", "Cormorant Garamond", "normal", "400"),
    ("CormorantGaramond-SemiBold.ttf", "Cormorant Garamond", "normal", "600"),
    ("CormorantGaramond-Italic.ttf", "Cormorant Garamond", "italic", "400"),
)

# What templates put in `font-family`. The bundled face first; a generic stack
# stays behind it so a host missing the bundled files still prints something.
BOOK_FONT_STACK: str = '"Gentium Plus", Georgia, "Times New Roman", serif'
BRAND_SANS_STACK: str = '"IBM Plex Sans", "DejaVu Sans", sans-serif'
BRAND_SERIF_STACK: str = '"Cormorant Garamond", "DejaVu Serif", serif'


def _face_css(faces: tuple[_Face, ...]) -> str:
    """``@font-face`` rules for every given face that exists on disk, keyed by
    absolute ``file://`` URI so the rendered PDF never depends on host font
    installation. A missing file is skipped rather than fatal — the stack's
    generic tail then carries that face."""
    rules: list[str] = []
    for filename, family, style, weight in faces:
        path = FONT_DIR / filename
        if not path.is_file():
            continue
        rules.append(
            f'@font-face {{ font-family: "{family}";'
            f" font-style: {style}; font-weight: {weight};"
            f' src: url("{path.as_uri()}") format("truetype"); }}'
        )
    return "\n".join(rules)


@lru_cache(maxsize=1)
def font_face_css() -> str:
    """Score-book faces (Gentium Plus). Cached — the bundle is immutable at runtime."""
    return _face_css(_BOOK_FACES)


@lru_cache(maxsize=1)
def brand_font_face_css() -> str:
    """Brand faces (IBM Plex Sans + Cormorant Garamond) for outward-facing documents."""
    return _face_css(_BRAND_FACES)


__all__ = [
    "BOOK_FONT_STACK",
    "BRAND_SANS_STACK",
    "BRAND_SERIF_STACK",
    "FONT_DIR",
    "brand_font_face_css",
    "font_face_css",
]
