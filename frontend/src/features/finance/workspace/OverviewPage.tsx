/**
 * @file OverviewPage.tsx
 * @description Przegląd finansów — the board's immediate unpaid work from B3,
 * the live grant deadlines and budget warnings. It intentionally has no
 * cross-grant balance: an agreement's remaining amount is meaningful only on
 * that agreement's own page.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/workspace/OverviewPage
 */

import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarClock, CircleAlert, HandCoins, ListTodo } from "lucide-react";

import { useNow } from "@/shared/lib/dom/useNow";
import { MetricBlock } from "@/shared/ui/composites/MetricBlock";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { StaggeredBentoContainer, StaggeredBentoItem } from "@/shared/ui/kinematics/StaggeredBentoGrid";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { formatFinanceDate } from "../lib/financePresentation";
import { formatAmount } from "../lib/money";
import { projectsRequiringWork, sourceDeadlines } from "../lib/portfolio";
import type { PayableDTO } from "../types/finance.dto";
import { useFinanceOutlet } from "./financeOutlet";

const PAYABLES_PATH = "/panel/finance/payables";

const payableName = (payable: PayableDTO): string =>
  payable.kind === "FEE" ? payable.payee_name : payable.vendor_name;

const payableDetail = (payable: PayableDTO): string =>
  payable.kind === "FEE" ? payable.payee_role : payable.description;

export default function OverviewPage(): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const { overview } = useFinanceOutlet();
  const { pathname, search } = useLocation();
  const now = useNow(60_000);
  const deadlines = sourceDeadlines(overview.sources, now);
  const projects = projectsRequiringWork(overview.projects);
  const financeReturn = pathname + search;
  const summary = overview.payables_summary;
  const date = (value: string): string => formatFinanceDate(value, i18n.language);

  return (
    <PageTransition>
      <StaggeredBentoContainer className="grid grid-cols-1 gap-5 pb-24 lg:grid-cols-2">
        <StaggeredBentoItem className="lg:col-span-2">
          <SectionCard
            as="h2"
            icon={<HandCoins size={15} aria-hidden="true" />}
            title={t("finance.workspace.overview.title", "Dzisiaj w finansach")}
            bodyClassName="grid grid-cols-1 gap-5 sm:grid-cols-3"
          >
            <MetricBlock
              label={t("finance.workspace.overview.outstanding", "Do zapłaty")}
              value={formatAmount(summary.total) ?? "–"}
              unit="PLN"
            />
            <div className="flex flex-col gap-1">
              <MetricBlock
                label={t("finance.workspace.overview.overdue", "Po terminie")}
                value={formatAmount(summary.overdue_total) ?? "–"}
                unit="PLN"
                accentColor="gold"
              />
              <Caption as="span" color="gold">
                {t("finance.workspace.overview.payments_count", "płatności: {{count}}", {
                  count: summary.overdue_count,
                })}
              </Caption>
            </div>
            <div className="flex flex-col gap-1">
              <MetricBlock
                label={t("finance.workspace.overview.due_soon", "W 14 dni")}
                value={formatAmount(summary.due_soon_total) ?? "–"}
                unit="PLN"
                accentColor="gold"
              />
              <Caption as="span" color="gold">
                {t("finance.workspace.overview.payments_count", "płatności: {{count}}", {
                  count: summary.due_soon_count,
                })}
              </Caption>
            </div>
          </SectionCard>
        </StaggeredBentoItem>

        <StaggeredBentoItem>
          <SectionCard
            as="h2"
            icon={<HandCoins size={15} aria-hidden="true" />}
            title={t("finance.workspace.overview.next_payments", "Najbliższe płatności")}
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link to={PAYABLES_PATH}>
                  {t("finance.workspace.overview.all_payments", "Wszystkie")}
                </Link>
              </Button>
            }
            bodyClassName="p-0"
          >
            {overview.payables.results.length > 0 ? (
              <div className="divide-y divide-hairline">
                {overview.payables.results.map((payable) => (
                  <Link
                    key={payable.cost_item_id}
                    to={PAYABLES_PATH}
                    className="flex items-start justify-between gap-4 px-5 py-3 transition-colors hover:bg-ethereal-marble/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ethereal-gold/40"
                  >
                    <div className="min-w-0">
                      <Text as="span" size="sm" weight="medium" truncate className="block">
                        {payableName(payable)}
                      </Text>
                      <Caption as="span" color="muted" className="block truncate">
                        {[payableDetail(payable), payable.project_title].filter(Boolean).join(" · ")}
                      </Caption>
                    </div>
                    <div className="shrink-0 text-right">
                      <Text as="span" size="sm" weight="medium" className="block">
                        {formatAmount(payable.cost_amount) ?? "–"} PLN
                      </Text>
                      <Caption as="span" color="muted" className="block">
                        {payable.due_on
                          ? date(payable.due_on)
                          : t("finance.workspace.overview.no_due_date", "Bez terminu")}
                      </Caption>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <StatePanel
                variant="inline"
                icon={<HandCoins size={22} strokeWidth={1.5} />}
                title={t("finance.workspace.overview.payments_empty", "Fundacja nie ma płatności do wykonania.")}
              />
            )}
          </SectionCard>
        </StaggeredBentoItem>

        <StaggeredBentoItem>
          <SectionCard
            as="h2"
            icon={<CalendarClock size={15} aria-hidden="true" />}
            title={t("finance.workspace.overview.deadlines", "Terminy")}
            bodyClassName="p-0"
          >
            {deadlines.length > 0 ? (
              <div className="divide-y divide-hairline">
                {deadlines.map((deadline) => (
                  <Link
                    key={`${deadline.source.id}-${deadline.kind}-${deadline.date}`}
                    to={`/panel/finance/sources/${deadline.source.id}`}
                    className="flex items-start justify-between gap-4 px-5 py-3 transition-colors hover:bg-ethereal-marble/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ethereal-gold/40"
                  >
                    <div className="min-w-0">
                      <Text as="span" size="sm" weight="medium" truncate className="block">
                        {deadline.source.name}
                      </Text>
                      <Caption as="span" color="muted" className="block">
                        {deadline.kind === "report"
                          ? t("finance.workspace.overview.report_due", "Sprawozdanie")
                          : t("finance.workspace.overview.eligibility_ends", "Kwalifikowalność")}
                      </Caption>
                    </div>
                    <Text as="span" size="sm" color="gold" className="shrink-0">
                      {date(deadline.date)}
                    </Text>
                  </Link>
                ))}
              </div>
            ) : (
              <StatePanel
                variant="inline"
                icon={<CalendarClock size={22} strokeWidth={1.5} />}
                title={t("finance.workspace.overview.deadlines_empty", "W ciągu 60 dni nie ma terminu źródła.")}
              />
            )}
          </SectionCard>
        </StaggeredBentoItem>

        <StaggeredBentoItem className="lg:col-span-2">
          <SectionCard
            as="h2"
            icon={<ListTodo size={15} aria-hidden="true" />}
            title={t("finance.workspace.overview.work", "Wymaga pracy")}
            bodyClassName="p-0"
          >
            {projects.length > 0 ? (
              <div className="divide-y divide-hairline">
                {projects.map((project) => {
                  const { problem, work } = project.warning_counts;
                  return (
                    <Link
                      key={project.project.id}
                      to={`/panel/projects/${project.project.id}/budget`}
                      state={{ financeReturn }}
                      className="flex items-start justify-between gap-4 px-5 py-3 transition-colors hover:bg-ethereal-marble/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ethereal-gold/40"
                    >
                      <Text as="span" size="sm" weight="medium" truncate>
                        {project.project.title}
                      </Text>
                      <Caption as="span" color={problem > 0 ? "crimson" : "gold"} className="shrink-0 text-right">
                        {[
                          problem > 0
                            ? t("finance.workspace.overview.problems", "problemy: {{count}}", { count: problem })
                            : null,
                          work > 0
                            ? t("finance.workspace.overview.work_count", "do zrobienia: {{count}}", { count: work })
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </Caption>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <StatePanel
                variant="inline"
                icon={<CircleAlert size={22} strokeWidth={1.5} />}
                title={t("finance.workspace.overview.work_empty", "Żaden budżet nie wymaga teraz pracy.")}
              />
            )}
          </SectionCard>
        </StaggeredBentoItem>
      </StaggeredBentoContainer>
    </PageTransition>
  );
}
