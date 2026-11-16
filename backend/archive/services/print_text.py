"""
@file print_text.py
@description Reads a piece's preference on printing its sung text in a score book:
    the fingerprint of the lyrics an analysis assessed, and whether the stored
    recommendation still speaks for the lyrics as they are now. The score book's
    card resolution (roster.score_package_config) is the only consumer that acts
    on it; the archive and the cockpit only report it.
@module archive/services/print_text
"""

from __future__ import annotations

import hashlib
import unicodedata
from dataclasses import dataclass
from typing import Literal, TypedDict

from archive.models import Piece, PrintTextChoice

Verdict = Literal["omit", "keep"]


@dataclass(frozen=True)
class PrintTextRecommendation:
    """One stored analysis answer. ``verdict`` is ``None`` when the analysis
    was unsure: it then recommends nothing and the book's defaults hold."""

    verdict: Verdict | None
    reason: str
    source: str
    lyrics_sha: str
    assessed_at: str


class PrintTextRecommendationSummary(TypedDict):
    verdict: Verdict | None
    reason: str
    # False once the lyrics changed after the assessment: the verdict is then
    # shown for review and applied to nothing.
    is_current: bool


def lyrics_fingerprint(piece: Piece) -> str:
    """SHA-256 of the sung text with case, Unicode form and whitespace
    normalised, so re-wrapping lines or fixing capitals does not send an
    assessment back for review while any change of words does."""
    text = unicodedata.normalize("NFC", piece.lyrics_original or "").casefold()
    normalised = " ".join(text.split())
    return hashlib.sha256(normalised.encode("utf-8")).hexdigest()


def stored_recommendation(piece: Piece) -> PrintTextRecommendation | None:
    """The stored recommendation, current or not. A malformed value reads as
    none: it is the analysis's output and must never break a book."""
    raw = piece.print_text_recommendation
    if not isinstance(raw, dict):
        return None
    lyrics_sha = raw.get("lyrics_sha")
    if not isinstance(lyrics_sha, str) or not lyrics_sha:
        return None
    verdict_raw = raw.get("verdict")
    verdict: Verdict | None = None
    if verdict_raw == PrintTextChoice.OMIT:
        verdict = "omit"
    elif verdict_raw == PrintTextChoice.KEEP:
        verdict = "keep"
    reason = raw.get("reason")
    source = raw.get("source")
    assessed_at = raw.get("assessed_at")
    return PrintTextRecommendation(
        verdict=verdict,
        reason=reason if isinstance(reason, str) else "",
        source=source if isinstance(source, str) else "",
        lyrics_sha=lyrics_sha,
        assessed_at=assessed_at if isinstance(assessed_at, str) else "",
    )


def current_recommendation(piece: Piece) -> PrintTextRecommendation | None:
    """The recommendation that applies to the lyrics as they are now: one with
    a verdict, assessed on text with today's fingerprint. Anything else (none
    stored, unsure, stale) leaves the book's editorial defaults alone."""
    recommendation = stored_recommendation(piece)
    if recommendation is None or recommendation.verdict is None:
        return None
    if recommendation.lyrics_sha != lyrics_fingerprint(piece):
        return None
    return recommendation


def recommendation_summary(piece: Piece) -> PrintTextRecommendationSummary | None:
    """What the archive card and the cockpit show of the stored recommendation."""
    recommendation = stored_recommendation(piece)
    if recommendation is None:
        return None
    return {
        "verdict": recommendation.verdict,
        "reason": recommendation.reason,
        "is_current": recommendation.lyrics_sha == lyrics_fingerprint(piece),
    }


__all__ = [
    "PrintTextRecommendation",
    "PrintTextRecommendationSummary",
    "Verdict",
    "current_recommendation",
    "lyrics_fingerprint",
    "recommendation_summary",
    "stored_recommendation",
]
