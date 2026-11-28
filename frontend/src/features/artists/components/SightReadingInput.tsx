/**
 * @file SightReadingInput.tsx
 * @description The editor's sight-reading rating: five stars to click, the
 * marks the roster row shows. Native radios sit under the stars, so the group
 * is one tab stop and the arrow keys move the rating. A rating is cleared only
 * by "Usuń ocenę", never by a second click on a star, which would read as a
 * confirmation and wipe it.
 * @module features/artists/components/SightReadingInput
 */

import React, { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Star } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/primitives/Button";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";

const LEVELS = [1, 2, 3, 4, 5] as const;

interface SightReadingInputProps {
  readonly label: string;
  readonly name: string;
  /** "" while unrated, otherwise "1" to "5", as the form stores it. */
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onBlur?: () => void;
  readonly disabled?: boolean;
}

export const SightReadingInput = ({
  label,
  name,
  value,
  onChange,
  onBlur,
  disabled = false,
}: SightReadingInputProps): React.JSX.Element => {
  const { t } = useTranslation();
  const labelId = useId();
  // The hover preview follows a mouse only: a tap also fires pointer-enter,
  // and the preview would outlive the rating it previewed once cleared.
  const [preview, setPreview] = useState<number | null>(null);
  const level = Number(value) || 0;
  const shown = preview ?? level;

  return (
    <div className="flex flex-col gap-1.5">
      <Eyebrow id={labelId} color="muted" className="ml-1">
        {label}
      </Eyebrow>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div
          role="radiogroup"
          aria-labelledby={labelId}
          className="-ml-1.5 flex"
          onPointerLeave={() => setPreview(null)}
        >
          {LEVELS.map((star) => (
            <label
              key={star}
              onPointerEnter={(event) => {
                if (!disabled && event.pointerType === "mouse") setPreview(star);
              }}
              className={cn(
                "flex size-11 items-center justify-center rounded-control has-focus-visible:ring-2 has-focus-visible:ring-ethereal-gold/40 md:size-10",
                disabled ? "opacity-50" : "cursor-pointer",
              )}
            >
              <input
                type="radio"
                name={name}
                value={String(star)}
                checked={level === star}
                onChange={() => onChange(String(star))}
                onBlur={onBlur}
                disabled={disabled}
                aria-label={t("artists.editor.stars_count", {
                  defaultValue: "{{count}} gwiazdki",
                  count: star,
                })}
                className="sr-only"
              />
              <Star
                size={22}
                strokeWidth={1.5}
                aria-hidden="true"
                className={cn(
                  "transition-colors",
                  star <= shown
                    ? "fill-ethereal-gold text-ethereal-gold"
                    : "text-ethereal-incense/50",
                )}
              />
            </label>
          ))}
        </div>
        {level > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            casing="sentence"
            onClick={() => onChange("")}
            disabled={disabled}
          >
            {t("artists.editor.clear_rating", "Usuń ocenę")}
          </Button>
        ) : (
          <Text as="span" size="sm" color="muted">
            {t("artists.editor.no_rating", "Brak oceny")}
          </Text>
        )}
      </div>
    </div>
  );
};
