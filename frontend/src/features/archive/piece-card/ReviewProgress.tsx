/**
 * @file ReviewProgress.tsx
 * @description The piece card's one statement of review progress: a thin bar
 * of one segment per checkable field, filled for every field a person has
 * confirmed. In review it sits under the title with its sentence; on a phone
 * it rides in the bottom bar with a bare count. A published record with fields
 * still unchecked gets only a quiet count, with no bar. The figures come from
 * `pieceReviewBreakdown`, the same predicate every other count on the card
 * reads.
 * @module features/archive/piece-card/ReviewProgress
 */

import React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { Text } from "@/shared/ui/primitives/typography";

import type { ReviewProgress as ReviewProgressCounts } from "../components/ProvenanceChip";

interface SegmentsProps {
  readonly progress: ReviewProgressCounts;
  readonly className?: string;
}

/** Decorative: the sentence or the count beside it is what is read out. */
const ReviewSegments = ({ progress, className }: SegmentsProps): React.JSX.Element => (
  <span className={cn("flex gap-0.75", className)} aria-hidden="true">
    {Array.from({ length: progress.total }, (_, index) => (
      <span
        key={index}
        className={cn(
          "h-0.75 min-w-0 flex-1 rounded-full transition-colors duration-300",
          index < progress.verified
            ? "bg-ethereal-ink/70"
            : "bg-ethereal-amethyst/30",
        )}
      />
    ))}
  </span>
);

interface ReviewProgressProps {
  readonly progress: ReviewProgressCounts;
  /** An edition is awaiting review: the bar and its sentence. */
  readonly isReviewing: boolean;
}

/** Under the title. Renders nothing when there is nothing to check. */
export const ReviewProgress = ({
  progress,
  isReviewing,
}: ReviewProgressProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  if (progress.total === 0) return null;

  if (isReviewing) {
    return (
      <div className="mt-4 flex items-center gap-3.5">
        <ReviewSegments progress={progress} className="w-50 shrink-0" />
        <Text size="base" color="graphite">
          {t("archive.piece_card.review_progress", {
            verified: progress.verified,
            total: progress.total,
          })}
        </Text>
      </div>
    );
  }

  if (progress.pending === 0) return null;
  return (
    <div className="mt-3.5 flex items-center gap-2">
      <span className="size-1.5 rounded-full bg-ethereal-amethyst" aria-hidden="true" />
      <Text size="base" color="graphite">
        {t("archive.piece_card.review_remaining", { count: progress.pending })}
      </Text>
    </div>
  );
};

/** The phone's bottom bar: the bar across the room it has, and a bare count. */
export const CompactReviewProgress = ({
  progress,
}: {
  readonly progress: ReviewProgressCounts;
}): React.JSX.Element => {
  const { t } = useTranslation();
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <ReviewSegments progress={progress} className="min-w-0 flex-1" />
      <Text size="sm" color="graphite" className="shrink-0 tabular-nums" aria-hidden="true">
        {`${progress.verified}/${progress.total}`}
      </Text>
      <Text className="sr-only">
        {t("archive.piece_card.review_progress", {
          verified: progress.verified,
          total: progress.total,
        })}
      </Text>
    </div>
  );
};
