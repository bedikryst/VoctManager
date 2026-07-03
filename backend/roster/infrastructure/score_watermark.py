"""
@file score_watermark.py
@description Server-side personal watermark for protected scores. Stamps a
    single footer line ("Egzemplarz nr N · Imię Nazwisko · Koncert · data") into
    the bottom margin of every page of an already-rendered PDF — the single
    edition OR the concert score-book binder — at serve time, per recipient.

    Overlay-merge ONLY: no page is added or removed and the outline is preserved
    (``PdfWriter.append`` clones the bookmarks), so the binder's page count and
    its outline anchors (``phys_start``) never shift. The footer sits dead-centre
    in the bottom margin, clearing the duplex folio which lives in the OUTER
    corner (see score_package_layout).

    The WeasyPrint render is isolated behind ``render_footer_overlay`` so the
    merge/placement contract is unit-testable on a host without the native
    rendering libraries (which the binder builder also needs).
@architecture Enterprise SaaS 2026
@module roster/infrastructure/score_watermark
"""

from __future__ import annotations

from io import BytesIO

from pypdf import PageObject, PdfReader, PdfWriter

from roster.infrastructure.document_generator import (
    DocumentRenderDependencyError,
    _render_pdf,
)
from roster.infrastructure.print_fonts import BOOK_FONT_STACK, font_face_css

# Bottom margin the footer lives in (PDF points). Big enough to clear engraving,
# small enough to stay in the physical print margin.
_FOOTER_MARGIN_PT: float = 15.0
_FOOTER_FONT_SIZE_PT: float = 7.0
_FOOTER_COLOR: str = "#6b6b6b"


def _css_escape(text: str) -> str:
    """Escape a string for a CSS ``content`` value (backslash + double-quote)."""
    return text.replace("\\", "\\\\").replace('"', '\\"')


def render_footer_overlay(width_pt: float, height_pt: float, footer_text: str) -> PageObject:
    """Render a single transparent page of the given size carrying only the footer,
    centred in the bottom margin. Returns the pypdf page to merge onto a source
    page of the same size. Raises DocumentRenderDependencyError when WeasyPrint's
    native libraries are missing — the caller must then refuse to serve rather
    than hand out an unstamped protected score."""
    html = (
        "<!DOCTYPE html><html><head><meta charset='utf-8'><style>"
        + font_face_css()
        + f"@page {{ size: {width_pt:.2f}pt {height_pt:.2f}pt;"
        f" margin: 0 0 {_FOOTER_MARGIN_PT:.2f}pt 0;"
        " @bottom-center { content: \"" + _css_escape(footer_text) + "\";"
        f" font: {_FOOTER_FONT_SIZE_PT:.1f}pt {BOOK_FONT_STACK};"
        f" color: {_FOOTER_COLOR}; }} }}"
        "</style></head><body></body></html>"
    )
    reader = PdfReader(BytesIO(_render_pdf(html)))
    return reader.pages[0]


def stamp_pdf(pdf_bytes: bytes, footer_text: str) -> bytes:
    """Merge the personal footer onto every page of ``pdf_bytes`` and return the
    new PDF. Page count and outline are preserved. Overlays are memoised per
    distinct page size, so a uniform document renders the footer exactly once."""
    reader = PdfReader(BytesIO(pdf_bytes))
    writer = PdfWriter()
    writer.append(reader)  # clones pages AND the outline / named destinations

    overlays: dict[tuple[float, float], PageObject] = {}
    for page in writer.pages:
        box = page.mediabox
        width = float(box.width)
        height = float(box.height)
        key = (round(width, 1), round(height, 1))
        overlay = overlays.get(key)
        if overlay is None:
            overlay = render_footer_overlay(width, height, footer_text)
            overlays[key] = overlay
        page.merge_page(overlay)

    buffer = BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


__all__ = [
    "DocumentRenderDependencyError",
    "render_footer_overlay",
    "stamp_pdf",
]
