/**
 * @file SpotlightProjectCard.tsx
 * @description Solves the overflow clipping issue by decoupling clipping from the parent.
 * Strictly typed and fully internationalized for the VoctEnsemble SaaS.
 * @architecture Enterprise SaaS 2026
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
} from "lucide-react";

import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { DualTimeDisplay } from "@/shared/widgets/utility/DualTimeDisplay";
import { LocationPreview } from "../../logistics/components/LocationPreview";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { cn } from "@/shared/lib/utils";
import type { Project } from "@/shared/types";

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

  return (
    <Link
      to="/panel/projects"
      className="block h-full outline-none group/project active:scale-[0.99] transition-transform"
      aria-label={
        project
          ? project.title
          : t("dashboard.admin.no_active_events", "Brak aktywnych wydarzeń")
      }
    >
      <GlassCard
        variant="solid"
        className="h-full flex flex-col justify-between !overflow-visible relative z-10"
      >
        <div
          className={cn(
            "absolute inset-0 rounded-[inherit] overflow-hidden -z-10 transition-all duration-300",
            "bg-white/40 group-hover/project:bg-white/60 group-hover/project:border-brand/30 group-hover/project:shadow-md",
          )}
          aria-hidden="true"
        />

        <div className="p-6 flex-1 rounded-t-[inherit]">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={14} className="text-brand" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400 group-hover/project:text-brand transition-colors">
              {t("dashboard.admin.spotlight_title", "Wydarzenie Główne")}
            </span>
          </div>

          {project && stats ? (
            <div className="flex flex-col h-full justify-between">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold font-serif text-stone-900 tracking-tight leading-tight mb-4 group-hover/project:text-brand transition-colors">
                  {project.title}
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-stone-700 mb-6">
                  <span className="flex items-center gap-1.5 bg-stone-50 px-2.5 py-1.5 rounded-lg border border-stone-200/80">
                    <Calendar size={12} className="text-brand" />
                    {formatLocalizedDate(
                      project.date_time,
                      { day: "numeric", month: "short", year: "numeric" },
                      undefined,
                      project.timezone,
                    )}
                  </span>
                  <DualTimeDisplay
                    value={project.date_time}
                    timeZone={project.timezone}
                    icon={<Clock size={12} className="text-brand" />}
                  />
                  {project.location && (
                    <div className="flex items-center bg-stone-50 px-2.5 py-1.5 rounded-lg border border-stone-200/80 z-[100]">
                      <LocationPreview
                        locationRef={project.location}
                        fallback={t("dashboard.admin.no_location", "TBA")}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center h-full opacity-60">
              <Briefcase size={24} className="text-stone-300 mb-3" />
              <p className="text-xs font-bold text-stone-500 mb-1">
                {t(
                  "dashboard.admin.no_active_events",
                  "Brak aktywnych wydarzeń",
                )}
              </p>
            </div>
          )}
        </div>

        {project && stats && (
          <div className="p-6 pt-0 mt-auto rounded-b-[inherit]">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-t border-stone-200/80 pt-4">
              <div className="flex gap-6">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1">
                    <ListOrdered size={10} />{" "}
                    {t("dashboard.admin.repertoire", "Repertuar")}
                  </span>
                  <span className="text-xs font-bold text-stone-800">
                    {t("dashboard.admin.pieces_count", "{{count}} utworów", {
                      count: stats.piecesCount,
                    })}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1">
                    <MicVocal size={10} />{" "}
                    {t("dashboard.admin.to_concert", "Do koncertu")}
                  </span>
                  <span className="text-xs font-bold text-stone-800">
                    {t("dashboard.admin.rehearsals_left", "{{count}} prób", {
                      count: stats.rehearsalsLeft,
                    })}
                  </span>
                </div>
              </div>

              <div className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-stone-900 group-hover/project:bg-brand text-white text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all shadow-sm">
                {t("dashboard.admin.open_project", "Otwórz Projekt")}
                <ArrowRight
                  size={14}
                  className="transform group-hover/project:translate-x-1 transition-transform"
                />
              </div>
            </div>
          </div>
        )}
      </GlassCard>
    </Link>
  );
}
