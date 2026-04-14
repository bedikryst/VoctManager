/**
 * @file SpotlightProjectCard.tsx
 * @description The cinematic centerpiece. Upgraded to Ethereal UI (April 2026).
 * Features cascaded text kinematics, shader tracking, and semantic status badges.
 * @architecture Enterprise SaaS 2026
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Calendar, Users, Music, ArrowUpRight } from "lucide-react";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { LocationPreview } from "@/features/logistics/components/LocationPreview";
import { StatusBadge } from "@/shared/ui/primitives/StatusBadge";

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

// Kinematic Tokens for 2026
const EtherealEasing = [0.16, 1, 0.3, 1] as const;

const headerStagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.3 },
  },
};

const textFadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 1.2, ease: EtherealEasing },
  },
};

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

  if (!project) {
    return (
      <div className="h-full min-h-[400px] rounded-[2.5rem] bg-ethereal-incense/5 animate-pulse" />
    );
  }

  const projectStats = stats ?? {
    castCount: 0,
    piecesCount: 0,
    rehearsalsRemaining: 0,
  };

  const isActive = project.status === "active";

  return (
    <GlassCard
      variant="light"
      padding="none"
      className="group relative flex h-full min-h-[400px] w-full flex-col overflow-hidden transition-all duration-1000 ease-[0.16,1,0.3,1] hover:shadow-[0_40px_80px_rgba(166,146,121,0.15)]"
      backgroundElement={
        <div className="pointer-events-none absolute -right-32 -top-32 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-ethereal-gold/15 to-transparent blur-[140px] transition-transform duration-[2000ms] group-hover:scale-125" />
      }
    >
      {/* 1. STATUS BAR (Top) */}
      <div className="relative z-10 flex items-center justify-between px-10 pt-10">
        <StatusBadge
          variant={isActive ? "active" : "upcoming"}
          label={
            isActive
              ? t("dashboard.admin.spotlight.status_active", "W Produkcji")
              : t("dashboard.admin.spotlight.status_prep", "W Przygotowaniu")
          }
          isPulsing={isActive} // Only sweeps light if the project is ongoing
        />

        <button
          className="flex h-12 w-12 items-center justify-center rounded-full border border-ethereal-incense/20 bg-white/5 backdrop-blur-md transition-all duration-500 hover:scale-110 hover:border-ethereal-gold/40 hover:bg-white/30"
          aria-label={t(
            "dashboard.admin.aria_open_project",
            "Otwórz szczegóły projektu",
          )}
        >
          <ArrowUpRight
            size={20}
            strokeWidth={1.2}
            className="text-ethereal-ink transition-transform duration-500 group-hover:translate-x-[1px] group-hover:-translate-y-[1px]"
          />
        </button>
      </div>

      {/* 2. CORE CONTENT (Cinematic Typography) */}
      <div className="relative z-10 flex flex-1 flex-col justify-center px-10 py-8">
        <motion.div variants={headerStagger} initial="hidden" animate="visible">
          <motion.div
            variants={textFadeUp}
            className="mb-4 flex flex-wrap items-center gap-4 text-ethereal-sage"
          >
            {formattedDate && (
              <div className="flex items-center gap-2">
                <Calendar size={13} className="shrink-0 opacity-70" />
                <time
                  dateTime={project.startDate}
                  className="text-[10px] font-bold uppercase tracking-[0.25em]"
                >
                  {formattedDate}
                </time>
              </div>
            )}

            {formattedDate && (
              <div className="h-[2px] w-[2px] rounded-full bg-ethereal-incense/40" />
            )}

            {/* PORTALED LOCATION PREVIEW (Pointer events restored for tooltip) */}
            <div className="pointer-events-auto relative z-30">
              <LocationPreview
                locationRef={project.locationId}
                fallback={project.locationFallbackName || "TBA"}
                variant="minimal"
                className="text-[10px] font-bold uppercase tracking-[0.25em] transition-colors duration-300 hover:text-ethereal-gold"
              />
            </div>
          </motion.div>

          <motion.h2
            variants={textFadeUp}
            className="mb-6 max-w-2xl font-serif text-4xl leading-[1.05] tracking-tight text-ethereal-ink md:text-[3rem]"
          >
            {project.title}
          </motion.h2>
          {!project.conductor && (
            <motion.p
              variants={textFadeUp}
              className="font-serif text-xl italic text-ethereal-graphite opacity-80"
            >
              {t("common.conductor_prefix", "Maestro")}{" "}
              <span className="font-medium text-ethereal-ink">
                {project.conductor || t("common.tba", "TBA")}
              </span>
            </motion.p>
          )}
        </motion.div>
      </div>

      {/* 3. ARTIFACT STRATUM (Telemetry Base) */}
      <div className="relative z-10 h-full grid grid-cols-1 divide-y divide-ethereal-incense/10 border-t border-ethereal-incense/10 bg-white/10 backdrop-blur-md sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="group/stat flex cursor-default flex-col gap-2 p-8 transition-colors duration-500 hover:bg-white/20">
          <div className="flex items-center gap-2 text-ethereal-incense/70 transition-colors duration-500 group-hover/stat:text-ethereal-ink">
            <Users size={14} strokeWidth={1.5} />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em]">
              {t("dashboard.admin.spotlight.cast", "Obsada")}
            </span>
          </div>
          <p className="font-serif text-3xl font-medium tracking-tight text-ethereal-ink lg:text-4xl">
            {projectStats.castCount}{" "}
            <span className="text-sm italic opacity-40">voices</span>
          </p>
        </div>

        <div className="group/stat flex cursor-default flex-col gap-2 p-8 transition-colors duration-500 hover:bg-white/20">
          <div className="flex items-center gap-2 text-ethereal-incense/70 transition-colors duration-500 group-hover/stat:text-ethereal-ink">
            <Music size={14} strokeWidth={1.5} />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em]">
              {t("dashboard.admin.spotlight.program", "Repertuar")}
            </span>
          </div>
          <p className="font-serif text-3xl font-medium tracking-tight text-ethereal-ink lg:text-4xl">
            {projectStats.piecesCount}{" "}
            <span className="text-sm italic opacity-40">scores</span>
          </p>
        </div>

        <div className="group/stat flex cursor-default flex-col gap-2 p-8 transition-colors duration-500 hover:bg-white/20">
          <div className="flex items-center gap-2 text-ethereal-incense/70 transition-colors duration-500 group-hover/stat:text-ethereal-gold">
            <Calendar size={14} strokeWidth={1.5} />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em]">
              {t("dashboard.admin.spotlight.remaining", "Do Premiery")}
            </span>
          </div>
          <p className="font-serif text-3xl font-medium tracking-tight text-ethereal-gold lg:text-4xl">
            {projectStats.rehearsalsRemaining}{" "}
            <span className="text-sm italic opacity-40 text-ethereal-ink">
              rehearsals
            </span>
          </p>
        </div>
      </div>
    </GlassCard>
  );
}
