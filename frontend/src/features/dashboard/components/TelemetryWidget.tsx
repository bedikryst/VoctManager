/**
 * @file TelemetryWidget.tsx
 * @description Ensemble Resonance and SATB Cohesion visualisation.
 * Refactored using Ethereal UI Primitives & Composites.
 * @architecture Enterprise SaaS 2026
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AudioLines, Library, Zap } from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { SectionHeader } from "@/shared/ui/composites/SectionHeader";
import { MetricBlock } from "@/shared/ui/composites/MetricBlock";
import { Eyebrow, Text, Unit } from "@/shared/ui/primitives/typography";
import { Divider } from "@/shared/ui/primitives/Divider";
import { ResonancePillar } from "@/shared/ui/kinematics/ResonancePillar";
import { KineticGlow } from "@/shared/ui/kinematics/KineticGlow";

export interface VoiceStatsDto {
  S: number;
  MEZ: number;
  A: number;
  CT: number;
  T: number;
  BAR: number;
  B: number;
  Total: number;
}

export interface AdminTelemetryStatsDto {
  totalPieces: number;
  activeProjects: number;
  satb: VoiceStatsDto;
}

export interface TelemetryWidgetProps {
  adminStats?: AdminTelemetryStatsDto;
}

export function TelemetryWidget({
  adminStats,
}: TelemetryWidgetProps): React.JSX.Element {
  const { t } = useTranslation();

  const stats = adminStats ?? {
    totalPieces: 0,
    activeProjects: 0,
    satb: { S: 0, MEZ: 0, A: 0, CT: 0, T: 0, BAR: 0, B: 0, Total: 0 },
  };

  const voices = useMemo(
    () => [
      {
        label: "S",
        val: stats.satb.S + stats.satb.MEZ,
        voiceType: "S" as const,
      },
      {
        label: "A",
        val: stats.satb.A + stats.satb.CT,
        voiceType: "A" as const,
      },
      { label: "T", val: stats.satb.T, voiceType: "T" as const },
      {
        label: "B",
        val: stats.satb.B + stats.satb.BAR,
        voiceType: "B" as const,
      },
    ],
    [stats.satb],
  );

  const maxVoiceVal = Math.max(...voices.map((v) => v.val), 1);

  return (
    <GlassCard
      variant="light"
      withNoise
      className="isolate flex h-full w-full flex-col justify-between p-6 md:p-8 xl:p-10 pb-4 md:pb-5 xl:pb-6"
    >
      {/* UPPER STRATUM: Resonance Metrics */}
      <section className="relative z-10 flex flex-col">
        <SectionHeader
          title={t("dashboard.admin.kpi_telemetry", "Telemetria Bazy")}
          icon={<AudioLines size={16} strokeWidth={1.5} />}
        />

        <div className="grid grid-cols-2 gap-2 xl:gap-8 relative">
          <MetricBlock
            label={t("dashboard.admin.kpi_pieces", "Repertuar Sakralny")}
            value={stats.totalPieces}
          />

          <div className="relative pl-8">
            <Divider
              variant="gradient-bottom"
              orientation="vertical"
              position="absolute-left"
            />
            <MetricBlock
              label={t(
                "dashboard.admin.kpi_active_projects",
                "Aktywne Dyrektywy",
              )}
              value={stats.activeProjects}
              accentColor="gold"
            />
          </div>
        </div>
      </section>

      {/* LOWER STRATUM: SATB Harmonic Cohesion */}
      <section className="relative z-10 mt-8 flex flex-col">
        <header className="mb-10 flex items-baseline justify-between pt-4 relative">
          <Divider
            variant="gradient-right"
            position="absolute-top"
            className="opacity-50"
          />

          <Eyebrow color="muted">
            {t("dashboard.admin.kpi_readiness", "Spójność Harmoniczna")}
          </Eyebrow>

          <div
            className="flex items-baseline gap-1"
            aria-label="Total ensemble voices"
          >
            <Text className="tabular-nums">{stats.satb.Total}</Text>
            <Unit size="sm" color="muted">
              voc.
            </Unit>
          </div>
        </header>

        <div
          className="flex h-28 items-end justify-between px-2"
          role="list"
          aria-label={t(
            "dashboard.admin.satb_distribution",
            "Dystrybucja Głosów SATB",
          )}
        >
          {voices.map((v, index) => (
            <ResonancePillar
              key={v.label}
              value={v.val}
              heightPercentage={`${(v.val / maxVoiceVal) * 100}%`}
              delayIndex={index}
              label={v.label}
              voice={v.voiceType}
            />
          ))}
        </div>
      </section>
    </GlassCard>
  );
}
