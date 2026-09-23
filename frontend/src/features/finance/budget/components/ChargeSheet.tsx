/**
 * @file ChargeSheet.tsx
 * @description Charges costs to one source in one act — "the grant pays the
 * singers". It lists every counted cost the source could still take a share
 * of, grouped by the kosztorys line it sits on, each with what it leaves
 * uncovered; whatever is ticked goes to the source in full. A group ticks as
 * one, because a grant is usually meant for a whole line. The preview says
 * what the source would then carry against its limit; the server writes it.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/budget/components/ChargeSheet
 */

import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Checkbox } from "@/shared/ui/primitives/Checkbox";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { useChargeFunding } from "../../api/finance.queries";
import { ActSheet } from "../../components/ActSheet";
import { toastFinanceError } from "../../lib/financeErrors";
import { formLabel } from "../../lib/financePresentation";
import { chargeableCosts } from "../../lib/funding";
import { formatGrosze, formatLedgerAmount, toGrosze } from "../../lib/money";
import type { ProjectBudgetDTO, ProjectFundingDTO } from "../../types/finance.dto";

interface ChargeSheetProps {
  readonly projectId: string;
  readonly funding: ProjectFundingDTO;
  readonly budget: ProjectBudgetDTO;
  readonly onClose: () => void;
}

interface Candidate {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly uncovered: string;
}

interface Group {
  readonly key: string;
  readonly title: string;
  readonly costs: Candidate[];
}

const OUTSIDE_PLAN = "__outside__";

export function ChargeSheet({
  projectId,
  funding,
  budget,
  onClose,
}: ChargeSheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const charge = useChargeFunding(projectId);
  const currency = t("common.currency", "PLN");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const groups = useMemo((): Group[] => {
    const { fees, expenses } = chargeableCosts(funding, budget.ledger, budget.expenses);
    const byLine = new Map<string, Candidate[]>();
    const add = (lineId: string | null, candidate: Candidate): void => {
      const key = lineId ?? OUTSIDE_PLAN;
      byLine.set(key, [...(byLine.get(key) ?? []), candidate]);
    };
    for (const row of fees) {
      if (!row.cost_item_id) continue;
      add(row.budget_line_id, {
        id: row.cost_item_id,
        label: row.payee_name || t("finance.row.unknown_payee", "Osoba bez nazwiska"),
        detail: row.form ? formLabel(t, row.form) : "",
        uncovered: row.unallocated,
      });
    }
    for (const expense of expenses) {
      add(expense.budget_line_id, {
        id: expense.id,
        label: expense.vendor_name,
        detail: expense.description,
        uncovered: expense.unallocated,
      });
    }
    // Kosztorys order first, then what sits outside the plan.
    const ordered: Group[] = budget.lines
      .filter((line) => byLine.has(line.id))
      .map((line) => ({
        key: line.id,
        title: `${line.number} ${line.name}`,
        costs: byLine.get(line.id) ?? [],
      }));
    const outside = byLine.get(OUTSIDE_PLAN);
    if (outside) {
      ordered.push({
        key: OUTSIDE_PLAN,
        title: t("finance.charge.outside_plan", "Poza kosztorysem"),
        costs: outside,
      });
    }
    return ordered;
  }, [budget, funding, t]);

  const all = groups.flatMap((group) => group.costs);
  const selectedGrosze = all
    .filter((cost) => selected.has(cost.id))
    .reduce((total, cost) => total + (toGrosze(cost.uncovered) ?? 0), 0);
  const afterGrosze = (toGrosze(funding.charged) ?? 0) + selectedGrosze;
  const limitGrosze = toGrosze(funding.charge_limit) ?? 0;
  // The foundation's own funds have no limit to pass: they are what it spends.
  const hasLimit = funding.brings_money && funding.source.kind !== "OWN_FUNDS";
  const passesLimit = hasLimit && selectedGrosze > 0 && afterGrosze > limitGrosze;

  const toggle = (ids: readonly string[], on: boolean): void =>
    setSelected((previous) => {
      const next = new Set(previous);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const handleConfirm = (): void => {
    if (selected.size === 0) {
      onClose();
      return;
    }
    charge.mutate(
      { fundingId: funding.id, ids: [...selected] },
      {
        onSuccess: () => {
          toast.success(
            t("finance.charge.done", "Obciążono źródło kosztami: {{count}}.", { count: selected.size }),
          );
          onClose();
        },
        onError: (error) =>
          toastFinanceError(error, t, t("finance.charge.error", "Nie udało się obciążyć źródła.")),
      },
    );
  };

  return (
    <ActSheet
      isOpen
      onClose={onClose}
      title={t("finance.charge.title", "Obciąż kosztami")}
      subtitle={funding.source.name}
      confirmLabel={t("finance.charge.confirm", "Obciąż ({{count}})", { count: selected.size })}
      onConfirm={handleConfirm}
      isPending={charge.isPending}
    >
      <Text size="sm" color="graphite">
        {t(
          "finance.charge.explain",
          "Zaznaczone koszty trafią na to źródło w części, której nic jeszcze nie pokrywa. Podział pojedynczego kosztu zmienisz w jego menu.",
        )}
      </Text>

      {groups.length === 0 ? (
        <Caption color="muted">
          {t("finance.charge.nothing", "Wszystkie koszty, które to źródło może przyjąć, są już pokryte.")}
        </Caption>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => {
            const ids = group.costs.map((cost) => cost.id);
            const ticked = ids.filter((id) => selected.has(id)).length;
            return (
              <div key={group.key} className="flex flex-col gap-1.5">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <Checkbox
                    checked={ticked === ids.length}
                    indeterminate={ticked > 0 && ticked < ids.length}
                    onChange={() => toggle(ids, ticked < ids.length)}
                  />
                  <Eyebrow color="muted">{group.title}</Eyebrow>
                </label>
                <ul className="flex flex-col divide-y divide-hairline rounded-nested border border-hairline">
                  {group.costs.map((cost) => (
                    <li key={cost.id}>
                      <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2">
                        <Checkbox
                          size="sm"
                          checked={selected.has(cost.id)}
                          onChange={() => toggle([cost.id], !selected.has(cost.id))}
                        />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <Text as="span" size="sm" truncate>
                            {cost.label}
                          </Text>
                          {cost.detail && (
                            <Caption as="span" color="muted" className="truncate">
                              {cost.detail}
                            </Caption>
                          )}
                        </span>
                        <Text as="span" size="sm" className="shrink-0 tabular-nums">
                          {formatLedgerAmount(cost.uncovered) ?? "0"}
                        </Text>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-1 border-t border-hairline pt-3">
        <Text size="sm" className="tabular-nums">
          {t("finance.charge.selected", "Do obciążenia: {{amount}} {{currency}}", {
            amount: formatGrosze(selectedGrosze),
            currency,
          })}
        </Text>
        {hasLimit && (
          <Caption color={passesLimit ? "gold" : "muted"} className="tabular-nums">
            {passesLimit
              ? t(
                  "finance.charge.passes_limit",
                  "Źródło poniesie wtedy {{after}} {{currency}} — więcej niż {{limit}} {{currency}}, na które liczy projekt. Zwiększ kwotę oczekiwaną albo wpisz, ile wpłynęło.",
                  { after: formatGrosze(afterGrosze), limit: formatGrosze(limitGrosze), currency },
                )
              : t("finance.charge.limit", "Źródło poniesie wtedy {{after}} z {{limit}} {{currency}}.", {
                  after: formatGrosze(afterGrosze),
                  limit: formatGrosze(limitGrosze),
                  currency,
                })}
          </Caption>
        )}
      </div>
    </ActSheet>
  );
}
