/**
 * @file MarkAudiencePicker.tsx
 * @description Who reads one marking, chosen after it was made.
 *
 * The three reaches are NESTED, not parallel — the choir's marks arrive at
 * whoever runs the rehearsal and at the managers too, and the leader's arrive at
 * the managers. So this is a ladder with one rung lit, never a set of boxes to
 * tick: every combination a reader could want is already a rung, and the two
 * that are not ("the choir but not the stand-in") name an audience the access
 * rules cannot produce.
 *
 * Widest reach first, so reading down the list is narrowing it. Only the chosen
 * rung spells out who that is: three permanent explanations would make the card
 * taller than the music it sits on, and the one that matters is the one in force.
 * @module features/annotations/components
 */

import React from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import {
  ACCENT_TEXT,
  ACCENT_TILE_ACTIVE,
  ACCENT_TILE_IDLE,
} from "@/shared/ui/primitives/accents";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";

import { asWriteLayer, writeLayerCopy, type WriteLayer } from "../lib/layers";
import type { AnnotationLayer } from "../types/annotations.dto";

interface MarkAudiencePickerProps {
  /** The reach this marking has now. */
  current: AnnotationLayer;
  /** The reaches it may be moved between; fewer than two renders nothing. */
  options: readonly WriteLayer[];
  onChange: (next: WriteLayer) => void;
}

export const MarkAudiencePicker = ({
  current,
  options,
  onChange,
}: MarkAudiencePickerProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  if (options.length < 2) return null;

  const copy = writeLayerCopy(t);
  // A marking carrying an ad-hoc layer name folds onto the choir's rung, the
  // same way it is drawn — so the ladder always has exactly one rung lit.
  const active = asWriteLayer(current);

  return (
    <div className="flex flex-col gap-1">
      <Eyebrow as="p" size="overline-sm" color="muted">
        {t("annotations.mark.audience", "Kto to widzi")}
      </Eyebrow>
      <div
        className="flex flex-col gap-1"
        role="group"
        aria-label={t("annotations.mark.audience", "Kto to widzi")}
      >
        {options.map((option) => {
          const { Icon, label, short, accent } = copy[option];
          const isActive = option === active;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              aria-pressed={isActive}
              aria-label={label}
              className={cn(
                "flex items-center gap-2 rounded-nested border px-2 py-1.5 text-left transition-colors",
                isActive ? ACCENT_TILE_ACTIVE[accent] : ACCENT_TILE_IDLE[accent],
              )}
            >
              <Icon
                size={14}
                aria-hidden="true"
                className={cn("shrink-0", isActive ? undefined : "opacity-50")}
              />
              <Text
                as="span"
                size="sm"
                weight={isActive ? "semibold" : "normal"}
                color={isActive ? ACCENT_TEXT[accent] : "muted"}
                className="min-w-0 flex-1 truncate"
              >
                {short}
              </Text>
              {isActive && (
                <Check size={13} aria-hidden="true" className="shrink-0" />
              )}
            </button>
          );
        })}
      </div>
      {/* The consequence of the rung in force, in words. A picker whose labels
          are three nouns asks the reader to already know the access model. */}
      <Caption color="muted" className="block">
        {copy[active].hint}
      </Caption>
    </div>
  );
};
