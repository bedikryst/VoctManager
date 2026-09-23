/**
 * @file RowActionsMenu.tsx
 * @description Everything one ledger row can do, behind one quiet control.
 * The form of settlement is a draft like the amount — it goes out with the
 * save bar. Everything below it is an act and happens at once: issuing,
 * printing, signing, paying. An act the row cannot take right now stays in the
 * menu, disabled, with the reason under it; a board act is not offered to a
 * manager outside the board, and the menu says so in one line rather than
 * holding a button that would answer 403.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/budget/components/RowActionsMenu
 */

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Ban,
  Banknote,
  Clock,
  FileDown,
  FilePen,
  FileSignature,
  MoreHorizontal,
  ReceiptText,
  SlidersHorizontal,
  Undo2,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/composites/DropdownMenu";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { formLabel } from "../../lib/financePresentation";
import {
  canAnnul,
  canConfirmHours,
  canIssue,
  canPay,
  canSign,
  canUnpay,
  hasBill,
} from "../../lib/ledgerActs";
import { FEE_FORMS, type FeeForm, type LedgerRowDTO } from "../../types/finance.dto";

/** The quiet "⋯" control every finance row ends with. */
export const ROW_CONTROL_CLASS =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-chip text-ethereal-graphite/60 transition-colors hover:bg-ethereal-ink/5 hover:text-ethereal-ink pointer-coarse:h-9 pointer-coarse:w-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40";

export interface RowActs {
  readonly onFormChange: (form: FeeForm) => void;
  readonly onDetails: () => void;
  readonly onIssue: () => void;
  readonly onDownloadContract: () => void;
  readonly onDownloadBill: () => void;
  readonly onSign: () => void;
  readonly onHours: () => void;
  readonly onPay: () => void;
  readonly onUnpay: () => void;
  readonly onAnnul: () => void;
}

interface RowActionsMenuProps {
  readonly row: LedgerRowDTO;
  /** The form the row will read once the draft is saved. */
  readonly currentForm: FeeForm;
  readonly formEditable: boolean;
  /** Why acts that write are unavailable right now, or null when they are. */
  readonly blockedReason: string | null;
  readonly isBoard: boolean;
  readonly acts: RowActs;
}

export function RowActionsMenu({
  row,
  currentForm,
  formEditable,
  blockedReason,
  isBoard,
  acts,
}: RowActionsMenuProps): React.JSX.Element {
  const { t } = useTranslation();
  const blocked = blockedReason ?? undefined;
  const hasBoardAct = canUnpay(row) || canAnnul(row);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={ROW_CONTROL_CLASS}
          aria-label={t("finance.acts.menu_aria", "Działania — {{name}}", {
            name: row.payee_name,
          })}
        >
          <MoreHorizontal size={16} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-72">
        {formEditable && (
          <>
            <DropdownMenuLabel>{t("finance.acts.form", "Forma rozliczenia")}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={currentForm}
              onValueChange={(value) => acts.onFormChange(value as FeeForm)}
            >
              {FEE_FORMS.map((form) => (
                <DropdownMenuRadioItem key={form} value={form}>
                  <Text as="span" size="sm" weight="medium" color="inherit">
                    {formLabel(t, form)}
                  </Text>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
          </>
        )}

        {row.cost_item_id !== null && (
          <DropdownMenuItem
            icon={<SlidersHorizontal size={14} />}
            onSelect={acts.onDetails}
            disabled={Boolean(blocked)}
            description={blocked ?? t("finance.acts.details_hint", "Termin, dokument, składki, uwagi")}
          >
            {t("finance.acts.details", "Szczegóły pozycji")}
          </DropdownMenuItem>
        )}

        {canIssue(row) && (
          <DropdownMenuItem
            icon={<FilePen size={14} />}
            onSelect={acts.onIssue}
            disabled={Boolean(blocked)}
            description={blocked}
          >
            {t("finance.acts.issue", "Wystaw umowę")}
          </DropdownMenuItem>
        )}

        {row.contract && (
          <DropdownMenuItem
            icon={<FileDown size={14} />}
            onSelect={acts.onDownloadContract}
            description={row.contract.number}
          >
            {t("finance.acts.download_contract", "Pobierz umowę")}
          </DropdownMenuItem>
        )}

        {hasBill(row) && (
          <DropdownMenuItem icon={<ReceiptText size={14} />} onSelect={acts.onDownloadBill}>
            {t("finance.acts.download_bill", "Pobierz rachunek")}
          </DropdownMenuItem>
        )}

        {canSign(row) && (
          <DropdownMenuItem
            icon={<FileSignature size={14} />}
            onSelect={acts.onSign}
            disabled={Boolean(blocked)}
            description={blocked}
          >
            {t("finance.acts.sign", "Oznacz jako podpisaną")}
          </DropdownMenuItem>
        )}

        {canConfirmHours(row) && (
          <DropdownMenuItem
            icon={<Clock size={14} />}
            onSelect={acts.onHours}
            disabled={Boolean(blocked)}
            description={
              blocked ??
              (row.contract?.hours_confirmed
                ? t("finance.acts.hours_current", "Potwierdzono: {{hours}} godz.", {
                    hours: row.contract.hours_confirmed.replace(".", ","),
                  })
                : undefined)
            }
          >
            {t("finance.acts.hours", "Potwierdź godziny")}
          </DropdownMenuItem>
        )}

        {canPay(row) && (
          <DropdownMenuItem
            icon={<Banknote size={14} />}
            onSelect={acts.onPay}
            disabled={Boolean(blocked)}
            description={blocked}
          >
            {t("finance.acts.pay", "Oznacz jako wypłacone")}
          </DropdownMenuItem>
        )}

        {hasBoardAct && (
          <>
            <DropdownMenuSeparator />
            {isBoard ? (
              <>
                {canUnpay(row) && (
                  <DropdownMenuItem
                    icon={<Undo2 size={14} />}
                    onSelect={acts.onUnpay}
                    disabled={Boolean(blocked)}
                    description={blocked}
                    destructive
                  >
                    {t("finance.acts.unpay", "Cofnij wypłatę")}
                  </DropdownMenuItem>
                )}
                {canAnnul(row) && (
                  <DropdownMenuItem
                    icon={<Ban size={14} />}
                    onSelect={acts.onAnnul}
                    disabled={Boolean(blocked)}
                    description={blocked}
                    destructive
                  >
                    {t("finance.acts.annul", "Unieważnij umowę")}
                  </DropdownMenuItem>
                )}
              </>
            ) : (
              <div className="px-3 py-2">
                <Caption color="muted">
                  {t(
                    "finance.acts.board_only",
                    "Cofnięcie wypłaty i unieważnienie umowy należą do zarządu.",
                  )}
                </Caption>
              </div>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
