/**
 * @file CrewSpecialtyBar.tsx
 * @description Specialty-balance strip — the crew counterpart to the artists'
 * EnsembleBalance. Each tile shows a specialty's head-count + a proportional bar
 * (scaled to the largest specialty) and doubles as the roster filter; the header
 * carries the facts the tiles do not: how many firms, and how much of the base
 * is actually reachable.
 *
 * The head-count belongs to the "Wszyscy" tile alone — the header stated it a
 * second time, forty pixels away from the same number.
 * @architecture Enterprise SaaS 2026
 * @module features/crew/components/CrewSpecialtyBar
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Building2, Layers, Mail, Phone, Users } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import {
  ACCENT_BAR,
  ACCENT_TEXT,
  ACCENT_TILE_ACTIVE,
  ACCENT_TILE_IDLE,
} from "@/shared/ui/primitives/accents";
import {
  Caption,
  Eyebrow,
  Metric,
  Text,
} from "@/shared/ui/primitives/typography";
import type { CollaboratorSpecialty } from "@/shared/types";
import type { CrewSpecialtyOption } from "../constants/crewSpecialties";

interface CrewSpecialtyBarProps {
  specialtyOptions: CrewSpecialtyOption[];
  counts: Record<CollaboratorSpecialty, number>;
  totalPeople: number;
  uniqueCompanies: number;
  /** Percentages, or `null` when there is nobody to compute them over. */
  emailCoverage: number | null;
  phoneCoverage: number | null;
  activeSpecialty: string;
  onSelectSpecialty: (value: string) => void;
}

const CoverageChip = ({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) => (
  <Caption color="muted" className="inline-flex items-center gap-1 tabular-nums">
    <span className="text-ethereal-incense/60" aria-hidden="true">
      {icon}
    </span>
    {children}
  </Caption>
);

export const CrewSpecialtyBar = React.memo(
  ({
    specialtyOptions,
    counts,
    totalPeople,
    uniqueCompanies,
    emailCoverage,
    phoneCoverage,
    activeSpecialty,
    onSelectSpecialty,
  }: CrewSpecialtyBarProps): React.JSX.Element => {
    const { t } = useTranslation();
    const peak = Math.max(...specialtyOptions.map((o) => counts[o.value]), 1);
    const hasFilter = activeSpecialty !== "";

    return (
      <GlassCard variant="solid" padding="none" isHoverable={false}>
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-hairline px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Layers
              size={14}
              className="text-ethereal-gold/70"
              aria-hidden="true"
            />
            <Eyebrow as="h2" color="graphite">
              {t("crew.bar.title", "Specjalizacje")}
            </Eyebrow>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <CoverageChip icon={<Building2 size={11} />}>
              <Text as="span" size="sm" weight="semibold" className="text-ethereal-ink">
                {uniqueCompanies}
              </Text>
              {t("crew.bar.companies", "firm")}
            </CoverageChip>
            {/* No base, no rate: an em-dash says "nothing recorded", where a
                confident 0% would read as a real, terrible coverage figure. */}
            <CoverageChip icon={<Mail size={11} />}>
              {emailCoverage === null
                ? t("crew.bar.email_unknown", "e-mail —")
                : t("crew.bar.email_pct", "e-mail {{n}}%", { n: emailCoverage })}
            </CoverageChip>
            <CoverageChip icon={<Phone size={11} />}>
              {phoneCoverage === null
                ? t("crew.bar.phone_unknown", "tel. —")
                : t("crew.bar.phone_pct", "tel. {{n}}%", { n: phoneCoverage })}
            </CoverageChip>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {specialtyOptions.map((option) => {
            const count = counts[option.value];
            const isActive = activeSpecialty === option.value;
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isActive}
                onClick={() =>
                  onSelectSpecialty(isActive ? "" : option.value)
                }
                title={option.description}
                className={cn(
                  "group flex flex-col gap-2 rounded-nested border bg-ethereal-alabaster px-3.5 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 active:scale-[0.98]",
                  isActive
                    ? ACCENT_TILE_ACTIVE[option.accent]
                    : ACCENT_TILE_IDLE[option.accent],
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <Icon
                    size={15}
                    strokeWidth={1.75}
                    aria-hidden="true"
                    className={cn(
                      "shrink-0 transition-colors",
                      isActive ? "" : "text-ethereal-graphite/55",
                    )}
                  />
                  <Metric
                    size="xl"
                    color={isActive ? "default" : "graphite"}
                    className="leading-none"
                  >
                    {count}
                  </Metric>
                </div>
                <Eyebrow
                  color={ACCENT_TEXT[option.accent]}
                  truncate
                  className="block"
                >
                  {option.label}
                </Eyebrow>
                <div
                  className="h-1 w-full overflow-hidden rounded-full bg-ethereal-ink/6"
                  aria-hidden="true"
                >
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700 ease-out",
                      ACCENT_BAR[option.accent],
                    )}
                    style={{ width: `${Math.round((count / peak) * 100)}%` }}
                  />
                </div>
              </button>
            );
          })}

          <button
            type="button"
            aria-pressed={!hasFilter}
            onClick={() => onSelectSpecialty("")}
            className={cn(
              "group flex flex-col justify-between gap-2 rounded-nested border px-3.5 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 active:scale-[0.98]",
              !hasFilter
                ? "border-ethereal-gold/40 bg-ethereal-gold/[0.06] ring-1 ring-ethereal-gold/25"
                : "border-dashed border-hairline-strong bg-ethereal-alabaster/50 hover:border-ethereal-gold/30",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <Users
                size={15}
                strokeWidth={1.75}
                aria-hidden="true"
                className={cn(
                  "shrink-0",
                  hasFilter ? "text-ethereal-graphite/55" : "text-ethereal-gold",
                )}
              />
              <Metric
                size="xl"
                color={!hasFilter ? "default" : "graphite"}
                className="leading-none"
              >
                {totalPeople}
              </Metric>
            </div>
            <Eyebrow color={!hasFilter ? "gold" : "muted"} className="block">
              {t("crew.bar.all", "Wszyscy")}
            </Eyebrow>
            <Caption color="muted" className="leading-tight">
              {t("crew.filters.all_specialties", "Wszystkie specjalizacje")}
            </Caption>
          </button>
        </div>
      </GlassCard>
    );
  },
);

CrewSpecialtyBar.displayName = "CrewSpecialtyBar";
