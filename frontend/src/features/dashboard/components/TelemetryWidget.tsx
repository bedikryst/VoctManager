/**
 * @file TelemetryWidget.tsx
 * @description System KPIs and SATB Readiness visualisation.
 * Orchestrates layout and delegates rendering to strict ResonancePillar primitives.
 * @architecture Enterprise SaaS 2026
 * @module panel/dashboard/components/TelemetryWidget
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Activity } from "lucide-react";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { ResonancePillar } from "@/shared/ui/kinematics/ResonancePillar";

export interface VoiceStatsDto {
  S: number;
  A: number;
  T: number;
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
    satb: { S: 0, A: 0, T: 0, B: 0, Total: 0 },
  };

  const voices = useMemo(
    () => [
      { label: "S", val: stats.satb.S, voiceType: "S" as const },
      { label: "A", val: stats.satb.A, voiceType: "A" as const },
      { label: "T", val: stats.satb.T, voiceType: "T" as const },
      { label: "B", val: stats.satb.B, voiceType: "B" as const },
    ],
    [stats.satb],
  );

  const maxVoiceVal = Math.max(...voices.map((v) => v.val), 1);

  return (
    <GlassCard
      variant="light"
      withNoise
      className="flex h-full w-full flex-col justify-between p-8 md:p-10 pb-4 md:pb-5"
    >
      {/* UPPER STRATUM: KPIs */}
      <div className="relative z-10 flex flex-col">
        <header className="mb-6 flex items-center gap-3 border-b border-ethereal-incense/15 pb-5">
          <Activity
            size={14}
            strokeWidth={1.5}
            className="text-ethereal-gold"
            aria-hidden="true"
          />
          <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-ethereal-graphite">
            {t("dashboard.admin.kpi_telemetry", "System Telemetry")}
          </span>
        </header>

        <div className="grid grid-cols-2 gap-6">
          <article className="group flex cursor-default flex-col gap-2">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-ethereal-incense/60 transition-colors duration-500 group-hover:text-ethereal-gold">
              {t("dashboard.admin.kpi_pieces", "Repertoire")}
            </h3>
            <p className="font-serif text-5xl font-medium tracking-tight text-ethereal-ink lg:text-6xl">
              {stats.totalPieces}
            </p>
          </article>
          <article className="group flex cursor-default flex-col gap-2 border-l border-ethereal-incense/10 pl-6">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-ethereal-incense/60 transition-colors duration-500 group-hover:text-ethereal-gold">
              {t("dashboard.admin.kpi_active_projects", "Active Projects")}
            </h3>
            <p className="font-serif text-5xl font-medium tracking-tight text-ethereal-gold lg:text-6xl">
              {stats.activeProjects}
            </p>
          </article>
        </div>
      </div>

      {/* LOWER STRATUM: SATB Resonance Pillars */}
      <div className="relative z-10 mt-6 flex flex-col">
        <div className="mb-11 flex items-baseline justify-between border-t border-ethereal-incense/10 pt-6">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-ethereal-graphite/60">
            {t("dashboard.admin.kpi_readiness", "Gotowość Głosów")}
          </h3>
          <span className="tabular-nums text-[11px] font-medium tracking-widest text-ethereal-ink">
            {stats.satb.Total}
          </span>
        </div>

        <div
          className="flex h-24 items-end justify-between px-2"
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
      </div>
    </GlassCard>
  );
}
