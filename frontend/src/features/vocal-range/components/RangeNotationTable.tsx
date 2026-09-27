/**
 * @file RangeNotationTable.tsx
 * @description The range as it stands, written in the two notations the reader
 * does not use. The reader's own is the slot line above, so it is not repeated
 * here. A singer who learned another system sees their range beside the
 * conductor's, which is where a misread octave shows itself. There is no
 * British row: British usage writes pitch as the international row or the
 * Helmholtz row does. The screen shows it only once a note is chosen, so it
 * never stands as a table of blanks, and a changed range settles in rather
 * than snapping.
 * @module features/vocal-range/components/RangeNotationTable
 */

import React, { useId } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";

import {
  ALL_NOTATIONS,
  type PitchNotation,
  type VocalRangeMidi,
} from "@/shared/lib/music/pitchNotation";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { VocalRangeText } from "@/shared/ui/instruments/PitchName";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";

import { RANGE_SLOTS } from "../lib/rangeDraft";

export interface RangeNotationTableProps {
  readonly draft: VocalRangeMidi;
  /** The reader's own notation, which the table leaves out. */
  readonly notation: PitchNotation;
}

export const RangeNotationTable = ({
  draft,
  notation,
}: RangeNotationTableProps): React.JSX.Element => {
  const { t } = useTranslation();
  const titleId = useId();
  const rangeKey = RANGE_SLOTS.map((slot) => draft[slot] ?? "").join(",");

  return (
    <section aria-labelledby={titleId}>
      <Eyebrow as="h2" id={titleId} color="muted" className="ml-1">
        {t("vocal_range.table.title", "Ten sam zakres w innych zapisach")}
      </Eyebrow>
      <GlassCard padding="none" className="mt-2 overflow-hidden">
        <dl className="divide-y divide-hairline">
          {ALL_NOTATIONS.filter((each) => each !== notation).map((each) => (
            <div
              key={each}
              className="flex items-baseline justify-between gap-4 px-4 py-2.5"
            >
              <dt>
                <Text as="span" size="sm" weight="medium" color="muted">
                  {t(`vocal_range.table.${each}`)}
                </Text>
              </dt>
              <dd className="text-right">
                <motion.span
                  key={rangeKey}
                  initial={{ opacity: 0.5 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <Text as="span" size="md" color="graphite">
                    <VocalRangeText range={draft} notation={each} />
                  </Text>
                </motion.span>
              </dd>
            </div>
          ))}
        </dl>
      </GlassCard>
    </section>
  );
};
