/**
 * @file SightReadingStars.tsx
 * @description Shared a-vista (sight-reading) rating display used by both the
 * roster card and the dense list row. Unrated singers read as an explicit
 * "not verified" caption rather than five empty stars.
 * @architecture Enterprise SaaS 2026
 * @module features/artists/components/SightReadingStars
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Star } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Caption } from "@/shared/ui/primitives/typography";

interface SightReadingStarsProps {
  readonly level?: number | null;
  readonly size?: number;
}

export const SightReadingStars = ({
  level,
  size = 11,
}: SightReadingStarsProps): React.JSX.Element => {
  const { t } = useTranslation();

  if (!level) {
    return (
      <Caption color="muted" className="italic">
        {t("artists.card.unverified", "Brak weryfikacji")}
      </Caption>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-0.5"
      title={t("artists.card.sight_reading_title", {
        defaultValue: "Czytanie a vista: {{level}}/5",
        level,
      })}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          aria-hidden="true"
          className={cn(
            star <= level
              ? "fill-ethereal-gold text-ethereal-gold"
              : "text-ethereal-marble",
          )}
        />
      ))}
    </span>
  );
};
