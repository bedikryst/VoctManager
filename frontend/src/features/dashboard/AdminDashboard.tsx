/**
 * @file AdminDashboard.tsx
 * @description Mission Control Dashboard for Choir Managers & Conductors.
 * Refactored to Enterprise SaaS 2026 High-Density (Bento Grid) standard.
 * Implements Controller Pattern with zero tech-debt and full i18n.
 * @module panel/dashboard/AdminDashboard
 */

import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, Variants } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Music,
  FileText,
  Users,
  Briefcase,
  Wrench,
  Plus,
  Loader2,
} from "lucide-react";

import { useAuth } from "@/app/providers/AuthProvider";
import { SystemModuleCard } from "@/shared/widgets/domain/SystemModuleCard";
import { useAdminDashboardData } from "./hooks/useAdminDashboardData";

import { NextRehearsalAlert } from "./components/NextRehearsalAlert";
import { TelemetryWidget } from "./components/TelemetryWidget";
import { SpotlightProjectCard } from "./components/SpotlightProjectCard";

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

export default function AdminDashboard(): React.JSX.Element {
  const { user } = useAuth();
  const { t } = useTranslation();

  const {
    isLoading,
    adminStats,
    nextProject,
    nextProjectStats,
    nextRehearsal,
  } = useAdminDashboardData();

  const ADMIN_MODULES = useMemo(
    () => [
      {
        id: "projects",
        title: t("dashboard.admin.modules.projects_title", "Projekty"),
        description: t(
          "dashboard.admin.modules.projects_desc",
          "Centrum dowodzenia produkcją.",
        ),
        features: [
          t("dashboard.admin.features.schedules", "Harmonogramy"),
          t("dashboard.admin.features.setlists", "Setlisty"),
          t("dashboard.admin.features.casting", "Casting"),
        ],
        icon: <Briefcase size={18} className="text-brand" />,
        path: "/panel/projects",
      },
      {
        id: "archive",
        title: t("dashboard.admin.modules.archive_title", "Archiwum"),
        description: t(
          "dashboard.admin.modules.archive_desc",
          "Baza biblioteki muzycznej.",
        ),
        features: [
          t("dashboard.admin.features.pdf_scores", "Nuty PDF"),
          t("dashboard.admin.features.audio", "Audio"),
          t("dashboard.admin.features.requirements", "Wymagania"),
        ],
        icon: <Music size={18} className="text-brand" />,
        path: "/panel/archive-management",
      },
      {
        id: "artists",
        title: t("dashboard.admin.modules.artists_title", "Artyści"),
        description: t(
          "dashboard.admin.modules.artists_desc",
          "Zarządzanie chórem i solistami.",
        ),
        features: [
          t("dashboard.admin.features.satb", "SATB"),
          t("dashboard.admin.features.profiles", "Profile"),
          t("dashboard.admin.features.sight_reading", "A vista"),
        ],
        icon: <Users size={18} className="text-brand" />,
        path: "/panel/artists",
      },
      {
        id: "contracts",
        title: t("dashboard.admin.modules.contracts_title", "Finanse"),
        description: t(
          "dashboard.admin.modules.contracts_desc",
          "Umowy i budżetowanie.",
        ),
        features: [
          t("dashboard.admin.features.rates", "Stawki"),
          t("dashboard.admin.features.documents", "Dokumenty"),
          t("dashboard.admin.features.budget", "Budżet"),
        ],
        icon: <FileText size={18} className="text-brand" />,
        path: "/panel/contracts",
      },
      {
        id: "crew",
        title: t("dashboard.admin.modules.crew_title", "Technika"),
        description: t(
          "dashboard.admin.modules.crew_desc",
          "Logistyka i reżyseria wydarzeń.",
        ),
        features: [
          t("dashboard.admin.features.sound", "Dźwięk"),
          t("dashboard.admin.features.light", "Światło"),
          t("dashboard.admin.features.vendors", "Firmy"),
        ],
        icon: <Wrench size={18} className="text-brand" />,
        path: "/panel/crew",
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
          {t("dashboard.shared.loading_telemetry", "Synchronizacja danych...")}
        </span>
      </div>
    );
  }

  return (
    <div className="animate-fade-in relative cursor-default pb-12 w-full max-w-7xl mx-auto">
      {/* HEADER SECTION */}
      <header className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="relative flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 z-10" />
              <div className="absolute w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping opacity-75" />
            </div>
            <p className="text-[10px] uppercase tracking-widest text-stone-500 font-bold">
              {t("dashboard.admin.welcome_back", "Witaj z powrotem")} •{" "}
              {user?.first_name || t("common.admin_generic", "Administratorze")}
            </p>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-stone-900 tracking-tight flex items-baseline gap-1.5">
            {t("dashboard.admin.title_main", "Pulpit")}
            <span className="italic font-serif text-transparent bg-clip-text bg-gradient-to-r from-brand to-blue-500 pr-1 pb-1 text-[1.15em]">
              {t("dashboard.admin.title_sub", "Produkcyjny")}
            </span>
          </h1>
        </div>

        <Link
          to="/panel/projects/new"
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-white border border-stone-200/80 hover:border-brand text-stone-700 hover:text-brand text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95"
        >
          <Plus size={14} />{" "}
          {t("dashboard.admin.btn_new_project", "Nowy Projekt")}
        </Link>
      </header>

      {/* TOP NOTIFICATION BAR */}
      {nextRehearsal && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
        >
          <NextRehearsalAlert rehearsal={nextRehearsal} />
        </motion.div>
      )}

      {/* KPI & SPOTLIGHT BENTO GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="col-span-1 h-full"
        >
          <TelemetryWidget adminStats={adminStats} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 h-full"
        >
          <SpotlightProjectCard
            project={nextProject}
            stats={nextProjectStats}
          />
        </motion.div>
      </div>

      {/* SYSTEM MODULES GRID */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4"
      >
        {ADMIN_MODULES.map((mod) => (
          <motion.div key={mod.id} variants={itemVariants} className="h-full">
            <SystemModuleCard {...mod} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
