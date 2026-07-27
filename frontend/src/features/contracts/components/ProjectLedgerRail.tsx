/**
 * @file ProjectLedgerRail.tsx
 * @description Left command rail of the settlements cockpit: a searchable project
 * switcher where a row speaks only when it is short — money owed, valuations
 * missing, or nobody cast at all. A settled project says nothing. A "whole
 * portfolio" row sits on top so the conductor can step back to the cross-project
 * payables view.
 * @architecture Enterprise SaaS 2026
 * @module features/contracts/components/ProjectLedgerRail
 */

import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Briefcase, Calendar, Layers3, Search } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { foldDiacritics } from "@/shared/lib/text";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Input } from "@/shared/ui/primitives/Input";
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

/**
 * What a project still owes the reader, or nothing at all. A settled project
 * used to wear a sage "rozliczono", which on a healthy season is most of the
 * rail — the resting state stated on every row is what buries the one that is
 * actually short. Silence here means "nothing to do", and the eye finds the
 * two rows that speak.
 */
const SignalChip = ({
  rollup,
}: {
  rollup: ProjectRollup;
}): React.JSX.Element | null => {
  const { t } = useTranslation();

  if (rollup.outstanding > 0) {
    return (
      <Badge variant="danger" casing="natural" className="tabular-nums">
        {formatContractCurrency(rollup.outstanding)}
      </Badge>
    );
  }
  if (rollup.missingCount > 0) {
    return (
      <Badge variant="warning">
        {t("contracts.rail.missing", "{{n}} bez wyceny", {
          n: rollup.missingCount,
        })}
      </Badge>
    );
  }
  if (rollup.totalRecords === 0) {
    return (
      <Caption color="muted">{t("contracts.rail.empty", "brak obsady")}</Caption>
    );
  }
  return null;
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
    const needle = foldDiacritics(query.trim());
    if (!needle) {
      return rollups;
    }
    return rollups.filter((rollup) =>
      foldDiacritics(rollup.project.title).includes(needle),
    );
  }, [rollups, query]);

  const isPortfolio = selectedProjectId === "";

  return (
    <GlassCard variant="solid" padding="none" isHoverable={false}>
      <header className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-3">
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

      <div className="border-b border-hairline p-3">
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("contracts.rail.search", "Szukaj projektu…")}
          aria-label={t("contracts.rail.search", "Szukaj projektu…")}
          leftIcon={<Search size={14} aria-hidden="true" />}
        />
      </div>

      <div className="max-h-[58vh] space-y-1 overflow-y-auto overflow-x-hidden p-2">
        {/* Portfolio row */}
        <button
          type="button"
          aria-pressed={isPortfolio}
          onClick={() => onSelect("")}
          className={cn(
            "flex w-full items-center gap-3 rounded-nested border px-3 py-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
            isPortfolio
              ? "border-ethereal-gold/40 bg-ethereal-gold/6 ring-1 ring-ethereal-gold/25"
              : "border-dashed border-hairline-strong bg-ethereal-alabaster/40 hover:border-ethereal-gold/30",
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
            <Badge variant="danger" casing="natural" className="shrink-0 tabular-nums">
              {formatContractCurrency(portfolioOutstanding)}
            </Badge>
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
                "flex w-full items-center gap-3 rounded-nested border px-3 py-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
                isActive
                  ? "border-ethereal-gold/40 bg-ethereal-gold/6 ring-1 ring-ethereal-gold/25"
                  : "border-hairline-strong bg-ethereal-alabaster hover:border-ethereal-gold/30 hover:bg-ethereal-parchment/40",
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
