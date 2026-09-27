/**
 * @file VerticalKeyboard.tsx
 * @description A piano stood upright, treble at the top, for choosing a pitch
 * by touch. White keys stack as full-width rows. Each black key straddles the
 * line between its two neighbours on the left, where a piano's black keys fall
 * when it is turned treble-up, so the fronts of the white keys face right.
 * Every white key carries its name there, faint, with each C stronger, set by
 * `PitchName` so the octave marks stay in the panel's face.
 *
 * The keys are an object, not chrome: ivory and ebony in both themes
 * (`piano-ivory` / `piano-ebony`), dimmed a step on dark but never inverted.
 * The caller's bands tint the keys they cover (a stronger tint for the main
 * span, a fainter one for the reach beyond it), keys outside an optional
 * emphasis span are dimmed, and an optional cursor follows a pitch that is not
 * a key, such as a sung note, scrolling the keys to keep itself in view.
 *
 * The keyboard knows pitches and a notation, and nothing about voices: bounds,
 * bands, the emphasis and the label come from the caller. A key reports through
 * `onKeyPress` inside its click, the gesture iOS requires before audio can
 * start, and a finger that scrolls the keyboard produces no click, so panning
 * never sounds a note.
 *
 * The caller gives the keyboard a height and the keys scroll inside it, with
 * the edges fading while there is more to scroll. At either end a swipe carries
 * on into the page around it: overscroll is deliberately not contained, since
 * on a phone the keyboard can fill the screen and would otherwise leave the
 * page reachable only by its scrollbar. Every key is rendered: a full
 * piano is under two hundred nodes, and a windowed list would re-render on
 * every scroll frame, unmount the focused key and hide the rest from assistive
 * technology, to save nothing measurable.
 * @module shared/ui/instruments/VerticalKeyboard
 */

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, useReducedMotion } from "framer-motion";

import {
  pitchClass,
  spokenPitch,
  type PitchNotation,
} from "@/shared/lib/music/pitchNotation";
import { PitchName } from "@/shared/ui/instruments/PitchName";
import { Text } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";

export interface KeyboardBand {
  /** Lowest and highest key the band covers, inclusive, as MIDI numbers. */
  readonly low: number;
  readonly high: number;
  /** `bright` is the main span; `thin` is the reach beyond it. */
  readonly weight: "bright" | "thin";
}

export interface KeyboardSpan {
  /** Inclusive MIDI bounds. */
  readonly low: number;
  readonly high: number;
}

/** A request to bring a key to the middle of the window. A new `seq` repeats
 *  the request for the same key, after the singer has scrolled away from it. */
export interface KeyboardCenterRequest {
  readonly midi: number;
  readonly seq: number;
}

export interface VerticalKeyboardProps {
  /** Lowest and highest playable key, as MIDI numbers. */
  readonly low: number;
  readonly high: number;
  readonly notation: PitchNotation;
  /** Accessible name of the keyboard as a whole. */
  readonly label: string;
  /** Pass a memoised array: a new one re-renders every key. */
  readonly bands?: readonly KeyboardBand[];
  /** Keys outside this span are dimmed; they still sound. Memoise it. */
  readonly emphasis?: KeyboardSpan | null;
  /** The key drawn pressed: the one last sounded or chosen. */
  readonly activeKey?: number | null;
  /** A continuous pitch in MIDI units (69.5 is a quarter tone above A4). Not
   *  drawn outside `low`–`high`; the keys scroll to keep it in view. */
  readonly liveCursor?: number | null;
  /** The first request is met instantly; later ones scroll smoothly, unless
   *  the reader prefers reduced motion. */
  readonly centerRequest?: KeyboardCenterRequest | null;
  readonly onKeyPress: (midi: number) => void;
  readonly className?: string;
}

const BLACK_PITCH_CLASSES: ReadonlySet<number> = new Set([1, 3, 6, 8, 10]);
const isBlackKey = (midi: number): boolean =>
  BLACK_PITCH_CLASSES.has(pitchClass(midi));

const NO_BANDS: readonly KeyboardBand[] = [];

/** How far the edge fade reaches into the window: about half a key. */
const EDGE_FADE = "1.5rem";

/** The share of the window's height, at each end, where a live cursor is
 *  close enough to the edge to bring back to the middle. */
const CURSOR_EDGE_MARGIN = 0.15;

const edgeMask = (top: boolean, bottom: boolean): string =>
  `linear-gradient(to bottom, ${top ? "transparent" : "black"}, black ${EDGE_FADE}, black calc(100% - ${EDGE_FADE}), ${bottom ? "transparent" : "black"})`;

interface KeyboardGeometry {
  /** Lowest and highest white key drawn. They widen `low`/`high` by a
   *  semitone where a bound is black, since a black key needs a white one on
   *  each side; the extra key renders disabled. */
  readonly first: number;
  readonly last: number;
  /** White keys, highest first: the order they stack in. */
  readonly whites: readonly number[];
  /** A key's centre as a fraction of the keyboard's height, from the top. */
  readonly center: (midi: number) => number;
}

const buildGeometry = (low: number, high: number): KeyboardGeometry => {
  const first = isBlackKey(low) ? low - 1 : low;
  const last = isBlackKey(high) ? high + 1 : high;
  const whites: number[] = [];
  for (let midi = last; midi >= first; midi -= 1) {
    if (!isBlackKey(midi)) whites.push(midi);
  }
  const count = whites.length;
  const rowOf = new Map(whites.map((midi, row) => [midi, row]));

  return {
    first,
    last,
    whites,
    center: (midi) => {
      const row = rowOf.get(midi);
      if (row !== undefined) return (row + 0.5) / count;
      // A black key sits on the line under the white key above it.
      return ((rowOf.get(midi + 1) ?? 0) + 1) / count;
    },
  };
};

/** A fractional pitch lands between the centres of its two neighbouring keys. */
const pitchPosition = (geometry: KeyboardGeometry, pitch: number): number => {
  const lower = Math.floor(pitch);
  const fraction = pitch - lower;
  const from = geometry.center(lower);
  if (fraction === 0) return from;
  return from + (geometry.center(lower + 1) - from) * fraction;
};

const percent = (fraction: number): string => `${fraction * 100}%`;

/** Arrow keys walk semitones, Page keys walk octaves; up is higher. */
const stepForKey = (key: string): number | null => {
  switch (key) {
    case "ArrowUp":
      return 1;
    case "ArrowDown":
      return -1;
    case "PageUp":
      return 12;
    case "PageDown":
      return -12;
    default:
      return null;
  }
};

/** The strongest band covering a key: the main span over the reach. */
const bandWeightAt = (
  bands: readonly KeyboardBand[],
  midi: number,
): KeyboardBand["weight"] | null => {
  let weight: KeyboardBand["weight"] | null = null;
  for (const band of bands) {
    if (midi < band.low || midi > band.high) continue;
    if (band.weight === "bright") return "bright";
    weight = "thin";
  }
  return weight;
};

interface KeyPress {
  readonly midi: number;
  readonly seq: number;
}

interface KeyColumnProps {
  readonly whites: readonly number[];
  readonly last: number;
  readonly low: number;
  readonly high: number;
  readonly notation: PitchNotation;
  readonly bands: readonly KeyboardBand[];
  readonly emphasis: KeyboardSpan | null;
  readonly activeKey: number | null;
  readonly press: KeyPress | null;
  readonly reduceMotion: boolean;
  readonly tabStop: number;
  readonly onPress: (midi: number) => void;
  readonly onFocusKey: (midi: number) => void;
  readonly registerKey: (midi: number, node: HTMLButtonElement | null) => void;
}

/** The keys alone, memoised so a live cursor moving at the microphone's frame
 *  rate re-renders the cursor and not the whole keyboard. */
const KeyColumn = React.memo(function KeyColumn({
  whites,
  last,
  low,
  high,
  notation,
  bands,
  emphasis,
  activeKey,
  press,
  reduceMotion,
  tabStop,
  onPress,
  onFocusKey,
  registerKey,
}: KeyColumnProps): React.JSX.Element {
  const renderKey = (midi: number): React.JSX.Element => {
    const black = isBlackKey(midi);
    const playable = midi >= low && midi <= high;
    const active = midi === activeKey;
    const isC = !black && pitchClass(midi) === 0;
    const weight = bandWeightAt(bands, midi);
    const dimmed =
      playable &&
      !active &&
      emphasis !== null &&
      (midi < emphasis.low || midi > emphasis.high);
    const pressed = press !== null && press.midi === midi;

    return (
      <button
        ref={(node) => registerKey(midi, node)}
        type="button"
        disabled={!playable}
        tabIndex={midi === tabStop ? 0 : -1}
        aria-label={spokenPitch(midi, notation)}
        aria-current={active ? "true" : undefined}
        onClick={() => onPress(midi)}
        onFocus={() => onFocusKey(midi)}
        className={cn(
          "flex touch-manipulation items-center justify-end overflow-hidden transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold",
          black
            ? "absolute left-0 top-0 z-10 h-3/5 w-3/5 -translate-y-1/2 rounded-r-chip pr-2"
            : "relative h-full w-full pr-3 focus-visible:ring-inset",
          active
            ? "bg-ethereal-gold text-surface-inverse"
            : !playable
              ? black
                ? "cursor-default bg-piano-ebony/40"
                : "cursor-default bg-piano-ivory/50"
              : black
                ? "bg-piano-ebony text-piano-ivory"
                : cn(
                    "bg-piano-ivory hover:bg-ethereal-gold/10",
                    isC ? "text-piano-ebony/80" : "text-piano-ebony/40",
                  ),
        )}
      >
        {/* The range, drawn on the keys it covers. Opacity only, so a note
            joining the range fades in rather than snapping. */}
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 bg-ethereal-gold transition-opacity duration-300",
            active || weight === null
              ? "opacity-0"
              : weight === "bright"
                ? black
                  ? "opacity-50"
                  : "opacity-30"
                : black
                  ? "opacity-25"
                  : "opacity-12",
          )}
        />
        {/* The wrong side of the selected slot's bound, veiled. */}
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 transition-opacity duration-300",
            black ? "bg-piano-ivory" : "bg-piano-ebony",
            dimmed ? (black ? "opacity-25" : "opacity-15") : "opacity-0",
          )}
        />
        {/* A flash on each press, apart from the selected state: a key that
            is already chosen still answers the finger. */}
        {pressed ? (
          <motion.span
            key={press.seq}
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-0",
              active || black ? "bg-piano-ivory" : "bg-ethereal-gold",
            )}
            initial={{ opacity: 0.55 }}
            animate={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.2 : 0.45, ease: "easeOut" }}
          />
        ) : null}
        {!black || active ? (
          <Text
            as="span"
            size="sm"
            weight={isC || active ? "semibold" : "medium"}
            color="inherit"
            className="relative"
          >
            <PitchName midi={midi} notation={notation} />
          </Text>
        ) : null}
      </button>
    );
  };

  return (
    <div className="relative min-w-0 flex-1">
      {whites.map((white) => (
        // One row per white key; the black key above it rides in the same row
        // so it paints over both neighbours.
        <div
          key={white}
          className="relative h-11 border-b border-piano-ebony/15 last:border-b-0"
        >
          {renderKey(white)}
          {white !== last && isBlackKey(white + 1) ? renderKey(white + 1) : null}
        </div>
      ))}
    </div>
  );
});

export const VerticalKeyboard = ({
  low,
  high,
  notation,
  label,
  bands = NO_BANDS,
  emphasis = null,
  activeKey = null,
  liveCursor = null,
  centerRequest = null,
  onKeyPress,
  className,
}: VerticalKeyboardProps): React.JSX.Element => {
  const geometry = useMemo(() => buildGeometry(low, high), [low, high]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const keyNodes = useRef(new Map<number, HTMLButtonElement>());
  const [focusKey, setFocusKey] = useState<number | null>(null);
  const [press, setPress] = useState<KeyPress | null>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });
  const reduceMotion = useReducedMotion() ?? false;
  const hasCentred = useRef(false);

  const clampKey = useCallback(
    (midi: number): number => Math.min(high, Math.max(low, midi)),
    [low, high],
  );

  // The caller's handler is read through a ref so an inline arrow from the
  // caller does not defeat the key column's memo.
  const onKeyPressRef = useRef(onKeyPress);
  useLayoutEffect(() => {
    onKeyPressRef.current = onKeyPress;
  }, [onKeyPress]);
  const handlePress = useCallback((midi: number) => {
    setPress((previous) => ({ midi, seq: (previous?.seq ?? 0) + 1 }));
    onKeyPressRef.current(midi);
  }, []);

  const registerKey = useCallback(
    (midi: number, node: HTMLButtonElement | null) => {
      if (node) keyNodes.current.set(midi, node);
      else keyNodes.current.delete(midi);
    },
    [],
  );

  /** Fade an edge only while there is more to scroll past it. */
  const updateEdges = useCallback((): void => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const top = scroller.scrollTop > 1;
    const bottom =
      scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 1;
    setEdges((current) =>
      current.top === top && current.bottom === bottom
        ? current
        : { top, bottom },
    );
  }, []);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const body = bodyRef.current;
    if (centerRequest === null || !scroller || !body) return;
    const y =
      body.offsetTop +
      geometry.center(clampKey(centerRequest.midi)) * body.offsetHeight;
    const instant = !hasCentred.current || reduceMotion;
    hasCentred.current = true;
    scroller.scrollTo({
      top: y - scroller.clientHeight / 2,
      behavior: instant ? "auto" : "smooth",
    });
    updateEdges();
  }, [centerRequest, geometry, clampKey, reduceMotion, updateEdges]);

  // The window's height is the caller's and can change under it (a phone
  // turned, a sheet resized), which moves both edges.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateEdges);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [updateEdges]);

  // One key is in the tab order (roving tabindex); arrows move within.
  const tabStop = clampKey(
    focusKey ?? activeKey ?? centerRequest?.midi ?? high,
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const step = stepForKey(event.key);
    if (step === null || focusKey === null) return;
    event.preventDefault();
    keyNodes.current.get(clampKey(focusKey + step))?.focus();
  };

  const cursor =
    liveCursor !== null &&
    Number.isFinite(liveCursor) &&
    liveCursor >= low &&
    liveCursor <= high
      ? pitchPosition(geometry, liveCursor)
      : null;

  // The cursor keeps itself in view: once it nears an edge of the window, the
  // keys scroll to bring it back to the middle, so a note sung off-screen is
  // seen while it is sung. Only a voice moves the cursor, and a finger on a key
  // ends the listening, so this never scrolls under a tap.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const body = bodyRef.current;
    if (cursor === null || !scroller || !body) return;
    const y = body.offsetTop + cursor * body.offsetHeight;
    const margin = scroller.clientHeight * CURSOR_EDGE_MARGIN;
    if (
      y >= scroller.scrollTop + margin &&
      y <= scroller.scrollTop + scroller.clientHeight - margin
    ) {
      return;
    }
    scroller.scrollTo({
      top: y - scroller.clientHeight / 2,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [cursor, reduceMotion]);

  const mask = edgeMask(edges.top, edges.bottom);

  return (
    <div
      ref={scrollerRef}
      role="group"
      aria-label={label}
      onKeyDown={handleKeyDown}
      onScroll={updateEdges}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
      className={cn(
        "relative select-none overflow-y-auto rounded-nested border border-hairline-strong bg-piano-ivory no-scrollbar",
        className,
      )}
    >
      <div ref={bodyRef} className="relative">
        <KeyColumn
          whites={geometry.whites}
          last={geometry.last}
          low={low}
          high={high}
          notation={notation}
          bands={bands}
          emphasis={emphasis}
          activeKey={activeKey}
          press={press}
          reduceMotion={reduceMotion}
          tabStop={tabStop}
          onPress={handlePress}
          onFocusKey={setFocusKey}
          registerKey={registerKey}
        />

        {cursor !== null ? (
          // Clipped, so the translated layer never lengthens the scroll area.
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
          >
            <motion.div
              className="absolute inset-x-0 top-0 h-full"
              initial={false}
              animate={{ y: percent(cursor) }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { duration: 0.08, ease: "linear" }
              }
            >
              <div className="h-0.5 -translate-y-1/2 bg-ethereal-sage" />
            </motion.div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
