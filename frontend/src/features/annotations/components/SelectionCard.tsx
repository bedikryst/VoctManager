/**
 * @file SelectionCard.tsx
 * @description What a writer can do with the marks a loop picked out: say who
 * reads them and which voices they are for, recolour them, duplicate them,
 * copy them to another page of this piece, or throw them away. Moving them is not here: the selection's own
 * frame is what the hand drags.
 *
 * Built from the single mark's card (`MarkActionCard`) and anchored the same
 * way, beside what it acts on. Every control commits on tap and is undone in
 * one step, however many marks it touched.
 *
 * The audience ladder is offered for a selection that keeps to one audience,
 * or that holds no private marks. A loop drawn round a busy passage also takes
 * the conductor's private remarks lying in it, and the assistant's replies on
 * the leader's layer, and a single tap that sent the whole selection to the
 * choir would publish them — the one gesture the per-mark ladder exists to
 * keep out of reach. Such a selection says why the ladder is missing instead.
 * A selection of the writer's own pencil marks gets the ladder with no rung
 * lit (see `MarkAudiencePicker`).
 * @module features/annotations/components
 */

import React, { useId, useRef } from "react";
import { Copy, CopyPlus, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";

import { MarkAudiencePicker } from "./MarkAudiencePicker";
import { MarkVoicePicker, type MarkVoices } from "./MarkVoicePicker";
import { placeNoteCard } from "../lib/noteCardPlacement";
import { useMeasuredHeight } from "../lib/useMeasuredHeight";
import { isPrivateLayer, layerOf, type WriteLayer } from "../lib/layers";
import type { AnnotationInk } from "../lib/palette";
import type { ScoreAnnotation } from "../types/annotations.dto";

/** A box on the page, in rendered pixels. */
export interface PageFrame {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface SelectionCardProps {
  /** The selected marks; never empty. */
  marks: readonly ScoreAnnotation[];
  /** The box round them, in page pixels. */
  frame: PageFrame;
  /** Page box, in rendered pixels. */
  width: number;
  height: number;
  /** Swatches this writer may use; fewer than two hides the row. */
  inks: readonly AnnotationInk[];
  /** Reaches these marks may move between; fewer than two hides the ladder. */
  audiences: readonly WriteLayer[];
  onChangeLayer: (next: WriteLayer) => void;
  /**
   * Which voices the selected marks are for, over those whose layer takes
   * voices; null hides the row.
   */
  voices: MarkVoices | null;
  onChangeColor: (next: string) => void;
  onDuplicate: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const CARD_WIDTH = 232;
/** One layout pass only — the real height is measured before paint. */
const CARD_ESTIMATED_HEIGHT = 170;
/** Air between the selection and the card talking about it. */
const CARD_CLEARANCE = 12;

const sameInk = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

export const SelectionCard = ({
  marks,
  frame,
  width,
  height,
  inks,
  audiences,
  onChangeLayer,
  voices,
  onChangeColor,
  onDuplicate,
  onCopy,
  onDelete,
  onClose,
}: SelectionCardProps): React.JSX.Element => {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const cardHeight = useMeasuredHeight(cardRef, CARD_ESTIMATED_HEIGHT);
  const countId = useId();

  const layers = new Set(marks.map(layerOf));
  const commonLayer = layers.size === 1 ? [...layers][0] : null;
  const mixesPrivate = layers.size > 1 && marks.some(isPrivateLayer);
  const commonInk = marks.every((mark) => sameInk(mark.color, marks[0].color))
    ? marks[0].color
    : null;

  const reach = frame.height / 2 + CARD_CLEARANCE;
  const placement = placeNoteCard({
    anchor: {
      x: (frame.left + frame.width / 2) / width,
      y: (frame.top + frame.height / 2) / height,
    },
    pageWidth: width,
    pageHeight: height,
    cardWidth: CARD_WIDTH,
    cardHeight,
    gapAbove: reach,
    gapBelow: reach,
  });

  const actionClass =
    "flex items-center gap-1.5 rounded-md px-1.5 py-1 text-ethereal-graphite transition-colors hover:text-ethereal-ink";

  return (
    <div
      ref={cardRef}
      data-annotation-mark
      data-annotation-card
      // Named by its count, so a screen reader entering the card hears what it
      // acts on before the controls.
      role="dialog"
      aria-labelledby={countId}
      // Controls, not a marking: this rides the theme ladder like the rest of
      // the chrome, while the ink it acts on stays paper-side on a white page.
      className="absolute z-20 -translate-x-1/2 rounded-nested border border-hairline-strong bg-ethereal-marble p-2.5 shadow-glass-ethereal"
      style={{
        width: CARD_WIDTH,
        left: placement.left,
        top: placement.top,
        pointerEvents: "auto",
      }}
      // The surface below reads a press as the start of a new loop — operating
      // this card is not that.
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2">
        <Eyebrow as="p" id={countId} size="overline-sm" color="muted">
          {t("annotations.selection.count", { count: marks.length })}
        </Eyebrow>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close_aria", "Zamknij")}
          className="-mr-1 rounded-md p-1 text-ethereal-ink/45 transition-colors hover:text-ethereal-ink"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      {audiences.length > 1 &&
        (mixesPrivate ? (
          <Caption color="muted" className="mt-2 block">
            {t(
              "annotations.selection.audience_private_mixed",
              "W zaznaczeniu są prywatne oznaczenia i oznaczenia widoczne dla innych. Żeby zmienić odbiorców, zaznacz je osobno.",
            )}
          </Caption>
        ) : (
          <div className="mt-2">
            <MarkAudiencePicker
              current={commonLayer}
              options={audiences}
              onChange={onChangeLayer}
            />
          </div>
        ))}

      {voices && (
        <div className="mt-2.5">
          <MarkVoicePicker current={voices.current} onChange={voices.onChange} surface="card" />
        </div>
      )}

      {inks.length > 1 && (
        <div className="mt-2.5 flex flex-col gap-1">
          <Eyebrow as="p" size="overline-sm" color="muted">
            {t("annotations.ink_color", "Kolor")}
          </Eyebrow>
          <div className="flex items-center gap-1.5">
            {inks.map(({ value, nameKey, fallback }) => {
              const active = commonInk !== null && sameInk(commonInk, value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onChangeColor(value)}
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
      )}

      <div className="mt-2 flex items-center justify-between gap-1">
        <div className="flex items-center gap-1">
          <button type="button" onClick={onDuplicate} className={actionClass}>
            <CopyPlus size={15} aria-hidden="true" />
            <Text as="span" size="sm" color="inherit">
              {t("annotations.selection.duplicate", "Powiel")}
            </Text>
          </button>
          <button type="button" onClick={onCopy} className={actionClass}>
            <Copy size={15} aria-hidden="true" />
            <Text as="span" size="sm" color="inherit">
              {t("annotations.selection.copy", "Kopiuj")}
            </Text>
          </button>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md p-1 text-ethereal-graphite transition-colors hover:text-ethereal-crimson"
          aria-label={t("annotations.selection.delete", "Usuń zaznaczone")}
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
