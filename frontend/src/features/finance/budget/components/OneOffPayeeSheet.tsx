/**
 * @file OneOffPayeeSheet.tsx
 * @description Adds a payee from outside the cast and crew — someone the
 * foundation pays once and never schedules (a page-turner hired for the night,
 * a translator of the programme notes). The payee is purely financial: anyone
 * who performs belongs in the cast or the crew, where the call sheet knows
 * them, and their fee then comes from there. The sheet says so, because that
 * is the mistake this form invites.
 * There is no roster record to derive a form from, so the form is chosen here.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/budget/components/OneOffPayeeSheet
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import { Text } from "@/shared/ui/primitives/typography";
import { useCreateOneOff } from "../../api/finance.queries";
import { ActSheet } from "../../components/ActSheet";
import { toastFinanceError } from "../../lib/financeErrors";
import { categoryLabel, formLabel } from "../../lib/financePresentation";
import { fromGrosze, sanitizeAmountInput, toGrosze } from "../../lib/money";
import { FEE_FORMS, type FeeCategory, type FeeForm } from "../../types/finance.dto";

interface OneOffPayeeSheetProps {
  readonly projectId: string;
  readonly onClose: () => void;
}

const SIDES: readonly FeeCategory[] = ["PERSONNEL_ARTISTIC", "PERSONNEL_TECHNICAL"];

export function OneOffPayeeSheet({
  projectId,
  onClose,
}: OneOffPayeeSheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const create = useCreateOneOff(projectId);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [side, setSide] = useState<FeeCategory>("PERSONNEL_ARTISTIC");
  const [form, setForm] = useState<FeeForm>("DZIELO");
  const [amount, setAmount] = useState("");
  const [errors, setErrors] = useState<{ name?: string; amount?: string }>({});

  const isVolunteer = form === "VOLUNTEER";

  const handleConfirm = (): void => {
    const next: { name?: string; amount?: string } = {};
    if (!name.trim()) {
      next.name = t("finance.one_off.name_required", "Podaj imię i nazwisko albo nazwę.");
    }
    const grosze = isVolunteer ? 0 : toGrosze(amount);
    if (!isVolunteer && amount.trim() !== "" && grosze === null) {
      next.amount = t("finance.one_off.amount_invalid", "To nie jest kwota.");
    }
    setErrors(next);
    if (next.name || next.amount) return;

    create.mutate(
      {
        payee_name: name.trim(),
        payee_role: role.trim(),
        category: side,
        form,
        contract_amount: grosze === null ? null : fromGrosze(grosze),
      },
      {
        onSuccess: () => {
          toast.success(t("finance.one_off.done", "Dodano {{name}}.", { name: name.trim() }));
          onClose();
        },
        onError: (failure) =>
          toastFinanceError(
            failure,
            t,
            t("finance.one_off.error", "Nie udało się dodać osoby."),
          ),
      },
    );
  };

  return (
    <ActSheet
      isOpen
      onClose={onClose}
      title={t("finance.one_off.title", "Osoba spoza obsady")}
      confirmLabel={t("finance.one_off.confirm", "Dodaj")}
      onConfirm={handleConfirm}
      isPending={create.isPending}
    >
      <Text size="sm" color="graphite">
        {t(
          "finance.one_off.description",
          "Tylko dla kogoś, kogo fundacja opłaca, a kto nie występuje ani nie pracuje przy koncercie. Muzyka lub technika dodaj w zakładce Obsada albo Ekipa — wtedy trafi też na kartę dnia.",
        )}
      </Text>
      <Input
        label={t("finance.one_off.name", "Imię i nazwisko lub nazwa")}
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setErrors((previous) => ({ ...previous, name: undefined }));
        }}
        error={errors.name}
        maxLength={200}
      />
      <Input
        label={t("finance.one_off.role", "Za co")}
        placeholder={t("finance.one_off.role_placeholder", "np. tłumaczenie tekstów programu")}
        value={role}
        onChange={(event) => setRole(event.target.value)}
        maxLength={150}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label={t("finance.one_off.side", "Rodzaj kosztu")}
          value={side}
          onValueChange={(value) => setSide(value as FeeCategory)}
          options={SIDES.map((category) => ({
            value: category,
            label: categoryLabel(t, category),
          }))}
        />
        <Select
          label={t("finance.one_off.form", "Forma rozliczenia")}
          value={form}
          onValueChange={(value) => setForm(value as FeeForm)}
          options={FEE_FORMS.map((option) => ({
            value: option,
            label: formLabel(t, option),
          }))}
        />
      </div>
      {!isVolunteer && (
        <Input
          label={t("finance.one_off.amount", "Kwota (PLN)")}
          type="text"
          inputMode="decimal"
          placeholder="–"
          value={amount}
          onChange={(event) => {
            setAmount(sanitizeAmountInput(event.target.value));
            setErrors((previous) => ({ ...previous, amount: undefined }));
          }}
          error={errors.amount}
          className="tabular-nums"
        />
      )}
    </ActSheet>
  );
}
