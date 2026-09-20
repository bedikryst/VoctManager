/**
 * @file PieceBulkBar.tsx
 * @description Floating command bar shown while the archive list is in
 * selection mode. Carries the selection count, the two selection shortcuts
 * (everything visible / only the pieces still without a divisi) and the one
 * bulk act the archive offers: writing a voice layout to the selection.
 * Portals to body and sits on `bottom-dock` so it clears the mobile nav.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/PieceBulkBar
 */

import React from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { CheckCheck, ListMusic, X } from "lucide-react";

import { Button } from "@/shared/ui/primitives/Button";
import { Text } from "@/shared/ui/primitives/typography";
import { Portal } from "@/shared/lib/dom/Portal";
import { useBottomBarSlot } from "@/shared/lib/dom/useBottomBarSlot";

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
  const slotRef = useBottomBarSlot();

  return (
    <Portal>
      <motion.div
        ref={slotRef}
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: "spring", damping: 26, stiffness: 260 }}
        className="fixed inset-x-0 bottom-dock z-dock-bar mx-auto flex w-[min(100%-2rem,44rem)] flex-wrap items-center justify-between gap-3 rounded-nested border border-hairline-strong bg-ethereal-alabaster/90 px-4 py-3 shadow-glass-ethereal backdrop-blur-xl"
        role="region"
        aria-label={t("archive.bulk.bar_aria", "Akcje zbiorcze")}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Text size="sm" weight="bold" className="tabular-nums">
            {t("archive.bulk.selected_count", {
              defaultValue: "{{n}} zaznaczono",
              n: selectedCount,
            })}
          </Text>
          <Button
            variant="ghost"
            size="sm"
            onClick={allSelected ? onClear : onSelectAll}
            leftIcon={<CheckCheck size={13} aria-hidden="true" />}
          >
            {allSelected
              ? t("archive.bulk.clear", "Wyczyść")
              : t("archive.bulk.select_all", "Zaznacz wszystkie")}
          </Button>
          {withoutDivisiCount > 0 && (
            <Button variant="ghost" size="sm" onClick={onSelectWithoutDivisi}>
              {t("archive.bulk.select_without_divisi", {
                defaultValue: "Bez rozkładu ({{n}})",
                n: withoutDivisiCount,
              })}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={onSetDivisi}
            disabled={selectedCount === 0}
            leftIcon={<ListMusic size={14} aria-hidden="true" />}
          >
            {t("archive.bulk.set_divisi", "Rozkład głosów")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onExit}
            leftIcon={<X size={14} aria-hidden="true" />}
          >
            {t("archive.bulk.done", "Zakończ")}
          </Button>
        </div>
      </motion.div>
    </Portal>
  );
};
