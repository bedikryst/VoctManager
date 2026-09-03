/**
 * @file ScopeContentsList.tsx
 * @description The contents list — every page of the corpus with its counts,
 * grouped by the family its key belongs to. Each row is the way into that
 * page's text.
 *
 * Two kinds of figure, and the difference is the point. A page's size and the
 * work already done on it are FACTS about the row, so they read as a sentence
 * in plain type. What is NEW since the reader was last here, and what has gone
 * stale under an edited Polish, are exceptions — they wear a chip, they appear
 * only when they exist, and a page nobody has touched says nothing beyond how
 * big it is. That is what keeps a returning editor's eye on the handful of rows
 * that changed instead of on six identical ones.
 * @architecture Enterprise SaaS 2026
 * @module features/copydesk/components/ScopeContentsList
 */

import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FileText, Music2, type LucideIcon } from "lucide-react";

import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { StatLine, type StatLineItem } from "@/shared/ui/composites/StatLine";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Heading } from "@/shared/ui/primitives/typography";

import { FAMILY_LABELS, formatCount, groupScopes } from "../lib/scopeGroups";
import type { CopyDeskScopeSummary } from "../types/copydesk.dto";

/** Same map as the labels: a family the desk has no icon for keeps the neutral one. */
const FAMILY_ICONS: Readonly<Record<string, LucideIcon>> = {
  concert: Music2,
};

interface ScopeContentsListProps {
  readonly scopes: readonly CopyDeskScopeSummary[];
}

export const ScopeContentsList = ({
  scopes,
}: ScopeContentsListProps): React.JSX.Element => {
  const { t, i18n } = useTranslation();
  const language = i18n.language || "pl";
  const groups = useMemo(() => groupScopes(scopes, language), [scopes, language]);

  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => {
        const meta = FAMILY_LABELS[group.family];
        const Icon = FAMILY_ICONS[group.family] ?? FileText;

        return (
          <SectionCard
            key={group.family}
            as="h2"
            title={meta ? t(meta.key, meta.fallback) : group.family}
            icon={<Icon size={15} strokeWidth={1.5} aria-hidden="true" />}
            bodyClassName="p-0"
          >
            <ul className="divide-y divide-hairline">
              {group.scopes.map((scope) => (
                <ScopeRow key={scope.scope} scope={scope} language={language} />
              ))}
            </ul>
          </SectionCard>
        );
      })}
    </div>
  );
};

interface ScopeRowProps {
  readonly scope: CopyDeskScopeSummary;
  readonly language: string;
}

const ScopeRow = ({ scope, language }: ScopeRowProps): React.JSX.Element => {
  const { t } = useTranslation();

  const facts: StatLineItem[] = [
    {
      id: "segments",
      value: formatCount(scope.segments, language),
      label: t("copy_desk.contents.segments", {
        count: scope.segments,
        defaultValue: "segmentów",
      }),
    },
  ];
  if (scope.touched > 0) {
    facts.push({
      id: "touched",
      value: formatCount(scope.touched, language),
      label: t("copy_desk.contents.touched", {
        count: scope.touched,
        defaultValue: "ruszonych",
      }),
    });
  }
  if (scope.accepted > 0) {
    facts.push({
      id: "accepted",
      value: formatCount(scope.accepted, language),
      label: t("copy_desk.contents.accepted", {
        count: scope.accepted,
        defaultValue: "przyjętych",
      }),
    });
  }

  return (
    <li>
      {/* The whole row is the way in — a per-row button would be chrome
          competing with the titles it lists, and the titles are what an editor
          is scanning for. */}
      <Link
        to={`/redakcja/${scope.scope}`}
        className="flex items-start justify-between gap-4 px-5 py-4 transition-colors hover:bg-ethereal-gold/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ethereal-gold/40"
      >
        <div className="flex min-w-0 flex-col gap-1.5">
          {/* The serif marks a titled event — a concert here, a static page once
              stage G brings them in — the same voice it wears in the row lists
              everywhere else in the panel. */}
          <Heading as="h3" size="lg" className="truncate">
            {scope.label || scope.scope}
          </Heading>
          <StatLine stats={facts} />
        </div>

        {(scope.new > 0 || scope.stale > 0) && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {scope.new > 0 && (
              <Badge variant="incense">
                {t("copy_desk.contents.new_badge", "{{count}} nowych", {
                  count: scope.new,
                })}
              </Badge>
            )}
            {/* Gold, not crimson: a translation whose Polish has moved is work
                waiting, not something broken. */}
            {scope.stale > 0 && (
              <Badge variant="warning">
                {t("copy_desk.contents.stale_badge", "{{count}} nieaktualnych", {
                  count: scope.stale,
                })}
              </Badge>
            )}
          </div>
        )}
      </Link>
    </li>
  );
};
