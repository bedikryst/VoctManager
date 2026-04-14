/**
 * @file SpotlightProjectCard.tsx
 * @description Transcendent View for the Main Production Event.
 * Refactored to Ethereal UI Standards (2026): Zero Tech-Debt & Semantic Colour Space.
 * Features a solid foundation reveal on interaction and enriched project telemetry.
 * @architecture Enterprise SaaS 2026
 * @module panel/dashboard/components/SpotlightProjectCard
 */

import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Calendar,
  Clock,
  ListOrdered,
  MicVocal,
  ArrowRight,
  Briefcase,
  Users,
  ClipboardList,
} from "lucide-react";

import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { DualTimeDisplay } from "@/shared/widgets/utility/DualTimeDisplay";
import { LocationPreview } from "../../logistics/components/LocationPreview";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { cn } from "@/shared/lib/utils";
import type { Project } from "@/shared/types";
import { buttonVariants } from "@/shared/ui/primitives/Button";

export interface SpotlightProjectStats {
  piecesCount: number;
  rehearsalsLeft: number;
}

export interface SpotlightProjectCardProps {
  project: Project | null;
  stats: SpotlightProjectStats | null;
}

export function SpotlightProjectCard({
  project,
  stats,
}: SpotlightProjectCardProps): React.JSX.Element {
  const { t } = useTranslation();

  const castSize = project?.cast?.length ?? 0;
  const hasRunSheet = project?.run_sheet && project.run_sheet.length > 0;

  return (
    <Link
      to={project ? `/panel/projects/${project.id}` : "/panel/projects"}
      className="block h-full outline-none group/project active:scale-[0.99] transition-all duration-500 rounded-[2.5rem] focus-visible:ring-2 focus-visible:ring-ethereal-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-ethereal-alabaster"
      aria-label={
        project
          ? project.title
          : t("dashboard.admin.no_active_events", "Brak aktywnych wydarzeń")
      }
    >
      <GlassCard
        variant="light"
        withNoise
        padding="none"
        className={cn(
          "h-full flex flex-col justify-between !overflow-visible relative z-10 transition-all duration-700 ease-out",
          "border-white/60 group-hover/project:border-ethereal-gold/40",
          "group-hover/project:shadow-[0_16px_48px_rgba(194,168,120,0.15)]",
        )}
      >
        {/* Subtle Background Glow Overlay */}
        <div
          className={cn(
            "absolute inset-0 rounded-[inherit] overflow-hidden -z-10 transition-all duration-700 pointer-events-none",
            "bg-gradient-to-br from-transparent to-transparent group-hover/project:from-ethereal-gold/5 group-hover/project:to-ethereal-sage/5",
          )}
          aria-hidden="true"
        />

        <div className="p-8 flex-1 rounded-t-[inherit]">
          <div className="flex items-center gap-2 mb-6">
            <Calendar size={16} className="text-ethereal-gold" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-ethereal-graphite group-hover/project:text-ethereal-gold transition-colors duration-500">
              {t("dashboard.admin.spotlight_title", "Wydarzenie Główne")}
            </span>
          </div>

          {project && stats ? (
            <div className="flex flex-col h-full justify-start relative z-10">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold font-serif text-ethereal-ink tracking-tight leading-tight mb-6 group-hover/project:text-ethereal-gold transition-colors duration-700">
                {project.title}
              </h2>

              <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold text-ethereal-graphite">
                <span className="flex items-center gap-2 bg-white/60 backdrop-blur-md px-3 py-2 rounded-xl border border-ethereal-incense/10 shadow-sm transition-colors duration-300 group-hover/project:border-ethereal-gold/30">
                  <Calendar size={14} className="text-ethereal-gold" />
                  {formatLocalizedDate(
                    project.date_time,
                    { day: "numeric", month: "short", year: "numeric" },
                    undefined,
                    project.timezone,
                  )}
                </span>

                <div className="bg-white/60 backdrop-blur-md px-3 py-2 rounded-xl border border-ethereal-incense/10 shadow-sm flex items-center transition-colors duration-300 group-hover/project:border-ethereal-gold/30">
                  <DualTimeDisplay
                    value={project.date_time}
                    timeZone={project.timezone}
                    typography={"sans"}
                    timeClassName="text-[11px]"
                    icon={
                      <Clock size={14} className="text-ethereal-gold mr-2" />
                    }
                  />
                </div>

                {project.location && (
                  <div className="flex items-center bg-white/60 backdrop-blur-md rounded-xl shadow-sm transition-colors duration-300 group-hover/project:border-ethereal-gold/30">
                    <LocationPreview
                      locationRef={project.location}
                      fallback={t("dashboard.admin.no_location", "TBA")}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center h-full opacity-60">
              <Briefcase size={32} className="text-ethereal-incense/40 mb-3" />
              <p className="text-xs font-bold uppercase tracking-widest text-ethereal-graphite">
                {t(
                  "dashboard.admin.no_active_events",
                  "Brak aktywnych wydarzeń",
                )}
              </p>
            </div>
          )}
        </div>

        {/* Foundation Strip (Rozświetla się na biało przy najechaniu) */}
        {project && stats && (
          <div className="mt-auto rounded-b-[inherit] bg-transparent group-hover/project:bg-white/60 border-t border-ethereal-incense/15 group-hover/project:border-transparent transition-all duration-700 p-6 md:p-8">
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
              <div className="flex flex-wrap gap-x-8 gap-y-4">
                {/* Metryka 1: Repertuar */}
                <div className="flex flex-col gap-1.5 cursor-default">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-ethereal-graphite flex items-center gap-1.5 opacity-80">
                    <ListOrdered size={12} className="text-ethereal-sage" />{" "}
                    {t("dashboard.admin.repertoire", "Repertuar")}
                  </span>
                  <span className="text-sm font-bold text-ethereal-ink tabular-nums">
                    {t("dashboard.admin.pieces_count", "{{count}} utworów", {
                      count: stats.piecesCount,
                    })}
                  </span>
                </div>

                {/* Metryka 2: Próby */}
                <div className="flex flex-col gap-1.5 cursor-default">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-ethereal-graphite flex items-center gap-1.5 opacity-80">
                    <MicVocal size={12} className="text-ethereal-amethyst" />{" "}
                    {t("dashboard.admin.to_concert", "Do koncertu")}
                  </span>
                  <span className="text-sm font-bold text-ethereal-ink tabular-nums">
                    {t("dashboard.admin.rehearsals_left", "{{count}} prób", {
                      count: stats.rehearsalsLeft,
                    })}
                  </span>
                </div>

                {/* Metryka 3: Obsada (Nowość) */}
                <div className="flex flex-col gap-1.5 cursor-default">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-ethereal-graphite flex items-center gap-1.5 opacity-80">
                    <Users size={12} className="text-ethereal-gold" />{" "}
                    {t("dashboard.admin.cast_size", "Obsada")}
                  </span>
                  <span className="text-sm font-bold text-ethereal-ink tabular-nums">
                    {t("dashboard.admin.cast_count", "{{count}} artystów", {
                      count: castSize,
                    })}
                  </span>
                </div>

                {/* Metryka 4: Run-sheet (Nowość) */}
                <div className="flex flex-col gap-1.5 cursor-default">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-ethereal-graphite flex items-center gap-1.5 opacity-80">
                    <ClipboardList
                      size={12}
                      className="text-ethereal-incense"
                    />{" "}
                    {t("dashboard.admin.run_sheet", "Plan Dnia")}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-bold tabular-nums transition-colors duration-300",
                      hasRunSheet
                        ? "text-ethereal-sage"
                        : "text-ethereal-graphite/60",
                    )}
                  >
                    {hasRunSheet
                      ? t("common.ready", "Gotowy")
                      : t("common.pending", "Oczekuje")}
                  </span>
                </div>
              </div>

              <div
                className={cn(
                  buttonVariants({ variant: "primary", size: "default" }),
                  "shrink-0 shadow-lg group-hover/project:bg-ethereal-gold group-hover/project:text-white group-hover/project:border-ethereal-gold group-hover/project:shadow-xl group-hover/project:shadow-ethereal-gold/20",
                )}
              >
                {t("dashboard.admin.open_project", "Otwórz Projekt")}
                <ArrowRight
                  size={16}
                  strokeWidth={2}
                  className="transform group-hover/project:translate-x-1.5 transition-transform duration-500"
                />
              </div>
            </div>
          </div>
        )}
      </GlassCard>
    </Link>
  );
}
