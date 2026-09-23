/**
 * @file FundingSheet.tsx
 * @description Puts a funding source on the project, or changes what the
 * project expects of it and what has arrived. A source is the foundation's,
 * not the project's: the sheet picks one that exists or starts a new one with
 * its kind and name — its rules (eligibility, own share, deadlines) are kept on
 * the source's own page, where every project it funds reads them.
 * What the project expects is part of the plan and changes only while the plan
 * does; what arrived is a fact and is recorded whenever it arrives.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/budget/components/FundingSheet
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import { Caption } from "@/shared/ui/primitives/typography";
import {
  useAddFunding,
  useCreateSource,
  useFundingSources,
  useUpdateFunding,
} from "../../api/finance.queries";
import { ActSheet } from "../../components/ActSheet";
import { DEFAULT_SOURCE_PAYLOAD } from "../../components/SourceSheet";
import { toastFinanceError } from "../../lib/financeErrors";
import { fundingKindLabel } from "../../lib/financePresentation";
import { fromGrosze, sanitizeAmountInput, toAmountInput, toGrosze } from "../../lib/money";
import {
  FUNDING_KINDS,
  type FundingKind,
  type ProjectFundingDTO,
  type ProjectFundingUpdatePayload,
} from "../../types/finance.dto";

const NEW_SOURCE = "__new__";

interface FundingSheetProps {
  readonly projectId: string;
  /** The funding being edited; absent when adding a source to the project. */
  readonly funding?: ProjectFundingDTO;
  /** Sources already on the project — not offered again. */
  readonly taken: ReadonlySet<string>;
  /** Whether the plan can change: the planned amount is part of it. */
  readonly planEditable: boolean;
  readonly onClose: () => void;
}

type FieldErrors = Partial<Record<"source" | "name" | "planned" | "received", string>>;

export function FundingSheet({
  projectId,
  funding,
  taken,
  planEditable,
  onClose,
}: FundingSheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const sources = useFundingSources();
  const createSource = useCreateSource();
  const addFunding = useAddFunding(projectId);
  const updateFunding = useUpdateFunding(projectId);

  const [sourceId, setSourceId] = useState<string>("");
  const [kind, setKind] = useState<FundingKind>("PUBLIC_GRANT");
  const [name, setName] = useState("");
  const [planned, setPlanned] = useState(funding ? toAmountInput(funding.planned_amount) : "");
  const [received, setReceived] = useState(funding ? toAmountInput(funding.received_amount) : "");
  const [errors, setErrors] = useState<FieldErrors>({});

  // A settled source takes no new project: its report is already in.
  const available = (sources.data ?? []).filter(
    (source) => !taken.has(source.id) && source.status !== "SETTLED",
  );
  const isNew = sourceId === NEW_SOURCE;
  const chosenKind: FundingKind | null = funding
    ? funding.source.kind
    : isNew
      ? kind
      : (available.find((source) => source.id === sourceId)?.kind ?? null);
  // Volunteer work arrives as it is charged at its valuation; nothing is received.
  const tracksReceipts = chosenKind !== "VOLUNTEER_WORK";
  const isPending = createSource.isPending || addFunding.isPending || updateFunding.isPending;

  const fail = (error: unknown): void =>
    toastFinanceError(error, t, t("finance.funding.sheet.error", "Nie udało się zapisać źródła."));

  const handleConfirm = (): void => {
    const next: FieldErrors = {};
    const plannedGrosze = planned.trim() ? toGrosze(planned) : 0;
    const receivedGrosze = tracksReceipts && received.trim() ? toGrosze(received) : 0;
    if (!funding && !sourceId) {
      next.source = t("finance.funding.sheet.source_required", "Wybierz źródło albo dodaj nowe.");
    }
    if (isNew && !name.trim()) {
      next.name = t("finance.funding.sheet.name_required", "Podaj nazwę — np. nazwę programu dotacyjnego.");
    }
    if (plannedGrosze === null) next.planned = t("finance.allocation.invalid", "To nie jest kwota.");
    if (receivedGrosze === null) next.received = t("finance.allocation.invalid", "To nie jest kwota.");
    setErrors(next);
    if (Object.keys(next).length > 0 || plannedGrosze === null || receivedGrosze === null) return;

    const done = (message: string) => (): void => {
      toast.success(message);
      onClose();
    };

    if (funding) {
      const changes: { -readonly [K in keyof ProjectFundingUpdatePayload]: ProjectFundingUpdatePayload[K] } =
        {};
      if (plannedGrosze !== toGrosze(funding.planned_amount)) changes.planned_amount = fromGrosze(plannedGrosze);
      if (receivedGrosze !== toGrosze(funding.received_amount)) {
        changes.received_amount = fromGrosze(receivedGrosze);
      }
      if (Object.keys(changes).length === 0) {
        onClose();
        return;
      }
      updateFunding.mutate(
        { fundingId: funding.id, payload: changes },
        { onSuccess: done(t("finance.funding.sheet.saved", "Zapisano kwoty źródła.")), onError: fail },
      );
      return;
    }

    const add = (source: string): void =>
      addFunding.mutate(
        {
          source,
          planned_amount: fromGrosze(plannedGrosze),
          received_amount: fromGrosze(receivedGrosze),
        },
        { onSuccess: done(t("finance.funding.sheet.added", "Dodano źródło do projektu.")), onError: fail },
      );

    if (!isNew) {
      add(sourceId);
      return;
    }
    createSource.mutate(
      { ...DEFAULT_SOURCE_PAYLOAD, kind, name: name.trim() },
      { onSuccess: (detail) => add(detail.source.id), onError: fail },
    );
  };

  return (
    <ActSheet
      isOpen
      onClose={onClose}
      title={
        funding
          ? funding.source.name
          : t("finance.funding.sheet.add_title", "Źródło finansowania projektu")
      }
      confirmLabel={funding ? t("common.actions.save", "Zapisz") : t("finance.funding.sheet.add", "Dodaj")}
      onConfirm={handleConfirm}
      isPending={isPending}
    >
      {!funding && (
        <>
          <Select
            label={t("finance.funding.sheet.source", "Źródło")}
            value={sourceId}
            onValueChange={(value) => {
              setSourceId(value);
              setErrors((previous) => ({ ...previous, source: undefined }));
            }}
            placeholder={
              sources.isLoading
                ? t("finance.funding.sheet.loading", "Wczytuję źródła…")
                : t("finance.funding.sheet.pick", "Wybierz źródło")
            }
            error={errors.source}
            options={[
              ...available.map((source) => ({
                value: source.id,
                label: `${source.name} · ${fundingKindLabel(t, source.kind)}`,
              })),
              { value: NEW_SOURCE, label: t("finance.funding.sheet.new", "Nowe źródło…") },
            ]}
          />
          {isNew && (
            <>
              <Select
                label={t("finance.source.kind", "Rodzaj")}
                value={kind}
                onValueChange={(value) => setKind(value as FundingKind)}
                options={FUNDING_KINDS.map((value) => ({ value, label: fundingKindLabel(t, value) }))}
              />
              <Input
                label={t("finance.source.name", "Nazwa")}
                placeholder={t("finance.source.name_placeholder", "np. Mecenat Małopolski 2026")}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setErrors((previous) => ({ ...previous, name: undefined }));
                }}
                error={errors.name}
                maxLength={200}
              />
              <Caption color="muted">
                {t(
                  "finance.funding.sheet.new_hint",
                  "Zasady źródła — okres kwalifikowalności, wymagany wkład własny, termin sprawozdania — uzupełnisz na jego stronie w Finansach.",
                )}
              </Caption>
            </>
          )}
        </>
      )}

      <Input
        label={t("finance.funding.sheet.planned", "Projekt oczekuje (PLN)")}
        type="text"
        inputMode="decimal"
        placeholder="0"
        value={planned}
        onChange={(event) => {
          setPlanned(sanitizeAmountInput(event.target.value));
          setErrors((previous) => ({ ...previous, planned: undefined }));
        }}
        error={errors.planned}
        disabled={!planEditable}
        className="tabular-nums"
      />
      {!planEditable && (
        <Caption color="muted">
          {t(
            "finance.funding.sheet.planned_locked",
            "Oczekiwana kwota należy do zatwierdzonego kosztorysu. Zmienić ją można po otwarciu kosztorysu do korekty.",
          )}
        </Caption>
      )}
      {tracksReceipts && (
        <>
          <Input
            label={
              chosenKind === "IN_KIND"
                ? t("finance.funding.sheet.received_in_kind", "Wartość otrzymanego wkładu (PLN)")
                : t("finance.funding.sheet.received", "Wpłynęło (PLN)")
            }
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={received}
            onChange={(event) => {
              setReceived(sanitizeAmountInput(event.target.value));
              setErrors((previous) => ({ ...previous, received: undefined }));
            }}
            error={errors.received}
            className="tabular-nums"
          />
          <Caption color="muted">
            {chosenKind === "IN_KIND"
              ? t(
                  "finance.funding.sheet.received_in_kind_hint",
                  "Ile wart jest wkład, który fundacja dostała bez zapłaty — np. kościół użyczony na koncert. Liczy się do wkładu własnego.",
                )
              : t(
                  "finance.funding.sheet.received_hint",
                  "Pieniądze, które naprawdę dotarły: transza dotacji, wpływy z biletów, zebrane darowizny. Źródło może pokryć koszty do kwoty oczekiwanej albo tej, która wpłynęła — tej większej.",
                )}
          </Caption>
        </>
      )}
      {chosenKind === "VOLUNTEER_WORK" && (
        <Caption color="muted">
          {t(
            "finance.funding.sheet.volunteer_hint",
            "Wkład osobowy rośnie, gdy przypiszesz do tego źródła wycenę pracy wolontariuszy w Honorariach.",
          )}
        </Caption>
      )}
    </ActSheet>
  );
}
