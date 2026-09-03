/**
 * @file SegmentRow.tsx
 * @description One field of the page, with its languages beside each other.
 *
 * The row is a hairline and a label, and nothing else. A card per field would
 * put seventy borders down a page whose content is prose, and the reading order
 * — which is the whole reason the desk is a column and not a table — only
 * survives if the chrome between two paragraphs is thinner than the paragraphs.
 * @architecture Enterprise SaaS 2026
 * @module features/copydesk/components/SegmentRow
 */

import React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Caption, Eyebrow } from "@/shared/ui/primitives/typography";

import { SegmentCell } from "./SegmentCell";
import { LOCALE_MARKS } from "../lib/localeView";
import type { CopyDeskField } from "../lib/fields";
import type {
  CopyDeskProposalWrite,
  SiteLocale,
} from "../types/copydesk.dto";

/**
 * Whole class strings, because Tailwind scans source text — a column count
 * assembled from a variable generates no CSS at all. The break points differ on
 * purpose: two columns of prose are readable on a tablet, three are not.
 */
const COLUMN_LAYOUT: Readonly<Record<number, string>> = {
  1: "flex flex-col",
  2: "grid gap-x-5 gap-y-2 md:grid-cols-2",
  3: "grid gap-x-5 gap-y-2 lg:grid-cols-3",
};

interface SegmentRowProps {
  readonly field: CopyDeskField;
  readonly locales: readonly SiteLocale[];
  readonly onSave: (payload: CopyDeskProposalWrite) => void;
  readonly onWithdraw: (proposalId: string) => void;
}

export const SegmentRow = ({
  field,
  locales,
  onSave,
  onWithdraw,
}: SegmentRowProps): React.JSX.Element => {
  const { t } = useTranslation();
  const isNew = locales.some((locale) => field.cells[locale]?.segment.is_new);

  return (
    <li className="border-t border-hairline py-2.5">
      <div className="flex items-baseline justify-between gap-3 px-1.5 pb-1">
        {/* The label is the contract's, in Polish, in every language of the
            desk: it names a slot in the repository, and an editor reporting
            "the note under the third work" has to be naming the thing the
            developer will go and look for. */}
        <Eyebrow size="overline-sm" color="muted" className="truncate">
          {field.label || field.key}
        </Eyebrow>
        {isNew && (
          <Badge variant="incense">{t("copy_desk.editor.new", "Nowe")}</Badge>
        )}
      </div>

      <div className={cn(COLUMN_LAYOUT[locales.length] ?? COLUMN_LAYOUT[1])}>
        {locales.map((locale) => {
          const cell = field.cells[locale];
          if (!cell) {
            return (
              <Caption key={locale} color="graphite" className="px-2.5 py-1.5">
                {t("copy_desk.editor.no_row", {
                  locale: LOCALE_MARKS[locale],
                  defaultValue: "{{locale}} — brak wiersza w korpusie",
                })}
              </Caption>
            );
          }
          return (
            <SegmentCell
              key={cell.segment.id}
              cell={cell}
              withMark={locales.length > 1}
              onSave={onSave}
              onWithdraw={onWithdraw}
            />
          );
        })}
      </div>
    </li>
  );
};
