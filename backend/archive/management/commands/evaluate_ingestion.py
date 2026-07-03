"""
===============================================================================
Score Package Compiler — Golden-Set Evaluation Harness
===============================================================================
Domain: Archive / Ingestion
Description:
    Runs the consolidated `analyze_score` prompt against a directory of
    reference PDFs and scores the extracted identity against expected values —
    the safety net for every cost/quality experiment (model tier, effort dial,
    prompt edits). Without it, "let's try effort=low" is a blind gamble on the
    exact scores that matter most (cramped lyrics, odd fonts, faint scans).

    Usage:
        python manage.py evaluate_ingestion <golden_dir> [--model sonnet]
            [--effort medium] [--limit N] [--verbose]

    `<golden_dir>` contains the PDFs plus an `expected.json`:
        {
          "wsrod_nocnej_ciszy.pdf": {
            "title": "Wśród nocnej ciszy",
            "composer_full_name": "…",
            "arranger": "…",
            "epoch": "FOLK",
            "sung_text_language": "pl",
            "voicing": "SATB",
            "musical_key": "F major"
          },
          …
        }
    Only the keys present per file are scored, so a partial golden set is fine.

    NOTE: every evaluated PDF is a REAL, BILLED Anthropic call (roughly the
    cost of one ingestion per file). No DB rows are written and no edition is
    billed — the spend appears only on the Anthropic invoice, deliberately
    outside the pipeline's budget counters (an offline eval must not eat the
    production daily budget).

Standards: SaaS 2026, evaluation-before-tuning.
===============================================================================
"""
from __future__ import annotations

import json
import time
import unicodedata
from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError, CommandParser

from archive.dtos import ScoreAnalysisResult
from archive.infrastructure.ai_client import AIClient, AIClientError, AIModel
from archive.infrastructure.prompts import ANALYZE_SCORE

# Identity fields the harness knows how to score. `expected.json` may use any
# subset per file; unknown keys are reported (typo guard) and skipped.
SCORABLE_FIELDS = (
    'title',
    'composer_full_name',
    'arranger',
    'opus_catalog',
    'musical_key',
    'voicing',
    'language',
    'text_source',
    'epoch',
    'sung_text_language',
)

_MODEL_BY_NAME = {
    'haiku': AIModel.HAIKU,
    'sonnet': AIModel.SONNET,
    'opus': AIModel.OPUS,
}


def _normalize(value: Any) -> str:
    """Case/diacritic/whitespace-insensitive comparison form. 'D-dur' still
    differs from 'D major' by design — the golden set should store the value
    the prompt is expected to produce."""
    if value is None:
        return ''
    text = unicodedata.normalize('NFKD', str(value))
    text = ''.join(ch for ch in text if not unicodedata.combining(ch))
    return ' '.join(text.casefold().split())


class Command(BaseCommand):
    help = (
        "Evaluate the analyze_score prompt against a golden set of PDFs. "
        "Each file is one real, billed Claude call — see the module docstring."
    )

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            'golden_dir',
            help="Directory containing reference PDFs and expected.json",
        )
        parser.add_argument(
            '--model', choices=sorted(_MODEL_BY_NAME), default='sonnet',
            help="Model tier to evaluate (default: sonnet — the pipeline's choice).",
        )
        parser.add_argument(
            '--effort', choices=['low', 'medium', 'high'], default='medium',
            help="output_config.effort to evaluate (default: medium).",
        )
        parser.add_argument(
            '--max-tokens', type=int, default=32768,
            help="max_tokens budget per call (default matches the pipeline).",
        )
        parser.add_argument(
            '--limit', type=int, default=0,
            help="Evaluate at most N files (0 = all). Handy for a cheap smoke run.",
        )
        parser.add_argument(
            '--verbose-fields', action='store_true',
            help="Print got/expected for every mismatch.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        golden_dir = Path(options['golden_dir'])
        expected_path = golden_dir / 'expected.json'
        if not expected_path.is_file():
            raise CommandError(f"Missing {expected_path} — see the module docstring for the format.")
        if not getattr(settings, 'ANTHROPIC_API_KEY', ''):
            raise CommandError("ANTHROPIC_API_KEY is not configured.")

        expected_by_file: dict[str, dict[str, Any]] = json.loads(
            expected_path.read_text(encoding='utf-8'),
        )
        entries = sorted(expected_by_file.items())
        limit = options['limit']
        if limit > 0:
            entries = entries[:limit]
        if not entries:
            raise CommandError("expected.json is empty — nothing to evaluate.")

        model = _MODEL_BY_NAME[options['model']]
        effort: str = options['effort']
        max_tokens: int = options['max_tokens']

        self.stdout.write(self.style.WARNING(
            f"Evaluating {len(entries)} file(s) with {model} / effort={effort} "
            f"— every file is a real, billed API call."
        ))

        client = AIClient()
        # Mirrors tasks.analyze_score so the eval measures what production runs.
        primary_language = settings.INGESTION_PRIMARY_LANGUAGE
        target_languages = list(settings.INGESTION_TRANSLATION_LANGUAGES)
        instructions = (
            f"The ensemble's primary language is: {primary_language}.\n"
            "Analyse the attached score PDF. Provide prose translations of the sung "
            f"text into these target languages: {', '.join(target_languages)}. "
            "Apply the ECONOMY rules for IPA and translations."
        )

        field_hits: dict[str, int] = dict.fromkeys(SCORABLE_FIELDS, 0)
        field_totals: dict[str, int] = dict.fromkeys(SCORABLE_FIELDS, 0)
        total_cents = 0
        failures: list[str] = []

        for filename, expected in entries:
            pdf_path = golden_dir / filename
            if not pdf_path.is_file():
                failures.append(f"{filename}: file not found")
                self.stdout.write(self.style.ERROR(f"✗ {filename} — missing file"))
                continue

            unknown = set(expected) - set(SCORABLE_FIELDS)
            if unknown:
                self.stdout.write(self.style.WARNING(
                    f"  {filename}: skipping unknown expected keys {sorted(unknown)}"
                ))

            t0 = time.monotonic()
            try:
                analysis, cost = client.parse(
                    model=model,
                    prompt=ANALYZE_SCORE,
                    user_content=instructions,
                    output_schema=ScoreAnalysisResult,
                    max_tokens=max_tokens,
                    effort=effort,
                    pdf_bytes=pdf_path.read_bytes(),
                    structured=False,
                )
            except AIClientError as exc:
                failures.append(f"{filename}: {exc}")
                self.stdout.write(self.style.ERROR(f"✗ {filename} — call failed: {exc}"))
                continue
            elapsed = time.monotonic() - t0
            total_cents += cost.total_cents

            got = analysis.model_dump(mode='json')
            hits = 0
            misses: list[str] = []
            scored = [f for f in SCORABLE_FIELDS if f in expected]
            for field in scored:
                field_totals[field] += 1
                if _normalize(got.get(field)) == _normalize(expected[field]):
                    field_hits[field] += 1
                    hits += 1
                else:
                    misses.append(field)

            style = self.style.SUCCESS if not misses else self.style.WARNING
            self.stdout.write(style(
                f"{'✓' if not misses else '~'} {filename} — {hits}/{len(scored)} fields, "
                f"{cost.total_cents}¢, {elapsed:.0f}s, confidence={analysis.confidence:.2f}"
            ))
            if misses and options['verbose_fields']:
                for field in misses:
                    self.stdout.write(
                        f"    {field}: got {got.get(field)!r}, expected {expected[field]!r}"
                    )

        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING(
            f"Per-field accuracy ({options['model']}, effort={effort}, "
            f"prompt={ANALYZE_SCORE.version}):"
        ))
        for field in SCORABLE_FIELDS:
            if field_totals[field] == 0:
                continue
            self.stdout.write(
                f"  {field:<22} {field_hits[field]}/{field_totals[field]}"
            )
        self.stdout.write(f"\nTotal cost: {total_cents}¢ (${total_cents / 100:.2f})")
        if failures:
            self.stdout.write(self.style.ERROR(
                f"{len(failures)} file(s) failed: " + "; ".join(failures)
            ))
