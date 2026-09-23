/**
 * @file BudgetOverviewPage.tsx
 * @description Przegląd — the project's money at a glance: what the concert
 * costs, the plan it is measured against, and what qualifies that figure —
 * paid, owed, what funding sources carry; the
 * work the server's warnings list, each linking to its row; where the budget
 * stands and the board's acts that move it; the reports for the board and for
 * a patron; what a grantor's settlement is typed and written from; what the
 * office takes away; and the history of every act. Every figure here is the
 * server's; the page sums nothing.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/budget/BudgetOverviewPage
 */

import React from "react";
import { useOutletContext } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Wallet } from "lucide-react";

import { useAuth } from "@/app/providers/AuthProvider";
import type { ProjectHubContext } from "@/features/projects/ProjectHubLayout";
import { TabLoadingCard } from "@/features/projects/editors/tabs/components/TabLoadingCard";
import { canApproveFinance } from "@/shared/auth/rbac";
import { Badge } from "@/shared/ui/primitives/Badge";
import { useProjectBudget } from "../api/finance.queries";
import { BudgetLoadError } from "../components/BudgetLoadError";
import { CostSummaryCard, type CostFigure } from "../components/CostSummaryCard";
import { budgetStatusLabel } from "../lib/financePresentation";
import { formatAmount, isPositiveAmount } from "../lib/money";
import type { ProjectBudgetDTO } from "../types/finance.dto";
import { BudgetStandingCard } from "./components/BudgetStandingCard";
import { DocumentsCard } from "./components/DocumentsCard";
import { GrantorCard } from "./components/GrantorCard";
import { HistoryCard } from "./components/HistoryCard";
import { ReportsCard } from "./components/ReportsCard";
import { WarningsCard } from "./components/WarningsCard";

interface BudgetOverviewProps {
  readonly projectId: string;
}

const useSummaryFigures = (budget: ProjectBudgetDTO | undefined): CostFigure[] => {
  const { t } = useTranslation();
  if (!budget) return [];
  const { summary } = budget;
  const currency = t("common.currency", "PLN");
  const hasExpenses = isPositiveAmount(summary.expenses.committed);

  return [
    // The plan earns its slot once there is one.
    ...(summary.planned !== null
      ? [
          {
            key: "planned",
            label: t("finance.summary.planned", "Plan"),
            value: formatAmount(summary.planned) ?? "0",
            unit: currency,
            tone: "default" as const,
          },
        ]
      : []),
    // Fees against expenses — a split, so only once both exist.
    ...(hasExpenses && isPositiveAmount(summary.fees.committed)
      ? [
          {
            key: "fees",
            label: t("finance.summary.fees", "Honoraria"),
            value: formatAmount(summary.fees.committed) ?? "0",
            unit: currency,
            tone: "default" as const,
          },
          {
            key: "expenses",
            label: t("finance.summary.expenses", "Wydatki"),
            value: formatAmount(summary.expenses.committed) ?? "0",
            unit: currency,
            tone: "default" as const,
          },
        ]
      : []),
    // Paid and owed stay off the rail until money has moved: before that,
    // "0 zapłacone" is the resting case and the headline already says what
    // is owed.
    ...(isPositiveAmount(summary.paid)
      ? [
          {
            key: "paid",
            label: t("finance.summary.paid_all", "Zapłacone"),
            value: formatAmount(summary.paid) ?? "0",
            unit: currency,
            tone: "sage" as const,
          },
          {
            key: "outstanding",
            label: t("finance.summary.outstanding_all", "Do zapłaty"),
            value: formatAmount(summary.outstanding) ?? "0",
            unit: currency,
            tone: "default" as const,
          },
        ]
      : []),
    // What funding sources carry, once any carries anything.
    ...(isPositiveAmount(budget.funding.charged)
      ? [
          {
            key: "funded",
            label: t("finance.summary.funded", "Ze źródeł"),
            value: formatAmount(budget.funding.charged) ?? "0",
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
  const { user } = useAuth();
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

  if (!budget) return <BudgetLoadError onRetry={() => void query.refetch()} />;

  const status = budget.budget ? budgetStatusLabel(t, budget.budget.status) : null;
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
        <WarningsCard budget={budget} budgetHref={`/panel/projects/${projectId}/budget`} />
        <HistoryCard projectId={projectId} />
      </div>
      <div className="flex flex-col gap-5">
        <BudgetStandingCard
          projectId={projectId}
          budget={budget}
          isBoard={canApproveFinance(user)}
        />
        <ReportsCard projectId={projectId} budget={budget} />
        <GrantorCard projectId={projectId} budget={budget} />
        <DocumentsCard projectId={projectId} contractCount={contractCount} />
      </div>
    </div>
  );
}

export default function BudgetOverviewPage(): React.JSX.Element {
  const { project } = useOutletContext<ProjectHubContext>();
  return <BudgetOverview projectId={String(project.id)} />;
}
