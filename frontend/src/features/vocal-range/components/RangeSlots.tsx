/**
 * @file RangeSlots.tsx
 * @description The singer's range written as the conductor writes it,
 * `a (g) – a² (c³)`, where each of the four notes is a slot: select one, then a
 * key, and the key fills it. The line is the form and the notes are its hero:
 * the parentheses and the dash are set lighter, and a short caption under each
 * slot names it.
 *
 * Nothing on the line moves when a slot fills. Each slot is as wide and as tall
 * as the widest name the keyboard can put in it: every name in the window is
 * stacked invisibly in the slot's one grid cell, so the cell is sized by the
 * largest and the chosen note sits on top. That also fixes where a narrow phone
 * wraps the line: always in the same place, before the dash.
 *
 * The four slots are one radio group: a single choice, one tab stop, arrows to
 * move between them.
 * @module features/vocal-range/components/RangeSlots
 */

import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import {
  spokenPitch,
  type PitchNotation,
  type VocalRangeMidi,
} from "@/shared/lib/music/pitchNotation";
import { cn } from "@/shared/lib/utils";
import { PitchName } from "@/shared/ui/instruments/PitchName";
import { Eyebrow, Metric } from "@/shared/ui/primitives/typography";

import { RANGE_SLOTS, type RangeSlot } from "../lib/rangeDraft";

/** The translation segment of each slot. */
export const SLOT_KEY: Readonly<Record<RangeSlot, string>> = {
  tessituraLow: "tessitura_low",
  extremeLow: "extreme_low",
  tessituraHigh: "tessitura_high",
  extremeHigh: "extreme_high",
};

/** A tablet and a wide screen set the notes large. A phone sets them one step
 *  under the page's display figures, so all four slots fit one line in the
 *  strip above the keyboard: at the next step up a Polish line needs ~350 px
 *  and wraps on a 390 px phone. */
const NOTE_SIZE = "sm:text-5xl lg:text-6xl";

/** A parenthesis or the dash: lighter than the notes, so the line reads as
 *  notes first, and hidden from assistive technology, which hears the slots'
 *  own names instead. */
const Mark = ({ children }: { readonly children: string }): React.JSX.Element => (
  <Metric
    size="4xl"
    aria-hidden="true"
    className={cn(
      "block pt-1 font-light leading-none text-ethereal-graphite/40",
      NOTE_SIZE,
    )}
  >
    {children}
  </Metric>
);

interface SlotSizerProps {
  readonly low: number;
  readonly high: number;
  readonly notation: PitchNotation;
}

/** Every name the keyboard can produce, stacked and invisible. Memoised: it
 *  changes only with the window or the notation, never with a key press. */
const SlotSizer = React.memo(function SlotSizer({
  low,
  high,
  notation,
}: SlotSizerProps): React.JSX.Element {
  const names: React.JSX.Element[] = [];
  for (let midi = low; midi <= high; midi += 1) {
    names.push(
      <span key={midi} aria-hidden="true" className="invisible col-start-1 row-start-1">
        <PitchName midi={midi} notation={notation} />
      </span>,
    );
  }
  return <>{names}</>;
});

interface SlotButtonProps {
  readonly slot: RangeSlot;
  readonly midi: number | null;
  readonly selected: boolean;
  readonly notation: PitchNotation;
  readonly low: number;
  readonly high: number;
  readonly onSelect: (slot: RangeSlot) => void;
  readonly onArrow: (slot: RangeSlot, step: 1 | -1) => void;
  readonly registerSlot: (slot: RangeSlot, node: HTMLButtonElement | null) => void;
}

const SlotButton = ({
  slot,
  midi,
  selected,
  notation,
  low,
  high,
  onSelect,
  onArrow,
  registerSlot,
}: SlotButtonProps): React.JSX.Element => {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion() ?? false;
  const key = SLOT_KEY[slot];
  const value =
    midi === null
      ? t("vocal_range.slots.empty", "nie wybrano")
      : spokenPitch(midi, notation);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      onArrow(slot, 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      onArrow(slot, -1);
    }
  };

  return (
    <button
      ref={(node) => registerSlot(slot, node)}
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`${t(`vocal_range.slots.${key}.label`)}: ${value}`}
      tabIndex={selected ? 0 : -1}
      onClick={() => onSelect(slot)}
      onKeyDown={handleKeyDown}
      className="group flex touch-manipulation flex-col items-center gap-2 rounded-control px-1 pt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40"
    >
      <Metric
        size="4xl"
        className={cn(
          "grid border-b-2 pb-1 text-center leading-none transition-colors",
          NOTE_SIZE,
          selected
            ? "border-ethereal-gold"
            : "border-ethereal-incense/30 group-hover:border-ethereal-gold/50",
        )}
      >
        <SlotSizer low={low} high={high} notation={notation} />
        <AnimatePresence initial={false}>
          {midi === null ? null : (
            <motion.span
              key={midi}
              className="col-start-1 row-start-1"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <PitchName midi={midi} notation={notation} />
            </motion.span>
          )}
        </AnimatePresence>
      </Metric>
      <Eyebrow size="overline-sm" color={selected ? "gold" : "muted"}>
        {t(`vocal_range.slots.${key}.caption`)}
      </Eyebrow>
    </button>
  );
};

export interface RangeSlotsProps {
  readonly draft: VocalRangeMidi;
  readonly selected: RangeSlot;
  readonly notation: PitchNotation;
  /** The keyboard's window: the names a slot can hold, which size it. */
  readonly low: number;
  readonly high: number;
  readonly onSelect: (slot: RangeSlot) => void;
}

export const RangeSlots = ({
  draft,
  selected,
  notation,
  low,
  high,
  onSelect,
}: RangeSlotsProps): React.JSX.Element => {
  const { t } = useTranslation();
  const slotNodes = useRef(new Map<RangeSlot, HTMLButtonElement>());

  const registerSlot = (slot: RangeSlot, node: HTMLButtonElement | null): void => {
    if (node) slotNodes.current.set(slot, node);
    else slotNodes.current.delete(slot);
  };

  // A radio group's arrows move the choice with the focus, wrapping at the ends.
  const handleArrow = (slot: RangeSlot, step: 1 | -1): void => {
    const count = RANGE_SLOTS.length;
    const next = RANGE_SLOTS[(RANGE_SLOTS.indexOf(slot) + step + count) % count];
    onSelect(next);
    slotNodes.current.get(next)?.focus();
  };

  const slotButton = (slot: RangeSlot): React.JSX.Element => (
    <SlotButton
      slot={slot}
      midi={draft[slot]}
      selected={selected === slot}
      notation={notation}
      low={low}
      high={high}
      onSelect={onSelect}
      onArrow={handleArrow}
      registerSlot={registerSlot}
    />
  );

  const side = (main: RangeSlot, extreme: RangeSlot): React.JSX.Element => (
    <div className="flex items-start gap-1.5 sm:gap-2">
      {slotButton(main)}
      <div className="flex items-start">
        <Mark>(</Mark>
        {slotButton(extreme)}
        <Mark>)</Mark>
      </div>
    </div>
  );

  return (
    // Two sides and the dash between them; a narrow phone wraps before the
    // dash, so each side stays whole.
    <div
      role="radiogroup"
      aria-label={t("vocal_range.slots.group_label", "Twój zakres")}
      className="flex flex-wrap items-start gap-x-2 gap-y-3 sm:gap-x-3"
    >
      {side("tessituraLow", "extremeLow")}
      <div className="flex items-start gap-2 sm:gap-3">
        <Mark>–</Mark>
        {side("tessituraHigh", "extremeHigh")}
      </div>
    </div>
  );
};
