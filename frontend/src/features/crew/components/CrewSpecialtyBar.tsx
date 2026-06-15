/**
 * @file CrewSpecialtyBar.tsx
 * @description Specialty-balance strip — the crew counterpart to the artists'
 * EnsembleBalance. Each tile shows a specialty's head-count + a proportional bar
 * (scaled to the largest specialty) and doubles as the roster filter; the header
 * carries compact contact-coverage stats. Folds the old hero + metrics grid +
 * specialty <select> into one scannable control.
 * @architecture Enterprise SaaS 2026
 * @module features/crew/components/CrewSpecialtyBar
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Building2, Layers, Mail, Phone, Users } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import {
  Caption,
  Eyebrow,
  Metric,
  Text,
} from "@/shared/ui/primitives/typography";
import type { CollaboratorSpecialty } from "@/shared/types";
import type {
  CrewSpecialtyAccent,
  CrewSpecialtyOption,
} from "../constants/crewSpecialties";

interface CrewSpecialtyBarProps {
  specialtyOptions: CrewSpecialtyOption[];
  counts: Record<CollaboratorSpecialty, number>;
  totalPeople: number;
  uniqueCompanies: number;
  emailCoverage: number;
  phoneCoverage: number;
  activeSpecialty: string;
  onSelectSpecialty: (value: string) => void;
}

const ACCENT: Record<
  CrewSpecialtyAccent,
  { bar: string; active: string; idle: string }
> = {
  gold: {
    bar: "bg-ethereal-gold/60",
    active:
      "border-ethereal-gold/45 bg-ethereal-gold/[0.05] ring-1 ring-ethereal-gold/30",
    idle: "border-ethereal-ink/8 hover:border-ethereal-gold/30",
  },
  amethyst: {
    bar: "bg-ethereal-amethyst/55",
    active:
      "border-ethereal-amethyst/45 bg-ethereal-amethyst/[0.04] ring-1 ring-ethereal-amethyst/30",
    idle: "border-ethereal-ink/8 hover:border-ethereal-amethyst/30",
  },
  crimson: {
    bar: "bg-ethereal-crimson/55",
    active:
      "border-ethereal-crimson/45 bg-ethereal-crimson/[0.04] ring-1 ring-ethereal-crimson/30",
    idle: "border-ethereal-ink/8 hover:border-ethereal-crimson/30",
  },
  sage: {
    bar: "bg-ethereal-sage/55",
    active:
      "border-ethereal-sage/45 bg-ethereal-sage/[0.04] ring-1 ring-ethereal-sage/30",
    idle: "border-ethereal-ink/8 hover:border-ethereal-sage/30",
  },
  graphite: {
    bar: "bg-ethereal-graphite/45",
    active:
      "border-ethereal-graphite/40 bg-ethereal-graphite/[0.05] ring-1 ring-ethereal-graphite/25",
    idle: "border-ethereal-ink/8 hover:border-ethereal-graphite/30",
  },
  incense: {
    bar: "bg-ethereal-incense/55",
    active:
      "border-ethereal-incense/45 bg-ethereal-incense/[0.05] ring-1 ring-ethereal-incense/30",
    idle: "border-ethereal-ink/8 hover:border-ethereal-incense/30",
  },
};

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
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-ethereal-ink/6 px-5 py-3.5">
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
            <CoverageChip icon={<Users size={11} />}>
              <Text as="span" size="sm" weight="semibold" className="text-ethereal-ink">
                {totalPeople}
              </Text>
              {t("crew.bar.people_total", "osób")}
            </CoverageChip>
            <CoverageChip icon={<Building2 size={11} />}>
              <Text as="span" size="sm" weight="semibold" className="text-ethereal-ink">
                {uniqueCompanies}
              </Text>
              {t("crew.bar.companies", "firm")}
            </CoverageChip>
            <CoverageChip icon={<Mail size={11} />}>
              {t("crew.bar.email_pct", "e-mail {{n}}%", { n: emailCoverage })}
            </CoverageChip>
            <CoverageChip icon={<Phone size={11} />}>
              {t("crew.bar.phone_pct", "tel. {{n}}%", { n: phoneCoverage })}
            </CoverageChip>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {specialtyOptions.map((option) => {
            const count = counts[option.value];
            const isActive = activeSpecialty === option.value;
            const accent = ACCENT[option.accent];
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isActive}
                onClick={() =>
                  onSelectSpecialty(isActive ? "" : option.value)
                }
                title={option.label}
                className={cn(
                  "group flex flex-col gap-2 rounded-2xl border bg-ethereal-alabaster px-3.5 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 active:scale-[0.98]",
                  isActive ? accent.active : accent.idle,
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
                    className="leading-none tabular-nums"
                  >
                    {count}
                  </Metric>
                </div>
                <Eyebrow color={option.accent} truncate className="block">
                  {option.label}
                </Eyebrow>
                <div
                  className="h-1 w-full overflow-hidden rounded-full bg-ethereal-ink/6"
                  aria-hidden="true"
                >
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700 ease-out",
                      accent.bar,
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
              "group flex flex-col justify-between gap-2 rounded-2xl border px-3.5 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 active:scale-[0.98]",
              !hasFilter
                ? "border-ethereal-gold/40 bg-ethereal-gold/[0.06] ring-1 ring-ethereal-gold/25"
                : "border-dashed border-ethereal-ink/12 bg-ethereal-alabaster/50 hover:border-ethereal-gold/30",
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
                className="leading-none tabular-nums"
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
