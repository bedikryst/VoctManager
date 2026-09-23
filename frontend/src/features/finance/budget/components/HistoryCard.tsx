/**
 * @file HistoryCard.tsx
 * @description The budget's history, newest first: who did what, to which
 * cost, line or contract, what it changed, and — for every act that undid a
 * settled fact — why. The log is append-only on the server; this card only
 * reads it, a page at a time.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/budget/components/HistoryCard
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { History } from "lucide-react";

import { formatLocalizedDateTime } from "@/shared/lib/time/intl";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { useBudgetHistory } from "../../api/finance.queries";
import { historyActionLabel, historyChange } from "../../lib/financePresentation";

interface HistoryCardProps {
  readonly projectId: string;
}

const MOMENT_FORMAT: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

export function HistoryCard({ projectId }: HistoryCardProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const query = useBudgetHistory(projectId);
  const pages = query.data?.pages ?? [];
  const events = pages.flatMap((page) => page.results);
  const total = pages[0]?.count ?? 0;

  return (
    <SectionCard
      as="h2"
      icon={<History size={15} aria-hidden="true" />}
      title={t("finance.history.title", "Historia")}
      bodyClassName="p-0"
    >
      {events.length === 0 ? (
        <StatePanel
          variant="inline"
          className="px-5 py-8"
          icon={<History size={22} strokeWidth={1.5} />}
          title={
            query.isLoading
              ? t("finance.history.loading", "Wczytuję historię…")
              : t("finance.history.empty", "Nic się jeszcze nie wydarzyło.")
          }
        />
      ) : (
        <>
          <ul className="divide-y divide-hairline">
            {events.map((event) => {
              const change = historyChange(t, event, i18n.language);
              const facts = [
                formatLocalizedDateTime(event.at, MOMENT_FORMAT, i18n.language),
                event.actor_name,
                change,
              ].filter(Boolean);
              return (
                <li key={event.id} className="flex flex-col gap-0.5 px-5 py-3">
                  <Text as="span" size="sm">
                    <Text as="span" size="sm" weight="medium">
                      {historyActionLabel(t, event.action)}
                    </Text>
                    {event.subject_label && (
                      <Text as="span" size="sm" color="graphite">
                        {` · ${event.subject_label}`}
                      </Text>
                    )}
                  </Text>
                  <Caption as="span" color="muted" className="tabular-nums">
                    {facts.join(" · ")}
                  </Caption>
                  {event.reason && (
                    <Caption as="span" color="graphite">
                      {t("finance.history.reason", "Powód: {{reason}}", { reason: event.reason })}
                    </Caption>
                  )}
                </li>
              );
            })}
          </ul>
          {query.hasNextPage && (
            <div className="border-t border-hairline px-5 py-3">
              <Button
                variant="ghost"
                size="sm"
                isLoading={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
              >
                {t("finance.history.more", "Pokaż starsze ({{count}})", {
                  count: Math.max(total - events.length, 0),
                })}
              </Button>
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}
