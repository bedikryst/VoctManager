"""
@file score_folio_review.py
@description What the score book does to an edition's own page numbers, as the
    manager reviews it: the detector's boxes on the visible page and, per
    programme item, which bound pages end up covered.

    Detection reads the whole edition PDF, so it never runs on the cockpit's
    read path or on a download. The edition preview computes it once per file
    and detector version and caches the result; the cockpit only reads that
    cache and says "not checked yet" until the preview has been opened.
@module roster/score_folio_review
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from django.core.cache import cache

from archive.models import ScoreEdition
from roster.infrastructure.score_package_builder import _read_edition_pdf
from roster.infrastructure.score_source_numbering import (
    DETECTOR_VERSION,
    FolioBox,
    detect_edition_folios,
    resolve_page_covers,
    rule_hits,
    source_to_visible,
    visible_frame,
)

logger = logging.getLogger(__name__)

# Detection is a pure function of the bytes, so the entry may live as long as
# the cache keeps anything; a new file or detector changes the key instead.
_CACHE_TIMEOUT_S: int = 60 * 60 * 24 * 90


def _cache_key(edition: ScoreEdition) -> str:
    return f"folio-detect:v{DETECTOR_VERSION}:{edition.pk}:{edition.sha256}"


def automatic_folio_boxes(edition: ScoreEdition) -> list[dict[str, Any]] | None:
    """The detector's boxes over the whole edition, as fractions of each
    visible page: ``[{"page": 1-based, "x", "y", "w", "h"}]``. None when the
    edition has no readable file. Computed once per file and detector version.
    """
    if not edition.pdf_file or not edition.sha256:
        return None
    key = _cache_key(edition)
    cached = cache.get(key)
    if cached is not None:
        return cached.get("boxes")
    try:
        reader = _read_edition_pdf(edition)
        detected = detect_edition_folios(reader)
    except Exception:
        # A file the detector cannot read is reported as unchecked, never as
        # "nothing to cover": the build has its own guard around the same call.
        logger.exception("score_folio_review.detect_failed edition=%s", edition.pk)
        return None
    boxes: list[dict[str, Any]] = []
    for index in sorted(detected):
        frame = visible_frame(reader.pages[index])
        if frame is None:
            continue
        for box in detected[index]:
            visible = source_to_visible(frame, box)
            if visible is None:
                continue
            x, y, w, h = visible
            boxes.append({"page": index + 1, "x": x, "y": y, "w": w, "h": h})
    cache.set(key, {"boxes": boxes}, _CACHE_TIMEOUT_S)
    return boxes


def cached_automatic_folio_boxes(edition: ScoreEdition) -> list[dict[str, Any]] | None:
    """The cached detection only — None when the preview has not computed it."""
    if not edition.sha256:
        return None
    cached = cache.get(_cache_key(edition))
    return None if cached is None else cached.get("boxes")


def _visible_box(rect: dict[str, Any]) -> FolioBox:
    """A visible-page fraction rectangle in FolioBox shape. The y axis runs
    down here; overlap is symmetric in it, so the resolution is the same."""
    return FolioBox(rect["x"], rect["y"], rect["x"] + rect["w"], rect["y"] + rect["h"])


@dataclass(frozen=True)
class FolioCoverage:
    """Which of an item's bound edition pages lose a number in print."""

    #: Pages where a detected number stays covered; None until detection ran.
    automatic_pages: list[int] | None
    #: Pages where a manager's cover rectangle prints.
    manual_pages: list[int]
    #: Pages where a keep cancels at least one cover.
    kept_pages: list[int]

    def as_dict(self) -> dict[str, Any]:
        return {
            "automatic_pages": self.automatic_pages,
            "manual_pages": self.manual_pages,
            "kept_pages": self.kept_pages,
        }


def folio_coverage(
    rules: list[dict[str, Any]],
    automatic: list[dict[str, Any]] | None,
    first: int,
    last: int,
) -> FolioCoverage:
    """Resolve the reviewed rules against the detector's boxes over the bound
    window ``first..last`` (1-based, inclusive) — the same keep-wins rule the
    builder applies, worked in visible-page fractions."""
    by_page: dict[int, list[FolioBox]] = {}
    for rect in automatic or []:
        by_page.setdefault(rect["page"], []).append(_visible_box(rect))
    # Only pages something could touch: a detected box or a rule's range. An
    # edition of unknown length has an open-ended window and must not be walked.
    candidates = set(by_page)
    for rule in rules:
        candidates.update(range(max(first, rule["first"]), min(last, rule["last"]) + 1))
    automatic_pages: list[int] = []
    manual_pages: list[int] = []
    kept_pages: list[int] = []
    for number in sorted(n for n in candidates if first <= n <= last):
        hits = [rule for rule in rules if rule_hits(rule, number)]
        manual = [_visible_box(rule) for rule in hits if rule["mode"] == "cover"]
        keeps = [_visible_box(rule) for rule in hits if rule["mode"] != "cover"]
        auto_printed, auto_cancelled = resolve_page_covers(by_page.get(number, []), [], keeps)
        manual_printed, manual_cancelled = resolve_page_covers([], manual, keeps)
        if auto_printed:
            automatic_pages.append(number)
        if manual_printed:
            manual_pages.append(number)
        if auto_cancelled or manual_cancelled:
            kept_pages.append(number)
    return FolioCoverage(
        automatic_pages=automatic_pages if automatic is not None else None,
        manual_pages=manual_pages,
        kept_pages=kept_pages,
    )
