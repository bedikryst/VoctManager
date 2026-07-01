"""
===============================================================================
Score Package Compiler — Sung-Language Normalizer
===============================================================================
Domain: Archive / Ingestion
Description:
    A single source of truth for turning whatever the AI (or an external
    catalogue) reports as the "sung language" into a canonical ISO 639-1 code.

    The problem this solves: `Piece.language` is a free-text column, and the
    vision model reported the same language a dozen different ways — "Polish",
    "polski", "pol", "Polish + Latin" — because it was asked for the language
    twice (a word form AND an ISO code) and two code paths raced to write the
    column. The result was an un-filterable, un-groupable mess. Everything that
    writes `Piece.language` now funnels through `normalize_language`, so the
    stored value is always a lowercase ISO 639-1 code (or a `+`-joined set of
    them for genuinely bilingual scores, e.g. `pl+la`).

    Design:
      * Accepts English names, Polish names, ISO 639-2/3 codes, and already-good
        639-1 codes — the union of everything the model has actually emitted.
      * Splits bilingual answers on the separators the model uses (`+ / , & i`)
        and normalizes each token, preserving order and de-duplicating.
      * Returns '' for anything it cannot map, so a junk value never reaches the
        DB (the review cockpit shows a blank field the conductor can fill).

    UI display (ISO → localised label) is a frontend concern; this module is
    purely the write-side canonicaliser.

Standards: SaaS 2026, one-way normalisation, never store junk.
===============================================================================
"""
from __future__ import annotations

import re

# ISO 639-1 codes we recognise as valid pass-through targets. Kept deliberately
# small — the ensemble's repertoire is European sacred/choral — but trivially
# extendable. The value is always what we store.
_ISO_639_1: frozenset[str] = frozenset({
    'la', 'pl', 'en', 'de', 'fr', 'it', 'es', 'cs', 'ru', 'uk', 'hu', 'cu',
    'nl', 'pt', 'sv', 'no', 'da', 'fi', 'el', 'he', 'ro', 'sk', 'hr', 'sl',
})

# Everything the model / MusicBrainz has been seen to emit → canonical 639-1.
# Keys are matched case-insensitively after stripping, so list only lowercase.
_ALIASES: dict[str, str] = {
    # Latin — the workhorse of a sacred repertoire, and the most-mangled.
    'latin': 'la', 'lat': 'la', 'lati': 'la',
    'ecclesiastical latin': 'la', 'church latin': 'la', 'liturgical latin': 'la',
    'łacina': 'la', 'lacina': 'la', 'łaciński': 'la', 'lacinski': 'la',
    # Polish.
    'polish': 'pl', 'pol': 'pl', 'polski': 'pl', 'po polsku': 'pl',
    # English.
    'english': 'en', 'eng': 'en', 'angielski': 'en',
    # German.
    'german': 'de', 'deu': 'de', 'ger': 'de', 'niemiecki': 'de',
    'hochdeutsch': 'de',
    # French.
    'french': 'fr', 'fra': 'fr', 'fre': 'fr', 'francuski': 'fr',
    # Italian.
    'italian': 'it', 'ita': 'it', 'włoski': 'it', 'wloski': 'it',
    # Spanish.
    'spanish': 'es', 'spa': 'es', 'castilian': 'es', 'hiszpański': 'es',
    'hiszpanski': 'es',
    # Czech / Slavic neighbours that show up in the repertoire.
    'czech': 'cs', 'ces': 'cs', 'cze': 'cs', 'czeski': 'cs',
    'church slavonic': 'cu', 'old church slavonic': 'cu',
    'russian': 'ru', 'rus': 'ru', 'rosyjski': 'ru',
    'ukrainian': 'uk', 'ukr': 'uk', 'ukraiński': 'uk', 'ukrainski': 'uk',
    'greek': 'el', 'gre': 'el', 'ell': 'el', 'grecki': 'el',
    'hebrew': 'he', 'heb': 'he', 'hebrajski': 'he',
}

# Bilingual answers arrive as "Polish + Latin", "pl/la", "polish and latin",
# "polski i łacina". Split on any of these joiners.
_SPLIT_RE = re.compile(r'\s*(?:\+|/|,|&|\band\b|\bi\b|\boraz\b)\s*', flags=re.IGNORECASE)


def _normalize_token(token: str) -> str:
    """Map one language token to a 639-1 code, or '' if unrecognised."""
    key = token.strip().lower()
    if not key:
        return ''
    if key in _ALIASES:
        return _ALIASES[key]
    # A bare 2-letter code the model already got right.
    if key in _ISO_639_1:
        return key
    return ''


def normalize_language(raw: str | None) -> str:
    """Canonicalise a free-text sung-language value to ISO 639-1.

    Returns:
        * '' for empty / unrecognisable input.
        * a single code ('pl', 'la') for a monolingual value.
        * a '+'-joined, order-preserving, de-duplicated set ('pl+la') for a
          genuinely multilingual score — the one case where the AI's blended
          answer carries real information worth keeping.
    """
    if not raw:
        return ''
    seen: list[str] = []
    for token in _SPLIT_RE.split(raw):
        code = _normalize_token(token)
        if code and code not in seen:
            seen.append(code)
    return '+'.join(seen)
