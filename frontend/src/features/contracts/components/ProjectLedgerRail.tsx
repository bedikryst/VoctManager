/**
 * @file ProjectLedgerRail.tsx
 * @description Left command rail of the settlements cockpit: a searchable project
 * switcher where every row carries its own settlement signal (money owed, missing
 * valuations, fully settled, or no personnel). A "whole portfolio" row sits on top
 * so the conductor can step back to the cross-project payables view.
 * @architecture Enterprise SaaS 2026
 * @module features/contracts/components/ProjectLedgerRail
 */

import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Briefcase, Calendar, Layers3, Search } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import type { ProjectRollup } from "../hooks/useContractsData";
import { formatContractCurrency, formatInteger } from "../lib/contractsPresentation";

interface ProjectLedgerRailProps {
  rollups: ProjectRollup[];
  selectedProjectId: string;
  onSelect: (projectId: string) => void;
  portfolioOutstanding: number;
  projectsWithOutstanding: number;
}

const SignalChip = ({ rollup }: { rollup: ProjectRollup }): React.JSX.Element => {
  const { t } = useTranslation();

  if (rollup.outstanding > 0) {
    return (
      <span className="rounded-md border border-ethereal-crimson/25 bg-ethereal-crimson/5 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ethereal-crimson">
        {formatContractCurrency(rollup.outstanding)}
      </span>
    );
  }
  if (rollup.missingCount > 0) {
    return (
      <span className="rounded-md border border-ethereal-gold/30 bg-ethereal-gold/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ethereal-gold">
        {t("contracts.rail.missing", "{{n}} bez wyceny", {
          n: rollup.missingCount,
        })}
      </span>
    );
  }
  if (rollup.totalRecords === 0) {
    return (
      <Caption color="muted">{t("contracts.rail.empty", "brak obsady")}</Caption>
    );
  }
  return (
    <span className="rounded-md border border-ethereal-sage/25 bg-ethereal-sage/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ethereal-sage">
      {t("contracts.rail.settled", "rozliczono")}
    </span>
  );
};

export const ProjectLedgerRail = ({
  rollups,
  selectedProjectId,
  onSelect,
  portfolioOutstanding,
  projectsWithOutstanding,
}: ProjectLedgerRailProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return rollups;
    }
    return rollups.filter((rollup) =>
      rollup.project.title.toLowerCase().includes(needle),
    );
  }, [rollups, query]);

  const isPortfolio = selectedProjectId === "";

  return (
    <GlassCard variant="solid" padding="none" isHoverable={false}>
      <header className="flex items-center justify-between gap-2 border-b border-ethereal-ink/6 px-4 py-3">
        <div className="flex items-center gap-2">
          <Briefcase size={14} className="text-ethereal-gold/70" aria-hidden="true" />
          <Eyebrow as="h2" color="graphite">
            {t("contracts.rail.title", "Projekty")}
          </Eyebrow>
        </div>
        <Caption color="muted" className="tabular-nums">
          {formatInteger(rollups.length)}
        </Caption>
      </header>

      <div className="border-b border-ethereal-ink/6 p-3">
        <div className="relative flex items-center">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 text-ethereal-incense"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("contracts.rail.search", "Szukaj projektu…")}
            aria-label={t("contracts.rail.search", "Szukaj projektu…")}
            className="w-full rounded-xl border border-ethereal-ink/10 bg-ethereal-marble py-2 pl-9 pr-3 text-sm text-ethereal-ink transition-colors placeholder:text-ethereal-incense focus:border-ethereal-gold/50 focus:outline-none focus:ring-2 focus:ring-ethereal-gold/20"
          />
        </div>
      </div>

      <div className="max-h-[58vh] space-y-1 overflow-y-auto overflow-x-hidden p-2">
        {/* Portfolio row */}
        <button
          type="button"
          aria-pressed={isPortfolio}
          onClick={() => onSelect("")}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
            isPortfolio
              ? "border-ethereal-gold/40 bg-ethereal-gold/[0.06] ring-1 ring-ethereal-gold/25"
              : "border-dashed border-ethereal-ink/12 bg-ethereal-alabaster/40 hover:border-ethereal-gold/30",
          )}
        >
          <Layers3
            size={16}
            className={cn(
              "shrink-0",
              isPortfolio ? "text-ethereal-gold" : "text-ethereal-graphite/55",
            )}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <Text size="sm" weight="semibold" truncate>
              {t("contracts.rail.all_projects", "Wszystkie projekty")}
            </Text>
            <Caption color="muted">
              {projectsWithOutstanding > 0
                ? t("contracts.rail.all_outstanding", "{{n}} z zaległościami", {
                    n: projectsWithOutstanding,
                  })
                : t("contracts.rail.all_clear", "Wszystko rozliczone")}
            </Caption>
          </div>
          {portfolioOutstanding > 0 && (
            <span className="shrink-0 rounded-md border border-ethereal-crimson/25 bg-ethereal-crimson/5 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ethereal-crimson">
              {formatContractCurrency(portfolioOutstanding)}
            </span>
          )}
        </button>

        {filtered.map((rollup) => {
          const isActive = String(rollup.project.id) === selectedProjectId;
          return (
            <button
              key={rollup.project.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => onSelect(String(rollup.project.id))}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
                isActive
                  ? "border-ethereal-gold/40 bg-ethereal-gold/[0.06] ring-1 ring-ethereal-gold/25"
                  : "border-ethereal-ink/8 bg-ethereal-alabaster hover:border-ethereal-gold/30 hover:bg-ethereal-parchment/40",
                rollup.project.status === "DONE" && !isActive && "opacity-75",
              )}
            >
              <div className="min-w-0 flex-1">
                <Text size="sm" weight="semibold" truncate>
                  {rollup.project.title}
                </Text>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0">
                  {rollup.project.date_time && (
                    <Caption color="muted" className="inline-flex items-center gap-1">
                      <Calendar size={10} aria-hidden="true" />
                      {formatLocalizedDate(
                        rollup.project.date_time,
                        { day: "numeric", month: "short", year: "numeric" },
                        undefined,
                        rollup.project.timezone,
                      )}
                    </Caption>
                  )}
                  {rollup.totalRecords > 0 && (
                    <Caption color="muted" className="tabular-nums">
                      {t("contracts.rail.mix", "{{cast}} obsada · {{crew}} ekipa", {
                        cast: rollup.castCount,
                        crew: rollup.crewCount,
                      })}
                    </Caption>
                  )}
                </div>
              </div>
              <div className="shrink-0">
                <SignalChip rollup={rollup} />
              </div>
            </button>
          );
        })}

        {filtered.length === 0 && (
          <Caption color="muted" className="block px-3 py-6 text-center">
            {t("contracts.rail.no_match", "Brak projektów dla tego zapytania.")}
          </Caption>
        )}
      </div>
    </GlassCard>
  );
};
