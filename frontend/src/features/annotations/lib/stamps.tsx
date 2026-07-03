/**
 * @file stamps.tsx
 * @description The musical stamp catalogue — the choir-markup vocabulary a
 * pencil would write on paper: breath marks, dynamics, hairpins, fermata,
 * caesura and the "watch the conductor" glasses. Text stamps render in a bold
 * italic serif (the engraving convention for dynamics); geometric symbols are
 * tiny inline SVGs so nothing depends on a music font being installed. Sizes
 * are fractions of the page width, matching the normalized coordinate model.
 * @module features/annotations/lib
 * @architecture Enterprise SaaS 2026
 */

import React from "react";

interface StampDefBase {
  /** Stored in `payload.symbol`; also the i18n key suffix. */
  id: string;
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
  /** Optional filled dot (fermata): [cx, cy, r] in viewBox units. */
  dot?: readonly [number, number, number];
}

export type StampDef = TextStampDef | SvgStampDef;

const dynamic = (mark: string): TextStampDef => ({
  id: mark,
  kind: "text",
  glyph: mark,
  labelKey: `annotations.stamps.${mark}`,
  fallback: `Dynamika ${mark}`,
  sizeFraction: 0.03,
});

export const STAMPS: ReadonlyArray<StampDef> = [
  {
    id: "breath",
    kind: "text",
    glyph: "’",
    labelKey: "annotations.stamps.breath",
    fallback: "Oddech",
    sizeFraction: 0.05,
  },
  {
    id: "caesura",
    kind: "text",
    glyph: "//",
    labelKey: "annotations.stamps.caesura",
    fallback: "Cezura",
    sizeFraction: 0.03,
  },
  {
    id: "fermata",
    kind: "svg",
    labelKey: "annotations.stamps.fermata",
    fallback: "Fermata",
    sizeFraction: 0.035,
    viewBox: "0 0 24 15",
    paths: ["M2 13 A 10 10 0 0 1 22 13"],
    dot: [12, 11, 2],
  },
  {
    id: "accent",
    kind: "text",
    glyph: ">",
    labelKey: "annotations.stamps.accent",
    fallback: "Akcent",
    sizeFraction: 0.032,
  },
  {
    id: "watch",
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
    id: "cresc",
    kind: "svg",
    labelKey: "annotations.stamps.cresc",
    fallback: "Crescendo",
    sizeFraction: 0.06,
    viewBox: "0 0 48 16",
    paths: ["M46 2 L2 8 L46 14"],
  },
  {
    id: "dim",
    kind: "svg",
    labelKey: "annotations.stamps.dim",
    fallback: "Diminuendo",
    sizeFraction: 0.06,
    viewBox: "0 0 48 16",
    paths: ["M2 2 L46 8 L2 14"],
  },
  dynamic("pp"),
  dynamic("p"),
  dynamic("mp"),
  dynamic("mf"),
  dynamic("f"),
  dynamic("ff"),
];

export const DEFAULT_STAMP = "breath";

const STAMP_INDEX = new Map(STAMPS.map((def) => [def.id, def]));

export const getStampDef = (symbol: string): StampDef | undefined =>
  STAMP_INDEX.get(symbol);

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

  const parts = def.viewBox.split(" ").map(Number);
  const aspect = (parts[3] ?? 1) / (parts[2] ?? 1);
  return (
    <svg
      width={size}
      height={size * aspect}
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
      {def.dot && <circle cx={def.dot[0]} cy={def.dot[1]} r={def.dot[2]} fill={color} />}
    </svg>
  );
};
