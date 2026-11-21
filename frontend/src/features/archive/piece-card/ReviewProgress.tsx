/**
 * @file ReviewProgress.tsx
 * @description The piece card's one statement of review progress. Every place
 * that states it says the same sentence ("Sprawdzono 3 z 10"): under the title
 * in review, in the phone's bottom bar, in the publish dialog, and muted under
 * the title of a published record that still has fields unchecked. In review a
 * thin continuous bar stands beside the sentence, its track amethyst (what the
 * AI wrote) and its fill the share a person has confirmed. The figures come
 * from `pieceReviewBreakdown`, the same predicate every other count on the
 * card reads.
 * @module features/archive/piece-card/ReviewProgress
 */

import React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { Text } from "@/shared/ui/primitives/typography";

import type { ReviewProgress as ReviewProgressCounts } from "../constants/pieceProvenance";

interface ProgressProps {
  readonly progress: ReviewProgressCounts;
  readonly className?: string;
}

/** Decorative: the sentence beside it is what is read out. The fill moves by transform. */
export const ReviewBar = ({ progress, className }: ProgressProps): React.JSX.Element => (
  <span className={cn("relative block h-1 overflow-hidden rounded-full bg-ethereal-amethyst/25", className)} aria-hidden="true">
    <span
      className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-ethereal-ink/70 transition-transform duration-300 ease-out motion-reduce:transition-none"
      style={{ transform: `scaleX(${progress.total ? progress.verified / progress.total : 0})` }}
    />
  </span>
);

/** The sentence, in every place that states the progress. */
export const useReviewSentence = (progress: ReviewProgressCounts): string => {
  const { t } = useTranslation();
  return t("archive.piece_card.review_progress", { verified: progress.verified, total: progress.total });
};

interface ReviewProgressProps {
  readonly progress: ReviewProgressCounts;
  /** An edition is awaiting review: the bar and its sentence. */
  readonly isReviewing: boolean;
  /** The review keys, at the line's end in review, where there is a keyboard. */
  readonly hint?: string;
}

/** Under the title. Renders nothing when there is nothing left to say. */
export const ReviewProgress = ({ progress, isReviewing, hint }: ReviewProgressProps): React.JSX.Element | null => {
  const sentence = useReviewSentence(progress);
  if (progress.total === 0) return null;

  if (isReviewing) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-x-3.5 gap-y-1">
        <ReviewBar progress={progress} className="w-50 shrink-0" />
        <Text size="base" color="graphite">{sentence}</Text>
        {hint && (
          <Text size="sm" color="muted" className="ml-auto hidden fine-pointer:block">
            {hint}
          </Text>
        )}
      </div>
    );
  }

  if (progress.pending === 0) return null;
  return <Text as="p" size="base" color="muted" className="mt-3">{sentence}</Text>;
};

/** The phone's bottom bar: the sentence over a bar across the room it has. */
export const CompactReviewProgress = ({ progress }: { readonly progress: ReviewProgressCounts }): React.JSX.Element => {
  const sentence = useReviewSentence(progress);
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <Text size="sm" color="graphite" className="tabular-nums">{sentence}</Text>
      <ReviewBar progress={progress} />
    </div>
  );
};
