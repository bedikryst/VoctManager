"""
@file pdf_raster.py
@description Page rasteriser for the score-book build cockpit. Turns each page of
    an edition PDF into a tiny WebP thumbnail so the conductor can *see* where the
    music starts and trim the publisher's front matter by eye, instead of typing
    page numbers blind. Pure CPU, no AI, never mutates the source. Isolated in the
    infrastructure layer (like the WeasyPrint adapter) so the rasteriser engine can
    be swapped without touching domain logic, and so its native dependency loads
    lazily — a host without PDFium degrades to manual page-number entry rather than
    breaking the cockpit.
@architecture Enterprise SaaS 2026
@module roster/infrastructure/pdf_raster
"""

from __future__ import annotations

import logging
from io import BytesIO

logger = logging.getLogger(__name__)

# Thumbnails exist to let the conductor *recognise* a page (publisher front matter
# vs the first system of music), not to read it. A small width keeps the rendered
# manifest light and the round-trip fast.
DEFAULT_THUMBNAIL_WIDTH_PX = 150
# A scanned full score can run to dozens of pages; cap the strip so one runaway
# edition cannot rasterise hundreds of bitmaps into a single response.
MAX_THUMBNAIL_PAGES = 80
# WebP encode quality — high enough to tell staves from text at thumbnail size,
# low enough that an 80-page edition stays well under a megabyte in the manifest.
_WEBP_QUALITY = 72


class PdfRasterDependencyError(RuntimeError):
    """Raised when the PDFium rasteriser cannot be loaded on this host, so callers
    can degrade gracefully instead of surfacing a 500."""


def render_pdf_thumbnails(
    pdf_bytes: bytes,
    *,
    width_px: int = DEFAULT_THUMBNAIL_WIDTH_PX,
    max_pages: int = MAX_THUMBNAIL_PAGES,
) -> list[bytes]:
    """
    Rasterise each page of a PDF to a small WebP thumbnail — one ``bytes`` blob per
    page, in page order, capped at ``max_pages``.

    Raises ``PdfRasterDependencyError`` when PDFium is unavailable so the cockpit
    can fall back to manual page-number entry rather than failing the request.
    """
    try:
        import pypdfium2 as pdfium
    except (ImportError, OSError) as exc:
        raise PdfRasterDependencyError(
            "pypdfium2 is unavailable or its native library could not be loaded."
        ) from exc

    from PIL import Image

    pdf = pdfium.PdfDocument(pdf_bytes)
    try:
        thumbnails: list[bytes] = []
        for index in range(min(len(pdf), max_pages)):
            page = pdf[index]
            try:
                page_width = float(page.get_size()[0]) or 1.0
                # Downscale to the target width; never upscale a tiny page past 4x.
                scale = min(width_px / page_width, 4.0)
                bitmap = page.render(scale=scale)
                try:
                    image = bitmap.to_pil()
                finally:
                    bitmap.close()
            finally:
                page.close()
            # Flatten onto white — engraving is black-on-white, so an alpha channel
            # only inflates the WebP and risks a black background in some viewers.
            if image.mode in ("RGBA", "LA", "P"):
                background = Image.new("RGB", image.size, (255, 255, 255))
                rgba = image.convert("RGBA")
                background.paste(rgba, mask=rgba.split()[-1])
                image = background
            else:
                image = image.convert("RGB")
            buffer = BytesIO()
            image.save(buffer, format="WEBP", quality=_WEBP_QUALITY, method=6)
            thumbnails.append(buffer.getvalue())
        return thumbnails
    finally:
        pdf.close()


__all__ = [
    "DEFAULT_THUMBNAIL_WIDTH_PX",
    "MAX_THUMBNAIL_PAGES",
    "PdfRasterDependencyError",
    "render_pdf_thumbnails",
]
