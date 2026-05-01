/**
 * @file CrewHeroPanel.tsx
 * @description Narrative surface that opens the Crew dashboard.
 * Surfaces the module headline, top-level operational badges, and contact-coverage
 * pillars, mirroring the Archive hero rhythm for cross-module consistency.
 * @architecture Enterprise SaaS 2026
 * @module features/crew/components/CrewHeroPanel
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Building2, Mail, Phone, Sparkle, Users, Wrench } from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";

import { getCrewSpecialtyOption } from "../constants/crewSpecialties";
import type { CrewMetrics } from "../hooks/useCrewData";

interface CrewHeroPanelProps {
  metrics: CrewMetrics;
  emailCoverage: number;
  phoneCoverage: number;
}

interface CoveragePillarProps {
  label: string;
  coverage: number;
  ratio: string;
  icon: React.ReactNode;
}

function CoveragePillar({
  label,
  coverage,
  ratio,
  icon,
}: CoveragePillarProps): React.JSX.Element {
  return (
    <div className="rounded-[1.75rem] border border-ethereal-incense/15 bg-ethereal-alabaster/35 px-5 py-4 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow color="muted">{label}</Eyebrow>
        <span
          className="text-ethereal-graphite/60"
          aria-hidden="true"
        >
          {icon}
        </span>
      </div>
      <Heading as="p" size="2xl" className="mt-2 leading-none">
        {coverage}%
      </Heading>
      <Text size="xs" color="graphite" className="mt-1">
        {ratio}
      </Text>
    </div>
  );
}

export function CrewHeroPanel({
  metrics,
  emailCoverage,
  phoneCoverage,
}: CrewHeroPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const topSpecialty = metrics.topSpecialty
    ? getCrewSpecialtyOption(t, metrics.topSpecialty.value)
    : null;

  return (
    <GlassCard
      variant="light"
      padding="lg"
      isHoverable={false}
      className="border border-ethereal-incense/15"
      backgroundElement={
        <div
          className="pointer-events-none absolute -right-24 -top-28 h-[28rem] w-[28rem] rounded-full bg-gradient-to-br from-ethereal-gold/20 via-ethereal-parchment/10 to-transparent blur-[120px]"
          aria-hidden="true"
        />
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.95fr)]">
        <div className="space-y-5">
          <Badge variant="glass" icon={<Wrench size={12} />}>
            {t("crew.hero.badge", "Operacje Logistyczne")}
          </Badge>

          <div className="space-y-2.5">
            <Heading as="h2" size="4xl">
              {t(
                "crew.hero.title",
                "Ekipa techniczna gotowa na produkcję.",
              )}
            </Heading>
            <Text color="graphite" className="max-w-xl">
              {t(
                "crew.hero.description",
                "Jeden centralny widok dla zewnętrznych współpracowników, firm i specjalizacji wspierających każdą produkcję.",
              )}
            </Text>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Badge variant="brand" icon={<Users size={12} />}>
              {t("crew.hero.stats.people", "{{count}} współpracowników", {
                count: metrics.totalPeople,
              })}
            </Badge>
            <Badge variant="glass" icon={<Building2 size={12} />}>
              {t("crew.hero.stats.companies", "{{count}} firm", {
                count: metrics.uniqueCompanies,
              })}
            </Badge>
            <Badge variant="warning" icon={<Sparkle size={12} />}>
              {t(
                "crew.hero.stats.specialties",
                "{{count}} specjalizacji w bazie",
                { count: metrics.uniqueSpecialties },
              )}
            </Badge>
            {topSpecialty && metrics.topSpecialty && (
              <Badge variant="amethyst" icon={<topSpecialty.icon size={12} />}>
                {t(
                  "crew.hero.stats.top_specialty",
                  "Najliczniej: {{label}} ({{count}})",
                  {
                    label: topSpecialty.label,
                    count: metrics.topSpecialty.count,
                  },
                )}
              </Badge>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <CoveragePillar
            label={t("crew.hero.coverage.email", "Pokrycie e-mail")}
            coverage={emailCoverage}
            ratio={t("crew.hero.coverage.ratio", "{{value}} / {{total}}", {
              value: metrics.withEmail,
              total: metrics.totalPeople,
            })}
            icon={<Mail size={14} strokeWidth={1.5} aria-hidden="true" />}
          />
          <CoveragePillar
            label={t("crew.hero.coverage.phone", "Pokrycie telefon")}
            coverage={phoneCoverage}
            ratio={t("crew.hero.coverage.ratio", "{{value}} / {{total}}", {
              value: metrics.withPhone,
              total: metrics.totalPeople,
            })}
            icon={<Phone size={14} strokeWidth={1.5} aria-hidden="true" />}
          />
        </div>
      </div>
    </GlassCard>
  );
}
