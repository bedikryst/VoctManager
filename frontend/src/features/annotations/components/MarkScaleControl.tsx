/**
 * @file MarkScaleControl.tsx
 * @description The size of a note or a symbol, wherever it is set: the
 * toolbar's note and symbol panels (the next mark), a symbol's card and a
 * note's composer (the mark in hand). A sample, a slider and a number.
 *
 * The sample and the slider are how a size is found: by looking at a mark
 * rather than by decoding a number. The number is how it is found again: a
 * slider never lands twice on the same spot, and in the concert book the
 * remembered size changes with the piece. It reads `scale × 20`
 * (`markSizeNumber`); a typed number commits on Enter or when the field is left,
 * clamped into the slider's range, and writes what the slider writes.
 *
 * The field is a text input, so the stand never takes a key typed into it: the
 * viewer offers no key from a field to the annotator, arrows, Delete and the
 * tool letters included.
 * @module features/annotations/components
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { FIELD_TEXT_SCALE } from "@/shared/ui/primitives/fieldShell";

import {
  MARK_SCALE_MAX,
  MARK_SCALE_MIN,
  MARK_SCALE_STEP,
  MARK_SIZE_NUMBER_MAX,
  MARK_SIZE_NUMBER_MIN,
  markSizeNumber,
  scaleOfSizeNumber,
} from "../lib/useAnnotationTools";

interface MarkScaleControlProps {
  value: number;
  /** Every step of the slider. */
  onChange: (scale: number) => void;
  /** A typed number, confirmed. Without it the number goes where a slider step goes. */
  onCommit?: (scale: number) => void;
  /** The slider let go, by pointer, key or focus: a card writes its size once, then. */
  onRelease?: () => void;
  label: string;
  /** The mark drawn at the size in hand; absent where the mark itself is on screen. */
  sample?: React.ReactNode;
  /** `chrome`: the toolbar's dark panel. `card`: a light card beside a mark. */
  surface: "chrome" | "card";
}

export const MarkScaleControl = ({
  value,
  onChange,
  onCommit,
  onRelease,
  label,
  sample,
  surface,
}: MarkScaleControlProps): React.JSX.Element => {
  const { t } = useTranslation();
  /** What is being typed; null shows the size in hand. */
  const [draft, setDraft] = useState<string | null>(null);
  const onChrome = surface === "chrome";

  const commitDraft = (): void => {
    if (draft === null) return;
    setDraft(null);
    const typed = Number.parseInt(draft, 10);
    if (Number.isNaN(typed)) return;
    (onCommit ?? onChange)(scaleOfSizeNumber(typed));
  };

  const numberLabel = t("annotations.scale.number", "{{label}} (od {{min}} do {{max}})", {
    label,
    min: MARK_SIZE_NUMBER_MIN,
    max: MARK_SIZE_NUMBER_MAX,
  });

  return (
    <div className="flex items-center gap-2">
      {sample && (
        <span
          aria-hidden="true"
          className={cn(
            "flex shrink-0 items-center justify-center overflow-hidden",
            onChrome ? "h-9 w-9 text-ink-on-inverse" : "h-8 w-8",
          )}
        >
          {sample}
        </span>
      )}
      <input
        type="range"
        min={MARK_SCALE_MIN}
        max={MARK_SCALE_MAX}
        step={MARK_SCALE_STEP}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerUp={onRelease}
        onPointerCancel={onRelease}
        onKeyUp={onRelease}
        onBlur={onRelease}
        aria-label={label}
        title={label}
        className={cn(
          "min-w-0",
          onChrome ? "w-36 accent-ethereal-gold" : "flex-1 accent-ethereal-ink",
        )}
      />
      <input
        type="text"
        inputMode="numeric"
        maxLength={2}
        value={draft ?? String(markSizeNumber(value))}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(event.target.value.replace(/\D/g, ""))}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitDraft();
          }
        }}
        onBlur={commitDraft}
        aria-label={numberLabel}
        title={numberLabel}
        className={cn(
          "w-10 shrink-0 rounded-md py-1 text-center tabular-nums outline-none focus:ring-2",
          FIELD_TEXT_SCALE.xs,
          onChrome
            ? "bg-ink-on-inverse/10 text-ink-on-inverse focus:ring-ethereal-gold"
            : "bg-ethereal-parchment/60 text-ethereal-ink focus:ring-ethereal-gold",
        )}
      />
    </div>
  );
};
