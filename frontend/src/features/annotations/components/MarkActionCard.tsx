/**
 * @file MarkActionCard.tsx
 * @description What a reader can do with the ink, highlight or symbol they just
 * tapped: change who reads it, change its colour, resize a symbol, throw it away.
 *
 * Anchored to the marking rather than docked to the toolbar, and that is the
 * whole point. The control this replaces lived in the floating tool pill at the
 * top-left corner — an arm's length from the bar it acted on, on the tablet this
 * is actually used on — so it was a control nobody found and, once found, moved
 * a mark one way only. Here the answer to "who sees this?" is beside the thing
 * being asked about.
 *
 * Every control commits on tap. There is no draft here and therefore no OK: each
 * one states a single fact about a marking that already exists, and every one of
 * them is undoable with the history the toolbar already carries. Delete goes
 * unconfirmed for the same reason the eraser does — an arm-then-confirm here
 * would make the card stricter than the tool sitting next to it.
 *
 * A text note is NOT handled here: it opens its own composer, which grew the same
 * audience row. One marking never gets two cards.
 * @module features/annotations/components
 */

import React, { useRef } from "react";
import { Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { Eyebrow } from "@/shared/ui/primitives/typography";

import { MarkAudiencePicker } from "./MarkAudiencePicker";
import { boundsAnchor, markBounds } from "../lib/markBounds";
import { placeNoteCard } from "../lib/noteCardPlacement";
import { getStampDef, StampGlyph } from "../lib/stamps";
import { useMeasuredHeight } from "../lib/useMeasuredHeight";
import { layerOf, type WriteLayer } from "../lib/layers";
import type { AnnotationInk } from "../lib/palette";
import {
  clampMarkScale,
  MARK_SCALE_MAX,
  MARK_SCALE_MIN,
  MARK_SCALE_STEP,
} from "../lib/useAnnotationTools";
import {
  isFreehand,
  isHighlight,
  isStamp,
  type ScoreAnnotation,
  type StampPayload,
} from "../types/annotations.dto";

interface MarkActionCardProps {
  /** The marking this card is about — never a text note. */
  annotation: ScoreAnnotation;
  /** Page box, in rendered pixels. */
  width: number;
  height: number;
  /** Swatches this reader may write; fewer than two hides the row. */
  inks: readonly AnnotationInk[];
  /** Reaches this marking may move between; fewer than two hides the ladder. */
  audiences: readonly WriteLayer[];
  onChangeLayer: (next: WriteLayer) => void;
  onChangeColor: (next: string) => void;
  onChangeScale: (next: number) => void;
  onDelete: () => void;
  onClose: () => void;
}

const CARD_WIDTH = 232;
/** One layout pass only — the real height is measured before paint. */
const CARD_ESTIMATED_HEIGHT = 150;
/** Air between the marking and the card talking about it. */
const CARD_CLEARANCE = 12;

/** What this marking is called, so the card says what it is acting on. */
const kindLabelKey = (annotation: ScoreAnnotation): [string, string] => {
  if (annotation.annotation_type === "HL") {
    return ["annotations.mark.kind.highlight", "Zakreślenie"];
  }
  if (annotation.annotation_type === "ST") {
    return ["annotations.mark.kind.stamp", "Symbol"];
  }
  return ["annotations.mark.kind.freehand", "Kreska"];
};

export const MarkActionCard = ({
  annotation,
  width,
  height,
  inks,
  audiences,
  onChangeLayer,
  onChangeColor,
  onChangeScale,
  onDelete,
  onClose,
}: MarkActionCardProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const cardHeight = useMeasuredHeight(cardRef, CARD_ESTIMATED_HEIGHT);

  const bounds = markBounds(annotation);
  if (!bounds) return null;

  const stamp = isStamp(annotation) ? (annotation.payload as StampPayload) : null;
  const stampDef = stamp ? getStampDef(stamp.symbol) : null;
  const scale = clampMarkScale(stamp?.scale);

  // How far the marking's own ink reaches from the anchor, so the card clears
  // the whole drawing rather than its centre point. A stroke reaches half its
  // bounding box plus half its own width; a symbol reaches half its glyph.
  const strokeReach =
    isFreehand(annotation) || isHighlight(annotation)
      ? (annotation.payload.width * width) / 2
      : 0;
  const glyphReach = stampDef ? (stampDef.sizeFraction * width * scale) / 2 : 0;
  const reach =
    ((bounds.maxY - bounds.minY) * height) / 2 +
    Math.max(strokeReach, glyphReach) +
    CARD_CLEARANCE;

  const placement = placeNoteCard({
    anchor: boundsAnchor(bounds),
    pageWidth: width,
    pageHeight: height,
    cardWidth: CARD_WIDTH,
    cardHeight,
    gapAbove: reach,
    gapBelow: reach,
  });

  const [kindKey, kindFallback] = kindLabelKey(annotation);

  return (
    <div
      ref={cardRef}
      data-annotation-mark
      // Controls, not a marking: this rides the theme ladder like the rest of
      // the chrome, while the ink it acts on stays paper-side on a white page.
      className="absolute z-20 -translate-x-1/2 rounded-nested border border-hairline-strong bg-ethereal-marble p-2.5 shadow-glass-ethereal"
      style={{
        width: CARD_WIDTH,
        left: placement.left,
        top: placement.top,
        pointerEvents: "auto",
      }}
      // The surface below reads a tap as "place a mark here" — operating this
      // card is not that.
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2">
        <Eyebrow as="p" size="overline-sm" color="muted">
          {t(kindKey, kindFallback)}
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

      {audiences.length > 1 && (
        <div className="mt-2">
          <MarkAudiencePicker
            current={layerOf(annotation)}
            options={audiences}
            onChange={onChangeLayer}
          />
        </div>
      )}

      {inks.length > 1 && (
        <div className="mt-2.5 flex flex-col gap-1">
          <Eyebrow as="p" size="overline-sm" color="muted">
            {t("annotations.ink_color", "Kolor")}
          </Eyebrow>
          <div className="flex items-center gap-1.5">
            {inks.map(({ value }) => (
              <button
                key={value}
                type="button"
                onClick={() => onChangeColor(value)}
                aria-label={t("annotations.ink_color", "Kolor")}
                aria-pressed={annotation.color === value}
                className={cn(
                  "h-6 w-6 rounded-full transition-transform hover:scale-110",
                  annotation.color === value
                    ? "ring-2 ring-ethereal-ink ring-offset-1 ring-offset-ethereal-marble"
                    : "ring-1 ring-hairline-strong",
                )}
                style={{ backgroundColor: value }}
              />
            ))}
          </div>
        </div>
      )}

      {/* A symbol placed too small to read from a stand used to be a symbol to
          delete and place again — the size control armed the NEXT one only. */}
      {stamp && stampDef && (
        <div className="mt-2.5 flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden"
          >
            <StampGlyph
              symbol={stamp.symbol}
              color={annotation.color}
              size={10 + scale * 8}
            />
          </span>
          <input
            type="range"
            min={MARK_SCALE_MIN}
            max={MARK_SCALE_MAX}
            step={MARK_SCALE_STEP}
            value={scale}
            onChange={(event) => onChangeScale(Number(event.target.value))}
            aria-label={t("annotations.scale.stamp", "Rozmiar symbolu")}
            className="w-full accent-ethereal-ink"
          />
        </div>
      )}

      <div className="mt-2 flex items-center">
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md p-1 text-ethereal-graphite transition-colors hover:text-ethereal-crimson"
          aria-label={t("annotations.mark.delete", "Usuń oznaczenie")}
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
