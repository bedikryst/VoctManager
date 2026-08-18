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
            "musical_key": "F major",
            "sung_text_contains": ["Wśród nocnej ciszy głos się rozchodzi"]
          },
          …
        }
    Only the keys present per file are scored, so a partial golden set is fine.

    `sung_text_contains` is scored apart from the identity fields: each entry is
    a phrase that must appear in the transcribed `sung_text`, matched WITHOUT
    the diacritic fold the identity fields use. Identity accuracy is read off
    the title page and says nothing about the underlay — this is the column that
    measures whether the words under the staves came back as printed.

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
from archive.infrastructure.ai_client import (
    LEGACY_OPUS,
    LEGACY_SONNET,
    AIClient,
    AIClientError,
    AIModel,
)
from archive.infrastructure.prompts import ANALYZE_SCORE
from archive.tasks import ANALYZE_MAX_TOKENS

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
    # Scoring this one needs golden entries that expect null: the failure mode
    # to measure is not a wrong year but a year invented for a score that never
    # printed one (a copyright date, or one recalled from the model's training).
    'composition_year',
    'sung_text_language',
)

# Scored separately from the identity fields: a list of phrases that must appear
# in the transcribed `sung_text`.
SUNG_TEXT_KEY = 'sung_text_contains'

_MODEL_BY_NAME = {
    'haiku': AIModel.HAIKU,
    'sonnet': AIModel.SONNET,
    'opus': AIModel.OPUS,
    # Previous generation, so an upgrade can be measured against a real floor
    # instead of a remembered one. Priced, but never selected by the pipeline.
    'sonnet-4-6': LEGACY_SONNET,
    'opus-4-8': LEGACY_OPUS,
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


def _normalize_fragment(value: str) -> str:
    """Comparison form for sung text — case-insensitive, punctuation-insensitive,
    and deliberately DIACRITIC-SENSITIVE: `Bostwo` must not pass for `Bóstwo`,
    because recovering Polish diacritics from a cramped underlay is the quality
    being measured here. The identity fold above would erase exactly that signal.

    Punctuation is dropped so an incidental syllable hyphen ('fal-li-tur') still
    matches the word, while the engraver's word-joining underscore ('w_Hostii')
    does not — copying that marker through means the underlay was transcribed
    mechanically instead of read as words, which is a real defect.
    """
    text = ''.join(ch if ch.isalnum() or ch.isspace() else '' for ch in value)
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
            '--effort', choices=['low', 'medium', 'high', 'xhigh', 'max'],
            default='medium',
            help="output_config.effort to evaluate (default: medium). The two "
                 "top tiers exist only on Sonnet 5 / Opus 5.",
        )
        parser.add_argument(
            '--max-tokens', type=int, default=ANALYZE_MAX_TOKENS,
            help="max_tokens budget per call (default matches the pipeline).",
        )
        parser.add_argument(
            '--only', action='append', metavar='FILENAME',
            help="Evaluate only this file (repeatable). Applied before --limit. "
                 "Iterating on one score's phrasing must not re-bill the set.",
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
        only: list[str] | None = options['only']
        if only:
            unknown_files = set(only) - set(expected_by_file)
            if unknown_files:
                raise CommandError(
                    f"--only names files absent from expected.json: {sorted(unknown_files)}"
                )
            entries = [(name, exp) for name, exp in entries if name in set(only)]
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
        text_hits = 0
        text_totals = 0
        total_cents = 0
        # Reported alongside cost because the cent column moves with the system
        # prompt's cache state: the first configuration run in a 5-minute window
        # pays the cache write, later ones read it back at a tenth of the price.
        tokens_in = tokens_out = tokens_cache_w = tokens_cache_r = 0
        failures: list[str] = []

        for filename, expected in entries:
            pdf_path = golden_dir / filename
            if not pdf_path.is_file():
                failures.append(f"{filename}: file not found")
                self.stdout.write(self.style.ERROR(f"✗ {filename} — missing file"))
                continue

            unknown = set(expected) - set(SCORABLE_FIELDS) - {SUNG_TEXT_KEY}
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
            tokens_in += cost.input_tokens
            tokens_out += cost.output_tokens
            tokens_cache_w += cost.cache_creation_input_tokens
            tokens_cache_r += cost.cache_read_input_tokens

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

            fragments: list[str] = list(expected.get(SUNG_TEXT_KEY) or [])
            got_text = _normalize_fragment(str(got.get('sung_text') or ''))
            frag_misses = [f for f in fragments if _normalize_fragment(f) not in got_text]
            text_totals += len(fragments)
            text_hits += len(fragments) - len(frag_misses)

            clean = not misses and not frag_misses
            text_part = (
                f"{len(fragments) - len(frag_misses)}/{len(fragments)} text, "
                if fragments else ''
            )
            style = self.style.SUCCESS if clean else self.style.WARNING
            self.stdout.write(style(
                f"{'✓' if clean else '~'} {filename} — {hits}/{len(scored)} fields, "
                f"{text_part}{cost.total_cents}¢, {elapsed:.0f}s, "
                f"confidence={analysis.confidence:.2f}"
            ))
            if options['verbose_fields']:
                for field in misses:
                    self.stdout.write(
                        f"    {field}: got {got.get(field)!r}, expected {expected[field]!r}"
                    )
                for fragment in frag_misses:
                    self.stdout.write(f"    sung_text missing: {fragment!r}")

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
        if text_totals:
            self.stdout.write(
                f"  {'sung_text (phrases)':<22} {text_hits}/{text_totals}"
            )
        self.stdout.write(
            f"\nTokens: in={tokens_in} out={tokens_out} "
            f"cache_write={tokens_cache_w} cache_read={tokens_cache_r}"
        )
        # Sonnet 5's introductory rate is not in `_PRICING` — see the table's
        # note — so this is what the run would cost at the standard rate.
        self.stdout.write(f"Total cost: {total_cents}¢ (${total_cents / 100:.2f}) at standard rates")
        if failures:
            self.stdout.write(self.style.ERROR(
                f"{len(failures)} file(s) failed: " + "; ".join(failures)
            ))
