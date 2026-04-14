/**
 * @file TelemetryWidget.tsx
 * @description System KPIs and SATB Readiness visualisation.
 * Refactored to Ethereal UI (2026): Alabaster aesthetics, soft-light telemetry,
 * and monumental serif typography. Introduces 'Resonance Pillars' for SATB.
 * @architecture Enterprise SaaS 2026
 * @module panel/dashboard/components/TelemetryWidget
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Activity, LucideSunMedium, MusicIcon } from "lucide-react";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
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

const EtherealEasing = [0.16, 1, 0.3, 1] as const;

export function TelemetryWidget({
  adminStats,
}: TelemetryWidgetProps): React.JSX.Element {
  const { t } = useTranslation();

  const stats = adminStats ?? {
    totalPieces: 0,
    activeProjects: 0,
    satb: { S: 0, A: 0, T: 0, B: 0, Total: 0 },
  };

  /**
   * Semantic Voice Mapping (SATB).
   * Defines 'Resonance Pillars' colors and bespoke shadows for the ethereal glow.
   */
  const voices = useMemo(
    () => [
      {
        label: "S",
        val: stats.satb.S,
        color: "bg-ethereal-gold",
        shadow: "shadow-[0_0_16px_rgba(194,168,120,0.6)]",
      },
      {
        label: "A",
        val: stats.satb.A,
        color: "bg-ethereal-amethyst",
        shadow: "shadow-[0_0_16px_rgba(155,138,164,0.6)]",
      },
      {
        label: "T",
        val: stats.satb.T,
        color: "bg-ethereal-sage",
        shadow: "shadow-[0_0_16px_rgba(143,154,138,0.6)]",
      },
      {
        label: "B",
        val: stats.satb.B,
        color: "bg-ethereal-incense",
        shadow: "shadow-[0_0_16px_rgba(166,146,121,0.6)]",
      },
    ],
    [stats.satb],
  );

  // Calculate dynamic scale for the equalizer effect
  const maxVoiceVal = Math.max(...voices.map((v) => v.val), 1);

  return (
    <GlassCard
      variant="light"
      withNoise
      className="flex h-full w-full flex-col justify-between p-8 md:p-10"
    >
      {/* UPPER STRATUM: KPIs */}
      <div className="relative z-10 flex flex-col">
        <header className="mb-8 flex items-center gap-3 border-b border-ethereal-incense/15 pb-5">
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
      <div className="relative z-10 mt-12 flex flex-col">
        <div className="mb-6 flex items-baseline justify-between border-t border-ethereal-incense/10 pt-6">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-ethereal-graphite/60">
            {t("dashboard.admin.kpi_readiness", "Gotowość Głosów")}
          </h3>
          <span className="text-[11px] font-medium tracking-widest text-ethereal-ink tabular-nums">
            {stats.satb.Total}
          </span>
        </div>

        {/* The Acoustic Equalizer */}
        <div
          className="flex h-24 items-end justify-between px-2"
          role="list"
          aria-label={t(
            "dashboard.admin.satb_distribution",
            "Dystrybucja Głosów SATB",
          )}
        >
          {voices.map((v, index) => {
            const heightPercentage = `${(v.val / maxVoiceVal) * 100}%`;

            return (
              <div
                key={v.label}
                className="group relative flex h-full w-12 flex-col items-center justify-end"
                role="listitem"
              >
                {/* Value Tooltip (Appears on hover) */}
                <span className="absolute -top-6 text-[11px] font-bold text-ethereal-ink opacity-0 transition-opacity duration-500 group-hover:opacity-100 tabular-nums">
                  {v.val}
                </span>

                {/* The Track (Background) */}
                <div className="relative flex h-full w-[2px] flex-col justify-end overflow-visible bg-ethereal-incense/10 rounded-full">
                  {/* The Pillar (Active Fill with Kinematics) */}
                  <motion.div
                    initial={{ height: "0%" }}
                    animate={{ height: heightPercentage }}
                    transition={{
                      duration: 1.8,
                      delay: 0.4 + index * 0.1, // Staggered entry matching music notation
                      ease: EtherealEasing,
                    }}
                    className={cn(
                      "w-full rounded-full transition-all duration-700",
                      v.color,
                      "group-hover:w-[4px] group-hover:-ml-[1px]", // Subtle expansion on hover
                      v.shadow, // Applies bespoke glow
                    )}
                    aria-hidden="true"
                  />
                </div>

                {/* Voice Label */}
                <span className="mt-3 text-[10px] font-bold text-ethereal-graphite/60 transition-colors duration-500 group-hover:text-ethereal-ink">
                  {v.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
}
