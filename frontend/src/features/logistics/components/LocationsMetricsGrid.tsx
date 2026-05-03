/**
 * @file LocationsMetricsGrid.tsx
 * @description Bento-aligned metrics rail summarising logistics KPIs.
 * Mirrors the Crew metrics rhythm: a single GlassCard hosting four MetricBlock
 * artefacts, separated with vertical Dividers on wider viewports.
 * @architecture Enterprise SaaS 2026
 * @module features/logistics/components/LocationsMetricsGrid
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Globe2, MapPin, Navigation, StickyNote } from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { MetricBlock } from "@/shared/ui/composites/MetricBlock";
import { Divider } from "@/shared/ui/primitives/Divider";

import type { LocationsMetrics } from "../hooks/useLocationsData";

interface LocationsMetricsGridProps {
  metrics: LocationsMetrics;
  geoCoverage: number;
  notesCoverage: number;
}

export function LocationsMetricsGrid({
  metrics,
  geoCoverage,
  notesCoverage,
}: LocationsMetricsGridProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <GlassCard
      variant="ethereal"
      padding="md"
      isHoverable={false}
      className="border border-ethereal-incense/20"
    >
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4 lg:divide-x lg:divide-ethereal-incense/15">
        <MetricBlock
          label={t("logistics.metrics.locations", "Lokacje w bazie")}
          value={metrics.totalLocations}
          icon={<MapPin />}
          accentColor="gold"
          interactiveMode="minimal"
          className="lg:px-6"
        />

        <MetricBlock
          label={t("logistics.metrics.countries", "Kraje")}
          value={metrics.uniqueCountries}
          icon={<Globe2 />}
          interactiveMode="minimal"
          className="lg:px-6"
        />

        <MetricBlock
          label={t("logistics.metrics.geo_coverage", "Pokrycie GPS")}
          value={geoCoverage}
          unit="%"
          icon={<Navigation />}
          interactiveMode="minimal"
          className="lg:px-6"
        />

        <MetricBlock
          label={t("logistics.metrics.notes_coverage", "Notatki zespołu")}
          value={notesCoverage}
          unit="%"
          icon={<StickyNote />}
          interactiveMode="minimal"
          className="lg:px-6"
        />
      </div>

      <Divider variant="fade" className="mt-6 hidden lg:block" />
    </GlassCard>
  );
}
