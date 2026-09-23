/**
 * @file ProjectRollups.tsx
 * @description Projekty — one row per project with money on it: cost, paid,
 * still owed, the work its warnings list, and the budget's standing when it is
 * anything but the ordinary "being planned". A row opens that project's
 * budget; there is no ledger here any more — it lives only in the hub.
 * The figures align down the column, so they are sans with tabular digits,
 * never display serif. A project with no fee rows at all is left out, and the
 * card says how many were.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/overview/components/ProjectRollups
 */

import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FolderKanban } from "lucide-react";

import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Caption, Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";
import { budgetStatusLabel } from "../../lib/financePresentation";
import { formatLedgerAmount, isPositiveAmount } from "../../lib/money";
import type { ProjectRollupDTO } from "../../types/finance.dto";

const CANCELLED = "CANC";

interface ProjectRollupsProps {
  readonly rollups: readonly ProjectRollupDTO[];
}

const hasMoney = (rollup: ProjectRollupDTO): boolean =>
  rollup.summary.rows > 0 || isPositiveAmount(rollup.summary.committed);

export function ProjectRollups({ rollups }: ProjectRollupsProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const visible = rollups.filter(hasMoney);
  const hidden = rollups.length - visible.length;

  return (
    <SectionCard
      as="h2"
      icon={<FolderKanban size={15} aria-hidden="true" />}
      title={t("finance.portfolio.projects", "Projekty")}
      bodyClassName="p-0"
      footer={
        hidden > 0 ? (
          <Caption color="muted">
            {t("finance.portfolio.hidden", "Pominięto projekty bez honorariów: {{count}}.", {
              count: hidden,
            })}
          </Caption>
        ) : undefined
      }
    >
      {visible.length === 0 ? (
        <StatePanel
          variant="inline"
          className="px-5 py-10"
          icon={<FolderKanban size={22} strokeWidth={1.5} />}
          title={t("finance.portfolio.projects_empty", "Żaden projekt nie ma jeszcze honorariów.")}
        />
      ) : (
        <>
          <div className="hidden items-center gap-4 border-b border-hairline px-5 py-2 sm:flex">
            <Eyebrow size="overline-sm" color="muted" className="flex-1">
              {t("common.currency", "PLN")}
            </Eyebrow>
            {[
              t("finance.portfolio.cost", "Koszt"),
              t("finance.summary.paid_all", "Zapłacone"),
              t("finance.summary.outstanding_all", "Do zapłaty"),
            ].map((label) => (
              <Eyebrow key={label} size="overline-sm" color="muted" className="w-24 text-right">
                {label}
              </Eyebrow>
            ))}
          </div>
          <ul className="divide-y divide-hairline">
            {visible.map((rollup) => {
              const { project, summary, warning_counts: counts } = rollup;
              const status = budgetStatusLabel(t, rollup.budget_status);
              return (
                <li key={project.id}>
                  <Link
                    to={`/panel/projects/${project.id}/budget`}
                    className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-ethereal-ink/3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ethereal-gold/40"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <Heading as="span" size="lg" weight="medium" className="truncate">
                        {project.title}
                      </Heading>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Caption color="muted">
                          {formatLocalizedDate(
                            project.date_time,
                            { day: "numeric", month: "short", year: "numeric" },
                            i18n.language,
                            project.timezone,
                          )}
                        </Caption>
                        {project.status === CANCELLED && (
                          <Caption color="muted">
                            · {t("finance.portfolio.cancelled", "odwołany")}
                          </Caption>
                        )}
                        {counts.problem > 0 && (
                          <Caption color="crimson">
                            · {t("finance.portfolio.problems", "problemy: {{count}}", {
                              count: counts.problem,
                            })}
                          </Caption>
                        )}
                        {counts.work > 0 && (
                          <Caption color="gold">
                            · {t("finance.portfolio.work", "do zrobienia: {{count}}", {
                              count: counts.work,
                            })}
                          </Caption>
                        )}
                        {status && <Badge variant="neutral">{status}</Badge>}
                      </span>
                    </span>
                    <Text as="span" size="sm" weight="medium" className="w-24 shrink-0 text-right tabular-nums">
                      {formatLedgerAmount(summary.committed) ?? "–"}
                    </Text>
                    <Text
                      as="span"
                      size="sm"
                      color={isPositiveAmount(summary.paid) ? "sage" : "muted"}
                      className="hidden w-24 shrink-0 text-right tabular-nums sm:inline"
                    >
                      {isPositiveAmount(summary.paid) ? formatLedgerAmount(summary.paid) : "–"}
                    </Text>
                    <Text
                      as="span"
                      size="sm"
                      color={isPositiveAmount(summary.outstanding) ? "default" : "muted"}
                      className="hidden w-24 shrink-0 text-right tabular-nums sm:inline"
                    >
                      {isPositiveAmount(summary.outstanding)
                        ? formatLedgerAmount(summary.outstanding)
                        : "–"}
                    </Text>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </SectionCard>
  );
}
