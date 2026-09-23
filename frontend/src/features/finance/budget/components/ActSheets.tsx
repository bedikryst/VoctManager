/**
 * @file ActSheets.tsx
 * @description The finance acts that need one answer before they happen: the
 * date a payment left, the reason a settled fact is undone, the date on a
 * signed paper, a mandate's confirmed hours. Paying and reverting a payment
 * serve fees and expenses alike. Each sheet is mounted when it opens, so it
 * always starts from its defaults, and closes itself once the server has
 * answered with the new budget.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/budget/components/ActSheets
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { DateTimeField } from "@/shared/ui/composites/DateTimeField";
import { Input } from "@/shared/ui/primitives/Input";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Text } from "@/shared/ui/primitives/typography";
import {
  useAnnulContract,
  useConfirmHours,
  usePayExpenses,
  usePayFees,
  useSignContract,
  useUnpay,
} from "../../api/finance.queries";
import { ActSheet } from "../../components/ActSheet";
import { toastFinanceError } from "../../lib/financeErrors";
import { todayIsoDate } from "../../lib/financePresentation";
import { fromGrosze, sanitizeAmountInput, toGrosze } from "../../lib/money";
import type { LedgerRowDTO } from "../../types/finance.dto";

interface SheetBaseProps {
  readonly projectId: string;
  readonly onClose: () => void;
}

/** The paid date is a past or present day; the server refuses a future one. */
const isFutureDate = (value: string): boolean => value > todayIsoDate();

// ── Pay ───────────────────────────────────────────────────────────────────

/** A cost item to mark paid, and the name it is listed under. */
export interface PayTarget {
  readonly id: string;
  readonly label: string;
}

interface PaySheetProps extends SheetBaseProps {
  readonly targets: readonly PayTarget[];
  /** Fees and expenses are paid through doors of their own. */
  readonly kind: "fee" | "expense";
}

export function PaySheet({
  projectId,
  targets,
  kind,
  onClose,
}: PaySheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const payFees = usePayFees(projectId);
  const payExpenses = usePayExpenses(projectId);
  const pay = kind === "fee" ? payFees : payExpenses;
  const [paidOn, setPaidOn] = useState<string>(todayIsoDate);
  const [error, setError] = useState<string | undefined>();

  const handleConfirm = (): void => {
    if (!paidOn) {
      setError(t("finance.pay.date_required", "Podaj datę zapłaty."));
      return;
    }
    if (isFutureDate(paidOn)) {
      setError(t("finance.pay.date_future", "Data zapłaty nie może być w przyszłości."));
      return;
    }
    const ids = targets.map((target) => target.id);
    pay.mutate(
      { ids, paid_on: paidOn },
      {
        onSuccess: () => {
          toast.success(
            kind === "fee"
              ? t("finance.pay.done", "Oznaczono jako wypłacone: {{count}} poz.", {
                  count: ids.length,
                })
              : t("finance.pay.done_expense", "Oznaczono jako zapłacone: {{count}} poz.", {
                  count: ids.length,
                }),
          );
          onClose();
        },
        onError: (failure) =>
          toastFinanceError(
            failure,
            t,
            t("finance.pay.error", "Nie udało się oznaczyć wypłaty."),
          ),
      },
    );
  };

  return (
    <ActSheet
      isOpen
      onClose={onClose}
      title={
        kind === "fee"
          ? t("finance.pay.title", "Oznacz jako wypłacone")
          : t("finance.pay.title_expense", "Oznacz jako zapłacone")
      }
      subtitle={t("finance.pay.subtitle", "Pozycje: {{count}}", { count: targets.length })}
      confirmLabel={
        kind === "fee"
          ? t("finance.pay.confirm", "Oznacz wypłatę")
          : t("finance.pay.confirm_expense", "Oznacz zapłatę")
      }
      onConfirm={handleConfirm}
      isPending={pay.isPending}
    >
      <Text size="sm" color="graphite">
        {targets.map((target) => target.label).join(", ")}
      </Text>
      <DateTimeField
        granularity="date"
        label={t("finance.pay.date", "Data zapłaty")}
        value={paidOn}
        onChange={(next) => {
          setPaidOn(next);
          setError(undefined);
        }}
        error={error}
      />
      <Text size="xs" color="muted">
        {kind === "fee"
          ? t(
              "finance.pay.note",
              "Wpisz dzień, w którym biuro wysłało przelew. Wypłaty nie zmienisz już w kwocie ani formie — cofnąć ją może tylko zarząd.",
            )
          : t(
              "finance.pay.note_expense",
              "Wpisz dzień, w którym biuro zapłaciło. Zapłaconego wydatku nie zmienisz już w kwocie ani dostawcy — cofnąć zapłatę może tylko zarząd.",
            )}
      </Text>
    </ActSheet>
  );
}

// ── Unpay / annul ─────────────────────────────────────────────────────────

interface ReasonSheetProps extends SheetBaseProps {
  readonly mode: "unpay" | "annul";
  /** The cost item whose payment is reverted, or the contract to annul. */
  readonly targetId: string;
  readonly subtitle: string;
}

export function ReasonSheet({
  projectId,
  mode,
  targetId,
  subtitle,
  onClose,
}: ReasonSheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const unpay = useUnpay(projectId);
  const annul = useAnnulContract(projectId);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>();
  const isUnpay = mode === "unpay";

  const handleConfirm = (): void => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError(t("finance.reason.required", "Podaj powód — trafi do historii budżetu."));
      return;
    }
    const callbacks = {
      onSuccess: () => {
        toast.success(
          isUnpay
            ? t("finance.unpay.done", "Cofnięto wypłatę.")
            : t("finance.annul.done", "Umowa unieważniona."),
        );
        onClose();
      },
      onError: (failure: unknown) =>
        toastFinanceError(
          failure,
          t,
          isUnpay
            ? t("finance.unpay.error", "Nie udało się cofnąć wypłaty.")
            : t("finance.annul.error", "Nie udało się unieważnić umowy."),
        ),
    };
    if (isUnpay) {
      unpay.mutate({ costItemId: targetId, reason: trimmed }, callbacks);
    } else {
      annul.mutate({ contractId: targetId, reason: trimmed }, callbacks);
    }
  };

  return (
    <ActSheet
      isOpen
      onClose={onClose}
      destructive
      title={
        isUnpay
          ? t("finance.unpay.title", "Cofnij wypłatę")
          : t("finance.annul.title", "Unieważnij umowę")
      }
      subtitle={subtitle}
      confirmLabel={
        isUnpay
          ? t("finance.unpay.confirm", "Cofnij wypłatę")
          : t("finance.annul.confirm", "Unieważnij")
      }
      onConfirm={handleConfirm}
      isPending={unpay.isPending || annul.isPending}
    >
      <Text size="sm" color="graphite">
        {isUnpay
          ? t(
              "finance.unpay.description",
              "Pozycja wróci do niezapłaconych i znów będzie można zmienić jej kwotę. Zapłata zostaje w historii razem z powodem.",
            )
          : t(
              "finance.annul.description",
              "Numer umowy nie wróci do puli. Po unieważnieniu można zmienić kwotę i wystawić nową umowę.",
            )}
      </Text>
      <Textarea
        label={t("finance.reason.label", "Powód")}
        value={reason}
        onChange={(event) => {
          setReason(event.target.value);
          setError(undefined);
        }}
        error={error}
        rows={3}
        maxLength={1000}
      />
    </ActSheet>
  );
}

// ── Sign ──────────────────────────────────────────────────────────────────

interface ContractSheetProps extends SheetBaseProps {
  readonly row: LedgerRowDTO;
}

export function SignSheet({ projectId, row, onClose }: ContractSheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const sign = useSignContract(projectId);
  const [signedOn, setSignedOn] = useState<string>(todayIsoDate);
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | undefined>();

  const handleConfirm = (): void => {
    if (!row.contract) return;
    if (!signedOn) {
      setError(t("finance.sign.date_required", "Podaj datę z podpisanej umowy."));
      return;
    }
    if (isFutureDate(signedOn)) {
      setError(t("finance.sign.date_future", "Data podpisania nie może być w przyszłości."));
      return;
    }
    sign.mutate(
      {
        contractId: row.contract.id,
        payload: { signed_on: signedOn, signed_copy_location: location.trim() },
      },
      {
        onSuccess: () => {
          toast.success(t("finance.sign.done", "Umowa oznaczona jako podpisana."));
          onClose();
        },
        onError: (failure) =>
          toastFinanceError(failure, t, t("finance.sign.error", "Nie udało się zapisać podpisu.")),
      },
    );
  };

  return (
    <ActSheet
      isOpen
      onClose={onClose}
      title={t("finance.sign.title", "Umowa podpisana")}
      subtitle={`${row.contract?.number ?? ""} · ${row.payee_name}`}
      confirmLabel={t("finance.sign.confirm", "Zapisz podpis")}
      onConfirm={handleConfirm}
      isPending={sign.isPending}
    >
      <DateTimeField
        granularity="date"
        label={t("finance.sign.date", "Data na umowie")}
        value={signedOn}
        onChange={(next) => {
          setSignedOn(next);
          setError(undefined);
        }}
        error={error}
      />
      <Input
        label={t("finance.sign.location", "Gdzie leży egzemplarz")}
        placeholder={t("finance.sign.location_placeholder", "np. segregator 2026, link do Dysku")}
        value={location}
        onChange={(event) => setLocation(event.target.value)}
        maxLength={300}
      />
    </ActSheet>
  );
}

// ── Hours ─────────────────────────────────────────────────────────────────

export function HoursSheet({ projectId, row, onClose }: ContractSheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const confirm = useConfirmHours(projectId);
  const [hours, setHours] = useState(
    row.contract?.hours_confirmed ? row.contract.hours_confirmed.replace(/\.00$/, "") : "",
  );
  const [error, setError] = useState<string | undefined>();

  const handleConfirm = (): void => {
    if (!row.contract) return;
    // Hours share the grosze parser: the same two decimals, the same comma.
    const parsed = toGrosze(hours);
    if (parsed === null || parsed <= 0) {
      setError(t("finance.hours.invalid", "Podaj liczbę godzin większą od zera."));
      return;
    }
    confirm.mutate(
      { contractId: row.contract.id, hours: fromGrosze(parsed) },
      {
        onSuccess: () => {
          toast.success(t("finance.hours.done", "Zapisano potwierdzone godziny."));
          onClose();
        },
        onError: (failure) =>
          toastFinanceError(failure, t, t("finance.hours.error", "Nie udało się zapisać godzin.")),
      },
    );
  };

  return (
    <ActSheet
      isOpen
      onClose={onClose}
      title={t("finance.hours.title", "Potwierdzone godziny")}
      subtitle={`${row.contract?.number ?? ""} · ${row.payee_name}`}
      confirmLabel={t("finance.hours.confirm", "Zapisz godziny")}
      onConfirm={handleConfirm}
      isPending={confirm.isPending}
    >
      <Input
        label={t("finance.hours.label", "Liczba godzin")}
        type="text"
        inputMode="decimal"
        value={hours}
        onChange={(event) => {
          setHours(sanitizeAmountInput(event.target.value));
          setError(undefined);
        }}
        error={error}
      />
      <Text size="xs" color="muted">
        {t(
          "finance.hours.note",
          "Liczba z potwierdzenia godzin podpisanego przez zleceniobiorcę. Bez niej nie sprawdzisz minimalnej stawki godzinowej.",
        )}
      </Text>
    </ActSheet>
  );
}
