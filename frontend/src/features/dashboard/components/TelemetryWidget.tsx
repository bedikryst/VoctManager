/**
 * @file TelemetryWidget.tsx
 * @description Ensemble Resonance and SATB Cohesion visualisation.
 * Escapes rigid SaaS borders in favor of fluid spatial tension and semantic typography.
 * @architecture Enterprise SaaS 2026
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AudioLines } from "lucide-react";
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
      className="flex h-full w-full flex-col justify-between p-8 md:p-10 pb-4 md:pb-5 isolate"
    >
      {/* UPPER STRATUM: Resonance Metrics */}
      <section className="relative z-10 flex flex-col">
        <header className="mb-6 flex items-center gap-3 pb-5 relative">
          <AudioLines
            size={16}
            strokeWidth={1.5}
            className="text-ethereal-gold"
            aria-hidden="true"
          />
          <h2 className="text-[9px] font-bold uppercase tracking-[0.3em] text-ethereal-graphite">
            {t("dashboard.admin.kpi_telemetry", "Ensemble Resonance")}
          </h2>
          {/* Fluid separator instead of border-b */}
          <div className="absolute bottom-0 left-0 h-[1px] w-full bg-gradient-to-r from-ethereal-incense/20 to-transparent" />
        </header>

        <div className="grid grid-cols-2 gap-8 relative">
          <article className="group flex cursor-default flex-col gap-1">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-ethereal-incense/60 transition-colors duration-500 group-hover:text-ethereal-gold">
              {t("dashboard.admin.kpi_pieces", "Repertuar Sakralny")}
            </h3>
            <p className="font-serif text-5xl font-light tracking-tight text-ethereal-ink lg:text-6xl">
              {stats.totalPieces}
            </p>
          </article>

          <article className="group flex cursor-default flex-col gap-1 relative pl-8">
            {/* Fluid vertical separator */}
            <div className="absolute inset-y-0 left-0 w-[1px] bg-gradient-to-b from-ethereal-incense/15 to-transparent" />
            <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-ethereal-incense/60 transition-colors duration-500 group-hover:text-ethereal-gold">
              {t("dashboard.admin.kpi_active_projects", "Aktywne Dyrektywy")}
            </h3>
            <p className="font-serif text-5xl font-light tracking-tight text-ethereal-gold lg:text-6xl">
              {stats.activeProjects}
            </p>
          </article>
        </div>
      </section>

      {/* LOWER STRATUM: SATB Harmonic Cohesion */}
      <section className="relative z-10 mt-8 flex flex-col">
        <header className="mb-10 flex items-baseline justify-between pt-4 relative">
          {/* Soft top gradient line */}
          <div className="absolute top-0 left-0 h-[1px] w-full bg-gradient-to-r from-ethereal-incense/15 via-ethereal-incense/5 to-transparent" />

          <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-ethereal-graphite/60">
            {t("dashboard.admin.kpi_readiness", "Spójność Harmoniczna")}
          </h3>
          <span
            className="tabular-nums text-[12px] font-medium tracking-widest text-ethereal-ink"
            aria-label="Total ensemble voices"
          >
            {stats.satb.Total}{" "}
            <span className="font-serif italic text-ethereal-graphite/50 text-[10px] lowercase tracking-normal">
              voc.
            </span>
          </span>
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
