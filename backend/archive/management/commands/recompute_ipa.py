"""
@file archive/management/commands/recompute_ipa.py
@description Re-derives the IPA guide of every Latin piece in one pronunciation
             system, through the same `recompute_piece_ipa` the piece card's
             "Przelicz wymowę" runs. It exists so the archive can be moved to a
             new default system once, instead of piece by piece.

             What it never touches: a guide whose latest provenance is a
             human's (edited or click-verified) — those are listed for the
             manager to recompute from the card, where replacing a correction
             is confirmed. What it skips as done: a guide already in the target
             system, which makes a re-run after an interruption (a dropped ssh
             session, a spent daily budget) continue where the last one stopped.

             Runs synchronously, one billed call per piece; `--dry-run` lists
             the work and calls nothing.

@architecture Enterprise SaaS 2026
@module archive/management/commands/recompute_ipa
"""
from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand, CommandError, CommandParser

from archive.infrastructure.ai_client import AIClientError, CostCeilingExceeded
from archive.models import LatinPronunciation, Piece
from archive.services.ingestion import ingestion_is_available
from archive.services.ipa import (
    IpaRecomputeRefused,
    ipa_is_hand_edited,
    recompute_refusal,
)
from archive.tasks import recompute_piece_ipa


class Command(BaseCommand):
    help = (
        "Recompute the IPA guide of every Latin piece in one pronunciation "
        "system, skipping hand-edited guides."
    )

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            '--system',
            choices=LatinPronunciation.values,
            default=LatinPronunciation.GERMANIC,
            help="Target Latin pronunciation (default: germanic).",
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help="List what would be recomputed and skipped; call nothing.",
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=0,
            help="Stop after this many recomputed pieces (0 = no limit).",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        system: str = options['system']
        dry_run: bool = options['dry_run']
        limit: int = max(0, options['limit'])

        todo: list[Piece] = []
        hand_edited: list[Piece] = []
        already = 0
        for piece in Piece.objects.exclude(lyrics_original='').order_by('title').iterator():
            if recompute_refusal(piece) is not None:
                continue
            if piece.lyrics_ipa_system == system and piece.lyrics_ipa.strip():
                already += 1
                continue
            if ipa_is_hand_edited(piece):
                hand_edited.append(piece)
                continue
            todo.append(piece)

        if limit:
            todo = todo[:limit]

        self.stdout.write(
            f"Latin pieces: {len(todo)} to recompute in '{system}', "
            f"{already} already in it, {len(hand_edited)} hand-edited (left alone)."
        )
        if dry_run:
            for piece in todo:
                note = "" if piece.lyrics_ipa.strip() else "  (no guide yet)"
                self.stdout.write(f"  Would recompute: {piece.title!r}  {piece.pk}{note}")
            self._list_hand_edited(hand_edited)
            self.stdout.write("Dry run — nothing was called. Re-run without --dry-run to apply.")
            return
        if not ingestion_is_available():
            raise CommandError("ANTHROPIC_API_KEY is not configured — nothing was called.")

        done = 0
        failed: list[Piece] = []
        spent_cents = 0
        for index, piece in enumerate(todo, start=1):
            prefix = f"[{index}/{len(todo)}] {piece.title!r}"
            try:
                outcome = recompute_piece_ipa(piece, system)
            except CostCeilingExceeded:
                self.stderr.write(self.style.ERROR(
                    f"{prefix}: today's AI budget is spent — stopping. Re-run "
                    "tomorrow; finished pieces are skipped."
                ))
                break
            except (AIClientError, IpaRecomputeRefused) as exc:
                failed.append(piece)
                self.stderr.write(self.style.WARNING(f"{prefix}: failed — {exc}"))
                continue
            done += 1
            spent_cents += outcome.cost_cents
            alignment = (
                "" if outcome.aligned
                else f"  LINE COUNT {outcome.ipa_lines}/{outcome.sung_lines} — check it"
            )
            self.stdout.write(f"{prefix}: ok, {outcome.cost_cents}¢{alignment}")

        self._list_hand_edited(hand_edited)
        for piece in failed:
            self.stdout.write(self.style.WARNING(f"  Failed (re-run to retry): {piece.title!r}  {piece.pk}"))
        self.stdout.write(self.style.SUCCESS(
            f"Recomputed {done} piece(s) for {spent_cents}¢; {len(failed)} failed; "
            f"{len(hand_edited)} hand-edited left for the piece card."
        ))

    def _list_hand_edited(self, pieces: list[Piece]) -> None:
        for piece in pieces:
            self.stdout.write(
                f"  Hand-edited, recompute from the card if wanted: {piece.title!r}  {piece.pk}"
            )
