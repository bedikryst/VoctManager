# Print fonts (WeasyPrint)

Bundled so every PDF artifact renders with identical metrics on every host
(Windows dev, Linux container) — never falling back to whatever serif the OS
happens to ship. Referenced via `@font-face` file URIs by
`roster/infrastructure/print_fonts.py`; do not rename files without updating
that module.

## Gentium Plus

Copyright (c) SIL International. Licensed under the SIL Open Font License 1.1
(<https://openfontlicense.org>). Source: <https://software.sil.org/gentium/>.
Chosen for the concert score book: book-serif tone suited to liturgical print,
complete Latin Extended (Polish diacritics) and full IPA coverage for the
pronunciation blocks.

## IBM Plex Sans + Cormorant Garamond

The brand pair, for documents an outside reader receives (contracts) — the same
two voices as the panel and the public site. Both licensed under the SIL Open
Font License 1.1. Sources: <https://github.com/IBM/plex> and
<https://github.com/CatharsisFonts/Cormorant>.

These are **derived** files, not upstream releases. Each was built from the two
variable woff2 subsets the frontend ships (`frontend/public/fonts/*.latin.woff2`
and `*.latin-ext.woff2`) by pinning the `wght` axis to the target weight and
merging the two subsets back into one static TTF. Two reasons for the detour:
WeasyPrint picks a face through fontconfig, where a variable weight axis is not
a reliable selector, and a face split by `unicode-range` would leave Polish
diacritics to a separate file mid-word. The merge is why coverage is exactly
Latin + Latin Extended-A — enough for Polish legal text, not a full Plex.

Rebuild them whenever the frontend's subsets change, and verify the result
covers both cases of `aąbcćdeęfghijklłmnńoóprsśtuwyzźż` with non-empty outlines
before committing; a silently blank glyph prints as nothing at all.
