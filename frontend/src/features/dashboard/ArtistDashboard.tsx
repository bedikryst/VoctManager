/**
 * @file ArtistDashboard.tsx
 * @description Highly personalized Assistant Dashboard for Artists.
 * Refactored to Enterprise SaaS 2026 High-Density (Bento Grid) standard.
 * Implements Controller Pattern for zero tech-debt.
 * @module panel/dashboard/ArtistDashboard
 */

import React, { useMemo } from "react";
import { motion, Variants } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Calendar,
  Music,
  BookOpen,
  Sparkles,
  Activity,
  Loader2,
} from "lucide-react";

import { useAuth } from "@/app/providers/AuthProvider";
import { useArtistDashboardData } from "./hooks/useArtistDashboardData";
import { SystemModuleCard } from "@/widgets/SystemModuleCard";

import { ArtistNextRehearsalWidget } from "./components/ArtistNextRehearsalWidget";
import { ArtistNextProjectWidget } from "./components/ArtistNextProjectWidget";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 400, damping: 30 },
  },
};

export default function ArtistDashboard(): React.JSX.Element {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { isLoading, upNextRehearsal, upNextProject, greeting } =
    useArtistDashboardData(user?.artist_profile_id ?? undefined);

  const ARTIST_MODULES = useMemo(
    () => [
      {
        id: "schedule",
        icon: <Calendar size={18} className="text-orange-600" />,
        iconBgClass: "bg-orange-50 border-orange-100",
        hoverClass:
          "hover:border-orange-300/60 hover:shadow-[0_8px_24px_rgba(249,115,22,0.12)]",
        titleColorClass: "group-hover/module:text-orange-600",
        title: t("dashboard.artist.module_schedule_title", "Mój Kalendarz"),
        description: t(
          "dashboard.artist.module_schedule_desc",
          "Sprawdź próby, koncerty i zgłoś nieobecność.",
        ),
        path: "/panel/schedule",
      },
      {
        id: "materials",
        icon: <Music size={18} className="text-emerald-600" />,
        iconBgClass: "bg-emerald-50 border-emerald-100",
        hoverClass:
          "hover:border-emerald-300/60 hover:shadow-[0_8px_24px_rgba(16,185,129,0.12)]",
        titleColorClass: "group-hover/module:text-emerald-600",
        title: t("dashboard.artist.module_materials_title", "Materiały"),
        description: t(
          "dashboard.artist.module_materials_desc",
          "Pobierz nuty PDF i ćwicz ze ścieżkami audio.",
        ),
        path: "/panel/materials",
      },
      {
        id: "resources",
        icon: <BookOpen size={18} className="text-purple-600" />,
        iconBgClass: "bg-purple-50 border-purple-100",
        hoverClass:
          "hover:border-purple-300/60 hover:shadow-[0_8px_24px_rgba(168,85,247,0.12)]",
        titleColorClass: "group-hover/module:text-purple-600",
        title: t("dashboard.artist.module_resources_title", "Baza Wiedzy"),
        description: t(
          "dashboard.artist.module_resources_desc",
          "Sprawdź wytyczne, dress-code i umowy.",
        ),
        path: "/panel/resources",
      },
    ],
    [t],
  );

  if (isLoading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center space-y-4">
        <Loader2
          size={48}
          strokeWidth={1}
          className="animate-spin text-brand"
        />
        <span className="text-[9px] uppercase font-bold tracking-[0.2em] text-stone-500">
          {t("dashboard.shared.syncing", "Synchronizacja pulpitu...")}
        </span>
      </div>
    );
  }

  return (
    <div className="animate-fade-in relative cursor-default pb-12 w-full max-w-7xl mx-auto">
      {/* HEADER */}
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="relative flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 z-10" />
              <div className="absolute w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping opacity-75" />
            </div>
            <p className="text-[10px] uppercase tracking-widest text-stone-500 font-bold">
              {greeting} • {user?.first_name || "Artysto"}
            </p>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-stone-900 tracking-tight flex items-baseline gap-1.5">
            Pulpit
            <span
              className="italic text-transparent bg-clip-text bg-gradient-to-r from-brand to-blue-500 pr-1 pb-1"
              style={{ fontFamily: "'Cormorant', serif", fontSize: "1.15em" }}
            >
              Muzyczny
            </span>
          </h1>
        </div>
      </header>

      {/* HORIZON SECTION (SPOTLIGHT WIDGETS) */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={14} className="text-brand" aria-hidden="true" />
          <h2 className="text-[9px] font-bold uppercase tracking-widest text-stone-400">
            {t("dashboard.artist.next_challenges", "Na horyzoncie")}
          </h2>
        </div>

        {!upNextRehearsal && !upNextProject ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white border border-dashed border-stone-300/60 rounded-[1.5rem] p-8 text-center flex flex-col items-center"
          >
            <Activity size={32} className="text-stone-300 mb-3" />
            <p className="text-stone-800 text-sm font-bold">
              {t(
                "dashboard.artist.empty_events_title",
                "Brak nadchodzących wydarzeń",
              )}
            </p>
            <p className="text-stone-500 text-xs mt-1">
              {t(
                "dashboard.artist.empty_events_desc",
                "Odpocznij, twój muzyczny kalendarz jest obecnie pusty.",
              )}
            </p>
          </motion.div>
        ) : (
          <div
            className={`grid grid-cols-1 ${upNextRehearsal && upNextProject ? "lg:grid-cols-2" : ""} gap-4`}
          >
            {upNextRehearsal && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <ArtistNextRehearsalWidget rehearsal={upNextRehearsal} />
              </motion.div>
            )}

            {upNextProject && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <ArtistNextProjectWidget project={upNextProject} />
              </motion.div>
            )}
          </div>
        )}
      </section>

      {/* QUICK ACCESS MODULES */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 bg-brand rounded-full" />
          <h3 className="text-[9px] font-bold uppercase tracking-widest text-stone-400">
            {t("dashboard.artist.personal_modules", "Szybki Dostęp")}
          </h3>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          {ARTIST_MODULES.map((mod) => (
            <motion.div key={mod.id} variants={itemVariants} className="h-full">
              <SystemModuleCard {...mod} />
            </motion.div>
          ))}
        </motion.div>
      </section>
    </div>
  );
}
