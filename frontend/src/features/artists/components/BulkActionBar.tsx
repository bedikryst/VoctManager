/**
 * @file BulkActionBar.tsx
 * @description The roster's `BulkBar` while it is in selection mode: the
 * selection count and the lifecycle acts the selection allows (archive the
 * selected active singers / restore the selected archived ones).
 * @module features/artists/components/BulkActionBar
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Archive, CheckCheck, RotateCcw, X } from "lucide-react";

import { BulkBar } from "@/shared/ui/composites/BulkBar";
import { Button } from "@/shared/ui/primitives/Button";
import { Text } from "@/shared/ui/primitives/typography";

interface BulkActionBarProps {
  selectedTotal: number;
  activeCount: number;
  archivedCount: number;
  visibleCount: number;
  onSelectAll: () => void;
  onClear: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onExit: () => void;
  isPending: boolean;
}

export const BulkActionBar = ({
  selectedTotal,
  activeCount,
  archivedCount,
  visibleCount,
  onSelectAll,
  onClear,
  onArchive,
  onRestore,
  onExit,
  isPending,
}: BulkActionBarProps): React.JSX.Element => {
  const { t } = useTranslation();
  const allSelected = selectedTotal >= visibleCount && visibleCount > 0;

  return (
    <BulkBar
      label={t("artists.bulk.bar_aria", "Akcje zbiorcze")}
      status={
        <>
          <Text size="sm" weight="bold" className="tabular-nums">
            {t("artists.bulk.selected_count", {
              defaultValue: "{{n}} zaznaczono",
              n: selectedTotal,
            })}
          </Text>
          <Button
            variant="ghost"
            size="sm"
            casing="sentence"
            onClick={allSelected ? onClear : onSelectAll}
            leftIcon={<CheckCheck size={13} aria-hidden="true" />}
          >
            {allSelected
              ? t("artists.bulk.clear", "Wyczyść")
              : t("artists.bulk.select_all", "Zaznacz wszystkich")}
          </Button>
        </>
      }
      actions={
        <>
          {archivedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              casing="sentence"
              onClick={onRestore}
              disabled={isPending}
              leftIcon={<RotateCcw size={14} aria-hidden="true" />}
              className="text-ethereal-sage hover:text-ethereal-sage"
            >
              {t("artists.bulk.restore", {
                defaultValue: "Przywróć ({{n}})",
                n: archivedCount,
              })}
            </Button>
          )}
          {activeCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              casing="sentence"
              onClick={onArchive}
              disabled={isPending}
              leftIcon={<Archive size={14} aria-hidden="true" />}
              className="text-ethereal-crimson hover:text-ethereal-crimson"
            >
              {t("artists.bulk.archive", {
                defaultValue: "Archiwizuj ({{n}})",
                n: activeCount,
              })}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            casing="sentence"
            onClick={onExit}
            leftIcon={<X size={14} aria-hidden="true" />}
          >
            {t("artists.bulk.done", "Zakończ")}
          </Button>
        </>
      }
    />
  );
};
