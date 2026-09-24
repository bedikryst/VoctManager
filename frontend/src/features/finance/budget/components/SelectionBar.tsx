/**
 * @file SelectionBar.tsx
 * @description The floating bar of the ledger's bulk acts: issue the selected
 * contracts, mark the selected fees paid. Each act counts only the selected
 * rows it can reach, so "Wystaw umowy (3)" means three documents.
 * It shares the band above the nav dock with the save bar and yields it: the
 * Honoraria page opens this bar only while no pricing draft is pending, because
 * an act on a row whose price is still a draft would settle the old price.
 * The finance workspace's Do zapłaty opens the same bar with the payment alone,
 * worded for fees and expenses together and with the selection's sum.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/budget/components/SelectionBar
 */

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Banknote, FilePen, X } from "lucide-react";

import { Portal } from "@/shared/lib/dom/Portal";
import { useBottomBarSlot } from "@/shared/lib/dom/useBottomBarSlot";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Text } from "@/shared/ui/primitives/typography";

interface SelectionBarProps {
  readonly isOpen: boolean;
  readonly selectedCount: number;
  /** Beside the count: what the selection adds up to. */
  readonly summary?: string;
  /** Without `onIssue` the bar offers no contracts. */
  readonly issuableCount?: number;
  readonly payableCount: number;
  /** Replaces the fee wording of the pay button; takes `{{count}}` already filled. */
  readonly payLabel?: string;
  /** Why the acts are unavailable (offline), or null. */
  readonly blockedReason: string | null;
  readonly isWorking: boolean;
  readonly onIssue?: () => void;
  readonly onPay: () => void;
  readonly onClear: () => void;
}

export function SelectionBar({
  isOpen,
  selectedCount,
  summary,
  issuableCount = 0,
  payableCount,
  payLabel,
  blockedReason,
  isWorking,
  onIssue,
  onPay,
  onClear,
}: SelectionBarProps): React.JSX.Element {
  const { t } = useTranslation();
  const slotRef = useBottomBarSlot();
  const blocked = blockedReason !== null;

  return (
    <Portal>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="finance-selection-bar"
            ref={slotRef}
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 260 }}
            className="fixed inset-x-0 bottom-dock z-dock-bar mx-auto flex w-[min(100%-2rem,44rem)] flex-col gap-2 rounded-nested border border-hairline-strong bg-ethereal-alabaster/90 px-4 py-3 shadow-glass-ethereal backdrop-blur-xl"
            role="region"
            aria-label={t("finance.selection.aria", "Działania na zaznaczonych")}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col">
                <Text size="sm" weight="bold" className="tabular-nums">
                  {t("finance.selection.count", "Zaznaczono: {{count}}", {
                    count: selectedCount,
                  })}
                </Text>
                {summary && (
                  <Caption color="muted" className="tabular-nums">
                    {summary}
                  </Caption>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {onIssue && issuableCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onIssue}
                    disabled={blocked || isWorking}
                    leftIcon={<FilePen size={14} aria-hidden="true" />}
                  >
                    {t("finance.selection.issue", "Wystaw umowy ({{count}})", {
                      count: issuableCount,
                    })}
                  </Button>
                )}
                {payableCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onPay}
                    disabled={blocked || isWorking}
                    leftIcon={<Banknote size={14} aria-hidden="true" />}
                  >
                    {payLabel ??
                      t("finance.selection.pay", "Oznacz wypłacone ({{count}})", {
                        count: payableCount,
                      })}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClear}
                  disabled={isWorking}
                  leftIcon={<X size={14} aria-hidden="true" />}
                >
                  {t("finance.selection.clear", "Odznacz")}
                </Button>
              </div>
            </div>
            {blockedReason && <Caption color="gold">{blockedReason}</Caption>}
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
