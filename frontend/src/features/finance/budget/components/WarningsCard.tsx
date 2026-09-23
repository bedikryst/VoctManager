/**
 * @file WarningsCard.tsx
 * @description The budget's work list: every warning the server raised, in its
 * order (problems first), each with the one thing to do about it and the people
 * it names — each name a link to that row on Honoraria. The server computes
 * the warnings per request, so "the concert has passed" is never stale here.
 * A long list of names is cut, and the cut says how many it hides.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/budget/components/WarningsCard
 */

import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CircleCheck, ListChecks } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { SEVERITY_TEXT, warningHint, warningTitle } from "../../lib/financePresentation";
import type { BudgetWarningDTO, LedgerRowDTO } from "../../types/finance.dto";

const NAMES_SHOWN = 6;

interface WarningsCardProps {
  readonly warnings: readonly BudgetWarningDTO[];
  readonly rows: readonly LedgerRowDTO[];
  /** Honoraria's route; a name links to `?focus=<row key>` on it. */
  readonly peopleHref: string;
}

export function WarningsCard({
  warnings,
  rows,
  peopleHref,
}: WarningsCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const nameOf = new Map(rows.map((row) => [row.key, row.payee_name]));

  return (
    <SectionCard
      as="h2"
      icon={<ListChecks size={15} aria-hidden="true" />}
      title={t("finance.overview.work", "Do zrobienia")}
      bodyClassName="p-0"
    >
      {warnings.length === 0 ? (
        <StatePanel
          variant="inline"
          className="px-5 py-8"
          icon={<CircleCheck size={22} strokeWidth={1.5} />}
          title={t("finance.overview.work_empty", "Nic nie czeka na rozliczenie.")}
        />
      ) : (
        <ul className="divide-y divide-hairline">
          {warnings.map((warning) => {
            const tone = SEVERITY_TEXT[warning.severity];
            const shown = warning.subject_ids.slice(0, NAMES_SHOWN);
            const hidden = warning.subject_ids.length - shown.length;
            return (
              <li key={warning.code} className="flex gap-3 px-5 py-4">
                <span
                  className={cn(
                    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    tone === "crimson" ? "bg-ethereal-crimson" : "bg-ethereal-gold",
                  )}
                  aria-hidden="true"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Text as="span" size="base" weight="semibold" color={tone}>
                    {warningTitle(t, warning)}
                    <Text as="span" size="base" color="muted" className="ml-2 tabular-nums">
                      {warning.subject_ids.length}
                    </Text>
                  </Text>
                  <Text as="span" size="sm" color="graphite">
                    {warningHint(t, warning)}
                  </Text>
                  <span className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
                    {shown.map((key) => (
                      <Link
                        key={key}
                        to={`${peopleHref}?focus=${key}`}
                        className="rounded-chip text-ethereal-graphite underline decoration-ethereal-gold/40 underline-offset-4 transition-colors hover:text-ethereal-ink hover:decoration-ethereal-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40"
                      >
                        <Text as="span" size="sm" color="inherit">
                          {nameOf.get(key) ||
                            t("finance.row.unknown_payee", "Osoba bez nazwiska")}
                        </Text>
                      </Link>
                    ))}
                    {hidden > 0 && (
                      <Caption color="muted">
                        {t("finance.overview.more_names", "i jeszcze {{count}}", {
                          count: hidden,
                        })}
                      </Caption>
                    )}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
