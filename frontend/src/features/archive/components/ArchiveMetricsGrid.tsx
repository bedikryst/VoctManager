/**
 * @file ArchiveMetricsGrid.tsx
 * @description Archive-specific metric cards aligned with the GlassCard surface model.
 * Removes nested white surfaces to keep visual hierarchy consistent with the design system.
 * @architecture Enterprise SaaS 2026
 */

import React from "react";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";
import { FileText, Headphones, Library, Users } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Heading, Text, Eyebrow } from "@/shared/ui/primitives/typography";

type MetricAccent = "default" | "gold" | "crimson";

interface ArchiveMetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  accent?: MetricAccent;
}

interface ArchiveMetricsGridProps {
  totalPieces: number;
  pdfCoverage: number;
  uniqueComposers: number;
  totalAudio: number;
}

const accentClasses: Record<
  MetricAccent,
  {
    container: string;
    icon: string;
    label: string;
    value: string;
  }
> = {
  default: {
    container: "border-ethereal-incense/20",
    icon: "text-ethereal-graphite/70",
    label: "text-ethereal-incense/70",
    value: "text-ethereal-ink",
  },
  gold: {
    container: "border-ethereal-gold/25",
    icon: "text-ethereal-gold",
    label: "text-ethereal-gold/80",
    value: "text-ethereal-gold",
  },
  crimson: {
    container: "border-ethereal-crimson/20",
    icon: "text-ethereal-crimson",
    label: "text-ethereal-crimson/80",
    value: "text-ethereal-crimson",
  },
};

function ArchiveMetricCard({
  label,
  value,
  unit,
  icon: Icon,
  accent = "default",
}: ArchiveMetricCardProps): React.JSX.Element {
  const styles = accentClasses[accent];

  return (
    <GlassCard
      variant="ethereal"
      padding="none"
      isHoverable={false}
      className={cn("overflow-hidden", styles.container)}
    >
      <div className="p-5 md:p-6">
        <div className={cn("flex items-center gap-2", styles.label)}>
          <Icon size={14} strokeWidth={1.5} className={styles.icon} />
          <Eyebrow color="inherit">{label}</Eyebrow>
        </div>

        <div className="mt-4 flex items-end gap-2">
          <Heading
            as="p"
            size="4xl"
            className={cn("leading-none", styles.value)}
          >
            {value}
          </Heading>
          {unit && (
            <Text size="sm" color="graphite" className="pb-1">
              {unit}
            </Text>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

export function ArchiveMetricsGrid({
  totalPieces,
  pdfCoverage,
  uniqueComposers,
  totalAudio,
}: ArchiveMetricsGridProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <ArchiveMetricCard
        label={t("archive.metrics.pieces", "Utwory")}
        value={totalPieces}
        icon={Library}
      />
      <ArchiveMetricCard
        label={t("archive.metrics.pdf", "Pokrycie nut")}
        value={pdfCoverage}
        unit="%"
        icon={FileText}
        accent="gold"
      />
      <ArchiveMetricCard
        label={t("archive.metrics.composers", "Kompozytorzy")}
        value={uniqueComposers}
        icon={Users}
      />
      <ArchiveMetricCard
        label={t("archive.metrics.audio", "Ścieżki audio")}
        value={totalAudio}
        icon={Headphones}
        accent="crimson"
      />
    </div>
  );
}
