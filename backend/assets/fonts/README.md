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
