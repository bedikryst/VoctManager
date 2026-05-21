"""
===============================================================================
Score Package Compiler — PDF Text Extractor
===============================================================================
Domain: Archive / Ingestion
Description:
    Thin wrapper over `pypdf` for extracting text from uploaded score PDFs.

    Scope (Phase 2):
      * Front-matter text — first N pages, enough to identify title, composer,
        opus, voicing. Capped to control downstream AI token cost.
      * Total page count — written back to ScoreEdition.page_count.
      * Computed SHA-256 of the raw PDF bytes — used for dedup at upload time.

    Out of scope (yet):
      * OCR fallback for scanned PDFs without a text layer. If extraction
        returns empty text, callers should mark the edition FAILED with
        reason 'no_text_layer' and surface a re-scan / OCR action to the
        conductor. Adding Tesseract is a Phase 6 (Polish) decision.

Standards: SaaS 2026, pypdf 5+ (the modern fork, PyPDF2 is retired).
===============================================================================
"""
from __future__ import annotations

import contextlib
import hashlib
import io
import logging
from dataclasses import dataclass
from typing import BinaryIO

from pypdf import PdfReader
from pypdf.errors import PdfReadError

logger = logging.getLogger(__name__)


# How many pages to scan for front-matter extraction. Three pages comfortably
# covers cover + title + (optional) table of contents on a typical vocal score.
DEFAULT_FRONT_MATTER_PAGES: int = 3

# Hard cap on extracted character count per call. A few KB is plenty for the
# AI to identify a work; anything past this is index/footer noise that wastes
# both AI tokens and reasoning.
MAX_EXTRACTED_CHARS: int = 12_000


@dataclass(frozen=True)
class ExtractedPdf:
    """Result of running the extractor over one PDF."""
    sha256: str
    page_count: int
    front_matter_text: str  # may be empty if PDF has no text layer


class PdfExtractionError(Exception):
    """Raised when pypdf can't parse the file at all (corrupted / encrypted)."""


def extract(file_handle: BinaryIO) -> ExtractedPdf:
    """
    Hash + parse a PDF from a binary file handle (e.g., Django's FieldFile).
    The handle's position is restored after reading so the caller can re-stream
    the file (e.g., to S3) without a separate open.
    """
    start_pos = file_handle.tell()
    try:
        raw = file_handle.read()
        sha = hashlib.sha256(raw).hexdigest()

        try:
            reader = PdfReader(io.BytesIO(raw))
        except PdfReadError as exc:
            raise PdfExtractionError(f"pypdf could not parse PDF: {exc}") from exc

        if reader.is_encrypted:
            # Try empty password first (some scores ship with empty-pw "protection").
            try:
                reader.decrypt('')
            except Exception:
                raise PdfExtractionError("PDF is password-protected.") from None

        page_count = len(reader.pages)
        front_matter_text = _extract_front_matter(reader, DEFAULT_FRONT_MATTER_PAGES)

        logger.info(
            "pdf.extracted sha256=%s pages=%d front_chars=%d",
            sha[:12], page_count, len(front_matter_text),
        )
        return ExtractedPdf(
            sha256=sha,
            page_count=page_count,
            front_matter_text=front_matter_text,
        )
    finally:
        # FieldFile may not be seekable post-read; safe to swallow.
        with contextlib.suppress(OSError, ValueError):
            file_handle.seek(start_pos)


def _extract_front_matter(reader: PdfReader, max_pages: int) -> str:
    """Concatenate text from the first `max_pages` pages, capped at MAX_EXTRACTED_CHARS."""
    chunks: list[str] = []
    total_chars = 0
    for index in range(min(max_pages, len(reader.pages))):
        try:
            text = (reader.pages[index].extract_text() or '').strip()
        except Exception as exc:
            # pypdf occasionally throws on unusual page structures; log + skip.
            logger.warning("pdf.page_extract_failed page=%d err=%s", index + 1, exc)
            continue
        if not text:
            continue

        remaining = MAX_EXTRACTED_CHARS - total_chars
        if remaining <= 0:
            break
        if len(text) > remaining:
            text = text[:remaining]
        chunks.append(f"--- Page {index + 1} ---\n{text}")
        total_chars += len(text)

    return '\n\n'.join(chunks)
