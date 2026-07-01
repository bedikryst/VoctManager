"""
@file archive/management/commands/normalize_piece_languages.py
@description One-off maintenance command that canonicalises legacy `Piece.language`
             values through `normalize_language`. New ingests already store ISO
             639-1 codes; this sweeps rows written before that fix (free-text
             "Polish" / "polski" / "pol" / "Polish+Latin") into the same shape.

             Safe by construction: it only rewrites a value when normalisation
             yields a NON-EMPTY code that differs from the current one, so an
             unrecognised value is never blanked out — it is reported instead for
             a human to look at. Provenance is left untouched (canonicalising a
             value is not a new claim), and `updated_at` is not bumped (a cosmetic
             cleanup should not trip the app's freshness / refetch machinery).

@architecture Enterprise SaaS 2026
@module archive/management/commands/normalize_piece_languages
"""
from __future__ import annotations

from django.core.management.base import BaseCommand

from archive.models import Piece
from archive.services.language import normalize_language


class Command(BaseCommand):
    help = "Canonicalise legacy Piece.language free-text values to ISO 639-1 codes."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help="Show what would change without writing anything.",
        )

    def handle(self, *args, **options) -> None:
        dry_run: bool = options['dry_run']

        changed: list[tuple[str, str, str]] = []   # (title, old, new)
        already_ok = 0
        unrecognised: list[tuple[str, str]] = []    # (title, value)

        # Only rows that actually carry a language; deleted pieces included so the
        # archive is uniform if one is ever restored.
        pieces = (
            Piece.objects.exclude(language='')
            .only('id', 'title', 'language')
            .iterator()
        )
        to_update: list[Piece] = []
        for piece in pieces:
            current = piece.language
            normalised = normalize_language(current)
            if not normalised:
                unrecognised.append((piece.title, current))
                continue
            if normalised == current:
                already_ok += 1
                continue
            changed.append((piece.title, current, normalised))
            piece.language = normalised
            to_update.append(piece)

        if to_update and not dry_run:
            # `updated_at` deliberately NOT in the field list — a canonicalisation
            # is not a content edit and should not invalidate cached reads.
            Piece.objects.bulk_update(to_update, ['language'], batch_size=200)

        verb = "Would normalise" if dry_run else "Normalised"
        for title, old, new in changed:
            self.stdout.write(f"  {verb}: {title!r}  {old!r} → {new!r}")
        for title, value in unrecognised:
            self.stdout.write(self.style.WARNING(
                f"  Unrecognised (left as-is): {title!r}  language={value!r}"
            ))

        summary = (
            f"{verb} {len(changed)} piece(s); {already_ok} already canonical; "
            f"{len(unrecognised)} unrecognised."
        )
        self.stdout.write(self.style.SUCCESS(summary))
        if dry_run and changed:
            self.stdout.write("Dry run — re-run without --dry-run to apply.")
