/**
 * @file SourcesCard.tsx
 * @description Źródła finansowania — every funding source of the foundation,
 * with what it may carry, what is charged to it across every project it funds,
 * what remains, and the report's deadline. A grant is settled per agreement,
 * not per concert, so these are the source's own figures, summed by the
 * server; a row opens the source's page. A rule the source's figures break is
 * said in crimson on the row; a deadline within two weeks, in gold.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/overview/components/SourcesCard
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Landmark, Plus } from "lucide-react";

import { useIsOnline } from "@/shared/lib/dom/useIsOnline";
import { useNow } from "@/shared/lib/dom/useNow";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { SourceSheet } from "../../components/SourceSheet";
import {
  formatFinanceDate,
  fundingKindLabel,
  fundingStatusLabel,
} from "../../lib/financePresentation";
import { formatLedgerAmount, formatLedgerDifference, isPositiveAmount } from "../../lib/money";
import type { FundingSourceDTO } from "../../types/finance.dto";

const DAY_MS = 86_400_000;
const REPORT_WINDOW_DAYS = 14;

interface SourcesCardProps {
  readonly sources: readonly FundingSourceDTO[];
}

export function SourcesCard({ sources }: SourcesCardProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const isOnline = useIsOnline();
  const [isCreating, setIsCreating] = useState(false);
  // "Due soon" is an answer about now; one clock, quantised to the day.
  const now = useNow(60_000);
  const today = Math.floor(now.getTime() / DAY_MS) * DAY_MS;

  const reportIsNear = (source: FundingSourceDTO): boolean => {
    if (!source.report_due_on || source.status === "SETTLED" || source.status === "REJECTED") {
      return false;
    }
    const due = Date.parse(`${source.report_due_on}T00:00:00Z`);
    return Number.isFinite(due) && (due - today) / DAY_MS <= REPORT_WINDOW_DAYS;
  };

  return (
    <>
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
        {sources.length === 0 ? (
          <StatePanel
            variant="inline"
            className="px-5 py-10"
            icon={<Landmark size={22} strokeWidth={1.5} />}
            title={t("finance.portfolio.sources_empty", "Fundacja nie ma jeszcze źródeł finansowania.")}
            description={t(
              "finance.portfolio.sources_empty_desc",
              "Źródło to dotacja, grant, sponsor, bilety albo środki własne. Jedno źródło może finansować kilka koncertów — tu widać je w całości, a na stronie źródła każdy obciążony koszt.",
            )}
          />
        ) : (
          <>
            <div className="hidden items-center gap-4 border-b border-hairline px-5 py-2 sm:flex">
              <Eyebrow size="overline-sm" color="muted" className="flex-1">
                {t("common.currency", "PLN")}
              </Eyebrow>
              {[
                t("finance.portfolio.ceiling", "Pułap"),
                t("finance.portfolio.charged", "Obciążono"),
                t("finance.portfolio.remaining", "Zostało"),
              ].map((label) => (
                <Eyebrow key={label} size="overline-sm" color="muted" className="w-24 text-right">
                  {label}
                </Eyebrow>
              ))}
            </div>
            <ul className="divide-y divide-hairline">
              {sources.map((source) => {
                const { figures } = source;
                const broken = [
                  figures.over_awarded ? t("finance.portfolio.over_awarded", "ponad pułap") : null,
                  figures.own_share_below ? t("finance.portfolio.own_share_below", "za mały wkład własny") : null,
                  figures.admin_cap_exceeded ? t("finance.portfolio.admin_over", "administracja ponad limit") : null,
                ].filter((entry): entry is string => entry !== null);
                const facts = [
                  fundingKindLabel(t, source.kind),
                  source.status === "PLANNED" ? null : fundingStatusLabel(t, source.status),
                  figures.project_count > 0
                    ? t("finance.portfolio.source_projects", "projekty: {{count}}", {
                        count: figures.project_count,
                      })
                    : null,
                ].filter(Boolean);
                return (
                  <li key={source.id}>
                    <Link
                      to={`/panel/finance/sources/${source.id}`}
                      className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-ethereal-ink/3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ethereal-gold/40"
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <Text as="span" size="sm" weight="medium" truncate>
                          {source.name}
                        </Text>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <Caption color="muted">{facts.join(" · ")}</Caption>
                          {source.report_due_on && source.status !== "SETTLED" && (
                            <Caption color={reportIsNear(source) ? "gold" : "muted"}>
                              ·{" "}
                              {t("finance.portfolio.report_due", "sprawozdanie do {{date}}", {
                                date: formatFinanceDate(source.report_due_on, i18n.language),
                              })}
                            </Caption>
                          )}
                          {broken.map((entry) => (
                            <Caption key={entry} color="crimson">
                              · {entry}
                            </Caption>
                          ))}
                        </span>
                      </span>
                      <Text as="span" size="sm" className="w-24 shrink-0 text-right tabular-nums">
                        {formatLedgerAmount(figures.ceiling) ?? "–"}
                      </Text>
                      <Text
                        as="span"
                        size="sm"
                        weight="medium"
                        color={isPositiveAmount(figures.charged) ? "default" : "muted"}
                        className="hidden w-24 shrink-0 text-right tabular-nums sm:inline"
                      >
                        {isPositiveAmount(figures.charged) ? formatLedgerAmount(figures.charged) : "–"}
                      </Text>
                      <Text
                        as="span"
                        size="sm"
                        color="muted"
                        className="hidden w-24 shrink-0 text-right tabular-nums sm:inline"
                      >
                        {formatLedgerDifference(figures.remaining) ?? "–"}
                      </Text>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </SectionCard>
      {isCreating && <SourceSheet onClose={() => setIsCreating(false)} />}
    </>
  );
}
