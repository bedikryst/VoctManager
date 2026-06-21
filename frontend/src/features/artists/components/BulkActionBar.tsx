/**
 * @file BulkActionBar.tsx
 * @description Floating command bar shown while the roster is in selection mode.
 * Surfaces the selection count and context-aware bulk lifecycle actions
 * (archive the selected active singers / restore the selected archived ones).
 * @architecture Enterprise SaaS 2026
 * @module features/artists/components/BulkActionBar
 */

import React from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Archive, CheckCheck, RotateCcw, X } from "lucide-react";

import { Button } from "@/shared/ui/primitives/Button";
import { Text } from "@/shared/ui/primitives/typography";
import { Portal } from "@/shared/lib/dom/Portal";

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
    <Portal>
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: "spring", damping: 26, stiffness: 260 }}
      className="fixed inset-x-0 bottom-dock z-toast mx-auto flex w-[min(100%-2rem,44rem)] flex-wrap items-center justify-between gap-3 rounded-2xl border border-ethereal-ink/8 bg-ethereal-alabaster/90 px-4 py-3 shadow-glass-ethereal backdrop-blur-xl"
      role="region"
      aria-label={t("artists.bulk.bar_aria", "Akcje zbiorcze")}
    >
      <div className="flex items-center gap-3">
        <Text size="sm" weight="bold" className="tabular-nums">
          {t("artists.bulk.selected_count", {
            defaultValue: "{{n}} zaznaczono",
            n: selectedTotal,
          })}
        </Text>
        <button
          type="button"
          onClick={allSelected ? onClear : onSelectAll}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ethereal-graphite transition-colors hover:text-ethereal-gold"
        >
          <CheckCheck size={13} aria-hidden="true" />
          {allSelected
            ? t("artists.bulk.clear", "Wyczyść")
            : t("artists.bulk.select_all", "Zaznacz wszystkich")}
        </button>
      </div>

      <div className="flex items-center gap-2">
        {archivedCount > 0 && (
          <Button
            variant="outline"
            size="sm"
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
          onClick={onExit}
          leftIcon={<X size={14} aria-hidden="true" />}
        >
          {t("artists.bulk.done", "Zakończ")}
        </Button>
      </div>
    </motion.div>
    </Portal>
  );
};
