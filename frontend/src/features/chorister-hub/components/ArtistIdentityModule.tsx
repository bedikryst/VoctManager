// chorister-hub/components/ArtistIdentityModule.tsx
import React from "react";
import { UserRound, Trophy, CalendarDays, Star } from "lucide-react";
import { useTranslation } from "react-i18next";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Badge } from "@/shared/ui/primitives/Badge";
import {
  Heading,
  Text,
  Metric,
  Eyebrow,
  Caption,
} from "@/shared/ui/primitives/typography";
import { useArtistMetrics } from "../api/chorister-hub.queries";
import { VocalDistributionGrid } from "./VocalDistributionGrid";

interface MetricTileProps {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  subLabel?: string;
}

const MetricTile = ({
  icon,
  value,
  label,
  subLabel,
}: MetricTileProps): React.JSX.Element => (
  <GlassCard
    variant="light"
    padding="md"
    isHoverable={false}
    className="flex flex-col items-start gap-3"
  >
    <div className="w-9 h-9 rounded-xl bg-ethereal-gold/10 border border-ethereal-gold/20 flex items-center justify-center text-ethereal-gold shrink-0">
      {icon}
    </div>
    <div>
      <Metric size="4xl" color="graphite" className="leading-none tabular-nums">
        {value}
      </Metric>
      <Text
        size="xs"
        weight="semibold"
        className="text-ethereal-graphite mt-1 block"
      >
        {label}
      </Text>
      {subLabel && (
        <Caption color="muted" className="block mt-0.5">
          {subLabel}
        </Caption>
      )}
    </div>
  </GlassCard>
);

export const ArtistIdentityModule = (): React.JSX.Element => {
  const { t } = useTranslation();
  const { data: metrics } = useArtistMetrics();

  const maxCount =
    metrics.vocal_line_distribution.length > 0
      ? Math.max(...metrics.vocal_line_distribution.map((e) => e.count))
      : 0;

  const seasonsSubLabel =
    metrics.first_project_year != null
      ? t("chorister_hub.identity.since", "since {{year}}", {
          year: metrics.first_project_year,
        })
      : undefined;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-ethereal-amethyst/10 border border-ethereal-amethyst/20 flex items-center justify-center text-ethereal-amethyst">
          <UserRound size={18} aria-hidden="true" />
        </div>
        <div>
          <Heading size="xl" className="tracking-tight">
            {t("chorister_hub.identity.title", "Artist Profile & History")}
          </Heading>
          <Text size="xs" color="muted">
            {t(
              "chorister_hub.identity.subtitle",
              "Aggregated from completed projects",
            )}
          </Text>
        </div>
      </div>

      {metrics.total_concerts === 0 ? (
        <GlassCard
          variant="ethereal"
          padding="lg"
          isHoverable={false}
          className="text-center py-10"
        >
          <Star
            size={28}
            className="mx-auto text-ethereal-graphite/25 mb-3"
            aria-hidden="true"
          />
          <Text color="muted" size="sm">
            {t(
              "chorister_hub.identity.no_history",
              "No completed project history to display.",
            )}
          </Text>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <MetricTile
              icon={<Trophy size={16} aria-hidden="true" />}
              value={metrics.total_concerts}
              label={t(
                "chorister_hub.identity.metric_concerts",
                "Concerts performed",
              )}
            />
            <MetricTile
              icon={<CalendarDays size={16} aria-hidden="true" />}
              value={metrics.active_seasons}
              label={t(
                "chorister_hub.identity.metric_seasons",
                "Active seasons",
              )}
              subLabel={seasonsSubLabel}
            />
            <MetricTile
              icon={<Star size={16} aria-hidden="true" />}
              value={metrics.vocal_line_distribution.length}
              label={t(
                "chorister_hub.identity.metric_voice_lines",
                "Voice lines performed",
              )}
            />
          </div>

          <GlassCard variant="ethereal" padding="lg">
            <VocalDistributionGrid
              distribution={metrics.vocal_line_distribution}
              maxCount={maxCount}
            />

            {metrics.season_years.length > 0 && (
              <div className="mt-5 pt-4 border-t border-ethereal-incense/15">
                <Eyebrow color="muted" className="mb-2">
                  {t(
                    "chorister_hub.identity.season_timeline",
                    "Season timeline",
                  )}
                </Eyebrow>
                <div className="flex flex-wrap gap-2">
                  {metrics.season_years.map((year) => (
                    <Badge key={year} variant="glass" className="tabular-nums">
                      {year}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </GlassCard>
        </div>
      )}
    </div>
  );
};
