/**
 * @file ReviewMeter.tsx
 * @description The Piece Card's trust scoreboard — how much of an AI-ingested
 * record a human has already confirmed. Reads the rollup from
 * `pieceReviewBreakdown`, so it counts exactly the fields that carry a verify
 * control and never a set the pipeline never populated.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/ReviewMeter
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck, Sparkles } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Text } from "@/shared/ui/primitives/typography";

import type { ReviewProgress } from "./ProvenanceChip";

/** One entry in the review meter's legend: a tone dot + count. */
const LegendDot = ({
  toneClass,
  label,
}: {
  toneClass: string;
  label: string;
}): React.JSX.Element => (
  <span className="inline-flex items-center gap-1.5">
    <span
      aria-hidden="true"
      className={cn("h-2 w-2 rounded-full border", toneClass)}
    />
    <Text as="span" size="xs" color="muted">
      {label}
    </Text>
  </span>
);

/**
 * Trust scoreboard for the whole record: gives the per-field provenance dots a
 * job (a target to drive to zero) and a sense of closure the loose pills never
 * offered. It counts every field the conductor can verify — metadata, movement
 * titles, translation texts — because "Zatwierdź i opublikuj" publishes all of
 * them; a meter scoped to one section reported "wszystko zweryfikowane" over a
 * stack of untouched translations. Hidden entirely for manually-authored pieces
 * (no provenance at all). The bar animates via `scaleX` (transform-only), per
 * the motion guidelines.
 */
export const ReviewMeter = ({
  progress,
  active,
}: {
  progress: ReviewProgress;
  active: boolean;
}): React.JSX.Element | null => {
  const { t } = useTranslation();
  if (progress.total === 0) return null;

  // Calm state (piece already published, no edition awaiting review): a full
  // progress bar reading "Zweryfikowano 0 z 9 · 0%" nags about a review that
  // isn't happening. Say nothing when nothing's pending; otherwise a single
  // quiet amethyst line — no bar, no percentage, no legend.
  if (!active) {
    if (progress.pending === 0) return null;
    return (
      <div className="flex items-center gap-2 px-1">
        <span
          aria-hidden="true"
          className="h-2 w-2 shrink-0 rounded-full border border-ethereal-amethyst/40 bg-ethereal-amethyst/15"
        />
        <Text as="span" size="sm" color="muted">
          {t(
            "archive.piece_card.review_remaining",
            "Do sprawdzenia pozostało: {{count}} pól",
            { count: progress.pending },
          )}
        </Text>
      </div>
    );
  }

  // Live review: keep the bar (it's the whole point), but drop the redundant
  // "%" — the "X z Y" line and the bar already carry the ratio.
  const ratio = progress.verified / progress.total;
  const allClear = progress.pending === 0;
  return (
    <div className="rounded-nested border border-hairline bg-ethereal-alabaster/50 px-4 py-3">
      <div className="flex items-center gap-2">
        {allClear ? (
          <ShieldCheck
            size={14}
            className="text-ethereal-sage"
            aria-hidden="true"
          />
        ) : (
          <Sparkles
            size={14}
            className="text-ethereal-amethyst"
            aria-hidden="true"
          />
        )}
        <Text as="span" size="sm" weight="medium">
          {allClear
            ? t(
                "archive.piece_card.review_all_clear",
                "Wszystkie pola zweryfikowane",
              )
            : t(
                "archive.piece_card.review_progress",
                "Zweryfikowano {{verified}} z {{total}}",
                { verified: progress.verified, total: progress.total },
              )}
        </Text>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-hairline-strong">
        <div
          className="h-full origin-left rounded-full bg-ethereal-sage transition-transform duration-500"
          style={{ transform: `scaleX(${ratio})` }}
        />
      </div>
      {progress.pending > 0 && (
        // A legend decodes the dots on the fields below — colour ↔ meaning, and
        // nothing else. It used to carry counts too, so "Zweryfikowano 4 z 9"
        // sat two lines above "Zweryfikowane: 4": the same figure twice, in two
        // inflections of the same word. The arithmetic belongs to the sentence
        // that owns it.
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          <LegendDot
            toneClass="border-ethereal-amethyst/40 bg-ethereal-amethyst/15"
            label={t("archive.piece_card.legend_ai", "Do sprawdzenia")}
          />
          <LegendDot
            toneClass="border-ethereal-sage/45 bg-ethereal-sage/15"
            label={t("archive.piece_card.legend_verified", "Zweryfikowane")}
          />
        </div>
      )}
    </div>
  );
};
