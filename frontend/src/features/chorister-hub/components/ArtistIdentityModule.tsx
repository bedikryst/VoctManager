// chorister-hub/components/ArtistIdentityModule.tsx
// Artist passport: aggregated history of the chorister's work — concerts,
// seasons, repertoire (every piece ever performed), voice lines and private
// attendance. Emotional surface, not a spreadsheet; never comparative.
import React from "react";
import {
  CalendarDays,
  Feather,
  HeartPulse,
  Music,
  ScrollText,
  Star,
  Trophy,
  UserRound,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Badge } from "@/shared/ui/primitives/Badge";
import {
  Caption,
  Eyebrow,
  Heading,
  Metric,
  Text,
} from "@/shared/ui/primitives/typography";
import { useArtistMetrics } from "../api/chorister-hub.queries";
import { VocalDistributionGrid } from "./VocalDistributionGrid";
import type { RepertoireEntry } from "../types/chorister-hub.dto";

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
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-ethereal-gold/20 bg-ethereal-gold/10 text-ethereal-gold">
      {icon}
    </div>
    <div>
      <Metric size="4xl" color="graphite" className="leading-none tabular-nums">
        {value}
      </Metric>
      <Text size="xs" weight="semibold" className="mt-1 block text-ethereal-graphite">
        {label}
      </Text>
      {subLabel && (
        <Caption color="muted" className="mt-0.5 block">
          {subLabel}
        </Caption>
      )}
    </div>
  </GlassCard>
);

const RepertoireRow = ({
  entry,
}: {
  entry: RepertoireEntry;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const yearsLabel =
    entry.years.length > 1
      ? `${entry.years[0]}–${entry.years[entry.years.length - 1]}`
      : String(entry.years[0] ?? "");

  return (
    <div className="flex items-center gap-3 border-b border-ethereal-marble/50 px-1 py-2.5 last:border-b-0">
      <Music size={13} className="shrink-0 text-ethereal-gold/60" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <Text size="sm" weight="semibold" truncate>
          {entry.title}
        </Text>
        <Caption color="muted" className="block truncate">
          {entry.composer_name ||
            t("chorister_hub.passport.traditional", "Tradycyjny / Nieznany")}
          {entry.epoch && ` · ${entry.epoch}`}
        </Caption>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {entry.voice_lines.map((line) => (
          <Eyebrow
            key={line}
            as="span"
            color="incense"
            className="rounded border border-ethereal-sage/20 bg-ethereal-sage/10 px-1.5 py-0.5"
          >
            {line}
          </Eyebrow>
        ))}
        {entry.performances > 1 && (
          <Eyebrow
            as="span"
            color="gold"
            className="rounded border border-ethereal-gold/20 bg-ethereal-gold/10 px-1.5 py-0.5 tabular-nums"
          >
            {entry.performances}×
          </Eyebrow>
        )}
        <Eyebrow as="span" color="muted" className="tabular-nums">
          {yearsLabel}
        </Eyebrow>
      </div>
    </div>
  );
};

export const ArtistIdentityModule = (): React.JSX.Element => {
  const { t } = useTranslation();
  const { data: metrics } = useArtistMetrics();

  const maxCount =
    metrics.vocal_line_distribution.length > 0
      ? Math.max(...metrics.vocal_line_distribution.map((e) => e.count))
      : 0;

  const seasonsSubLabel =
    metrics.first_project_year != null
      ? t("chorister_hub.identity.since", "od {{year}}", {
          year: metrics.first_project_year,
        })
      : undefined;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-ethereal-gold/20 bg-ethereal-gold/10 text-ethereal-gold">
          <UserRound size={18} aria-hidden="true" />
        </div>
        <div>
          <Heading size="xl" className="tracking-tight">
            {t("chorister_hub.identity.title", "Moja droga")}
          </Heading>
          <Text size="xs" color="muted">
            {t(
              "chorister_hub.identity.subtitle",
              "Twoja historia w zespole — zagregowana z zakończonych projektów",
            )}
          </Text>
        </div>
      </div>

      {metrics.total_concerts === 0 ? (
        <GlassCard
          variant="ethereal"
          padding="lg"
          isHoverable={false}
          className="py-10 text-center"
        >
          <Star
            size={28}
            className="mx-auto mb-3 text-ethereal-graphite/25"
            aria-hidden="true"
          />
          <Text color="muted" size="sm">
            {t(
              "chorister_hub.identity.no_history",
              "Historia pojawi się po Twoim pierwszym zakończonym projekcie.",
            )}
          </Text>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {/* ── passport metrics ─────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricTile
              icon={<Trophy size={16} aria-hidden="true" />}
              value={metrics.total_concerts}
              label={t("chorister_hub.identity.metric_concerts", "Wykonane koncerty")}
            />
            <MetricTile
              icon={<Music size={16} aria-hidden="true" />}
              value={metrics.total_pieces}
              label={t("chorister_hub.passport.metric_pieces", "Utwory w repertuarze")}
            />
            <MetricTile
              icon={<Feather size={16} aria-hidden="true" />}
              value={metrics.total_composers}
              label={t("chorister_hub.passport.metric_composers", "Kompozytorzy")}
            />
            <MetricTile
              icon={<CalendarDays size={16} aria-hidden="true" />}
              value={metrics.active_seasons}
              label={t("chorister_hub.identity.metric_seasons", "Aktywne sezony")}
              subLabel={seasonsSubLabel}
            />
          </div>

          {/* ── private attendance note ──────────────────────────────── */}
          {metrics.attendance_rate != null && (
            <GlassCard variant="light" padding="sm" isHoverable={false}>
              <div className="flex items-center gap-3">
                <HeartPulse
                  size={15}
                  className="shrink-0 text-ethereal-gold"
                  aria-hidden="true"
                />
                <Text size="sm" className="flex-1">
                  {t(
                    "chorister_hub.passport.attendance",
                    "Twoja frekwencja na próbach: {{rate}}%",
                    { rate: metrics.attendance_rate },
                  )}
                </Text>
                <Caption color="muted" className="hidden shrink-0 sm:block">
                  {t(
                    "chorister_hub.passport.attendance_private",
                    "Widoczne tylko dla Ciebie",
                  )}
                </Caption>
              </div>
            </GlassCard>
          )}

          {/* ── repertoire passport ──────────────────────────────────── */}
          <GlassCard variant="ethereal" padding="lg" isHoverable={false}>
            <div className="mb-3 flex items-center gap-2 border-b border-ethereal-incense/15 pb-3">
              <ScrollText size={14} className="text-ethereal-gold" aria-hidden="true" />
              <Eyebrow color="muted">
                {t("chorister_hub.passport.repertoire_title", "Paszport repertuarowy")}
              </Eyebrow>
            </div>
            {metrics.repertoire.length > 0 ? (
              <div className="max-h-[48dvh] overflow-y-auto no-scrollbar">
                {metrics.repertoire.map((entry) => (
                  <RepertoireRow key={entry.piece_id} entry={entry} />
                ))}
              </div>
            ) : (
              <Text size="sm" color="muted" className="py-4 text-center italic">
                {t(
                  "chorister_hub.passport.repertoire_empty",
                  "Brak danych o obsadzie dla zakończonych projektów.",
                )}
              </Text>
            )}
          </GlassCard>

          {/* ── voice lines + seasons ────────────────────────────────── */}
          <GlassCard variant="ethereal" padding="lg" isHoverable={false}>
            <VocalDistributionGrid
              distribution={metrics.vocal_line_distribution}
              maxCount={maxCount}
            />

            {metrics.season_years.length > 0 && (
              <div className="mt-5 border-t border-ethereal-incense/15 pt-4">
                <Eyebrow color="muted" className="mb-2">
                  {t("chorister_hub.identity.season_timeline", "Oś czasu sezonów")}
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
