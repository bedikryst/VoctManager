"""
@file print_fonts.py
@description Deterministic print typography for WeasyPrint artifacts. The score
    book's templates used to ask for Georgia/Times — fonts that exist on a
    Windows dev host but not in the Linux runtime image, so line wrapping (and
    therefore verse layout) silently differed between preview and production.
    This module is the single source of truth for the bundled book face:
    Gentium Plus (SIL OFL), shipped in ``backend/assets/fonts`` and injected as
    ``@font-face`` rules with absolute file URIs, which WeasyPrint resolves
    identically on every OS. Missing files degrade to the system serif stack
    instead of failing the build.
@architecture Enterprise SaaS 2026
@module roster/infrastructure/print_fonts
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

FONT_DIR: Path = Path(__file__).resolve().parents[2] / "assets" / "fonts"

# The full family: regular for verse, italic for notes, bold for titles/heads.
_FACES: tuple[tuple[str, str, str], ...] = (
    ("GentiumPlus-Regular.ttf", "normal", "normal"),
    ("GentiumPlus-Italic.ttf", "italic", "normal"),
    ("GentiumPlus-Bold.ttf", "normal", "bold"),
    ("GentiumPlus-BoldItalic.ttf", "italic", "bold"),
)

# What templates put in `font-family`. Gentium Plus first; the legacy stack
# stays behind it so a host missing the bundled files still prints something.
BOOK_FONT_STACK: str = '"Gentium Plus", Georgia, "Times New Roman", serif'


@lru_cache(maxsize=1)
def font_face_css() -> str:
    """``@font-face`` rules for every bundled face that exists on disk, keyed by
    absolute ``file://`` URI so the rendered PDF never depends on host font
    installation. Cached — the bundle is immutable at runtime."""
    rules: list[str] = []
    for filename, style, weight in _FACES:
        path = FONT_DIR / filename
        if not path.is_file():
            continue
        rules.append(
            '@font-face { font-family: "Gentium Plus";'
            f" font-style: {style}; font-weight: {weight};"
            f' src: url("{path.as_uri()}") format("truetype"); }}'
        )
    return "\n".join(rules)


__all__ = ["BOOK_FONT_STACK", "FONT_DIR", "font_face_css"]
