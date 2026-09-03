/**
 * @file ScopeContentsList.tsx
 * @description The contents list — every page of the corpus with its counts,
 * in the two halves the desk is actually read in. Each row is the way into that
 * page's text.
 *
 * **The division is the surface's whole argument.** An editor arrives asking
 * where there is something they have not looked at, and the list answers before
 * they have read a title: pages they have never declared read, or that have
 * moved since they did, sit above; everything else sits below with the date it
 * was read. Neither half is a state anybody maintains — both are comparisons
 * against one watermark per page, so a page leaves the top half by being read
 * and comes back on its own when the site's text moves under it.
 *
 * Two kinds of figure inside a row, and the difference is the point. A page's
 * size and the work already done on it are FACTS, so they read as a sentence in
 * plain type. What is NEW, what has CHANGED, and what has gone stale under an
 * edited Polish are exceptions — they wear a chip, they appear only when they
 * exist, and a page nobody has touched says nothing beyond how big it is.
 * @architecture Enterprise SaaS 2026
 * @module features/copydesk/components/ScopeContentsList
 */

import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Eye } from "lucide-react";

import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { StatLine, type StatLineItem } from "@/shared/ui/composites/StatLine";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Caption, Heading } from "@/shared/ui/primitives/typography";

import {
  familyIcon,
  formatCount,
  scopeFamily,
  seenOnDate,
  splitScopes,
} from "../lib/scopeGroups";
import type { CopyDeskScopeSummary } from "../types/copydesk.dto";

interface ScopeContentsListProps {
  readonly scopes: readonly CopyDeskScopeSummary[];
}

export const ScopeContentsList = ({
  scopes,
}: ScopeContentsListProps): React.JSX.Element => {
  const { t, i18n } = useTranslation();
  const language = i18n.language || "pl";
  const { pending, reviewed } = useMemo(
    () => splitScopes(scopes, language),
    [scopes, language],
  );

  return (
    <div className="flex flex-col gap-5">
      <SectionCard
        as="h2"
        title={t("copy_desk.contents.pending_title", "Do przejrzenia")}
        icon={<Eye size={15} strokeWidth={1.5} aria-hidden="true" />}
        bodyClassName="p-0"
      >
        {pending.length === 0 ? (
          // The resting case, and it earns a sentence rather than an empty box:
          // an editor who has read everything should be told so, not left
          // wondering whether the list failed to load.
          <div className="px-5 py-8">
            <StatePanel
              icon={<CheckCircle2 size={22} aria-hidden="true" />}
              title={t(
                "copy_desk.contents.pending_empty_title",
                "Przejrzałeś wszystko",
              )}
              description={t(
                "copy_desk.contents.pending_empty_description",
                "Żadna strona nie zmieniła się od czasu, kiedy ją czytałeś. Wrócą tu same, kiedy tekst serwisu się ruszy.",
              )}
            />
          </div>
        ) : (
          <ul className="divide-y divide-hairline">
            {pending.map((scope) => (
              <ScopeRow key={scope.scope} scope={scope} language={language} />
            ))}
          </ul>
        )}
      </SectionCard>

      {reviewed.length > 0 && (
        <SectionCard
          as="h2"
          title={t("copy_desk.contents.reviewed_title", "Przejrzane")}
          icon={<CheckCircle2 size={15} strokeWidth={1.5} aria-hidden="true" />}
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-hairline">
            {reviewed.map((scope) => (
              <ScopeRow key={scope.scope} scope={scope} language={language} />
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
};

interface ScopeRowProps {
  readonly scope: CopyDeskScopeSummary;
  readonly language: string;
}

const ScopeRow = ({ scope, language }: ScopeRowProps): React.JSX.Element => {
  const { t } = useTranslation();
  // The family used to be the heading a row sat under; the halves are the
  // heading now, so it travels on the row itself rather than disappearing.
  const Icon = familyIcon(scopeFamily(scope.scope));

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
      {/* Stacked on a phone, and that is not a cosmetic choice: a row can now
          carry three chips at once, and beside a 390px title they take the line
          and leave the page's own name truncated to nothing. The title is what
          an editor is scanning for, so it keeps the full measure and the marks
          sit under it until there is room for both. */}
      <Link
        to={`/redakcja/${scope.scope}`}
        className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-ethereal-gold/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ethereal-gold/40 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
      >
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <Icon
              size={14}
              strokeWidth={1.5}
              aria-hidden="true"
              className="shrink-0 text-ethereal-graphite"
            />
            {/* The serif marks a titled event — a concert here, a static page
                once stage G brings them in — the same voice it wears in the row
                lists everywhere else in the panel. */}
            <Heading as="h3" size="lg" className="truncate">
              {scope.label || scope.scope}
            </Heading>
          </div>
          <StatLine stats={facts} />
          {scope.seen_at !== null && (
            <Caption color="graphite">
              {t("copy_desk.contents.seen_on", {
                date: seenOnDate(scope.seen_at, language),
                defaultValue: "Przejrzane {{date}}",
              })}
            </Caption>
          )}
        </div>

        {(scope.new > 0 || scope.changed > 0 || scope.stale > 0) && (
          <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0 sm:justify-end">
            {scope.new > 0 && (
              <Badge variant="incense">
                {t("copy_desk.contents.new_badge", "{{count}} nowych", {
                  count: scope.new,
                })}
              </Badge>
            )}
            {/* Not "new" and not "broken": text that was already on the page
                when this reader went through it, and has moved since. */}
            {scope.changed > 0 && (
              <Badge variant="incense">
                {t("copy_desk.contents.changed_badge", "{{count}} zmienionych", {
                  count: scope.changed,
                })}
              </Badge>
            )}
            {/* Gold, not crimson: a translation whose Polish has moved is work
                waiting, not something broken. It sits on rows in BOTH halves —
                being read does not clear it, which is why it takes no part in
                deciding which half a page belongs to. */}
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
