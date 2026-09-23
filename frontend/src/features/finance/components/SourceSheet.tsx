/**
 * @file SourceSheet.tsx
 * @description Creates or edits a funding source — the foundation's, shared by
 * every project it funds. Besides who gives the money and how much, it holds
 * the grantor's rules, each optional because a grantor's form is only known
 * once there is a grantor: the eligibility period, the own share it requires,
 * the cap on administration, the overrun a kosztorys line may carry, the
 * report's deadline, and the formula for describing accounting documents.
 * Every rule a source states becomes a warning on the projects it funds.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/components/SourceSheet
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { DateTimeField } from "@/shared/ui/composites/DateTimeField";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Caption, Eyebrow } from "@/shared/ui/primitives/typography";
import { useCreateSource, useUpdateSource } from "../api/finance.queries";
import { toastFinanceError } from "../lib/financeErrors";
import { fundingKindLabel, fundingStatusLabel } from "../lib/financePresentation";
import { fromGrosze, sanitizeAmountInput, toAmountInput, toGrosze } from "../lib/money";
import {
  DOCUMENT_NOTE_PLACEHOLDERS,
  FUNDING_KINDS,
  FUNDING_STATUSES,
  type DecimalString,
  type FundingKind,
  type FundingSourceDTO,
  type FundingSourcePayload,
  type FundingSourceUpdatePayload,
  type FundingStatus,
  type SourceDetailDTO,
} from "../types/finance.dto";
import { ActSheet } from "./ActSheet";

/** A new source with nothing but its kind and name decided. */
export const DEFAULT_SOURCE_PAYLOAD: FundingSourcePayload = {
  kind: "PUBLIC_GRANT",
  name: "",
  grantor: "",
  agreement_number: "",
  agreement_date: null,
  awarded_amount: null,
  status: "PLANNED",
  eligible_from: null,
  eligible_to: null,
  report_due_on: null,
  required_own_share_pct: null,
  admin_cost_cap_pct: null,
  line_tolerance_pct: null,
  note: "",
};

const HUNDRED_PERCENT_HUNDREDTHS = 100_00;

interface Draft {
  readonly kind: FundingKind;
  readonly name: string;
  readonly status: FundingStatus;
  readonly grantor: string;
  readonly agreementNumber: string;
  readonly agreementDate: string;
  readonly awarded: string;
  readonly eligibleFrom: string;
  readonly eligibleTo: string;
  readonly reportDueOn: string;
  readonly ownShare: string;
  readonly adminCap: string;
  readonly tolerance: string;
  readonly template: string;
  readonly note: string;
}

const draftOf = (source: FundingSourceDTO | undefined): Draft => ({
  kind: source?.kind ?? "PUBLIC_GRANT",
  name: source?.name ?? "",
  status: source?.status ?? "PLANNED",
  grantor: source?.grantor ?? "",
  agreementNumber: source?.agreement_number ?? "",
  agreementDate: source?.agreement_date ?? "",
  awarded: toAmountInput(source?.awarded_amount ?? null),
  eligibleFrom: source?.eligible_from ?? "",
  eligibleTo: source?.eligible_to ?? "",
  reportDueOn: source?.report_due_on ?? "",
  ownShare: toAmountInput(source?.required_own_share_pct ?? null),
  adminCap: toAmountInput(source?.admin_cost_cap_pct ?? null),
  tolerance: toAmountInput(source?.line_tolerance_pct ?? null),
  template: source?.document_note_template ?? "",
  note: source?.note ?? "",
});

type FieldErrors = Partial<Record<keyof Draft, string>>;

/** Placeholders the renderer does not know, as the manager typed them. */
const unknownPlaceholders = (template: string): string[] => {
  const known = new Set<string>(DOCUMENT_NOTE_PLACEHOLDERS);
  return [...template.matchAll(/\{([^{}]*)\}/g)]
    .map((match) => match[1])
    .filter((name) => !known.has(name));
};

interface SourceSheetProps {
  /** The source being edited; absent when creating one. */
  readonly source?: FundingSourceDTO;
  readonly onClose: () => void;
  readonly onSaved?: (detail: SourceDetailDTO) => void;
}

export function SourceSheet({ source, onClose, onSaved }: SourceSheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const create = useCreateSource();
  const update = useUpdateSource();
  const [draft, setDraft] = useState<Draft>(() => draftOf(source));
  const [errors, setErrors] = useState<FieldErrors>({});

  const set = <K extends keyof Draft>(key: K, value: Draft[K]): void => {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  };

  const handleConfirm = (): void => {
    const next: FieldErrors = {};
    const amount = (key: "awarded", value: string): DecimalString | null => {
      if (!value.trim()) return null;
      const grosze = toGrosze(value);
      if (grosze === null) {
        next[key] = t("finance.allocation.invalid", "To nie jest kwota.");
        return null;
      }
      return fromGrosze(grosze);
    };
    const percent = (key: "ownShare" | "adminCap" | "tolerance", value: string): DecimalString | null => {
      if (!value.trim()) return null;
      const hundredths = toGrosze(value);
      if (hundredths === null || hundredths > HUNDRED_PERCENT_HUNDREDTHS) {
        next[key] = t("finance.source.percent_invalid", "Podaj procent od 0 do 100.");
        return null;
      }
      return fromGrosze(hundredths);
    };

    if (!draft.name.trim()) {
      next.name = t("finance.source.name_required", "Podaj nazwę źródła.");
    }
    if (draft.eligibleFrom && draft.eligibleTo && draft.eligibleFrom > draft.eligibleTo) {
      next.eligibleTo = t("finance.source.period_invalid", "Okres kończy się przed swoim początkiem.");
    }
    if (source && !draft.template.trim()) {
      next.template = t("finance.source.template_required", "Formuła nie może być pusta.");
    } else if (source) {
      const unknown = unknownPlaceholders(draft.template);
      if (unknown.length > 0) {
        next.template = t("finance.source.template_unknown", "Nieznane pola: {{fields}}.", {
          fields: unknown.map((name) => `{${name}}`).join(", "),
        });
      }
    }
    const payload: FundingSourcePayload = {
      kind: draft.kind,
      name: draft.name.trim(),
      status: draft.status,
      grantor: draft.grantor.trim(),
      agreement_number: draft.agreementNumber.trim(),
      agreement_date: draft.agreementDate || null,
      awarded_amount: amount("awarded", draft.awarded),
      eligible_from: draft.eligibleFrom || null,
      eligible_to: draft.eligibleTo || null,
      report_due_on: draft.reportDueOn || null,
      required_own_share_pct: percent("ownShare", draft.ownShare),
      admin_cost_cap_pct: percent("adminCap", draft.adminCap),
      line_tolerance_pct: percent("tolerance", draft.tolerance),
      note: draft.note.trim(),
      ...(source ? { document_note_template: draft.template.trim() } : {}),
    };
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const callbacks = {
      onSuccess: (detail: SourceDetailDTO) => {
        toast.success(
          source
            ? t("finance.source.saved", "Zapisano źródło.")
            : t("finance.source.created", "Dodano źródło finansowania."),
        );
        onSaved?.(detail);
        onClose();
      },
      onError: (error: unknown) =>
        toastFinanceError(error, t, t("finance.source.error", "Nie udało się zapisać źródła.")),
    };
    if (!source) {
      create.mutate(payload, callbacks);
      return;
    }
    // Only what changed goes out; amounts and percentages compare as figures,
    // so "10" typed over a stored "10.00" is no change.
    const changes: { -readonly [K in keyof FundingSourceUpdatePayload]: FundingSourceUpdatePayload[K] } = {};
    const before: FundingSourcePayload = {
      kind: source.kind,
      name: source.name,
      status: source.status,
      grantor: source.grantor,
      agreement_number: source.agreement_number,
      agreement_date: source.agreement_date,
      awarded_amount: source.awarded_amount,
      eligible_from: source.eligible_from,
      eligible_to: source.eligible_to,
      report_due_on: source.report_due_on,
      required_own_share_pct: source.required_own_share_pct,
      admin_cost_cap_pct: source.admin_cost_cap_pct,
      line_tolerance_pct: source.line_tolerance_pct,
      note: source.note,
      document_note_template: source.document_note_template,
    };
    for (const key of Object.keys(payload) as (keyof FundingSourcePayload)[]) {
      const value = payload[key];
      const previous = before[key];
      const same =
        key === "awarded_amount" ||
        key === "required_own_share_pct" ||
        key === "admin_cost_cap_pct" ||
        key === "line_tolerance_pct"
          ? toGrosze(value ?? null) === toGrosze(previous ?? null)
          : value === previous;
      if (!same) Object.assign(changes, { [key]: value });
    }
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    update.mutate({ sourceId: source.id, payload: changes }, callbacks);
  };

  const percentField = (
    key: "ownShare" | "adminCap" | "tolerance",
    label: string,
    hint: string,
  ): React.JSX.Element => (
    <div className="flex flex-col gap-1">
      <Input
        label={label}
        type="text"
        inputMode="decimal"
        placeholder="–"
        value={draft[key]}
        onChange={(event) => set(key, sanitizeAmountInput(event.target.value))}
        error={errors[key]}
        className="tabular-nums"
      />
      <Caption color="muted">{hint}</Caption>
    </div>
  );

  return (
    <ActSheet
      isOpen
      onClose={onClose}
      title={source ? source.name : t("finance.source.create_title", "Nowe źródło finansowania")}
      confirmLabel={source ? t("common.actions.save", "Zapisz") : t("finance.source.create", "Dodaj")}
      onConfirm={handleConfirm}
      isPending={create.isPending || update.isPending}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label={t("finance.source.kind", "Rodzaj")}
          value={draft.kind}
          onValueChange={(value) => set("kind", value as FundingKind)}
          options={FUNDING_KINDS.map((kind) => ({ value: kind, label: fundingKindLabel(t, kind) }))}
        />
        <Select
          label={t("finance.source.status", "Status")}
          value={draft.status}
          onValueChange={(value) => set("status", value as FundingStatus)}
          options={FUNDING_STATUSES.map((status) => ({
            value: status,
            label: fundingStatusLabel(t, status),
          }))}
        />
      </div>
      <Input
        label={t("finance.source.name", "Nazwa")}
        placeholder={t("finance.source.name_placeholder", "np. Mecenat Małopolski 2026")}
        value={draft.name}
        onChange={(event) => set("name", event.target.value)}
        error={errors.name}
        maxLength={200}
      />
      <Input
        label={t("finance.source.grantor", "Grantodawca")}
        placeholder={t("finance.source.grantor_placeholder", "np. Województwo Małopolskie")}
        value={draft.grantor}
        onChange={(event) => set("grantor", event.target.value)}
        maxLength={200}
      />

      <Eyebrow color="muted" className="pt-2">
        {t("finance.source.agreement_section", "Umowa")}
      </Eyebrow>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Input
          label={t("finance.source.agreement_number", "Numer umowy")}
          value={draft.agreementNumber}
          onChange={(event) => set("agreementNumber", event.target.value)}
          maxLength={100}
        />
        <DateTimeField
          granularity="date"
          clearable
          label={t("finance.source.agreement_date", "Data umowy")}
          value={draft.agreementDate}
          onChange={(value) => set("agreementDate", value)}
        />
        <Input
          label={t("finance.source.awarded", "Przyznano (PLN)")}
          type="text"
          inputMode="decimal"
          placeholder="–"
          value={draft.awarded}
          onChange={(event) => set("awarded", sanitizeAmountInput(event.target.value))}
          error={errors.awarded}
          className="tabular-nums"
        />
      </div>

      <Eyebrow color="muted" className="pt-2">
        {t("finance.source.rules_section", "Zasady grantodawcy")}
      </Eyebrow>
      <Caption color="muted">
        {t(
          "finance.source.rules_hint",
          "Wszystkie są opcjonalne. Wpisz te, które stawia umowa — każda stanie się ostrzeżeniem w projektach, które to źródło finansuje.",
        )}
      </Caption>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <DateTimeField
          granularity="date"
          clearable
          label={t("finance.source.eligible_from", "Koszty od")}
          value={draft.eligibleFrom}
          onChange={(value) => set("eligibleFrom", value)}
        />
        <DateTimeField
          granularity="date"
          clearable
          label={t("finance.source.eligible_to", "Koszty do")}
          value={draft.eligibleTo}
          onChange={(value) => set("eligibleTo", value)}
          error={errors.eligibleTo}
        />
        <DateTimeField
          granularity="date"
          clearable
          label={t("finance.source.report_due_on", "Termin sprawozdania")}
          value={draft.reportDueOn}
          onChange={(value) => set("reportDueOn", value)}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {percentField(
          "ownShare",
          t("finance.source.own_share", "Wkład własny (%)"),
          t("finance.source.own_share_hint", "Jaka część zadania musi pochodzić spoza tego źródła."),
        )}
        {percentField(
          "adminCap",
          t("finance.source.admin_cap", "Limit administracji (%)"),
          t("finance.source.admin_cap_hint", "Ile z tego, co obciąża źródło, mogą stanowić koszty administracyjne."),
        )}
        {percentField(
          "tolerance",
          t("finance.source.tolerance", "Tolerancja pozycji (%)"),
          t("finance.source.tolerance_hint", "O ile pozycja kosztorysu może przekroczyć plan bez aneksu."),
        )}
      </div>

      {source && (
        <>
          <Eyebrow color="muted" className="pt-2">
            {t("finance.source.template_section", "Opis dokumentów księgowych")}
          </Eyebrow>
          <Textarea
            label={t("finance.source.template", "Formuła")}
            value={draft.template}
            onChange={(event) => set("template", event.target.value)}
            error={errors.template}
            rows={4}
            maxLength={2000}
          />
          <Caption color="muted">
            {t(
              "finance.source.template_hint",
              "To zdanie trafia na odwrocie każdej faktury i rachunku obciążonego tym źródłem. Wklej formułę z umowy; w nawiasach klamrowych panel wstawi: {{fields}}.",
              { fields: DOCUMENT_NOTE_PLACEHOLDERS.map((name) => `{${name}}`).join(", ") },
            )}
          </Caption>
        </>
      )}

      <Textarea
        label={t("finance.source.note", "Uwagi")}
        value={draft.note}
        onChange={(event) => set("note", event.target.value)}
        rows={2}
        maxLength={2000}
      />
    </ActSheet>
  );
}
