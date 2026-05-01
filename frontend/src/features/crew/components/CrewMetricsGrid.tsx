/**
 * @file CrewMetricsGrid.tsx
 * @description Numeric KPI strip for the crew dashboard.
 * Aligned with the Archive metric model (GlassCard surfaces + accent tokens).
 * @architecture Enterprise SaaS 2026
 * @module features/crew/components/CrewMetricsGrid
 */

import React from "react";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";
import { Building2, Mail, Phone, Users } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";

import type { CrewMetrics } from "../hooks/useCrewData";

type MetricAccent = "default" | "gold" | "crimson" | "sage";

interface CrewMetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  description?: string;
  icon: LucideIcon;
  accent?: MetricAccent;
}

interface CrewMetricsGridProps {
  metrics: CrewMetrics;
  emailCoverage: number;
  phoneCoverage: number;
}

const ACCENT_CLASSES: Record<
  MetricAccent,
  { container: string; icon: string; label: string; value: string }
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
  sage: {
    container: "border-ethereal-sage/25",
    icon: "text-ethereal-sage",
    label: "text-ethereal-sage/80",
    value: "text-ethereal-sage",
  },
};

function CrewMetricCard({
  label,
  value,
  unit,
  description,
  icon: Icon,
  accent = "default",
}: CrewMetricCardProps): React.JSX.Element {
  const styles = ACCENT_CLASSES[accent];

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

        {description && (
          <Text size="xs" color="graphite" className="mt-3">
            {description}
          </Text>
        )}
      </div>
    </GlassCard>
  );
}

export function CrewMetricsGrid({
  metrics,
  emailCoverage,
  phoneCoverage,
}: CrewMetricsGridProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <CrewMetricCard
        label={t("crew.metrics.people", "Współpracownicy")}
        value={metrics.totalPeople}
        icon={Users}
      />
      <CrewMetricCard
        label={t("crew.metrics.email_coverage", "Pokrycie e-mail")}
        value={emailCoverage}
        unit="%"
        description={t("crew.metrics.email_desc", "{{value}} osób z e-mailem", {
          value: metrics.withEmail,
        })}
        icon={Mail}
        accent="gold"
      />
      <CrewMetricCard
        label={t("crew.metrics.phone_coverage", "Pokrycie telefon")}
        value={phoneCoverage}
        unit="%"
        description={t(
          "crew.metrics.phone_desc",
          "{{value}} osób z telefonem",
          { value: metrics.withPhone },
        )}
        icon={Phone}
        accent="sage"
      />
      <CrewMetricCard
        label={t("crew.metrics.companies", "Firmy partnerskie")}
        value={metrics.uniqueCompanies}
        icon={Building2}
        accent="crimson"
      />
    </div>
  );
}
