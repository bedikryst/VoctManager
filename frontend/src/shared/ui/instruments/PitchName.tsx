/**
 * @file PitchName.tsx
 * @description A pitch name, and a whole written range, set as markup in the
 * surrounding face. The octave mark is a `<sup>`/`<sub>` of plain digits and
 * the sharp is drawn: the self-hosted font subsets carry ¹ ² ³ but not ⁴ ⁵ ₁ ₂
 * or ♯, so the Unicode forms would put a large `c⁴` in a system face beside a
 * `c³` in Cormorant. Every mark is set this way, the ones the fonts do carry
 * included, so all octaves read in one hand.
 *
 * Where only plain text will do (an aria-label, a sentence in a translation),
 * use `formatPitch` / `formatVocalRange` instead; both spell from the same
 * `spellPitch`.
 * @module shared/ui/instruments/PitchName
 */

import React from "react";

import {
  spellPitch,
  vocalRangeTokens,
  type PitchNotation,
  type VocalRangeMidi,
  type VocalRangeToken,
} from "@/shared/lib/music/pitchNotation";
import { cn } from "@/shared/lib/utils";

/** A sharp at roughly cap height, drawn in the text's own colour. The glyph
 *  stays in the text for assistive technology and for copying. */
const SharpSign = (): React.JSX.Element => (
  <>
    <svg
      aria-hidden="true"
      viewBox="0 0 10 16"
      width="0.42em"
      height="0.68em"
      fill="currentColor"
      className="inline-block"
    >
      <rect x="2.8" y="1.6" width="1.2" height="14" />
      <rect x="6" y="0.4" width="1.2" height="14" />
      <polygon points="0.8,6.8 9.2,4.4 9.2,6.6 0.8,9" />
      <polygon points="0.8,11.8 9.2,9.4 9.2,11.6 0.8,14" />
    </svg>
    <span className="sr-only">♯</span>
  </>
);

export interface PitchNameProps {
  readonly midi: number;
  readonly notation: PitchNotation;
  readonly className?: string;
}

/** An `f` or `F` reaches past its own advance at the top right, where a raised
 *  mark sits, so its mark stands off further. In em, so the gap scales with the
 *  size the name is set at. */
const OVERHANGING_ENDING = /[fF]$/;

export const PitchName = ({
  midi,
  notation,
  className,
}: PitchNameProps): React.JSX.Element => {
  const { name, sharp, octave, placement } = spellPitch(midi, notation);
  const markGap =
    !sharp && OVERHANGING_ENDING.test(name) ? "ml-[0.14em]" : "ml-[0.03em]";
  return (
    <span className={cn("whitespace-nowrap", className)}>
      {name}
      {sharp ? <SharpSign /> : null}
      {placement === "superscript" ? (
        <sup className={markGap}>{octave}</sup>
      ) : placement === "subscript" ? (
        <sub className={markGap}>{octave}</sub>
      ) : (
        octave
      )}
    </span>
  );
};

export interface VocalRangeTextProps {
  readonly range: VocalRangeMidi;
  readonly notation: PitchNotation;
  readonly className?: string;
}

const RangeToken = ({
  token,
  notation,
}: {
  readonly token: VocalRangeToken;
  readonly notation: PitchNotation;
}): React.JSX.Element => {
  if (token.kind === "dash") return <>–</>;
  return token.extreme ? (
    <>
      (<PitchName midi={token.midi} notation={notation} />)
    </>
  ) : (
    <PitchName midi={token.midi} notation={notation} />
  );
};

/**
 * `a (g) – a² (c³)` as markup; renders nothing for an empty range. A narrow
 * column may break the line only before the dash, so each side stays whole
 * and an extreme never lands on a line apart from its bound; the dash leads
 * the second side, as on the singer's line of slots.
 */
export const VocalRangeText = ({
  range,
  notation,
  className,
}: VocalRangeTextProps): React.JSX.Element | null => {
  const tokens = vocalRangeTokens(range);
  if (tokens.length === 0) return null;

  const dash = tokens.findIndex((token) => token.kind === "dash");
  const sides = [tokens.slice(0, dash), tokens.slice(dash)].filter(
    (side) => side.length > 0,
  );

  return (
    <span className={className}>
      {sides.map((side, sideIndex) => (
        // The token list is rebuilt whole from four numbers, never reordered.
        <React.Fragment key={sideIndex}>
          {sideIndex > 0 ? " " : null}
          <span className="whitespace-nowrap">
            {side.map((token, index) => (
              <React.Fragment key={index}>
                {index > 0 ? " " : null}
                <RangeToken token={token} notation={notation} />
              </React.Fragment>
            ))}
          </span>
        </React.Fragment>
      ))}
    </span>
  );
};
