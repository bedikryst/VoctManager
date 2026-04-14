/**
 * @file SpotlightProjectCard.tsx
 * @description The cinematic centerpiece.
 * Features: A11y full-card clickability via absolute semantic link and group-hover kinematics.
 * @architecture Enterprise SaaS 2026
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Calendar, Users, Music, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { LocationPreview } from "@/features/logistics/components/LocationPreview";
import { StatusBadge } from "@/shared/ui/primitives/StatusBadge";
import { KineticText } from "@/shared/ui/kinematics/KineticText";

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

const EtherealEasing = [0.16, 1, 0.3, 1] as const;

const fadeUpVariant = {
  hidden: { opacity: 0, y: 15, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 1.2, ease: EtherealEasing, delay: 0.4 },
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
      <div
        className="h-full min-h-[400px] rounded-[2.5rem] bg-ethereal-incense/5 animate-pulse"
        aria-busy="true"
      />
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
      className="group relative isolate flex h-full min-h-[400px] w-full flex-col overflow-hidden transition-all duration-[1200ms] ease-[0.16,1,0.3,1] hover:shadow-[0_40px_100px_rgba(166,146,121,0.2)]"
      backgroundElement={
        <div className="pointer-events-none absolute -right-32 -top-32 h-[800px] w-[800px] rounded-full bg-gradient-to-br from-ethereal-gold/15 via-ethereal-incense/5 to-transparent blur-[160px] transition-transform duration-[3000ms] ease-out group-hover:scale-[1.3] group-hover:translate-x-10" />
      }
    >
      {/* SEMANTIC OVERLAY LINK
        This invisible link covers the entire card, providing semantic A11y and full clickability 
      */}
      <Link
        to={`/panel/projects`}
        className="absolute inset-0 z-10 outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/50 rounded-[2.5rem]"
        aria-label={t(
          "dashboard.admin.aria_open_project",
          "Otwórz szczegóły dyrektywy: {{title}}",
          { title: project.title },
        )}
      />

      {/* 1. STATUS BAR (Top) */}
      <header className="relative z-10 flex items-center justify-between px-10 pt-10 pointer-events-none">
        <div className="pointer-events-auto">
          <StatusBadge
            variant={isActive ? "active" : "upcoming"}
            label={
              isActive
                ? t("dashboard.admin.spotlight.status_active", "W Produkcji")
                : t("dashboard.admin.spotlight.status_prep", "W Przygotowaniu")
            }
            isPulsing={isActive}
          />
        </div>

        {/* VISUAL BUTTON (Decorative)
          Reacts to the GlassCard's 'group-hover' but is inherently unclickable (pointer-events-none)
        */}
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full border border-ethereal-incense/10 bg-white/5 backdrop-blur-md transition-all duration-700 group-hover:scale-110 group-hover:border-ethereal-gold/40 group-hover:bg-white/40 group-hover:shadow-[0_0_30px_rgba(194,168,120,0.3)]"
          aria-hidden="true"
        >
          <ArrowUpRight
            size={20}
            strokeWidth={1.2}
            className="text-ethereal-ink transition-transform duration-700 group-hover:translate-x-[2px] group-hover:-translate-y-[2px]"
          />
        </div>
      </header>

      {/* 2. CORE CONTENT (Cinematic Typography) */}
      <div className="relative z-10 flex flex-1 flex-col justify-center px-10 py-8 pointer-events-none">
        <motion.div
          initial="hidden"
          animate="visible"
          className="mb-4 flex flex-wrap items-center gap-4 text-ethereal-sage"
        >
          <motion.div
            variants={fadeUpVariant}
            className="flex items-center gap-2"
          >
            <Calendar
              size={13}
              strokeWidth={1.5}
              className="shrink-0 opacity-70"
            />
            <time
              dateTime={project.startDate}
              className="tabular-nums text-[10px] font-bold uppercase tracking-[0.25em]"
            >
              {formattedDate}
            </time>
          </motion.div>

          <motion.div
            variants={fadeUpVariant}
            className="h-[2px] w-[2px] rounded-full bg-ethereal-incense/40"
          />

          {/* ELEVATED INTERACTIVITY
            Because the main link is z-20, we elevate the location preview to z-30 
            and restore pointer events so its internal tooltips still work perfectly.
          */}
          <motion.div
            variants={fadeUpVariant}
            className="pointer-events-auto relative z-50"
          >
            <LocationPreview
              locationRef={project.locationId}
              fallback={project.locationFallbackName || "TBA"}
              variant="minimal"
              className="text-[10px] font-bold uppercase tracking-[0.25em] transition-colors duration-500 hover:text-ethereal-gold"
            />
          </motion.div>
        </motion.div>

        <KineticText
          as="h2"
          text={project.title}
          delay={0.2}
          className="mb-6 max-w-2xl font-serif text-3xl leading-[1.05] tracking-tight text-ethereal-ink md:text-[3rem]"
        />

        {!project.conductor ||
          (project.conductor.split("(").at(-1) === "Conductor)" && (
            <motion.p
              variants={fadeUpVariant}
              initial="hidden"
              animate="visible"
              className="font-serif text-xl italic text-ethereal-graphite opacity-80"
            >
              {t("common.conductor_prefix", "Maestro")}{" "}
              <span className="font-medium text-ethereal-ink">
                {project.conductor.split("(").at(-2) ||
                  t("common.tba", "TBA")}{" "}
              </span>
            </motion.p>
          ))}
      </div>

      {/* 3. ARTIFACT STRATUM (Metrics) */}
      <div className="relative z-10 grid h-full grid-cols-1 overflow-hidden sm:grid-cols-3 pointer-events-none">
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-ethereal-incense/20 to-transparent" />

        <article className="relative flex flex-col gap-2 p-8 transition-colors duration-700 group-hover:bg-white/30 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-ethereal-incense/70 transition-colors duration-500 group-hover:text-ethereal-ink">
            <Users size={14} strokeWidth={1.5} />
            <span className="text-[9px] font-bold uppercase tracking-[0.25em]">
              {t("dashboard.admin.spotlight.cast", "Obsada")}
            </span>
          </div>
          <p className="flex items-baseline gap-2">
            <span className="font-serif text-4xl font-light tracking-tight text-ethereal-ink lg:text-5xl">
              {projectStats.castCount}
            </span>
            <span className="font-serif text-sm italic text-ethereal-graphite/60">
              voices
            </span>
          </p>
          <div className="absolute inset-y-0 right-0 w-[1px] bg-gradient-to-b from-transparent via-ethereal-incense/10 to-transparent sm:block hidden" />
        </article>

        <article className="relative flex flex-col gap-2 p-8 transition-colors duration-700 group-hover:bg-white/30 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-ethereal-incense/70 transition-colors duration-500 group-hover:text-ethereal-ink">
            <Music size={14} strokeWidth={1.5} />
            <span className="text-[9px] font-bold uppercase tracking-[0.25em]">
              {t("dashboard.admin.spotlight.program", "Repertuar")}
            </span>
          </div>
          <p className="flex items-baseline gap-2">
            <span className="font-serif text-4xl font-light tracking-tight text-ethereal-ink lg:text-5xl">
              {projectStats.piecesCount}
            </span>
            <span className="font-serif text-sm italic text-ethereal-graphite/60">
              scores
            </span>
          </p>
          <div className="absolute inset-y-0 right-0 w-[1px] bg-gradient-to-b from-transparent via-ethereal-incense/10 to-transparent sm:block hidden" />
        </article>

        <article className="flex flex-col gap-2 p-8 transition-colors duration-700 group-hover:bg-white/30 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-ethereal-incense/70 transition-colors duration-500 group-hover:text-ethereal-gold">
            <Calendar size={14} strokeWidth={1.5} />
            <span className="text-[9px] font-bold uppercase tracking-[0.25em]">
              {t("dashboard.admin.spotlight.remaining", "Do Premiery")}
            </span>
          </div>
          <p className="flex items-baseline gap-2">
            <span className="font-serif text-4xl font-light tracking-tight text-ethereal-gold lg:text-5xl">
              {projectStats.rehearsalsRemaining}
            </span>
            <span className="font-serif text-sm italic text-ethereal-gold/60">
              rehearsals
            </span>
          </p>
        </article>
      </div>
    </GlassCard>
  );
}
