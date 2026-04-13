/**
 * @file ArtistDashboard.tsx
 * @description Highly personalized Assistant Dashboard for Artists.
 * Refactored to Enterprise SaaS 2026 High-Density (Bento Grid) standard.
 * Implements Controller Pattern with zero tech-debt and full i18n.
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

import {
  StaggeredBentoContainer,
  StaggeredBentoItem,
} from "@/shared/ui/kinematics/StaggeredBentoGrid";

import { cn } from "@/shared/lib/utils";
import { useAuth } from "@/app/providers/AuthProvider";
import { useArtistDashboardData } from "./hooks/useArtistDashboardData";
import { SystemModuleCard } from "@/shared/widgets/domain/SystemModuleCard";

import { ArtistNextRehearsalWidget } from "./components/ArtistNextRehearsalWidget";
import { ArtistNextProjectWidget } from "./components/ArtistNextProjectWidget";

export default function ArtistDashboard(): React.JSX.Element {
  const { user } = useAuth();
  const { t } = useTranslation();

  // Data Fetching via specialized hook
  const { isLoading, upNextRehearsal, upNextProject, greeting } =
    useArtistDashboardData(user?.artist_profile_id ?? undefined);

  // Definition of Dashboard Modules using the i18n system
  const ARTIST_MODULES = useMemo(
    () => [
      {
        id: "schedule",
        icon: <Calendar size={18} className="text-ethereal-gold" />,
        iconBgClass: "bg-ethereal-gold/10 border-ethereal-gold/20",
        hoverClass:
          "hover:border-ethereal-gold/40 hover:shadow-[0_8px_24px_rgba(194,168,120,0.12)]",
        titleColorClass: "group-hover/module:text-ethereal-gold",
        title: t("dashboard.artist.module_schedule_title", "Mój Kalendarz"),
        description: t(
          "dashboard.artist.module_schedule_desc",
          "Sprawdź próby, koncerty i zgłoś nieobecność.",
        ),
        path: "/panel/schedule",
      },
      {
        id: "materials",
        icon: <Music size={18} className="text-ethereal-sage" />,
        iconBgClass: "bg-ethereal-sage/10 border-ethereal-sage/20",
        hoverClass:
          "hover:border-ethereal-sage/40 hover:shadow-[0_8px_24px_rgba(143,154,138,0.12)]",
        titleColorClass: "group-hover/module:text-ethereal-sage",
        title: t("dashboard.artist.module_materials_title", "Materiały"),
        description: t(
          "dashboard.artist.module_materials_desc",
          "Pobierz nuty PDF i ćwicz ze ścieżkami audio.",
        ),
        path: "/panel/materials",
      },
      {
        id: "resources",
        icon: <BookOpen size={18} className="text-ethereal-amethyst" />,
        iconBgClass: "bg-ethereal-amethyst/10 border-ethereal-amethyst/20",
        hoverClass:
          "hover:border-ethereal-amethyst/40 hover:shadow-[0_8px_24px_rgba(140,122,158,0.12)]",
        titleColorClass: "group-hover/module:text-ethereal-amethyst",
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
      <div
        className="flex h-[60vh] flex-col items-center justify-center space-y-4"
        aria-busy="true"
      >
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
      {/* HEADER SECTION */}
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="relative flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 z-10" />
              <div className="absolute w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping opacity-75" />
            </div>
            <p className="text-[10px] uppercase tracking-widest text-stone-500 font-bold">
              {greeting} •{" "}
              {user?.first_name || t("common.artist_generic", "Artysto")}
            </p>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-stone-900 tracking-tight flex items-baseline gap-1.5">
            {t("dashboard.artist.title_main", "Pulpit")}
            <span className="italic font-serif text-transparent bg-clip-text bg-gradient-to-r from-brand to-blue-500 pr-1 pb-1 text-[1.15em]">
              {t("dashboard.artist.title_sub", "Muzyczny")}
            </span>
          </h1>
        </div>
      </header>

      {/* HORIZON SECTION (SPOTLIGHT WIDGETS) */}
      <section className="mb-8" aria-labelledby="horizon-heading">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={14} className="text-brand" aria-hidden="true" />
          <h2
            id="horizon-heading"
            className="text-[9px] font-bold uppercase tracking-widest text-stone-400"
          >
            {t("dashboard.artist.next_challenges", "Na horyzoncie")}
          </h2>
        </div>

        {!upNextRehearsal && !upNextProject ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white border border-dashed border-stone-300/60 rounded-[1.5rem] p-8 text-center flex flex-col items-center"
          >
            <Activity
              size={32}
              className="text-stone-300 mb-3"
              aria-hidden="true"
            />
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
            className={cn(
              "grid grid-cols-1 gap-4",
              upNextRehearsal && upNextProject ? "lg:grid-cols-2" : "",
            )}
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
      <section aria-labelledby="modules-heading">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-1 h-4 bg-ethereal-gold rounded-full"
            aria-hidden="true"
          />
          <h3
            id="modules-heading"
            className="text-[9px] font-bold uppercase tracking-widest text-ethereal-graphite"
          >
            {t("dashboard.artist.personal_modules", "Szybki Dostęp")}
          </h3>
        </div>

        <StaggeredBentoContainer className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {ARTIST_MODULES.map((mod) => (
            <StaggeredBentoItem key={mod.id} className="h-full">
              <SystemModuleCard {...mod} />
            </StaggeredBentoItem>
          ))}
        </StaggeredBentoContainer>
      </section>
    </div>
  );
}
