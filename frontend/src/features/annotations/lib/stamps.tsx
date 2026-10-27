/**
 * @file stamps.tsx
 * @description The musical stamp catalogue — the choir-markup vocabulary a
 * pencil would write on paper: breath and its refusal, articulation, dynamics
 * and hairpins, the navigation signs, tempo and expression words, and the cues
 * a conductor gives with a look, the reminder accidentals among them. Text
 * stamps render in a bold italic serif (the engraving convention for dynamics);
 * geometric symbols, the accidentals included, are tiny inline SVGs so nothing
 * depends on a music font being installed. Sizes are fractions of the page
 * width, matching the normalized coordinate model.
 *
 * Every stamp declares a `group`, because a flat grid stopped fitting a phone
 * somewhere around twenty symbols. Groups are an EDITOR concern only — the
 * print mirror (`backend/archive/annotation_stamps.py`) knows ids and shapes,
 * and the two files must be edited in one change or a placed mark prints as a
 * hole. Group ids deliberately live under a `group:` key rather than an `id:`
 * one: the parity test reads stamp ids out of this file with a regex.
 * @module features/annotations/lib
 */

import React from "react";

export type StampGroupId =
  | "breath"
  | "articulation"
  | "dynamics"
  | "navigation"
  | "tempo"
  | "cues";

interface StampDefBase {
  /** Stored in `payload.symbol`; also the i18n key suffix. */
  id: string;
  group: StampGroupId;
  labelKey: string;
  fallback: string;
  /** Rendered size (font size / SVG width) as a fraction of the page width. */
  sizeFraction: number;
}

interface TextStampDef extends StampDefBase {
  kind: "text";
  glyph: string;
}

interface SvgStampDef extends StampDefBase {
  kind: "svg";
  viewBox: string;
  /** Stroked polylines drawn in the annotation colour. */
  paths: string[];
  /** Filled dots (fermata's eye, segno's pair, the staccato dot itself), each
   *  [cx, cy, r] in viewBox units. */
  dots?: ReadonlyArray<readonly [number, number, number]>;
}

export type StampDef = TextStampDef | SvgStampDef;

const dynamic = (mark: string): TextStampDef => ({
  id: mark,
  group: "dynamics",
  kind: "text",
  glyph: mark,
  labelKey: `annotations.stamps.${mark}`,
  fallback: `Dynamika ${mark}`,
  sizeFraction: 0.03,
});

/** A tempo or expression word, set the way an engraver sets one. */
const word = (id: string, glyph: string, fallback: string): TextStampDef => ({
  id,
  group: "tempo",
  kind: "text",
  glyph,
  labelKey: `annotations.stamps.${id}`,
  fallback,
  sizeFraction: 0.026,
});

export const STAMPS: ReadonlyArray<StampDef> = [
  // --- Breath, holds and silences ------------------------------------------
  {
    id: "breath",
    group: "breath",
    kind: "text",
    glyph: "’",
    labelKey: "annotations.stamps.breath",
    fallback: "Oddech",
    sizeFraction: 0.05,
  },
  {
    id: "nobreath",
    group: "breath",
    kind: "svg",
    labelKey: "annotations.stamps.nobreath",
    fallback: "Bez oddechu",
    sizeFraction: 0.035,
    viewBox: "0 0 16 16",
    // The breath's own hook, struck through: the sign says what it forbids.
    paths: ["M6 3 C 10 5, 10 9, 5 12", "M2 13.5 L 14 2.5"],
  },
  {
    id: "caesura",
    group: "breath",
    kind: "text",
    glyph: "//",
    labelKey: "annotations.stamps.caesura",
    fallback: "Cezura",
    sizeFraction: 0.03,
  },
  {
    id: "cutoff",
    group: "breath",
    kind: "svg",
    labelKey: "annotations.stamps.cutoff",
    fallback: "Odcięcie",
    sizeFraction: 0.03,
    viewBox: "0 0 14 16",
    paths: ["M2 1.5 L12 1.5", "M7 1.5 L7 14.5"],
  },
  {
    id: "fermata",
    group: "breath",
    kind: "svg",
    labelKey: "annotations.stamps.fermata",
    fallback: "Fermata",
    sizeFraction: 0.035,
    viewBox: "0 0 24 15",
    paths: ["M2 13 A 10 10 0 0 1 22 13"],
    dots: [[12, 11, 2]],
  },
  {
    id: "gp",
    group: "breath",
    kind: "text",
    glyph: "G.P.",
    labelKey: "annotations.stamps.gp",
    fallback: "Generalpauza",
    sizeFraction: 0.03,
  },

  // --- Articulation ---------------------------------------------------------
  {
    id: "accent",
    group: "articulation",
    kind: "text",
    glyph: ">",
    labelKey: "annotations.stamps.accent",
    fallback: "Akcent",
    sizeFraction: 0.032,
  },
  {
    id: "marcato",
    group: "articulation",
    kind: "svg",
    labelKey: "annotations.stamps.marcato",
    fallback: "Marcato",
    sizeFraction: 0.024,
    viewBox: "0 0 16 14",
    paths: ["M2 12 L8 2 L14 12"],
  },
  {
    id: "staccato",
    group: "articulation",
    kind: "svg",
    labelKey: "annotations.stamps.staccato",
    fallback: "Staccato",
    sizeFraction: 0.012,
    viewBox: "0 0 10 10",
    paths: [],
    dots: [[5, 5, 3]],
  },
  {
    id: "tenuto",
    group: "articulation",
    kind: "svg",
    labelKey: "annotations.stamps.tenuto",
    fallback: "Tenuto",
    sizeFraction: 0.022,
    viewBox: "0 0 16 6",
    paths: ["M2 3 L14 3"],
  },

  // --- Dynamics -------------------------------------------------------------
  dynamic("ppp"),
  dynamic("pp"),
  dynamic("p"),
  dynamic("mp"),
  dynamic("mf"),
  dynamic("f"),
  dynamic("ff"),
  dynamic("fff"),
  dynamic("sfz"),
  dynamic("fp"),
  {
    id: "cresc",
    group: "dynamics",
    kind: "svg",
    labelKey: "annotations.stamps.cresc",
    fallback: "Crescendo",
    sizeFraction: 0.06,
    viewBox: "0 0 48 16",
    paths: ["M46 2 L2 8 L46 14"],
  },
  {
    id: "dim",
    group: "dynamics",
    kind: "svg",
    labelKey: "annotations.stamps.dim",
    fallback: "Diminuendo",
    sizeFraction: 0.06,
    viewBox: "0 0 48 16",
    paths: ["M2 2 L46 8 L2 14"],
  },

  // --- Navigation -----------------------------------------------------------
  {
    id: "segno",
    group: "navigation",
    kind: "svg",
    labelKey: "annotations.stamps.segno",
    fallback: "Segno",
    sizeFraction: 0.035,
    viewBox: "0 0 20 20",
    paths: [
      "M15.5 4.5 C 12 0.5, 6.5 2, 6.5 6 C 6.5 9.5, 13.5 10.5, 13.5 14 C 13.5 18, 8 19.5, 4.5 15.5",
      "M4 5.5 L16 14.5",
    ],
    dots: [
      [15, 5, 1.3],
      [5, 15, 1.3],
    ],
  },
  {
    id: "coda",
    group: "navigation",
    kind: "svg",
    labelKey: "annotations.stamps.coda",
    fallback: "Coda",
    sizeFraction: 0.035,
    viewBox: "0 0 20 20",
    paths: [
      "M5 10 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0",
      "M10 1.5 L10 18.5",
      "M1.5 10 L18.5 10",
    ],
  },
  {
    id: "dc",
    group: "navigation",
    kind: "text",
    glyph: "D.C.",
    labelKey: "annotations.stamps.dc",
    fallback: "Da capo",
    sizeFraction: 0.028,
  },
  {
    id: "ds",
    group: "navigation",
    kind: "text",
    glyph: "D.S.",
    labelKey: "annotations.stamps.ds",
    fallback: "Dal segno",
    sizeFraction: 0.028,
  },
  {
    id: "fine",
    group: "navigation",
    kind: "text",
    glyph: "Fine",
    labelKey: "annotations.stamps.fine",
    fallback: "Fine",
    sizeFraction: 0.028,
  },
  {
    id: "to_coda",
    group: "navigation",
    kind: "text",
    glyph: "To Coda",
    labelKey: "annotations.stamps.to_coda",
    fallback: "To Coda",
    sizeFraction: 0.028,
  },

  // --- Tempo and expression ---------------------------------------------------
  word("rit", "rit.", "Ritardando"),
  word("accel", "accel.", "Accelerando"),
  word("atempo", "a tempo", "A tempo"),
  word("subito", "sub.", "Subito"),
  word("poco", "poco a poco", "Poco a poco"),
  word("molto", "molto", "Molto"),
  word("bocca_chiusa", "bocca chiusa", "Bocca chiusa"),

  // --- Cues: what the conductor asks for without stopping --------------------
  {
    id: "watch",
    group: "cues",
    kind: "svg",
    labelKey: "annotations.stamps.watch",
    fallback: "Patrz na dyrygenta",
    sizeFraction: 0.045,
    viewBox: "0 0 34 14",
    paths: [
      "M2 8 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0",
      "M22 8 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0",
      "M12 7 Q 17 3.5 22 7",
    ],
  },
  {
    id: "raise",
    group: "cues",
    kind: "svg",
    labelKey: "annotations.stamps.raise",
    fallback: "Za nisko — podnieś",
    sizeFraction: 0.028,
    viewBox: "0 0 12 18",
    paths: ["M6 17 L6 2", "M1.5 7 L6 2 L10.5 7"],
  },
  {
    id: "lower",
    group: "cues",
    kind: "svg",
    labelKey: "annotations.stamps.lower",
    fallback: "Za wysoko — obniż",
    sizeFraction: 0.028,
    viewBox: "0 0 12 18",
    paths: ["M6 1 L6 16", "M1.5 11 L6 16 L10.5 11"],
  },
  // The reminder accidental a singer pencils in before the note they keep
  // missing. Drawn, not typed: the serif the text stamps use has no ♯ ♭ ♮.
  {
    id: "sharp",
    group: "cues",
    kind: "svg",
    labelKey: "annotations.stamps.sharp",
    fallback: "Krzyżyk",
    sizeFraction: 0.016,
    viewBox: "0 0 14 22",
    paths: ["M5 2.5 L5 20.5", "M9 1.5 L9 19.5", "M1.5 9 L12.5 6", "M1.5 16 L12.5 13"],
  },
  {
    id: "flat",
    group: "cues",
    kind: "svg",
    labelKey: "annotations.stamps.flat",
    fallback: "Bemol",
    sizeFraction: 0.0115,
    viewBox: "0 0 10 22",
    paths: ["M2.5 1.5 L2.5 20.5", "M2.5 20.5 C 6.5 18, 9 15.5, 8 13 C 7 10.5, 4 11.5, 2.5 13.5"],
  },
  {
    id: "natural",
    group: "cues",
    kind: "svg",
    labelKey: "annotations.stamps.natural",
    fallback: "Kasownik",
    sizeFraction: 0.0125,
    viewBox: "0 0 11 22",
    paths: ["M2.5 1.5 L2.5 16", "M8.5 6 L8.5 20.5", "M2.5 8.5 L8.5 6.5", "M2.5 16 L8.5 14"],
  },
];

export const DEFAULT_STAMP = "breath";

interface StampGroupDef {
  group: StampGroupId;
  labelKey: string;
  fallback: string;
}

/** Palette order — breath first because it is the mark hands reach for most. */
export const STAMP_GROUPS: ReadonlyArray<StampGroupDef> = [
  { group: "breath", labelKey: "annotations.stamp_groups.breath", fallback: "Oddech" },
  {
    group: "articulation",
    labelKey: "annotations.stamp_groups.articulation",
    fallback: "Artykulacja",
  },
  {
    group: "dynamics",
    labelKey: "annotations.stamp_groups.dynamics",
    fallback: "Dynamika",
  },
  {
    group: "navigation",
    labelKey: "annotations.stamp_groups.navigation",
    fallback: "Nawigacja",
  },
  { group: "tempo", labelKey: "annotations.stamp_groups.tempo", fallback: "Tempo i wyraz" },
  { group: "cues", labelKey: "annotations.stamp_groups.cues", fallback: "Wskazówki" },
];

const STAMP_INDEX = new Map(STAMPS.map((def) => [def.id, def]));

export const getStampDef = (symbol: string): StampDef | undefined =>
  STAMP_INDEX.get(symbol);

/** The stamps of one palette group, in catalogue order. */
export const stampsInGroup = (group: StampGroupId): StampDef[] =>
  STAMPS.filter((def) => def.group === group);

/**
 * Which group a palette should be showing, given the armed stamp — so the
 * palette always opens on the symbol in hand rather than on a fixed first tab.
 */
export const groupOfStamp = (symbol: string): StampGroupId =>
  getStampDef(symbol)?.group ?? "breath";

/** Height / width of an SVG stamp's box; a text stamp answers 1. */
const stampAspect = (def: StampDef): number => {
  if (def.kind === "text") return 1;
  const parts = def.viewBox.split(" ").map(Number);
  return (parts[3] ?? 1) / (parts[2] ?? 1);
};

/**
 * The `size` that fits a stamp's preview inside a square of `box` px. An SVG
 * stamp is sized by its width, so a tall one (a flat, a cut-off) is narrowed
 * until its height fits too.
 */
export const stampPreviewSize = (def: StampDef, box: number): number =>
  def.kind === "text" ? box * 0.68 : Math.min(box, box / stampAspect(def));

interface StampGlyphProps {
  symbol: string;
  color: string;
  /** Rendered size in px: font size for text stamps, width for SVG stamps. */
  size: number;
  className?: string;
}

/**
 * Presentation of one stamp, shared by the toolbar picker (fixed preview size)
 * and the page overlay (size derived from the live page width). Unknown symbol
 * ids (e.g. from a newer client) render nothing rather than a broken glyph.
 */
export const StampGlyph = ({
  symbol,
  color,
  size,
  className,
}: StampGlyphProps): React.JSX.Element | null => {
  const def = getStampDef(symbol);
  if (!def) return null;

  if (def.kind === "text") {
    return (
      <span
        className={className}
        aria-hidden="true"
        style={{
          color,
          fontSize: size,
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontStyle: "italic",
          fontWeight: 700,
          lineHeight: 1,
          whiteSpace: "nowrap",
        }}
      >
        {def.glyph}
      </span>
    );
  }

  return (
    <svg
      width={size}
      height={size * stampAspect(def)}
      viewBox={def.viewBox}
      aria-hidden="true"
      className={className}
    >
      {def.paths.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {def.dots?.map((dot) => (
        <circle key={dot.join()} cx={dot[0]} cy={dot[1]} r={dot[2]} fill={color} />
      ))}
    </svg>
  );
};
