/**
 * @file SpotlightProjectCard.tsx
 * @description The cinematic centerpiece. Now deeply integrated with
 * temporal logic (Intl date formatting) and spatial kinematics (LocationPreview).
 * @architecture Enterprise SaaS 2026
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Calendar, Users, Music, ArrowUpRight } from "lucide-react";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { LocationPreview } from "@/features/logistics/components/LocationPreview";

const EtherealEasing = [0.16, 1, 0.3, 1] as const;

export interface ProjectStatsDto {
  castCount: number;
  piecesCount: number;
  rehearsalsRemaining: number;
}

export interface SpotlightProjectCardProps {
  project?: {
    id: string;
    title: string;
    conductor?: string;
    locationId?: string;
    locationFallbackName?: string;
    startDate?: string;
    status?: "active" | "upcoming" | "archived";
  };
  stats?: ProjectStatsDto;
}

export function SpotlightProjectCard({
  project,
  stats,
}: SpotlightProjectCardProps): React.JSX.Element {
  const { t, i18n } = useTranslation();

  const formattedDate = useMemo(() => {
    if (!project?.startDate) return null;
    try {
      const date = new Date(project.startDate);
      return new Intl.DateTimeFormat(i18n.language, {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(date);
    } catch {
      return null;
    }
  }, [project?.startDate, i18n.language]);

  if (!project)
    return (
      <div className="h-full min-h-[400px] rounded-[2.5rem] bg-ethereal-incense/5 animate-pulse" />
    );

  const projectStats = stats ?? {
    castCount: 0,
    piecesCount: 0,
    rehearsalsRemaining: 0,
  };

  return (
    <GlassCard
      variant="ethereal"
      padding="none"
      className="group relative flex h-full min-h-[400px] w-full flex-col overflow-hidden transition-all duration-1000 ease-[0.16,1,0.3,1] hover:shadow-[0_32px_64px_rgba(166,146,121,0.15)]"
      backgroundElement={
        <div className="absolute -right-20 -top-20 h-[500px] w-[500px] rounded-full bg-ethereal-gold/10 blur-[120px] transition-transform duration-1000 group-hover:scale-110" />
      }
    >
      {/* 1. STATUS BAR */}
      <div className="relative z-10 flex items-center justify-between px-10 pt-10">
        <div className="flex items-center gap-4">
          <div className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ethereal-gold opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-ethereal-gold" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-ethereal-graphite/60">
            {project.status === "active"
              ? t("dashboard.admin.spotlight.status_active", "W Produkcji")
              : t("dashboard.admin.spotlight.status_prep", "W Przygotowaniu")}
          </span>
        </div>

        <button className="flex h-12 w-12 items-center justify-center rounded-full border border-ethereal-incense/20 bg-white/10 backdrop-blur-md transition-all duration-500 hover:scale-110 hover:border-ethereal-gold/40 hover:bg-white/30">
          <ArrowUpRight
            size={20}
            strokeWidth={1.5}
            className="text-ethereal-ink"
          />
        </button>
      </div>

      {/* 2. CORE CONTENT */}
      <div className="relative z-10 flex flex-1 flex-col justify-center px-10 py-12">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, ease: EtherealEasing }}
        >
          {/* METADATA STRIP: Date & Interactive Location */}
          <div className="mb-4 flex flex-wrap items-center gap-3 text-ethereal-sage">
            {formattedDate && (
              <div className="flex items-center gap-2">
                <Calendar size={12} className="shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
                  {formattedDate}
                </span>
              </div>
            )}

            {formattedDate && (
              <div className="h-1 w-1 rounded-full bg-ethereal-incense/30" />
            )}

            {/* PORTALED LOCATION PREVIEW (Minimal Variant) */}
            <LocationPreview
              locationRef={project.locationId}
              fallback={project.locationFallbackName || "TBA"}
              variant="minimal"
              className="text-[10px] font-bold uppercase tracking-[0.2em]"
            />
          </div>

          <h2 className="mb-6 max-w-2xl font-serif text-5xl leading-[1.1] tracking-tight text-ethereal-ink md:text-6xl">
            {project.title}
          </h2>
          <p className="font-serif text-xl italic text-ethereal-graphite opacity-80">
            {t("common.conductor_prefix", "Maestro")}{" "}
            {project.conductor || "TBA"}
          </p>
        </motion.div>
      </div>

      {/* 3. ARTIFACT STRATUM (Remains unchanged) */}
      <div className="relative z-10 grid grid-cols-1 divide-y divide-ethereal-incense/10 border-t border-ethereal-incense/10 bg-white/5 backdrop-blur-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="flex flex-col gap-1 p-8 transition-colors duration-500 hover:bg-white/20">
          <div className="flex items-center gap-2 text-ethereal-incense">
            <Users size={14} />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em]">
              {t("dashboard.admin.spotlight.cast", "Obsada")}
            </span>
          </div>
          <p className="font-serif text-3xl text-ethereal-ink">
            {projectStats.castCount}{" "}
            <span className="text-sm italic opacity-40">voices</span>
          </p>
        </div>

        <div className="flex flex-col gap-1 p-8 transition-colors duration-500 hover:bg-white/20">
          <div className="flex items-center gap-2 text-ethereal-incense">
            <Music size={14} />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em]">
              {t("dashboard.admin.spotlight.program", "Repertuar")}
            </span>
          </div>
          <p className="font-serif text-3xl text-ethereal-ink">
            {projectStats.piecesCount}{" "}
            <span className="text-sm italic opacity-40">scores</span>
          </p>
        </div>

        <div className="flex flex-col gap-1 p-8 transition-colors duration-500 hover:bg-white/20">
          <div className="flex items-center gap-2 text-ethereal-incense">
            <Calendar size={14} />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em]">
              {t("dashboard.admin.spotlight.remaining", "Do Premiery")}
            </span>
          </div>
          <p className="font-serif text-3xl text-ethereal-gold">
            {projectStats.rehearsalsRemaining}{" "}
            <span className="text-sm italic opacity-40">rehearsals</span>
          </p>
        </div>
      </div>
    </GlassCard>
  );
}
