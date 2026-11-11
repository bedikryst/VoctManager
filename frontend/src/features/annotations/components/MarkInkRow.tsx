/**
 * @file MarkInkRow.tsx
 * @description The swatches a marking that already exists is recoloured from —
 * a mark, a selection, a text note. Each swatch commits on tap, like every other
 * control on the cards that carry this row.
 * @module features/annotations/components
 */

import React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { Eyebrow } from "@/shared/ui/primitives/typography";

import type { AnnotationInk } from "../lib/palette";

interface MarkInkRowProps {
  inks: readonly AnnotationInk[];
  /** The colour the marking carries now; null when a selection mixes several. */
  current: string | null;
  onChange: (next: string) => void;
}

/** Stored colours may differ from the palette in case only. */
const sameInk = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

export const MarkInkRow = ({ inks, current, onChange }: MarkInkRowProps): React.JSX.Element => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1">
      <Eyebrow as="p" size="overline-sm" color="muted">
        {t("annotations.ink_color", "Kolor")}
      </Eyebrow>
      <div className="flex items-center gap-1.5">
        {inks.map(({ value, nameKey, fallback }) => {
          const active = current !== null && sameInk(current, value);
          return (
            <button
              key={value}
              type="button"
              onClick={() => onChange(value)}
              aria-label={t(nameKey, fallback)}
              title={t(nameKey, fallback)}
              aria-pressed={active}
              className={cn(
                "h-6 w-6 rounded-full transition-transform hover:scale-110",
                active
                  ? "ring-2 ring-ethereal-ink ring-offset-1 ring-offset-ethereal-marble"
                  : "ring-1 ring-hairline-strong",
              )}
              style={{ backgroundColor: value }}
            />
          );
        })}
      </div>
    </div>
  );
};
