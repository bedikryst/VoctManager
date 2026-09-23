/**
 * @file FundingPage.tsx
 * @description Finansowanie — where the project's money comes from. The
 * sources it counts on (a grant, a sponsor, tickets, the foundation's own
 * funds, work and gifts in kind), what it expects of each and what has
 * arrived, what is charged to each, and how much of the cost no source of
 * money carries yet. Every figure is the server's; the grant rules a source
 * states come back as warnings on its row.
 * What a project expects of a source belongs to the plan and changes while the
 * plan does; what arrives and what is charged are facts, recorded until the
 * budget closes.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/budget/FundingPage
 */

import React, { useEffect, useState } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { toast } from "sonner";
import { ExternalLink, HandCoins, Landmark, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";

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
import { Button } from "@/shared/ui/primitives/Button";
import { Text } from "@/shared/ui/primitives/typography";
import { useProjectBudget, useRemoveFunding } from "../api/finance.queries";
import { ActSheet } from "../components/ActSheet";
import { BudgetLoadError } from "../components/BudgetLoadError";
import { CostSummaryCard, type CostFigure } from "../components/CostSummaryCard";
import { toastFinanceError } from "../lib/financeErrors";
import { isBudgetWritable, isPlanEditable, warningsFor } from "../lib/financePresentation";
import { chargeableCosts } from "../lib/funding";
import { formatAmount, isNegativeAmount, isPositiveAmount } from "../lib/money";
import type { ProjectBudgetDTO, ProjectFundingDTO } from "../types/finance.dto";
import { ChargeSheet } from "./components/ChargeSheet";
import { FundingRow } from "./components/FundingRow";
import { FundingSheet } from "./components/FundingSheet";
import { ROW_CONTROL_CLASS } from "./components/RowActionsMenu";

type OpenSheet =
  | { readonly kind: "add" }
  | { readonly kind: "edit" | "charge" | "remove"; readonly funding: ProjectFundingDTO };

/**
 * The rail. The cost and what no source of money carries always stand; the
 * rest earns a slot once it exists — a sum expected, money arrived, a
 * contribution in kind, a plan whose part no source is asked for.
 */
const fundingFigures = (t: TFunction, budget: ProjectBudgetDTO): CostFigure[] => {
  const { summary, funding } = budget;
  const currency = t("common.currency", "PLN");
  const figures: CostFigure[] = [
    {
      key: "committed",
      label: t("finance.funding.cost", "Koszt projektu"),
      value: formatAmount(summary.committed) ?? "0",
      unit: currency,
      tone: "default",
    },
    {
      key: "uncovered",
      label: t("finance.funding.uncovered", "Własne lub niepokryte"),
      value: formatAmount(funding.uncovered) ?? "0",
      unit: currency,
      tone: "default",
    },
  ];
  if (isPositiveAmount(funding.planned)) {
    figures.push({
      key: "planned",
      label: t("finance.funding.expected", "Oczekiwane ze źródeł"),
      value: formatAmount(funding.planned) ?? "0",
      unit: currency,
      tone: "default",
    });
  }
  if (isPositiveAmount(funding.received)) {
    figures.push({
      key: "received",
      label: t("finance.funding.received", "Wpłynęło"),
      value: formatAmount(funding.received) ?? "0",
      unit: currency,
      tone: "sage",
    });
  }
  if (isPositiveAmount(funding.in_kind_contributed)) {
    figures.push({
      key: "in_kind",
      label: t("finance.funding.in_kind", "Wkład niefinansowy"),
      value: formatAmount(funding.in_kind_contributed) ?? "0",
      unit: currency,
      tone: "default",
    });
  }
  const gap = funding.plan_uncovered;
  if (gap !== null && (isPositiveAmount(gap) || isNegativeAmount(gap))) {
    const over = isNegativeAmount(gap);
    figures.push({
      key: "plan_uncovered",
      label: over
        ? t("finance.funding.plan_over", "Źródła ponad kosztorys")
        : t("finance.funding.plan_uncovered", "Kosztorys bez źródła"),
      value: formatAmount(gap.replace(/^-/, "")) ?? "0",
      unit: currency,
      tone: over ? "gold" : "default",
    });
  }
  return figures;
};

interface FundingWorkspaceProps {
  readonly projectId: string;
}

function FundingWorkspace({ projectId }: FundingWorkspaceProps): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const query = useProjectBudget(projectId);
  const remove = useRemoveFunding(projectId);
  const isOnline = useIsOnline();
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get("focus");
  const [openSheet, setOpenSheet] = useState<OpenSheet | null>(null);

  const budget = query.data;

  // Once, when the source a warning pointed at is on screen.
  const focusPresent = Boolean(focusId && budget?.fundings.some((funding) => funding.id === focusId));
  useEffect(() => {
    if (!focusPresent || !focusId) return;
    document.getElementById(`funding-${focusId}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusId, focusPresent]);

  if (query.isLoading) {
    return (
      <TabLoadingCard
        icon={<Landmark size={15} aria-hidden="true" />}
        title={t("finance.funding.title", "Finansowanie")}
      />
    );
  }
  if (!budget) return <BudgetLoadError onRetry={() => void query.refetch()} />;

  const status = budget.budget?.status ?? "PLANNING";
  const writable = isBudgetWritable(status) && isOnline;
  const planEditable = isPlanEditable(status);
  const fundings = budget.fundings;
  const taken = new Set(fundings.map((funding) => funding.source.id));

  const note = !isOnline
    ? t("finance.offline.short", "Brak połączenia — rozliczeń nie zapisuje się offline.")
    : status === "CLOSED"
      ? t("finance.plan.locked_closed", "Budżet jest zamknięty.")
      : status === "APPROVED"
        ? t(
            "finance.funding.locked_approved",
            "Kosztorys jest zatwierdzony: oczekiwane kwoty i podział pozycji są zamrożone. Wpływy i obciążenia kosztów zapisujesz dalej.",
          )
        : undefined;

  /** Why the source cannot leave the project now, or null when it can. */
  const removalBlock = (funding: ProjectFundingDTO): string | null => {
    if (funding.charged_count > 0) {
      return t("finance.funding.remove_blocked_charged", "Najpierw zdejmij z niego koszty ({{count}}).", {
        count: funding.charged_count,
      });
    }
    const inPlan = isPositiveAmount(funding.planned_amount) || isPositiveAmount(funding.line_allocated);
    if (inPlan && !planEditable) {
      return t(
        "finance.funding.remove_blocked_plan",
        "Źródło jest w zatwierdzonym kosztorysie — usunąć je można po otwarciu kosztorysu do korekty.",
      );
    }
    return null;
  };

  const renderMenu = (funding: ProjectFundingDTO): React.JSX.Element => {
    const settled = funding.source.status === "SETTLED";
    const { fees, expenses } = chargeableCosts(funding, budget.ledger, budget.expenses);
    const chargeable = fees.length + expenses.length;
    const blocked = removalBlock(funding);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={ROW_CONTROL_CLASS}
            aria-label={t("finance.funding.menu_aria", "Działania — {{name}}", {
              name: funding.source.name,
            })}
          >
            <MoreHorizontal size={16} aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-72">
          {writable && !settled && (
            <DropdownMenuItem
              icon={<Pencil size={14} />}
              onSelect={() => setOpenSheet({ kind: "edit", funding })}
              description={t("finance.funding.edit_hint", "Ile projekt oczekuje, ile wpłynęło")}
            >
              {t("finance.funding.edit", "Zmień kwoty")}
            </DropdownMenuItem>
          )}
          {writable && !settled && chargeable > 0 && (
            <DropdownMenuItem
              icon={<HandCoins size={14} />}
              onSelect={() => setOpenSheet({ kind: "charge", funding })}
              description={t("finance.funding.charge_hint", "Kosztów bez pełnego pokrycia: {{count}}", {
                count: chargeable,
              })}
            >
              {t("finance.funding.charge", "Obciąż kosztami")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            icon={<ExternalLink size={14} />}
            onSelect={() => navigate(`/panel/finance/sources/${funding.source.id}`)}
            description={
              settled
                ? t("finance.funding.settled_hint", "Źródło jest rozliczone — jego kwot już się nie zmienia.")
                : t("finance.funding.open_source_hint", "Zasady, terminy i wszystkie obciążone koszty")
            }
          >
            {t("finance.funding.open_source", "Strona źródła")}
          </DropdownMenuItem>
          {writable && !settled && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                icon={<Trash2 size={14} />}
                onSelect={() => setOpenSheet({ kind: "remove", funding })}
                disabled={blocked !== null}
                description={blocked ?? undefined}
                destructive
              >
                {t("finance.funding.remove", "Usuń z projektu")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const closeSheet = (): void => setOpenSheet(null);

  return (
    <>
      <div className="w-full space-y-5 pb-24">
        <CostSummaryCard
          title={t("finance.funding.title", "Finansowanie")}
          headlineLabel={t("finance.funding.headline", "Pokryte ze źródeł")}
          headline={formatAmount(budget.funding.charged) ?? "0"}
          figures={fundingFigures(t, budget)}
          note={note}
        />

        <SectionCard
          as="h2"
          icon={<Landmark size={15} aria-hidden="true" />}
          title={t("finance.funding.sources", "Źródła")}
          action={
            writable ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpenSheet({ kind: "add" })}
                leftIcon={<Plus size={14} aria-hidden="true" />}
              >
                {t("finance.funding.add", "Dodaj źródło")}
              </Button>
            ) : undefined
          }
          bodyClassName="p-0"
        >
          {fundings.length === 0 ? (
            <StatePanel
              variant="inline"
              className="px-5 py-10"
              icon={<Landmark size={22} strokeWidth={1.5} />}
              title={t("finance.funding.empty", "Projekt nie ma jeszcze źródeł finansowania")}
              description={t(
                "finance.funding.empty_desc",
                "Dodaj dotację, sponsora, bilety albo środki własne i wpisz, ile projekt z każdego oczekuje. Potem rozpiszesz między nie pozycje kosztorysu i obciążysz je kosztami — z tego powstaje rozliczenie grantu.",
              )}
            />
          ) : (
            <ul className="divide-y divide-hairline">
              {fundings.map((funding) => (
                <FundingRow
                  key={funding.id}
                  funding={funding}
                  warnings={warningsFor(budget.warnings, funding.id)}
                  isFocused={funding.id === focusId}
                  menu={renderMenu(funding)}
                />
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {(openSheet?.kind === "add" || openSheet?.kind === "edit") && (
        <FundingSheet
          projectId={projectId}
          funding={openSheet.kind === "edit" ? openSheet.funding : undefined}
          taken={taken}
          planEditable={planEditable}
          onClose={closeSheet}
        />
      )}
      {openSheet?.kind === "charge" && (
        <ChargeSheet
          projectId={projectId}
          funding={openSheet.funding}
          budget={budget}
          onClose={closeSheet}
        />
      )}
      {openSheet?.kind === "remove" && (
        <ActSheet
          isOpen
          destructive
          onClose={closeSheet}
          title={t("finance.funding.remove_title", "Usuń źródło z projektu")}
          subtitle={openSheet.funding.source.name}
          confirmLabel={t("finance.funding.remove_confirm", "Usuń")}
          isPending={remove.isPending}
          onConfirm={() =>
            remove.mutate(openSheet.funding.id, {
              onSuccess: () => {
                toast.success(t("finance.funding.removed", "Usunięto źródło z projektu."));
                closeSheet();
              },
              onError: (error) =>
                toastFinanceError(error, t, t("finance.funding.remove_error", "Nie udało się usunąć źródła.")),
            })
          }
        >
          <Text size="sm" color="graphite">
            {t(
              "finance.funding.remove_plain",
              "Źródło zniknie z projektu razem ze swoim udziałem w kosztorysie. Samo źródło zostaje w Finansach.",
            )}
          </Text>
        </ActSheet>
      )}
    </>
  );
}

export default function FundingPage(): React.JSX.Element {
  const { project } = useOutletContext<ProjectHubContext>();
  return <FundingWorkspace projectId={String(project.id)} />;
}
