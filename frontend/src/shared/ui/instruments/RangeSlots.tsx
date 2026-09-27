/**
 * @file RangeSlots.tsx
 * @description A vocal range written as the conductor writes it,
 * `a (g) – a² (c³)`, where each of the four notes is a slot: select one, then a
 * key, and the key fills it. Two writers use it: the singer's screen, for their
 * proposal, and the artist editor, for the conductor's assessment; each names
 * the line for assistive technology (`label`), and the editor sets it at a
 * form's size (`scale`). The line is the form, and it is set as notation,
 * not as four fields. The tessitura carries the size. The extremes are
 * optional, so they are set smaller and lighter, with their parentheses hugging
 * them, the way the conductor writes them. The whole line stands on one
 * baseline.
 *
 * One gold rule marks the selected slot and glides to the next. An empty slot
 * shows a faint blank and its caption; a filled one shows only its note. The
 * empty line reads as an instruction, the finished one as notation. A note
 * enters from the side its pitch moved to (a higher note from above) and sends
 * out one ring: the echo of the key that sounded it.
 *
 * Nothing on the line moves when a slot fills. Each slot is as wide and as tall
 * as the widest name the keyboard can put in it: every name in the window is
 * stacked invisibly in the slot's one grid cell, so the cell is sized by the
 * largest and the chosen note sits on top. A caption hangs under its slot
 * without widening it, and its row keeps its height when it fades. That also
 * fixes where a narrow phone wraps the line: always in the same place, before
 * the dash.
 *
 * At the singer's screen's entrance the line fades in while its blanks rule
 * themselves in from the left, one after another. The variant labels come from
 * that screen; without them the line simply stands.
 *
 * The four slots are one radio group: a single choice, one tab stop, arrows to
 * move between them.
 * @module shared/ui/instruments/RangeSlots
 */

import React, { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion";

import {
  spokenPitch,
  type PitchNotation,
  type VocalRangeMidi,
} from "@/shared/lib/music/pitchNotation";
import {
  isExtremeSlot,
  RANGE_SLOTS,
  type RangeSlot,
} from "@/shared/lib/music/rangeDraft";
import { cn } from "@/shared/lib/utils";
import { PitchName } from "@/shared/ui/instruments/PitchName";
import { EASE } from "@/shared/ui/kinematics/motion-presets";
import {
  Eyebrow,
  Metric,
  type TypographyProps,
} from "@/shared/ui/primitives/typography";

/** The translation segment of each slot. */
export const SLOT_KEY: Readonly<Record<RangeSlot, string>> = {
  tessituraLow: "tessitura_low",
  extremeLow: "extreme_low",
  tessituraHigh: "tessitura_high",
  extremeHigh: "extreme_high",
};

/**
 * How large the line is set. `screen` is the singer's full-screen moment: the
 * tessitura at Metric `5xl` on a phone (36 px), large from `sm`, and with the
 * extremes set smaller a Polish line of four slots fits a 390 px phone.
 * `field` sits among a form's inputs, whose width does not grow with the
 * viewport, so it keeps one size at every width. At both scales the extremes
 * stand at about three fifths of the tessitura.
 */
export type RangeSlotsScale = "screen" | "field";

interface SlotType {
  readonly size: TypographyProps["size"];
  readonly className: string;
}

const SLOT_TYPE: Readonly<
  Record<RangeSlotsScale, { readonly tessitura: SlotType; readonly extreme: SlotType }>
> = {
  screen: {
    tessitura: { size: "5xl", className: "sm:text-5xl lg:text-6xl" },
    extreme: { size: "2xl", className: "sm:text-3xl lg:text-4xl" },
  },
  field: {
    tessitura: { size: "3xl", className: "" },
    extreme: { size: "lg", className: "" },
  },
};

/** How far a note travels as it enters or leaves, in px. */
const NOTE_TRAVEL = 8;

/** A parenthesis or the dash, hidden from assistive technology, which hears
 *  the slots' own names instead. Parentheses take the extremes' size and a
 *  light cut; the dash stands between the tessitura notes at their size. */
const Mark = ({
  children,
  scale,
  extreme = false,
}: {
  readonly children: string;
  readonly scale: RangeSlotsScale;
  readonly extreme?: boolean;
}): React.JSX.Element => {
  const type = SLOT_TYPE[scale][extreme ? "extreme" : "tessitura"];
  return (
    <Metric
      size={type.size}
      weight={extreme ? "light" : "normal"}
      color="muted"
      aria-hidden="true"
      className={cn("leading-none", type.className)}
    >
      {children}
    </Metric>
  );
};

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

/** A note enters from the side its pitch moved to and leaves the other way,
 *  faster than the new one arrives, so two names never stand on each other. A
 *  first note, with no direction, only fades in. */
const noteMotion = (reduceMotion: boolean): Variants => ({
  enter: (direction: number) => ({
    opacity: 0,
    y: reduceMotion ? 0 : direction * -NOTE_TRAVEL,
  }),
  settled: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.24, ease: EASE.buttery },
  },
  leave: (direction: number) => ({
    opacity: 0,
    y: reduceMotion ? 0 : direction * NOTE_TRAVEL,
    transition: { duration: 0.1, ease: "easeIn" },
  }),
});

/** The screen's entrance: the line fades in and hands a stagger to its blanks. */
const LINE_ENTRANCE: Variants = {
  hidden: { opacity: 0 },
  shown: {
    opacity: 1,
    transition: { duration: 0.5, ease: EASE.buttery, staggerChildren: 0.07 },
  },
};

/** Each blank rules itself in from the left; under reduced motion it simply
 *  arrives with the line. */
const ruleEntrance = (reduceMotion: boolean): Variants => ({
  hidden: reduceMotion ? {} : { scaleX: 0 },
  shown: { scaleX: 1, transition: { duration: 0.6, ease: EASE.buttery } },
});

interface ShownNote {
  readonly midi: number | null;
  /** +1 when the pitch rose, −1 when it fell, 0 for a first note. */
  readonly direction: number;
  /** Counts the notes that have landed here since the screen opened; each
   *  one sends out a ring. */
  readonly echo: number;
}

interface SlotButtonProps {
  readonly slot: RangeSlot;
  readonly midi: number | null;
  readonly selected: boolean;
  /** The group's one tab stop: the selected slot, or the first while none is. */
  readonly tabStop: boolean;
  readonly notation: PitchNotation;
  readonly low: number;
  readonly high: number;
  readonly scale: RangeSlotsScale;
  readonly disabled: boolean;
  readonly onSelect: (slot: RangeSlot) => void;
  readonly onArrow: (slot: RangeSlot, step: 1 | -1) => void;
  readonly registerSlot: (slot: RangeSlot, node: HTMLButtonElement | null) => void;
}

const SlotButton = ({
  slot,
  midi,
  selected,
  tabStop,
  notation,
  low,
  high,
  scale,
  disabled,
  onSelect,
  onArrow,
  registerSlot,
}: SlotButtonProps): React.JSX.Element => {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion() ?? false;
  const key = SLOT_KEY[slot];
  const extreme = isExtremeSlot(slot);
  const type = SLOT_TYPE[scale][extreme ? "extreme" : "tessitura"];
  const filled = midi !== null;
  const value = filled
    ? spokenPitch(midi, notation)
    : t("vocal_range.slots.empty", "nie wybrano");

  // The note last shown, to know which way a new one comes from. Adjusted
  // during render, so the new note's first frame already knows.
  const [shown, setShown] = useState<ShownNote>({ midi, direction: 0, echo: 0 });
  if (midi !== shown.midi) {
    setShown({
      midi,
      direction:
        midi === null || shown.midi === null ? 0 : Math.sign(midi - shown.midi),
      echo: midi === null ? shown.echo : shown.echo + 1,
    });
  }

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
      tabIndex={tabStop ? 0 : -1}
      disabled={disabled}
      onClick={() => onSelect(slot)}
      onKeyDown={handleKeyDown}
      className={cn(
        "group flex touch-manipulation flex-col items-center gap-2 rounded-control pt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 disabled:cursor-not-allowed",
        extreme ? "px-1.5" : "px-1",
      )}
    >
      <Metric
        size={type.size}
        color={extreme ? "graphite" : "default"}
        className={cn(
          "relative grid pb-1.5 text-center leading-none",
          type.className,
        )}
      >
        <SlotSizer low={low} high={high} notation={notation} />

        {/* The echo of the key that filled the slot: one ring, once. */}
        {shown.echo > 0 && !reduceMotion ? (
          <motion.span
            key={shown.echo}
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 aspect-square h-full -translate-x-1/2 -translate-y-1/2 rounded-full border border-ethereal-gold/60"
            initial={{ scale: 0.5, opacity: 0.7 }}
            animate={{ scale: 1.9, opacity: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
        ) : null}

        <AnimatePresence initial={false} custom={shown.direction}>
          {filled ? (
            <motion.span
              key={midi}
              custom={shown.direction}
              variants={noteMotion(reduceMotion)}
              initial="enter"
              animate="settled"
              exit="leave"
              className="col-start-1 row-start-1"
            >
              <PitchName midi={midi} notation={notation} />
            </motion.span>
          ) : null}
        </AnimatePresence>

        {/* The rule under the note: the entrance draws it in from the left.
            An empty slot shows a faint blank there, a filled one shows it only
            under a hovering pointer, and the selected one carries the gold
            mark, which glides from slot to slot. */}
        <motion.span
          aria-hidden="true"
          variants={ruleEntrance(reduceMotion)}
          className="pointer-events-none absolute inset-x-0 bottom-0 flex h-0.5 origin-left justify-center"
        >
          <span
            className={cn(
              "h-px w-3/5 self-end bg-ethereal-incense/50 transition duration-300 group-hover:bg-ethereal-gold/50",
              selected
                ? "opacity-0"
                : filled
                  ? "opacity-0 group-hover:opacity-100"
                  : "opacity-100",
            )}
          />
          {selected ? (
            <motion.span
              layoutId="selected-slot"
              className="absolute inset-0 bg-ethereal-gold"
              transition={{ duration: 0.35, ease: EASE.buttery }}
            />
          ) : null}
        </motion.span>
      </Metric>

      {/* The caption hangs under the slot without widening it: an extreme's
          name is wider than its note. It shows while it is needed, on the
          selected slot and on an empty one, and its row always keeps its
          height. */}
      <span className="relative h-3 w-full" aria-hidden="true">
        <Eyebrow
          size="overline-sm"
          color={selected ? "gold" : "muted"}
          className={cn(
            "absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap transition-opacity duration-300",
            selected || !filled ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          {t(`vocal_range.slots.${key}.caption`)}
        </Eyebrow>
      </span>
    </button>
  );
};

export interface RangeSlotsProps {
  readonly draft: VocalRangeMidi;
  /** Null where no slot is being written, as in the editor while its
   *  keyboard is closed: no gold mark, and the first slot is the tab stop. */
  readonly selected: RangeSlot | null;
  readonly notation: PitchNotation;
  /** The keyboard's window: the names a slot can hold, which size it. */
  readonly low: number;
  readonly high: number;
  /** The radio group's accessible name: whose range this line holds. */
  readonly label: string;
  readonly scale?: RangeSlotsScale;
  readonly disabled?: boolean;
  readonly onSelect: (slot: RangeSlot) => void;
}

export const RangeSlots = ({
  draft,
  selected,
  notation,
  low,
  high,
  label,
  scale = "screen",
  disabled = false,
  onSelect,
}: RangeSlotsProps): React.JSX.Element => {
  const groupId = useId();
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
      tabStop={(selected ?? RANGE_SLOTS[0]) === slot}
      notation={notation}
      low={low}
      high={high}
      scale={scale}
      disabled={disabled}
      onSelect={onSelect}
      onArrow={handleArrow}
      registerSlot={registerSlot}
    />
  );

  const side = (main: RangeSlot, extreme: RangeSlot): React.JSX.Element => (
    <div className="flex items-baseline gap-1.5 sm:gap-2">
      {slotButton(main)}
      <div className="flex items-baseline">
        <Mark scale={scale} extreme>(</Mark>
        {slotButton(extreme)}
        <Mark scale={scale} extreme>)</Mark>
      </div>
    </div>
  );

  return (
    // The gold mark's layout id is scoped to this line.
    <LayoutGroup id={groupId}>
      {/* Two sides and the dash between them; a narrow phone wraps before the
          dash, so each side stays whole. */}
      <motion.div
        role="radiogroup"
        aria-label={label}
        variants={LINE_ENTRANCE}
        className="flex flex-wrap items-baseline gap-x-2 gap-y-3 sm:gap-x-3"
      >
        {side("tessituraLow", "extremeLow")}
        <div className="flex items-baseline gap-2 sm:gap-3">
          <Mark scale={scale}>–</Mark>
          {side("tessituraHigh", "extremeHigh")}
        </div>
      </motion.div>
    </LayoutGroup>
  );
};
