"""
@file hashing.py
@description Single source of truth for the copy desk's source hash — the
             fingerprint of a Polish value that a translation was rendered
             against. A translation whose Polish moved looks perfectly fine on
             screen; this hash is the only thing that can say otherwise.
@architecture Enterprise SaaS 2026
@module copydesk/hashing
"""
from __future__ import annotations

import hashlib
import unicodedata

# Hard spaces are presentation the site's build inserts (`web/src/lib/typo.ts`
# pins orphans and sets French punctuation spacing), never sense. Folding them
# before hashing keeps a typographic pass from marking every translation on a
# page stale over a change no reader of the Polish could see.
#
# Declared as codepoints, not as the characters themselves: these are invisible
# in an editor, and a file carrying them literally is one careless copy-paste
# away from quietly hashing a different set.
_HARD_SPACE_TABLE: dict[int, str] = {
    0x00A0: " ",  # NO-BREAK SPACE
    0x202F: " ",  # NARROW NO-BREAK SPACE
    0x2009: " ",  # THIN SPACE
}


def normalize_for_hash(value: str) -> str:
    """The exact text the hash is taken over.

    Split out from :func:`source_hash` because the extractor and the apply
    script (stage C, TypeScript) have to reproduce it character for character,
    and a rule nobody can read is a rule that will be mirrored wrongly. The
    steps, in order:

    1. **NFC** — so a diacritic typed as one codepoint and as a base plus a
       combining mark are one value. Polish and French both reach this file
       through editors that disagree about which form to emit.
    2. **Line endings to LF** — the corpus is CRLF on a Windows checkout, so a
       hash taken over raw bytes would differ between the extractor's read and
       the desk's write on the same unchanged string.
    3. **Hard spaces to ordinary spaces** — see above.
    4. **Strip the ends** — leading and trailing whitespace is layout, not
       sense, and YAML block scalars add and drop it freely.

    Interior whitespace is deliberately NOT collapsed: a rule that has to be
    mirrored in another language is worth keeping small, and no field in the
    corpus depends on it.
    """
    text = unicodedata.normalize("NFC", value)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.translate(_HARD_SPACE_TABLE)
    return text.strip()


def source_hash(value: str) -> str:
    """SHA-256 (hex) of the normalized value, or `""` when there is nothing to hash.

    The empty answer is load-bearing: it means "no source is recorded", which is
    a different state from "the source is up to date" and the desk renders it
    differently. Every translation that predates the desk carries it, because
    nothing ever recorded which Polish those were written against.
    """
    normalized = normalize_for_hash(value)
    if not normalized:
        return ""
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()
