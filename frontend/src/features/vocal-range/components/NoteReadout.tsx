/**
 * @file NoteReadout.tsx
 * @description The key last touched, on one line, named in all three
 * notations and in hertz: `A4 · a¹ · la3 · 440 Hz`. The reader's own notation
 * carries the weight. A singer who learned another system sees their name for
 * the note beside the conductor's, which is where a misread octave shows
 * itself. It sits under the slots, in the strip that stays above the keyboard.
 * Each new note settles in rather than snapping.
 * @module features/vocal-range/components/NoteReadout
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";

import {
  ALL_NOTATIONS,
  midiToHz,
  type PitchNotation,
} from "@/shared/lib/music/pitchNotation";
import { PitchName } from "@/shared/ui/instruments/PitchName";
import { Text } from "@/shared/ui/primitives/typography";

export interface NoteReadoutProps {
  readonly midi: number;
  readonly notation: PitchNotation;
}

export const NoteReadout = ({
  midi,
  notation,
}: NoteReadoutProps): React.JSX.Element => {
  const { t, i18n } = useTranslation();

  return (
    <motion.div
      key={midi}
      className="min-w-0"
      initial={{ opacity: 0.5 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <Text as="p" size="md" color="graphite" className="truncate">
        {ALL_NOTATIONS.map((each) => (
          <React.Fragment key={each}>
            <Text
              as="span"
              size="md"
              weight={each === notation ? "semibold" : "normal"}
              color={each === notation ? "default" : "inherit"}
            >
              <PitchName midi={midi} notation={each} />
            </Text>
            <span aria-hidden="true" className="mx-2 text-ethereal-graphite/40">
              ·
            </span>
          </React.Fragment>
        ))}
        <span className="tabular-nums">
          {t("vocal_range.note_card.hz", "{{value}} Hz", {
            value: new Intl.NumberFormat(i18n.language, {
              maximumFractionDigits: 1,
            }).format(midiToHz(midi)),
          })}
        </span>
      </Text>
    </motion.div>
  );
};
