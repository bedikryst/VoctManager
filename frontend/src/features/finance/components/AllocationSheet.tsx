/**
 * @file AllocationSheet.tsx
 * @description Splits one amount between funding sources — a kosztorys line's
 * plan, or a cost as it was actually charged. One field per source that can
 * take it; whatever no source covers stays the foundation's own, and the sheet
 * says how much that is. The preview sums the typed amounts in integer grosze;
 * the server keeps the split inside the amount and refuses anything else.
 * A settled source's share is shown but cannot be changed: its report already
 * counts it.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/components/AllocationSheet
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Input } from "@/shared/ui/primitives/Input";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { useSetCostAllocations, useSetLineAllocations } from "../api/finance.queries";
import { toastFinanceError } from "../lib/financeErrors";
import { fundingKindLabel } from "../lib/financePresentation";
import { fundingsAccepting } from "../lib/funding";
import {
  formatAmount,
  formatGrosze,
  fromGrosze,
  sanitizeAmountInput,
  toAmountInput,
  toGrosze,
} from "../lib/money";
import type {
  AllocationDTO,
  AllocationSetPayload,
  DecimalString,
  PlanLineDTO,
  ProjectFundingDTO,
} from "../types/finance.dto";
import { ActSheet } from "./ActSheet";

interface AllocationSheetProps {
  readonly title: string;
  readonly subtitle?: string;
  /** What the sources can share: a line's plan, a cost, a volunteer's valuation. */
  readonly available: DecimalString;
  readonly availableLabel: string;
  readonly allocations: readonly AllocationDTO[];
  /** The sources this amount may be split between, already filtered by kind. */
  readonly fundings: readonly ProjectFundingDTO[];
  /** One sentence above the fields — why only these sources are offered. */
  readonly note?: string;
  readonly isPending: boolean;
  readonly onSave: (payload: AllocationSetPayload) => void;
  readonly onClose: () => void;
}

type Draft = Readonly<Record<string, string>>;

export function AllocationSheet({
  title,
  subtitle,
  available,
  availableLabel,
  allocations,
  fundings,
  note,
  isPending,
  onSave,
  onClose,
}: AllocationSheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const currency = t("common.currency", "PLN");
  const [draft, setDraft] = useState<Draft>(() =>
    Object.fromEntries(
      allocations.map((allocation) => [allocation.funding_id, toAmountInput(allocation.amount)]),
    ),
  );
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [overError, setOverError] = useState<string | null>(null);

  const availableGrosze = toGrosze(available) ?? 0;
  const typed = (fundingId: string): number => toGrosze(draft[fundingId] ?? "") ?? 0;
  const coveredGrosze = fundings.reduce((total, funding) => total + typed(funding.id), 0);
  const remainingGrosze = availableGrosze - coveredGrosze;

  const set = (fundingId: string, value: string): void => {
    setDraft((previous) => ({ ...previous, [fundingId]: value }));
    setErrors((previous) => ({ ...previous, [fundingId]: "" }));
    setOverError(null);
  };

  /** The rest of the amount to one source: what the others leave uncovered. */
  const fillRest = (fundingId: string): void => {
    const others = coveredGrosze - typed(fundingId);
    const rest = Math.max(availableGrosze - others, 0);
    set(fundingId, rest > 0 ? toAmountInput(fromGrosze(rest)) : "");
  };

  const handleConfirm = (): void => {
    const nextErrors: Record<string, string> = {};
    const entries: { funding: string; amount: DecimalString }[] = [];
    for (const funding of fundings) {
      const raw = (draft[funding.id] ?? "").trim();
      if (!raw) continue;
      const grosze = toGrosze(raw);
      if (grosze === null) {
        nextErrors[funding.id] = t("finance.allocation.invalid", "To nie jest kwota.");
      } else if (grosze > 0) {
        entries.push({ funding: funding.id, amount: fromGrosze(grosze) });
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (remainingGrosze < 0) {
      setOverError(
        t(
          "finance.allocation.over",
          "Źródła pokryłyby więcej niż {{amount}} {{currency}} — o {{over}} {{currency}} za dużo.",
          {
            amount: formatGrosze(availableGrosze),
            over: formatGrosze(-remainingGrosze),
            currency,
          },
        ),
      );
      return;
    }
    onSave({ allocations: entries });
  };

  return (
    <ActSheet
      isOpen
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      confirmLabel={t("common.actions.save", "Zapisz")}
      onConfirm={handleConfirm}
      isPending={isPending}
    >
      <Text size="sm" color="graphite" className="tabular-nums">
        {t("finance.allocation.available", "{{label}}: {{amount}} {{currency}}", {
          label: availableLabel,
          amount: formatAmount(available) ?? "0",
          currency,
        })}
      </Text>
      {note && (
        <Caption color="muted">
          {note}
        </Caption>
      )}

      <div className="flex flex-col gap-4">
        {fundings.map((funding) => {
          const settled = funding.source.status === "SETTLED";
          return (
            <div key={funding.id} className="flex flex-col gap-1">
              <Input
                label={funding.source.name}
                type="text"
                inputMode="decimal"
                placeholder="–"
                value={draft[funding.id] ?? ""}
                onChange={(event) => set(funding.id, sanitizeAmountInput(event.target.value))}
                error={errors[funding.id] || undefined}
                disabled={settled}
                className="tabular-nums"
                rightElement={
                  settled ? undefined : (
                    <button
                      type="button"
                      onClick={() => fillRest(funding.id)}
                      className="rounded-chip px-1.5 py-0.5 text-ethereal-graphite/70 transition-colors hover:text-ethereal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40"
                    >
                      <Caption as="span" color="inherit">
                        {t("finance.allocation.rest", "reszta")}
                      </Caption>
                    </button>
                  )
                }
              />
              <Caption color="muted">
                {settled
                  ? t("finance.allocation.settled", "{{kind}} · rozliczone — bez zmian", {
                      kind: fundingKindLabel(t, funding.source.kind),
                    })
                  : fundingKindLabel(t, funding.source.kind)}
              </Caption>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-1 border-t border-hairline pt-3">
        <Text size="sm" className="tabular-nums">
          {t("finance.allocation.covered", "Ze źródeł: {{amount}} {{currency}}", {
            amount: formatGrosze(coveredGrosze),
            currency,
          })}
        </Text>
        {/* Typing past the amount is a draft in progress, not an alarm: gold
            until a save is refused. */}
        <Text size="sm" color={remainingGrosze < 0 ? "gold" : "graphite"} className="tabular-nums">
          {remainingGrosze < 0
            ? t("finance.allocation.over_short", "Ponad kwotę: {{amount}} {{currency}}", {
                amount: formatGrosze(-remainingGrosze),
                currency,
              })
            : t("finance.allocation.own", "Środki własne lub niepokryte: {{amount}} {{currency}}", {
                amount: formatGrosze(remainingGrosze),
                currency,
              })}
        </Text>
        {overError && <Caption color="crimson">{overError}</Caption>}
      </div>
    </ActSheet>
  );
}

interface CostAllocationSheetProps {
  readonly projectId: string;
  readonly costItemId: string;
  /** Who or what the cost is — the payee, the vendor. */
  readonly label: string;
  /** The cost, or for volunteer work its valuation. */
  readonly available: DecimalString;
  /** Volunteer work: charged at its valuation, to a volunteer-work source only. */
  readonly valuation: boolean;
  readonly allocations: readonly AllocationDTO[];
  readonly fundings: readonly ProjectFundingDTO[];
  readonly onClose: () => void;
}

/** The actual split of one fee or expense. */
export function CostAllocationSheet({
  projectId,
  costItemId,
  label,
  available,
  valuation,
  allocations,
  fundings,
  onClose,
}: CostAllocationSheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const save = useSetCostAllocations(projectId);

  return (
    <AllocationSheet
      title={t("finance.allocation.cost_title", "Źródła finansowania")}
      subtitle={label}
      available={available}
      availableLabel={
        valuation
          ? t("finance.allocation.valuation", "Wycena pracy wolontariusza")
          : t("finance.allocation.cost", "Koszt")
      }
      allocations={allocations}
      fundings={fundingsAccepting(fundings, { valuation })}
      note={
        valuation
          ? t(
              "finance.allocation.valuation_note",
              "Wolontariat nie kosztuje fundacji nic. Jego wycenę wlicza się do wkładu osobowego — dlatego tylko to źródło.",
            )
          : undefined
      }
      isPending={save.isPending}
      onClose={onClose}
      onSave={(payload) =>
        save.mutate(
          { costItemId, payload },
          {
            onSuccess: () => {
              toast.success(t("finance.allocation.saved", "Zapisano podział między źródła."));
              onClose();
            },
            onError: (error) =>
              toastFinanceError(error, t, t("finance.allocation.error", "Nie udało się zapisać podziału.")),
          },
        )
      }
    />
  );
}

interface LineAllocationSheetProps {
  readonly projectId: string;
  readonly line: PlanLineDTO;
  readonly fundings: readonly ProjectFundingDTO[];
  readonly onClose: () => void;
}

/** The plan's split of one kosztorys line — every source may take a share. */
export function LineAllocationSheet({
  projectId,
  line,
  fundings,
  onClose,
}: LineAllocationSheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const save = useSetLineAllocations(projectId);

  return (
    <AllocationSheet
      title={t("finance.allocation.line_title", "Pozycja {{number}} — źródła", { number: line.number })}
      subtitle={line.name}
      available={line.planned_amount}
      availableLabel={t("finance.allocation.planned", "Plan pozycji")}
      allocations={line.allocations}
      fundings={fundings}
      note={t(
        "finance.allocation.line_note",
        "Ile z tej pozycji ma pokryć każde źródło — tak jak w kolumnach kosztorysu we wniosku.",
      )}
      isPending={save.isPending}
      onClose={onClose}
      onSave={(payload) =>
        save.mutate(
          { lineId: line.id, payload },
          {
            onSuccess: () => {
              toast.success(t("finance.allocation.saved", "Zapisano podział między źródła."));
              onClose();
            },
            onError: (error) =>
              toastFinanceError(error, t, t("finance.allocation.error", "Nie udało się zapisać podziału.")),
          },
        )
      }
    />
  );
}
