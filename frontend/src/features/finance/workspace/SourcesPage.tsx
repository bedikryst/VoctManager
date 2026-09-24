/**
 * @file SourcesPage.tsx
 * @description Źródła — every funding source of the foundation with what it
 * carries across the projects it funds: what was awarded, what is charged to
 * it, what remains, and when its report is due. A grant is settled per
 * agreement, not per concert, so these are the source's own figures, summed
 * by the server. A rule the figures break reads in crimson under the name; a
 * report due within two weeks, in gold. A row opens the source's own page,
 * which lives under this section. Sort is `?ordering=`, in memory.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/workspace/SourcesPage
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Landmark, Plus } from "lucide-react";

import { useIsOnline } from "@/shared/lib/dom/useIsOnline";
import { useNow } from "@/shared/lib/dom/useNow";
import {
  DataTable,
  sortRows,
  useSearchParamSort,
  type DataTableColumn,
} from "@/shared/ui/composites/DataTable";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { SourceSheet } from "../components/SourceSheet";
import {
  formatFinanceDate,
  fundingKindLabel,
  fundingStatusLabel,
} from "../lib/financePresentation";
import { formatTableAmount, formatTableDifference, isPositiveAmount, toGrosze } from "../lib/money";
import type { DecimalString, FundingSourceDTO } from "../types/finance.dto";
import { useFinanceOutlet } from "./financeOutlet";

const DAY_MS = 86_400_000;
const REPORT_WINDOW_DAYS = 14;

/** A difference sorts by its sign too: an overdrawn source is below an empty one. */
const signedGrosze = (value: DecimalString | null): number | null => {
  if (value === null) return null;
  const magnitude = toGrosze(value.startsWith("-") ? value.slice(1) : value);
  if (magnitude === null) return null;
  return value.startsWith("-") ? -magnitude : magnitude;
};

export default function SourcesPage(): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const { overview } = useFinanceOutlet();
  const isOnline = useIsOnline();
  const [isCreating, setIsCreating] = useState(false);
  const [sort, setSort] = useSearchParamSort();
  // "Due soon" is an answer about now; one clock, quantised to the day.
  const now = useNow(60_000);
  const today = Math.floor(now.getTime() / DAY_MS) * DAY_MS;

  const reportIsOpen = (source: FundingSourceDTO): boolean =>
    source.report_due_on !== null && source.status !== "SETTLED" && source.status !== "REJECTED";

  const reportIsNear = (source: FundingSourceDTO): boolean => {
    if (!reportIsOpen(source) || source.report_due_on === null) return false;
    const due = Date.parse(`${source.report_due_on}T00:00:00Z`);
    return Number.isFinite(due) && (due - today) / DAY_MS <= REPORT_WINDOW_DAYS;
  };

  const brokenRules = (source: FundingSourceDTO): string[] => {
    const { figures } = source;
    return [
      figures.over_awarded ? t("finance.portfolio.over_awarded", "ponad pułap") : null,
      figures.own_share_below ? t("finance.portfolio.own_share_below", "za mały wkład własny") : null,
      figures.admin_cap_exceeded ? t("finance.portfolio.admin_over", "administracja ponad limit") : null,
    ].filter((entry): entry is string => entry !== null);
  };

  const nameCell = (source: FundingSourceDTO, size: "sm" | "base"): React.ReactNode => {
    const broken = brokenRules(source);
    return (
      <span className="flex flex-col gap-0.5">
        <Text as="span" size={size} weight="medium">
          {source.name}
        </Text>
        {source.grantor && (
          <Caption as="span" color="muted">
            {source.grantor}
          </Caption>
        )}
        {broken.length > 0 && (
          <Caption as="span" color="crimson">
            {broken.join(" · ")}
          </Caption>
        )}
      </span>
    );
  };

  const reportDate = (source: FundingSourceDTO): string | null =>
    reportIsOpen(source) && source.report_due_on
      ? formatFinanceDate(source.report_due_on, i18n.language)
      : null;

  const columns: DataTableColumn<FundingSourceDTO>[] = [
    {
      id: "name",
      header: t("finance.workspace.sources.source", "Źródło"),
      sortValue: (source) => source.name,
      cell: (source) => nameCell(source, "base"),
    },
    {
      id: "kind",
      header: t("finance.source.kind", "Rodzaj"),
      sortValue: (source) => fundingKindLabel(t, source.kind),
      className: "w-36",
      cell: (source) => (
        <Text as="span" size="sm">
          {fundingKindLabel(t, source.kind)}
        </Text>
      ),
    },
    {
      id: "status",
      header: t("finance.source.status", "Status"),
      sortValue: (source) => fundingStatusLabel(t, source.status),
      className: "w-32",
      cell: (source) => (
        <Text as="span" size="sm" color={source.status === "PLANNED" ? "muted" : "default"}>
          {fundingStatusLabel(t, source.status)}
        </Text>
      ),
    },
    {
      id: "awarded",
      header: t("finance.source_page.awarded", "Przyznano"),
      numeric: true,
      sortValue: (source) => toGrosze(source.awarded_amount),
      firstDirection: "desc",
      className: "w-32",
      cell: (source) => (
        <Text as="span" size="sm" color={source.awarded_amount === null ? "muted" : "default"}>
          {formatTableAmount(source.awarded_amount) ?? "–"}
        </Text>
      ),
    },
    {
      id: "charged",
      header: t("finance.portfolio.charged", "Obciążono"),
      numeric: true,
      sortValue: (source) => toGrosze(source.figures.charged),
      firstDirection: "desc",
      className: "w-32",
      cell: (source) => {
        const positive = isPositiveAmount(source.figures.charged);
        return (
          <Text as="span" size="sm" weight="medium" color={positive ? "default" : "muted"}>
            {positive ? formatTableAmount(source.figures.charged) : "–"}
          </Text>
        );
      },
    },
    {
      id: "remaining",
      header: t("finance.workspace.sources.remaining", "Pozostało"),
      numeric: true,
      sortValue: (source) => signedGrosze(source.figures.remaining),
      firstDirection: "desc",
      className: "w-32",
      cell: (source) => (
        <Text as="span" size="sm" color={source.figures.over_awarded ? "gold" : "graphite"}>
          {formatTableDifference(source.figures.remaining) ?? "–"}
        </Text>
      ),
    },
    {
      id: "report",
      header: t("finance.workspace.sources.report_due", "Raport do"),
      numeric: true,
      sortValue: (source) => (reportIsOpen(source) ? source.report_due_on : null),
      className: "w-32",
      cell: (source) => {
        const date = reportDate(source);
        return (
          <Text as="span" size="sm" color={date === null ? "muted" : reportIsNear(source) ? "gold" : "default"}>
            {date ?? "–"}
          </Text>
        );
      },
    },
  ];

  return (
    <PageTransition>
      <div className="flex flex-col gap-5 pb-24">
        <SectionCard
          as="h2"
          icon={<Landmark size={15} aria-hidden="true" />}
          title={t("finance.portfolio.sources", "Źródła finansowania")}
          bodyClassName="p-0"
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreating(true)}
              disabled={!isOnline}
              leftIcon={<Plus size={14} aria-hidden="true" />}
            >
              {t("finance.portfolio.add_source", "Nowe źródło")}
            </Button>
          }
        >
          <DataTable
            label={t("finance.portfolio.sources", "Źródła finansowania")}
            rows={sortRows(overview.sources, columns, sort)}
            columns={columns}
            rowKey={(source) => source.id}
            rowLink={(source) => ({ to: `/panel/finance/sources/${source.id}` })}
            sort={sort}
            onSortChange={setSort}
            empty={{
              icon: <Landmark size={22} strokeWidth={1.5} />,
              title: t("finance.portfolio.sources_empty", "Fundacja nie ma jeszcze źródeł finansowania."),
              description: t(
                "finance.portfolio.sources_empty_desc",
                "Źródło to dotacja, grant, sponsor, bilety albo środki własne. Jedno źródło może finansować kilka koncertów — tu widać je w całości, a na stronie źródła każdy obciążony koszt.",
              ),
            }}
            mobile={{
              primary: (source) => nameCell(source, "sm"),
              secondary: (source) => {
                const date = reportDate(source);
                return (
                  <Caption as="span" color={reportIsNear(source) ? "gold" : "muted"}>
                    {[
                      fundingKindLabel(t, source.kind),
                      source.status === "PLANNED" ? null : fundingStatusLabel(t, source.status),
                      date
                        ? t("finance.portfolio.report_due", "sprawozdanie do {{date}}", { date })
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Caption>
                );
              },
              trailing: (source) => (
                <>
                  <Text as="span" size="sm" weight="medium">
                    {formatTableAmount(source.figures.charged) ?? "–"}
                  </Text>
                  {source.figures.remaining !== null && (
                    <Caption as="span" color={source.figures.over_awarded ? "gold" : "muted"}>
                      {t("finance.workspace.sources.remaining_short", "zostało {{amount}}", {
                        amount: formatTableDifference(source.figures.remaining),
                      })}
                    </Caption>
                  )}
                </>
              ),
            }}
          />
        </SectionCard>
      </div>
      {isCreating && <SourceSheet onClose={() => setIsCreating(false)} />}
    </PageTransition>
  );
}
