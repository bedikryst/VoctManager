/**
 * @file SelectionBar.tsx
 * @description The floating bar of the ledger's bulk acts, in the order a fee
 * lives through them: set the form, charge a source, issue the contracts, mark
 * them signed, mark the fees paid. An act shows only while the selection holds
 * a row it can reach, and counts only those rows, so "Wystaw umowy (3)" means
 * three documents; a selection of people at one stage shows two or three.
 * The form is a draft like the amount: choosing it here fills the save bar,
 * not the server. It shares the band above the nav dock with the save bar and
 * yields it: the Honoraria page opens this bar only while no pricing draft is
 * pending, because an act on a row whose price is still a draft would settle
 * the old price. The selection itself outlives the draft, so the rows whose
 * form was just saved are still ticked for the contracts that follow.
 * The finance workspace's Do zapłaty opens the same bar with the payment alone,
 * worded for fees and expenses together and with the selection's sum.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/budget/components/SelectionBar
 */

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Banknote, ChevronUp, FilePen, FileSignature, Landmark, X } from "lucide-react";

import { Portal } from "@/shared/lib/dom/Portal";
import { useBottomBarSlot } from "@/shared/lib/dom/useBottomBarSlot";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/shared/ui/composites/DropdownMenu";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { formLabel } from "../../lib/financePresentation";
import { FEE_FORMS, type FeeForm } from "../../types/finance.dto";

/** Setting the form of the selected rows that are still open to pricing. */
interface FormAct {
  readonly count: number;
  /** The form every one of those rows would read after the save, or null when they differ. */
  readonly current: FeeForm | null;
  readonly onChange: (form: FeeForm) => void;
}

/** An act that opens a sheet or runs at once, over the selected rows it can reach. */
interface CountedAct {
  readonly count: number;
  readonly onRun: () => void;
}

interface SelectionBarProps {
  readonly isOpen: boolean;
  readonly selectedCount: number;
  /** Beside the count: what the selection adds up to. */
  readonly summary?: string;
  /** Each absent act is not offered; Do zapłaty offers the payment alone. */
  readonly form?: FormAct;
  readonly charge?: CountedAct;
  readonly issue?: CountedAct;
  readonly sign?: CountedAct;
  readonly payableCount: number;
  /** Replaces the fee wording of the pay button; takes `{{count}}` already filled. */
  readonly payLabel?: string;
  /** Why the acts are unavailable (offline), or null. */
  readonly blockedReason: string | null;
  readonly isWorking: boolean;
  readonly onPay: () => void;
  readonly onClear: () => void;
}

export function SelectionBar({
  isOpen,
  selectedCount,
  summary,
  form,
  charge,
  issue,
  sign,
  payableCount,
  payLabel,
  blockedReason,
  isWorking,
  onPay,
  onClear,
}: SelectionBarProps): React.JSX.Element {
  const { t } = useTranslation();
  const slotRef = useBottomBarSlot();
  const blocked = blockedReason !== null;
  const disabled = blocked || isWorking;

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
                {form && form.count > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isWorking}
                        rightIcon={<ChevronUp size={14} aria-hidden="true" />}
                      >
                        {t("finance.selection.form", "Forma ({{count}})", { count: form.count })}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="top" className="w-64">
                      <DropdownMenuLabel>
                        {t("finance.acts.form", "Forma rozliczenia")}
                      </DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        value={form.current ?? ""}
                        onValueChange={(value) => {
                          const next = FEE_FORMS.find((candidate) => candidate === value);
                          if (next) form.onChange(next);
                        }}
                      >
                        {FEE_FORMS.map((option) => (
                          <DropdownMenuRadioItem key={option} value={option}>
                            <Text as="span" size="sm" weight="medium" color="inherit">
                              {formLabel(t, option)}
                            </Text>
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {charge && charge.count > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={charge.onRun}
                    disabled={disabled}
                    leftIcon={<Landmark size={14} aria-hidden="true" />}
                  >
                    {t("finance.selection.charge", "Obciąż źródło ({{count}})", {
                      count: charge.count,
                    })}
                  </Button>
                )}
                {issue && issue.count > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={issue.onRun}
                    disabled={disabled}
                    leftIcon={<FilePen size={14} aria-hidden="true" />}
                  >
                    {t("finance.selection.issue", "Wystaw umowy ({{count}})", {
                      count: issue.count,
                    })}
                  </Button>
                )}
                {sign && sign.count > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={sign.onRun}
                    disabled={disabled}
                    leftIcon={<FileSignature size={14} aria-hidden="true" />}
                  >
                    {t("finance.selection.sign", "Oznacz podpisane ({{count}})", {
                      count: sign.count,
                    })}
                  </Button>
                )}
                {payableCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onPay}
                    disabled={disabled}
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
