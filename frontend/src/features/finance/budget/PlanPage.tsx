/**
 * @file PlanPage.tsx
 * @description Kosztorys — the project's plan: lines grouped by the two
 * sections of a public-benefit kosztorys ("I. Koszty realizacji działań",
 * "II. Koszty administracyjne") and, inside them, by category, each with what
 * has actually been charged to it. Numbers, planned amounts and totals are the
 * server's; the page previews only the line being typed.
 * The plan is edited while the budget is being planned — its lines and how each
 * is split between the project's funding sources, the kosztorys's "z dotacji /
 * z innych środków" columns. Once the board has approved it the page reads,
 * and says who can open it for a correction.
 * The "from the cast" helper proposes a line — billable cast × the most common
 * fee — and opens it in the form; it never writes one on its own.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/budget/PlanPage
 */

import React, { useEffect, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ClipboardList,
  Landmark,
  Link2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";

import type { ProjectHubContext } from "@/features/projects/ProjectHubLayout";
import { TabLoadingCard } from "@/features/projects/editors/tabs/components/TabLoadingCard";
import { useIsOnline } from "@/shared/lib/dom/useIsOnline";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/composites/DropdownMenu";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import {
  useChargeLine,
  useDeleteLine,
  useProjectBudget,
  useReorderLines,
} from "../api/finance.queries";
import { ActSheet } from "../components/ActSheet";
import { LineAllocationSheet } from "../components/AllocationSheet";
import { BudgetLoadError } from "../components/BudgetLoadError";
import { CostSummaryCard, type CostFigure } from "../components/CostSummaryCard";
import { toastFinanceError } from "../lib/financeErrors";
import {
  allocationSummary,
  budgetStatusLabel,
  categoryLabel,
  formatFinanceDate,
  isPlanEditable,
  sectionLabel,
} from "../lib/financePresentation";
import { formatAmount, formatGrosze, isPositiveAmount, toAmountInput, toGrosze } from "../lib/money";
import type {
  CostCategory,
  PlanLineDTO,
  PlanSection,
  ProjectBudgetDTO,
} from "../types/finance.dto";
import { EMPTY_LINE, LineSheet, draftOfLine, type LineDraft } from "./components/LineSheet";
import { PlanLineRow } from "./components/PlanLineRow";
import { ROW_CONTROL_CLASS } from "./components/RowActionsMenu";

type OpenSheet =
  | { readonly kind: "line"; readonly line?: PlanLineDTO; readonly initial: LineDraft; readonly note?: string }
  | { readonly kind: "delete" | "sources"; readonly line: PlanLineDTO };

/** Costs of each category that count and sit outside the plan — what the
 * plan warning names, counted per category for the line's shortcut. */
const unplannedByCategory = (budget: ProjectBudgetDTO): Map<CostCategory, number> => {
  const counts = new Map<CostCategory, number>();
  const add = (category: CostCategory): void => {
    counts.set(category, (counts.get(category) ?? 0) + 1);
  };
  for (const row of budget.ledger) {
    if (row.counted && row.budget_line_id === null && row.form !== "VOLUNTEER" && row.category) {
      add(row.category);
    }
  }
  for (const expense of budget.expenses) {
    if (expense.budget_line_id === null) add(expense.category);
  }
  return counts;
};

/**
 * The cast line a manager would write by hand: every billable seat, at the fee
 * most of them are priced at. Counting and choosing, never summing.
 */
const castProposal = (budget: ProjectBudgetDTO): { readonly count: number; readonly rate: string | null } => {
  const cast = budget.ledger.filter((row) => row.origin === "cast" && row.billable);
  const frequency = new Map<string, number>();
  for (const row of cast) {
    if (row.contract_amount !== null && row.form !== "VOLUNTEER") {
      frequency.set(row.contract_amount, (frequency.get(row.contract_amount) ?? 0) + 1);
    }
  }
  let rate: string | null = null;
  let best = 0;
  for (const [amount, times] of frequency) {
    if (times > best) {
      rate = amount;
      best = times;
    }
  }
  return { count: cast.length, rate };
};

interface PlanWorkspaceProps {
  readonly projectId: string;
}

function PlanWorkspace({ projectId }: PlanWorkspaceProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const query = useProjectBudget(projectId);
  const reorder = useReorderLines(projectId);
  const charge = useChargeLine(projectId);
  const deleteLine = useDeleteLine(projectId);
  const isOnline = useIsOnline();
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get("focus");
  const [openSheet, setOpenSheet] = useState<OpenSheet | null>(null);

  const budget = query.data;

  // Once, when the line a warning pointed at is on screen — not after every write.
  const focusPresent = Boolean(focusId && budget?.lines.some((line) => line.id === focusId));
  useEffect(() => {
    if (!focusPresent || !focusId) return;
    document
      .getElementById(`plan-line-${focusId}`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusId, focusPresent]);

  if (query.isLoading) {
    return (
      <TabLoadingCard
        icon={<ClipboardList size={15} aria-hidden="true" />}
        title={t("finance.plan.title", "Kosztorys")}
      />
    );
  }
  if (!budget) return <BudgetLoadError onRetry={() => void query.refetch()} />;

  const status = budget.budget?.status ?? "PLANNING";
  const editable = isPlanEditable(status) && isOnline;
  const { summary, lines } = budget;
  const currency = t("common.currency", "PLN");
  const unplanned = unplannedByCategory(budget);
  const offlineReason = isOnline
    ? null
    : t("finance.offline.short", "Brak połączenia — rozliczeń nie zapisuje się offline.");

  const lockNote =
    status === "APPROVED"
      ? t(
          "finance.plan.locked_approved",
          "Kosztorys zatwierdzony {{date}}. Zmienić go można po otwarciu do korekty — robi to zarząd na karcie Przegląd.",
          {
            date: budget.budget?.approved_at
              ? formatFinanceDate(budget.budget.approved_at.slice(0, 10), i18n.language)
              : "",
          },
        )
      : status === "CLOSED"
        ? t("finance.plan.locked_closed", "Budżet jest zamknięty.")
        : (offlineReason ?? undefined);

  const figures: CostFigure[] = [
    {
      key: "committed",
      label: t("finance.plan.actual_total", "Wykonanie"),
      value: formatAmount(summary.committed) ?? "0",
      unit: currency,
      tone: "default",
    },
    ...(lines.length > 0 && isPositiveAmount(summary.unplanned)
      ? [
          {
            key: "unplanned",
            label: t("finance.plan.unplanned", "Poza kosztorysem"),
            value: formatAmount(summary.unplanned) ?? "0",
            unit: currency,
            tone: "gold" as const,
          },
        ]
      : []),
  ];

  const move = (line: PlanLineDTO, direction: -1 | 1): void => {
    const index = lines.findIndex((entry) => entry.id === line.id);
    const target = lines[index + direction];
    if (!target || target.category !== line.category) return;
    const order = lines.map((entry) => entry.id);
    order[index] = target.id;
    order[index + direction] = line.id;
    reorder.mutate(order, {
      onError: (error) =>
        toastFinanceError(error, t, t("finance.plan.reorder_error", "Nie udało się przestawić pozycji.")),
    });
  };

  const chargeUnplanned = (line: PlanLineDTO): void => {
    charge.mutate(line.id, {
      onSuccess: () =>
        toast.success(t("finance.plan.charged", "Przypisano koszty do pozycji {{number}}.", {
          number: line.number,
        })),
      onError: (error) =>
        toastFinanceError(error, t, t("finance.plan.charge_error", "Nie udało się przypisać kosztów.")),
    });
  };

  const proposeCastLine = (): void => {
    const proposal = castProposal(budget);
    setOpenSheet({
      kind: "line",
      initial: {
        category: "PERSONNEL_ARTISTIC",
        name: t("finance.plan.cast_line_name", "Honoraria obsady"),
        unit: "PERSON",
        quantity: String(proposal.count),
        unitCost: proposal.rate === null ? "" : toAmountInput(proposal.rate),
        note: "",
      },
      note:
        proposal.rate === null
          ? t(
              "finance.plan.cast_proposal_unpriced",
              "Propozycja z obsady: {{count}} os. Nikt nie ma jeszcze stawki — wpisz cenę jednostkową.",
              { count: proposal.count },
            )
          : t(
              "finance.plan.cast_proposal",
              "Propozycja z obsady: {{count}} os. po {{rate}} {{currency}} — tyle wynosi najczęstsza stawka. Sprawdź przed zapisaniem.",
              {
                count: proposal.count,
                rate: formatGrosze(toGrosze(proposal.rate) ?? 0),
                currency,
              },
            ),
    });
  };

  const renderMenu = (line: PlanLineDTO, index: number): React.JSX.Element | null => {
    const charges = unplanned.get(line.category) ?? 0;
    const canMoveUp = lines[index - 1]?.category === line.category;
    const canMoveDown = lines[index + 1]?.category === line.category;
    if (!editable && (charges === 0 || status === "CLOSED" || !isOnline)) return null;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={ROW_CONTROL_CLASS}
            aria-label={t("finance.plan.menu_aria", "Działania — {{name}}", { name: line.name })}
          >
            <MoreHorizontal size={16} aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-72">
          {editable && (
            <>
              <DropdownMenuItem
                icon={<Pencil size={14} />}
                onSelect={() => setOpenSheet({ kind: "line", line, initial: draftOfLine(line) })}
              >
                {t("finance.plan.edit", "Edytuj pozycję")}
              </DropdownMenuItem>
              {budget.fundings.length > 0 && (
                <DropdownMenuItem
                  icon={<Landmark size={14} />}
                  onSelect={() => setOpenSheet({ kind: "sources", line })}
                  description={t(
                    "finance.plan.sources_hint",
                    "Ile pokryje dotacja, sponsor, środki własne",
                  )}
                >
                  {t("finance.plan.split", "Podziel między źródła")}
                </DropdownMenuItem>
              )}
              {canMoveUp && (
                <DropdownMenuItem icon={<ArrowUp size={14} />} onSelect={() => move(line, -1)}>
                  {t("finance.plan.move_up", "Przesuń wyżej")}
                </DropdownMenuItem>
              )}
              {canMoveDown && (
                <DropdownMenuItem icon={<ArrowDown size={14} />} onSelect={() => move(line, 1)}>
                  {t("finance.plan.move_down", "Przesuń niżej")}
                </DropdownMenuItem>
              )}
            </>
          )}
          {charges > 0 && status !== "CLOSED" && isOnline && (
            <DropdownMenuItem
              icon={<Link2 size={14} />}
              onSelect={() => chargeUnplanned(line)}
              description={t(
                "finance.plan.charge_hint",
                "Koszty tego rodzaju bez pozycji w kosztorysie: {{count}}",
                { count: charges },
              )}
            >
              {t("finance.plan.charge", "Przypisz koszty spoza kosztorysu")}
            </DropdownMenuItem>
          )}
          {editable && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                icon={<Trash2 size={14} />}
                onSelect={() => setOpenSheet({ kind: "delete", line })}
                destructive
              >
                {t("finance.plan.delete", "Usuń pozycję")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  // Lines arrive in kosztorys order; the page only draws the section and
  // category headings where they change.
  const sections: { readonly section: PlanSection; readonly lines: PlanLineDTO[] }[] = [];
  for (const line of lines) {
    const last = sections[sections.length - 1];
    if (last?.section === line.section) last.lines.push(line);
    else sections.push({ section: line.section, lines: [line] });
  }

  const hasCast = budget.ledger.some((row) => row.origin === "cast" && row.billable);
  const hasCastLine = lines.some((line) => line.category === "PERSONNEL_ARTISTIC");
  const actions = editable ? (
    <span className="flex flex-wrap items-center gap-2">
      {hasCast && !hasCastLine && (
        <Button
          variant="ghost"
          size="sm"
          onClick={proposeCastLine}
          leftIcon={<Users size={14} aria-hidden="true" />}
        >
          {t("finance.plan.from_cast", "Honoraria z obsady")}
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpenSheet({ kind: "line", initial: EMPTY_LINE })}
        leftIcon={<Plus size={14} aria-hidden="true" />}
      >
        {t("finance.plan.add", "Dodaj pozycję")}
      </Button>
    </span>
  ) : undefined;

  const statusLabel = budgetStatusLabel(t, status);

  return (
    <>
      <div className="w-full space-y-5 pb-24">
        <CostSummaryCard
          title={t("finance.plan.title", "Kosztorys")}
          headlineLabel={t("finance.plan.headline", "Plan")}
          headline={summary.planned === null ? "–" : (formatAmount(summary.planned) ?? "0")}
          figures={figures}
          note={lockNote}
          action={statusLabel ? <Badge variant="neutral">{statusLabel}</Badge> : undefined}
        />

        <SectionCard
          as="h2"
          icon={<ClipboardList size={15} aria-hidden="true" />}
          title={t("finance.plan.lines", "Pozycje")}
          action={actions}
          bodyClassName="p-0"
        >
          {lines.length === 0 ? (
            <StatePanel
              variant="inline"
              className="px-5 py-10"
              icon={<ClipboardList size={22} strokeWidth={1.5} />}
              title={t("finance.plan.empty", "Kosztorys jest pusty")}
              description={t(
                "finance.plan.empty_desc",
                "Rozpisz koszty koncertu na pozycje — tak jak we wniosku o grant: ilość, jednostka, cena. Potem zobaczysz tu, ile z każdej pozycji już wydano.",
              )}
            />
          ) : (
            <div className="flex flex-col">
              {sections.map(({ section, lines: sectionLines }) => (
                <div key={section} className="border-b border-hairline last:border-b-0">
                  <div className="px-5 pb-1 pt-4">
                    <Eyebrow color="muted">
                      {`${section}. ${sectionLabel(t, section)}`}
                    </Eyebrow>
                  </div>
                  <ul className="divide-y divide-hairline pb-1">
                    {sectionLines.map((line) => {
                      const index = lines.indexOf(line);
                      const previous = lines[index - 1];
                      const firstOfCategory = previous?.category !== line.category;
                      return (
                        <React.Fragment key={line.id}>
                          {firstOfCategory && (
                            <li className="px-5 pb-1 pt-3">
                              <Text as="span" size="xs" color="muted" weight="medium">
                                {categoryLabel(t, line.category)}
                              </Text>
                            </li>
                          )}
                          <PlanLineRow
                            line={line}
                            sources={allocationSummary(line.allocations, budget.fundings)}
                            isFocused={line.id === focusId}
                            menu={renderMenu(line, index)}
                          />
                        </React.Fragment>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {openSheet?.kind === "line" && (
        <LineSheet
          projectId={projectId}
          line={openSheet.line}
          initial={openSheet.initial}
          proposalNote={openSheet.note}
          onClose={() => setOpenSheet(null)}
        />
      )}
      {openSheet?.kind === "sources" && (
        <LineAllocationSheet
          projectId={projectId}
          line={openSheet.line}
          fundings={budget.fundings}
          onClose={() => setOpenSheet(null)}
        />
      )}
      {openSheet?.kind === "delete" && (
        <ActSheet
          isOpen
          destructive
          onClose={() => setOpenSheet(null)}
          title={t("finance.plan.delete_title", "Usuń pozycję {{number}}", {
            number: openSheet.line.number,
          })}
          subtitle={openSheet.line.name}
          confirmLabel={t("finance.plan.delete_confirm", "Usuń")}
          isPending={deleteLine.isPending}
          onConfirm={() =>
            deleteLine.mutate(openSheet.line.id, {
              onSuccess: () => {
                toast.success(t("finance.plan.deleted", "Usunięto pozycję kosztorysu."));
                setOpenSheet(null);
              },
              onError: (error) =>
                toastFinanceError(error, t, t("finance.plan.delete_error", "Nie udało się usunąć pozycji.")),
            })
          }
        >
          <Text size="sm" color="graphite">
            {openSheet.line.cost_count > 0
              ? t(
                  "finance.plan.delete_with_costs",
                  "Przypisane do niej koszty ({{count}}) zostaną poza kosztorysem. Same koszty nie znikają.",
                  { count: openSheet.line.cost_count },
                )
              : t("finance.plan.delete_plain", "Pozycja zniknie z kosztorysu; zostanie w historii budżetu.")}
          </Text>
          {openSheet.line.allocations.length > 0 && (
            <Text size="sm" color="graphite">
              {t(
                "finance.plan.delete_with_sources",
                "Zniknie też jej podział między źródła; kwoty oczekiwane od źródeł zostają bez zmian.",
              )}
            </Text>
          )}
        </ActSheet>
      )}
    </>
  );
}

export default function PlanPage(): React.JSX.Element {
  const { project } = useOutletContext<ProjectHubContext>();
  return <PlanWorkspace projectId={String(project.id)} />;
}
