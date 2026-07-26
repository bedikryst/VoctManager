/**
 * @file DurationCell.tsx
 * @description The programme's duration column, shared by the setlist and the
 * database beside it so a piece can be weighed before it is added.
 * Sans + `tabular-nums`: this is one of the few figures in the panel that
 * genuinely aligns down a column, which is the reason it left the metadata line
 * where it used to read "· 3 min 30 sek" halfway through a sentence.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/components/DurationCell
 */

import React from "react";
import { useTranslation } from "react-i18next";

import { Text } from "@/shared/ui/primitives/typography";
import { formatClockDuration } from "../../../lib/programDuration";

interface DurationCellProps {
  readonly seconds?: number | null;
}

export function DurationCell({
  seconds,
}: DurationCellProps): React.JSX.Element {
  const { t } = useTranslation();
  const clock = formatClockDuration(seconds);

  return (
    <Text
      as="span"
      size="xs"
      color="muted"
      className="w-11 shrink-0 text-right tabular-nums"
      title={
        clock
          ? t("projects.program.duration_label", "Czas trwania")
          : t("projects.program.duration_unknown", "Czas nieznany")
      }
    >
      {clock ?? "–"}
    </Text>
  );
}
