/**
 * @file BudgetOverviewPage.tsx
 * @description Przegląd — the project's money at a glance: what the concert
 * costs and what qualifies that figure, the work the server's warnings list,
 * each linking to its row, and what the office takes away. Every figure here is
 * the server's; the page sums nothing.
 * The plan, the budget's approval and its history arrive with the stages that
 * build them — this page grows, it never holds a placeholder for them.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/budget/BudgetOverviewPage
 */

import React from "react";
import { useOutletContext } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, RefreshCw, Wallet } from "lucide-react";

import type { ProjectHubContext } from "@/features/projects/ProjectHubLayout";
import { TabLoadingCard } from "@/features/projects/editors/tabs/components/TabLoadingCard";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { useProjectBudget } from "../api/finance.queries";
import { CostSummaryCard, type CostFigure } from "../components/CostSummaryCard";
import { budgetStatusLabel, categoryLabel } from "../lib/financePresentation";
import { formatAmount, isPositiveAmount } from "../lib/money";
import type { ProjectBudgetDTO } from "../types/finance.dto";
import { DocumentsCard } from "./components/DocumentsCard";
import { WarningsCard } from "./components/WarningsCard";

interface BudgetOverviewProps {
  readonly projectId: string;
}

const useSummaryFigures = (budget: ProjectBudgetDTO | undefined): CostFigure[] => {
  const { t } = useTranslation();
  if (!budget) return [];
  const { summary } = budget;
  const currency = t("common.currency", "PLN");

  const categories = summary.by_category.filter((total) => isPositiveAmount(total.committed));

  return [
    // One category is the headline again; the split earns a slot only as a split.
    ...(categories.length > 1
      ? categories.map((total) => ({
          key: total.category,
          label: categoryLabel(t, total.category),
          value: formatAmount(total.committed) ?? "0",
          unit: currency,
          tone: "default" as const,
        }))
      : []),
    // Paid and owed stay off the rail until money has moved: before that,
    // "0 wypłacone" is the resting case and the headline already says what
    // is owed.
    ...(isPositiveAmount(summary.paid)
      ? [
          {
            key: "paid",
            label: t("finance.summary.paid", "Wypłacone"),
            value: formatAmount(summary.paid) ?? "0",
            unit: currency,
            tone: "sage" as const,
          },
          {
            key: "outstanding",
            label: t("finance.summary.outstanding", "Do wypłaty"),
            value: formatAmount(summary.outstanding) ?? "0",
            unit: currency,
            tone: "default" as const,
          },
        ]
      : []),
    ...(isPositiveAmount(summary.in_kind)
      ? [
          {
            key: "in_kind",
            label: t("finance.summary.in_kind", "Wkład wolontariuszy"),
            value: formatAmount(summary.in_kind) ?? "0",
            unit: currency,
            tone: "default" as const,
          },
        ]
      : []),
    ...(summary.unpriced > 0
      ? [
          {
            key: "unpriced",
            label: t("finance.summary.unpriced", "Bez stawki"),
            value: String(summary.unpriced),
            unit: t("common.people_short", "os."),
            tone: "gold" as const,
          },
        ]
      : []),
  ];
};

function BudgetOverview({ projectId }: BudgetOverviewProps): React.JSX.Element {
  const { t } = useTranslation();
  const query = useProjectBudget(projectId);
  const budget = query.data;
  const figures = useSummaryFigures(budget);

  if (query.isLoading) {
    return (
      <TabLoadingCard
        icon={<Wallet size={15} aria-hidden="true" />}
        title={t("finance.overview.title", "Budżet")}
      />
    );
  }

  if (!budget) {
    return (
      <StatePanel
        tone="danger"
        icon={<AlertTriangle size={28} strokeWidth={1.5} />}
        title={t("finance.load_error.title", "Nie udało się wczytać budżetu.")}
        description={t(
          "finance.load_error.description",
          "Serwer nie odpowiedział. Spróbuj ponownie za chwilę.",
        )}
        actions={
          <Button
            variant="secondary"
            onClick={() => void query.refetch()}
            leftIcon={<RefreshCw size={14} aria-hidden="true" />}
          >
            {t("common.actions.retry", "Ponów")}
          </Button>
        }
      />
    );
  }

  const status = budget.budget
    ? budgetStatusLabel(t, budget.budget.status)
    : null;
  const contractCount = budget.ledger.filter((row) => row.contract !== null).length;

  return (
    <div className="grid w-full grid-cols-1 gap-5 pb-24 lg:grid-cols-3 lg:items-start">
      <div className="flex flex-col gap-5 lg:col-span-2">
        <CostSummaryCard
          title={t("finance.overview.title", "Budżet")}
          headlineLabel={t("finance.overview.headline", "Koszt projektu")}
          headline={formatAmount(budget.summary.committed) ?? "0"}
          figures={figures}
          action={status ? <Badge variant="neutral">{status}</Badge> : undefined}
        />
        <WarningsCard
          warnings={budget.warnings}
          rows={budget.ledger}
          peopleHref={`/panel/projects/${projectId}/budget/people`}
        />
      </div>
      <DocumentsCard projectId={projectId} contractCount={contractCount} />
    </div>
  );
}

export default function BudgetOverviewPage(): React.JSX.Element {
  const { project } = useOutletContext<ProjectHubContext>();
  return <BudgetOverview projectId={String(project.id)} />;
}
