/**
 * @file TelemetryWidget.tsx
 * @description System KPIs and SATB Readiness visualization.
 * Refactored to Ethereal UI (2026): Alabaster aesthetics and soft-light telemetry.
 * @architecture Enterprise SaaS 2026
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
  adminStats: AdminTelemetryStatsDto;
}

export function TelemetryWidget({
  adminStats,
}: TelemetryWidgetProps): React.JSX.Element {
  const { t } = useTranslation();

  /**
   * Semantic Voice Mapping:
   * S - Gold (Light/Sun)
   * A - Amethyst (Depth/Spirit)
   * T - Sage (Nature/Air)
   * B - Incense (Foundation/Earth)
   */
  const voices = [
    { label: "S", val: adminStats.satb.S, colorClass: "bg-ethereal-gold" },
    { label: "A", val: adminStats.satb.A, colorClass: "bg-ethereal-amethyst" },
    { label: "T", val: adminStats.satb.T, colorClass: "bg-ethereal-sage" },
    { label: "B", val: adminStats.satb.B, colorClass: "bg-ethereal-incense" },
  ];

  return (
    <GlassCard
      variant="solid"
      className="h-full p-6 flex flex-col justify-between overflow-hidden relative border-ethereal-incense/10 shadow-[0_4px_20px_rgba(0,0,0,0.02)]"
    >
      {/* Soft Gold Epiphany Glow */}
      <div
        className="absolute -top-20 -right-20 w-40 h-40 bg-ethereal-gold/10 rounded-full blur-[60px] pointer-events-none"
        aria-hidden="true"
      />

      <div>
        <div className="flex items-center gap-2 mb-6">
          <Activity
            size={14}
            className="text-ethereal-sage"
            aria-hidden="true"
          />
          <span className="text-[9px] font-bold uppercase tracking-widest text-ethereal-graphite">
            {t("dashboard.admin.kpi_telemetry", "Telemetria Zespołu")}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="group/kpi transition-transform duration-500 hover:translate-y-[-2px]">
            <p className="text-[9px] font-bold uppercase tracking-wider text-ethereal-incense mb-1">
              {t("dashboard.admin.kpi_pieces", "Baza Utworów")}
            </p>
            <p className="text-2xl font-black text-ethereal-ink tracking-tight">
              {adminStats.totalPieces}
            </p>
          </div>
          <div className="group/kpi transition-transform duration-500 hover:translate-y-[-2px]">
            <p className="text-[9px] font-bold uppercase tracking-wider text-ethereal-incense mb-1">
              {t("dashboard.admin.kpi_active_projects", "Aktywne Projekty")}
            </p>
            <p className="text-2xl font-black text-ethereal-gold tracking-tight">
              {adminStats.activeProjects}
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-ethereal-incense/10 pt-4 mt-auto">
        <div className="flex justify-between items-center mb-4">
          <p className="text-[9px] font-bold uppercase tracking-wider text-ethereal-graphite">
            {t("dashboard.admin.kpi_readiness", "Gotowość Zespołu")}
          </p>
          <span className="text-[9px] font-bold text-ethereal-ink bg-ethereal-gold/10 px-2 py-0.5 rounded-full border border-ethereal-gold/20">
            {adminStats.satb.Total} {t("common.persons_short", "os.")}
          </span>
        </div>

        <div
          className="space-y-3"
          role="list"
          aria-label={t(
            "dashboard.admin.satb_distribution",
            "Rozkład głosów SATB",
          )}
        >
          {voices.map((v) => (
            <div key={v.label} className="group/bar">
              <ProgressBar
                label={v.label}
                value={v.val}
                total={adminStats.satb.Total}
                colorClass={cn(
                  v.colorClass,
                  "shadow-[0_0_8px_rgba(0,0,0,0.05)]",
                )}
              />
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
