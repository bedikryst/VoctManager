/**
 * @file TelemetryWidget.tsx
 * @description System KPIs and SATB Readiness visualisation.
 * Refactored to Ethereal UI (2026): Alabaster aesthetics, soft-light telemetry,
 * and monumental serif typography for primary metrics. Zero tech-debt.
 * @architecture Enterprise SaaS 2026
 * @module panel/dashboard/components/TelemetryWidget
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Activity } from "lucide-react";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { ProgressBar } from "@/shared/ui/primitives/ProgressBar";
import { cn } from "@/shared/lib/utils";

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

  // Fallback state ensures graceful degradation if telemetry is momentarily unavailable.
  const stats = adminStats ?? {
    totalPieces: 0,
    activeProjects: 0,
    satb: { S: 0, A: 0, T: 0, B: 0, Total: 0 },
  };

  /**
   * Semantic Voice Mapping (SATB).
   * Utilises core Ethereal UI tokens to distinguish vocal registers.
   */
  const voices = [
    { label: "S", val: stats.satb.S, colourClass: "bg-ethereal-gold" },
    { label: "A", val: stats.satb.A, colourClass: "bg-ethereal-amethyst" },
    { label: "T", val: stats.satb.T, colourClass: "bg-ethereal-sage" },
    { label: "B", val: stats.satb.B, colourClass: "bg-ethereal-incense" },
  ];

  return (
    <GlassCard
      variant="light"
      withNoise
      className="h-full p-8 flex flex-col justify-between"
    >
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-8 border-b border-ethereal-incense/15 pb-4">
          <Activity
            size={16}
            strokeWidth={1.5}
            className="text-ethereal-sage"
            aria-hidden="true"
          />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-ethereal-graphite">
            {t("dashboard.admin.kpi_telemetry", "System Telemetry")}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-10">
          <div className="flex flex-col gap-1 cursor-default">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-ethereal-incense">
              {t("dashboard.admin.kpi_pieces", "Repertoire")}
            </p>
            <p className="font-serif text-5xl font-medium text-ethereal-ink tracking-tight">
              {stats.totalPieces}
            </p>
          </div>
          <div className="flex flex-col gap-1 cursor-default">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-ethereal-incense">
              {t("dashboard.admin.kpi_active_projects", "Active Projects")}
            </p>
            <p className="font-serif text-5xl font-medium text-ethereal-gold tracking-tight">
              {stats.activeProjects}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-auto relative z-10">
        <div className="flex justify-between items-baseline mb-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-ethereal-graphite">
            {t("dashboard.admin.kpi_readiness", "Ensemble Readiness")}
          </p>
          <span className="text-[11px] font-bold text-ethereal-ink tabular-nums">
            {stats.satb.Total} {t("common.persons_short", "pax")}
          </span>
        </div>

        <div
          className="space-y-3.5"
          role="list"
          aria-label={t(
            "dashboard.admin.satb_distribution",
            "SATB voice distribution",
          )}
        >
          {voices.map((v) => (
            <div key={v.label} className="group/bar flex items-center gap-3">
              <span className="w-4 text-[11px] font-bold text-ethereal-ink uppercase text-right">
                {v.label}
              </span>
              <div className="flex-1">
                <ProgressBar
                  value={v.val}
                  total={stats.satb.Total || 1} // Prevent division by zero mathematically
                  colorClass={cn(
                    v.colourClass,
                    "h-1.5 transition-all duration-700 ease-out",
                  )}
                  aria-hidden="true"
                  label=""
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
