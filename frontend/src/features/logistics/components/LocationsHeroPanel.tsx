/**
 * @file LocationsHeroPanel.tsx
 * @description Narrative surface that opens the Logistics dashboard.
 * Surfaces the module headline, top-level operational badges, and coverage
 * pillars (geo-tagging, internal notes), mirroring the Crew hero rhythm
 * for cross-module consistency.
 * @architecture Enterprise SaaS 2026
 * @module features/logistics/components/LocationsHeroPanel
 */

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Compass,
  Globe2,
  MapPin,
  Sparkle,
  StickyNote,
  Map as MapIcon,
} from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";

import { getLocationCategoryOption } from "../constants/locationCategories";
import type { LocationsMetrics } from "../hooks/useLocationsData";

interface LocationsHeroPanelProps {
  metrics: LocationsMetrics;
  geoCoverage: number;
  notesCoverage: number;
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
        <span className="text-ethereal-graphite/60" aria-hidden="true">
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

export function LocationsHeroPanel({
  metrics,
  geoCoverage,
  notesCoverage,
}: LocationsHeroPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const topCategory = metrics.topCategory
    ? getLocationCategoryOption(t, metrics.topCategory.value)
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
          <Badge variant="glass" icon={<Compass size={12} />}>
            {t("logistics.hero.badge", "Globalna Baza Lokacji")}
          </Badge>

          <div className="space-y-2.5">
            <Heading as="h2" size="4xl">
              {t(
                "logistics.hero.title",
                "Każda scena, każdy hub — w jednym atlasie.",
              )}
            </Heading>
            <Text color="graphite" className="max-w-xl">
              {t(
                "logistics.hero.description",
                "Filharmonie, kościoły, sale prób, hotele i lotniska — synchronizowane z Google Maps, ze strefami czasowymi i instrukcjami dla zespołu.",
              )}
            </Text>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Badge variant="brand" icon={<MapPin size={12} />}>
              {t("logistics.hero.stats.locations", "{{count}} lokacji", {
                count: metrics.totalLocations,
              })}
            </Badge>
            <Badge variant="glass" icon={<Globe2 size={12} />}>
              {t("logistics.hero.stats.countries", "{{count}} krajów", {
                count: metrics.uniqueCountries,
              })}
            </Badge>
            <Badge variant="warning" icon={<Sparkle size={12} />}>
              {t(
                "logistics.hero.stats.timezones",
                "{{count}} stref czasowych",
                {
                  count: metrics.uniqueTimezones,
                },
              )}
            </Badge>
            {topCategory && metrics.topCategory && (
              <Badge variant="amethyst" icon={<topCategory.icon size={12} />}>
                {t(
                  "logistics.hero.stats.top_category",
                  "Najliczniej: {{label}} ({{count}})",
                  {
                    label: topCategory.plural,
                    count: metrics.topCategory.count,
                  },
                )}
              </Badge>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <CoveragePillar
            label={t("logistics.hero.coverage.geo", "Pokrycie GPS")}
            coverage={geoCoverage}
            ratio={t(
              "logistics.hero.coverage.ratio",
              "{{value}} / {{total}}",
              {
                value: metrics.geoTagged,
                total: metrics.totalLocations,
              },
            )}
            icon={<MapIcon size={14} strokeWidth={1.5} aria-hidden="true" />}
          />
          <CoveragePillar
            label={t("logistics.hero.coverage.notes", "Notatki zespołu")}
            coverage={notesCoverage}
            ratio={t(
              "logistics.hero.coverage.ratio",
              "{{value}} / {{total}}",
              {
                value: metrics.withNotes,
                total: metrics.totalLocations,
              },
            )}
            icon={<StickyNote size={14} strokeWidth={1.5} aria-hidden="true" />}
          />
        </div>
      </div>
    </GlassCard>
  );
}
