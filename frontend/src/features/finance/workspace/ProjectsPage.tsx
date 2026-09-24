/**
 * @file ProjectsPage.tsx
 * @description Projekty — each project's money in one row: cost, paid, still
 * owed, and the work its warnings list. A row opens that project's budget in
 * its hub, where the ledger lives; a project that still owes money also offers
 * its payables here, in Do zapłaty.
 *
 * A project with nothing on its books is left out unless `?all=1` asks for it;
 * the nav's count is the default list, so it never jumps when the toggle
 * flips. Sort is `?ordering=` and in-memory: the overview carries every project.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/workspace/ProjectsPage
 */

import React from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FolderKanban, HandCoins } from "lucide-react";

import { formatLocalizedDate } from "@/shared/lib/time/intl";
import {
  DataTable,
  sortRows,
  useSearchParamSort,
  type DataTableColumn,
} from "@/shared/ui/composites/DataTable";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Heading, Text } from "@/shared/ui/primitives/typography";
import { budgetStatusName } from "../lib/financePresentation";
import { formatTableAmount, isPositiveAmount, toGrosze } from "../lib/money";
import { hasCosts } from "../lib/portfolio";
import type { DecimalString, ProjectRollupDTO } from "../types/finance.dto";
import { useFinanceOutlet } from "./financeOutlet";

const CANCELLED = "CANC";
const SHOW_ALL_PARAM = "all";

/** A figure that is zero reads as a dash, so the column shows where money is. */
function AmountCell({
  value,
  tone = "default",
}: {
  readonly value: DecimalString;
  readonly tone?: "default" | "sage";
}): React.JSX.Element {
  const positive = isPositiveAmount(value);
  return (
    <Text as="span" size="sm" color={positive ? tone : "muted"}>
      {positive ? formatTableAmount(value) : "–"}
    </Text>
  );
}

export default function ProjectsPage(): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const { overview } = useFinanceOutlet();
  const { pathname, search } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sort, setSort] = useSearchParamSort();

  const showAll = searchParams.get(SHOW_ALL_PARAM) === "1";
  const withCosts = overview.projects.filter(hasCosts);
  const hidden = overview.projects.length - withCosts.length;

  const toggleAll = (): void =>
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        if (showAll) params.delete(SHOW_ALL_PARAM);
        else params.set(SHOW_ALL_PARAM, "1");
        return params;
      },
      { replace: true },
    );

  const projectDate = (rollup: ProjectRollupDTO): string =>
    formatLocalizedDate(
      rollup.project.date_time,
      { day: "numeric", month: "short", year: "numeric" },
      i18n.language,
      rollup.project.timezone,
    );

  const cancelled = (rollup: ProjectRollupDTO): boolean => rollup.project.status === CANCELLED;

  const workCell = (rollup: ProjectRollupDTO): React.ReactNode => {
    const { problem, work } = rollup.warning_counts;
    if (problem === 0 && work === 0) {
      return (
        <Text as="span" size="sm" color="muted">
          –
        </Text>
      );
    }
    return (
      <span className="flex flex-col items-end gap-0.5">
        {problem > 0 && (
          <Caption as="span" color="crimson">
            {t("finance.portfolio.problems", "problemy: {{count}}", { count: problem })}
          </Caption>
        )}
        {work > 0 && (
          <Caption as="span" color="gold">
            {t("finance.portfolio.work", "do zrobienia: {{count}}", { count: work })}
          </Caption>
        )}
      </span>
    );
  };

  const payablesLink = (rollup: ProjectRollupDTO): React.ReactNode =>
    isPositiveAmount(rollup.summary.outstanding) ? (
      <Button variant="icon" size="icon" asChild>
        <Link
          to={`/panel/finance/payables?project=${rollup.project.id}`}
          aria-label={t("finance.workspace.projects.open_payables", "Płatności projektu: {{title}}", {
            title: rollup.project.title,
          })}
          title={t("finance.workspace.projects.open_payables_short", "Płatności projektu")}
        >
          <HandCoins size={15} aria-hidden="true" />
        </Link>
      </Button>
    ) : null;

  const columns: DataTableColumn<ProjectRollupDTO>[] = [
    {
      id: "date",
      header: t("finance.workspace.projects.project", "Projekt"),
      sortValue: (rollup) => rollup.project.date_time,
      firstDirection: "desc",
      cell: (rollup) => (
        <span className="flex flex-col gap-0.5">
          <Heading as="span" size="lg" weight="medium">
            {rollup.project.title}
          </Heading>
          <Caption as="span" color="muted">
            {projectDate(rollup)}
            {cancelled(rollup) && ` · ${t("finance.portfolio.cancelled", "odwołany")}`}
          </Caption>
        </span>
      ),
    },
    {
      id: "status",
      header: t("finance.workspace.projects.budget_status", "Status budżetu"),
      sortValue: (rollup) => rollup.budget_status,
      className: "w-36",
      cell: (rollup) => (
        <Text as="span" size="sm" color={rollup.budget_status === "PLANNING" ? "muted" : "default"}>
          {budgetStatusName(t, rollup.budget_status)}
        </Text>
      ),
    },
    {
      id: "committed",
      header: t("finance.portfolio.cost", "Koszt"),
      numeric: true,
      sortValue: (rollup) => toGrosze(rollup.summary.committed),
      firstDirection: "desc",
      className: "w-32",
      cell: (rollup) => <AmountCell value={rollup.summary.committed} />,
    },
    {
      id: "paid",
      header: t("finance.summary.paid_all", "Zapłacone"),
      numeric: true,
      sortValue: (rollup) => toGrosze(rollup.summary.paid),
      firstDirection: "desc",
      className: "w-32",
      cell: (rollup) => <AmountCell value={rollup.summary.paid} tone="sage" />,
    },
    {
      id: "outstanding",
      header: t("finance.summary.outstanding_all", "Do zapłaty"),
      numeric: true,
      sortValue: (rollup) => toGrosze(rollup.summary.outstanding),
      firstDirection: "desc",
      className: "w-32",
      cell: (rollup) => <AmountCell value={rollup.summary.outstanding} />,
    },
    {
      id: "work",
      header: t("finance.workspace.projects.work", "Do zrobienia"),
      numeric: true,
      // Problems outrank any amount of ordinary work.
      sortValue: (rollup) => rollup.warning_counts.problem * 10_000 + rollup.warning_counts.work,
      firstDirection: "desc",
      className: "w-36",
      cell: workCell,
    },
    {
      id: "actions",
      header: t("finance.workspace.projects.open_payables_short", "Płatności projektu"),
      headerHidden: true,
      className: "w-12",
      cell: payablesLink,
    },
  ];

  const rows = sortRows(showAll ? overview.projects : withCosts, columns, sort);
  const financeReturn = pathname + search;

  return (
    <PageTransition>
      <div className="flex flex-col gap-5 pb-24">
        <SectionCard
          as="h2"
          icon={<FolderKanban size={15} aria-hidden="true" />}
          title={t("finance.workspace.nav.projects", "Projekty")}
          bodyClassName="p-0"
          action={
            hidden > 0 ? (
              <Button variant="ghost" size="sm" onClick={toggleAll} aria-pressed={showAll}>
                {showAll
                  ? t("finance.workspace.projects.hide_empty", "Ukryj projekty bez kosztów")
                  : t("finance.workspace.projects.show_empty", "Pokaż projekty bez kosztów ({{count}})", {
                      count: hidden,
                    })}
              </Button>
            ) : undefined
          }
        >
          <DataTable
            label={t("finance.workspace.nav.projects", "Projekty")}
            rows={rows}
            columns={columns}
            rowKey={(rollup) => rollup.project.id}
            rowLink={(rollup) => ({
              to: `/panel/projects/${rollup.project.id}/budget`,
              state: { financeReturn },
            })}
            sort={sort}
            onSortChange={setSort}
            empty={{
              icon: <FolderKanban size={22} strokeWidth={1.5} />,
              title: t("finance.workspace.projects.empty", "Żaden projekt nie ma jeszcze kosztów."),
            }}
            mobile={{
              primary: (rollup) => (
                <Text as="span" size="sm" weight="medium">
                  {rollup.project.title}
                </Text>
              ),
              secondary: (rollup) => (
                <Caption as="span" color="muted">
                  {[
                    projectDate(rollup),
                    cancelled(rollup) ? t("finance.portfolio.cancelled", "odwołany") : null,
                    rollup.budget_status === "PLANNING" ? null : budgetStatusName(t, rollup.budget_status),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Caption>
              ),
              trailing: (rollup) => (
                <>
                  <AmountCell value={rollup.summary.committed} />
                  {isPositiveAmount(rollup.summary.outstanding) && (
                    <Caption as="span" color="muted">
                      {t("finance.workspace.projects.outstanding_short", "do zapłaty {{amount}}", {
                        amount: formatTableAmount(rollup.summary.outstanding),
                      })}
                    </Caption>
                  )}
                </>
              ),
              action: payablesLink,
            }}
          />
        </SectionCard>
      </div>
    </PageTransition>
  );
}
