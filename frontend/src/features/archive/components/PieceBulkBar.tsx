/**
 * @file PieceBulkBar.tsx
 * @description The library's `BulkBar` while the list is in selection mode:
 * the selection count, the two selection shortcuts (everything visible / only
 * the pieces still without a divisi) and the one bulk act the library offers,
 * writing a voice layout to the selection.
 * @module features/archive/components/PieceBulkBar
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { CheckCheck, ListMusic, X } from "lucide-react";

import { BulkBar } from "@/shared/ui/composites/BulkBar";
import { Button } from "@/shared/ui/primitives/Button";
import { Text } from "@/shared/ui/primitives/typography";

interface PieceBulkBarProps {
  readonly selectedCount: number;
  readonly visibleCount: number;
  /** Visible pieces with no piece-wide divisi — the usual target of a sweep. */
  readonly withoutDivisiCount: number;
  readonly onSelectAll: () => void;
  readonly onSelectWithoutDivisi: () => void;
  readonly onClear: () => void;
  readonly onSetDivisi: () => void;
  readonly onExit: () => void;
}

export const PieceBulkBar = ({
  selectedCount,
  visibleCount,
  withoutDivisiCount,
  onSelectAll,
  onSelectWithoutDivisi,
  onClear,
  onSetDivisi,
  onExit,
}: PieceBulkBarProps): React.JSX.Element => {
  const { t } = useTranslation();
  const allSelected = selectedCount >= visibleCount && visibleCount > 0;

  return (
    <BulkBar
      label={t("archive.bulk.bar_aria", "Akcje zbiorcze")}
      status={
        <>
          <Text size="sm" weight="bold" className="tabular-nums">
            {t("archive.bulk.selected_count", "Zaznaczono {{count}}", {
              count: selectedCount,
            })}
          </Text>
          <Button
            variant="ghost"
            size="sm"
            casing="sentence"
            onClick={allSelected ? onClear : onSelectAll}
            leftIcon={<CheckCheck size={16} aria-hidden="true" />}
          >
            {allSelected
              ? t("archive.bulk.clear", "Wyczyść")
              : t("archive.bulk.select_all", "Zaznacz wszystkie")}
          </Button>
          {withoutDivisiCount > 0 && (
            <Button variant="ghost" size="sm" casing="sentence" onClick={onSelectWithoutDivisi}>
              {t("archive.bulk.select_without_divisi", {
                defaultValue: "Bez rozkładu ({{n}})",
                n: withoutDivisiCount,
              })}
            </Button>
          )}
        </>
      }
      actions={
        <>
          <Button
            variant="primary"
            size="sm"
            casing="sentence"
            onClick={onSetDivisi}
            disabled={selectedCount === 0}
            leftIcon={<ListMusic size={16} aria-hidden="true" />}
          >
            {t("archive.bulk.set_divisi", "Rozkład głosów")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            casing="sentence"
            onClick={onExit}
            leftIcon={<X size={16} aria-hidden="true" />}
          >
            {t("archive.bulk.done", "Zakończ")}
          </Button>
        </>
      }
    />
  );
};
