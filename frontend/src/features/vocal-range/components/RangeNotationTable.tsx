/**
 * @file RangeNotationTable.tsx
 * @description The range as it stands, written in each notation, with the
 * reader's own row lit. A singer who learned another system sees their range
 * beside the conductor's, which is where a misread octave shows itself. There
 * is no British row: British usage writes pitch as the international row or
 * the Helmholtz row does. The screen shows it only once a note is chosen, so it
 * never stands as a table of blanks.
 * @module features/vocal-range/components/RangeNotationTable
 */

import React, { useId } from "react";
import { useTranslation } from "react-i18next";

import {
  ALL_NOTATIONS,
  type PitchNotation,
  type VocalRangeMidi,
} from "@/shared/lib/music/pitchNotation";
import { cn } from "@/shared/lib/utils";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { VocalRangeText } from "@/shared/ui/instruments/PitchName";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";

export interface RangeNotationTableProps {
  readonly draft: VocalRangeMidi;
  readonly notation: PitchNotation;
}

export const RangeNotationTable = ({
  draft,
  notation,
}: RangeNotationTableProps): React.JSX.Element => {
  const { t } = useTranslation();
  const titleId = useId();

  return (
    <section aria-labelledby={titleId}>
      <Eyebrow as="h2" id={titleId} color="muted" className="ml-1">
        {t("vocal_range.table.title", "Twój zakres w każdym zapisie")}
      </Eyebrow>
      <GlassCard padding="none" className="mt-2 overflow-hidden">
        <dl className="divide-y divide-hairline">
          {ALL_NOTATIONS.map((each) => {
            const own = each === notation;
            return (
              <div
                key={each}
                className={cn(
                  "flex items-baseline justify-between gap-4 px-4 py-2.5",
                  own && "bg-ethereal-gold/10",
                )}
              >
                <dt>
                  <Text
                    as="span"
                    size="sm"
                    weight="medium"
                    color={own ? "gold" : "muted"}
                  >
                    {t(`vocal_range.table.${each}`)}
                  </Text>
                </dt>
                <dd className="text-right">
                  <Text as="span" size="md" color={own ? "default" : "graphite"}>
                    <VocalRangeText range={draft} notation={each} />
                  </Text>
                </dd>
              </div>
            );
          })}
        </dl>
      </GlassCard>
    </section>
  );
};
