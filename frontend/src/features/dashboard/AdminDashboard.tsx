/**
 * @file AdminDashboard.tsx
 * @description Mission Control Dashboard for Choir Managers & Conductors.
 * Refactored to Ethereal UI (2026) with zero tech-debt.
 * Implements the "Dynamic Triptych" - a 3-row, 2-column asymmetrical matrix.
 * @module panel/dashboard/AdminDashboard
 */

import React, { useMemo } from "react";
import { motion, type Variants } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Music,
  FileText,
  Users,
  Briefcase,
  Wrench,
  Map,
  Loader2,
} from "lucide-react";

import { UserLocalClock } from "@/shared/widgets/utility/UserLocalClock";
import { useAuth } from "@/app/providers/AuthProvider";
import { SystemModuleCard } from "@/shared/widgets/domain/SystemModuleCard";
import { useAdminDashboardData } from "./hooks/useAdminDashboardData";

import { NextRehearsalAlert } from "./components/NextRehearsalAlert";
import { TelemetryWidget } from "./components/TelemetryWidget";
import { SpotlightProjectCard } from "./components/SpotlightProjectCard";

// ==========================================
// KINEMATICS TOKENS (Child Variants)
// ==========================================

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemKinematics: Variants = {
  hidden: {
    opacity: 0,
    y: 30,
    filter: "blur(12px)",
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.85,
      ease: [0.25, 0.1, 0.25, 1],
    },
    transitionEnd: {
      filter: "",
      transform: "none",
    },
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

  // Wzbogacone opisy domenowe dostosowane do większej przestrzeni typograficznej
  const ADMIN_MODULES = useMemo(
    () => [
      {
        id: "projects",
        title: t("dashboard.admin.modules.projects_title", "Projekty"),
        description: t(
          "dashboard.admin.modules.projects_desc",
          "Główne centrum dowodzenia produkcją muzyczną. Zaawansowane planowanie sezonu artystycznego, wizualizacja osi czasu oraz zintegrowane harmonogramy dla wszystkich departamentów operacyjnych.",
        ),
        features: [
          t("dashboard.admin.features.schedules", "Harmonogramy"),
          t("dashboard.admin.features.setlists", "Setlisty"),
        ],
        icon: <Briefcase size={22} className="text-ethereal-gold" />,
        iconBgClass:
          "border-ethereal-gold/20 bg-ethereal-gold/10 text-ethereal-gold",
        path: "/panel/projects",
      },
      {
        id: "logistics",
        title: t("dashboard.admin.modules.logistics_title", "Logistyka"),
        description: t(
          "dashboard.admin.modules.logistics_desc",
          "Zarządzanie infrastrukturą zewnętrzną oraz mobilnością. Kompleksowa baza obiektów sakralnych i koncertowych z pełną specyfikacją przestrzenną, transportem oraz zakwaterowaniem zespołu.",
        ),
        features: [
          t("dashboard.admin.features.locations", "Lokacje"),
          t("dashboard.admin.features.transport", "Transport"),
        ],
        icon: <Map size={22} className="text-ethereal-sage" />,
        iconBgClass:
          "border-ethereal-sage/20 bg-ethereal-sage/10 text-ethereal-sage",
        path: "/panel/locations",
      },
      {
        id: "archive",
        title: t("dashboard.admin.modules.archive_title", "Archiwum"),
        description: t(
          "dashboard.admin.modules.archive_desc",
          "Scentralizowane repozytorium wiedzy. Dostęp do zdigitalizowanych partytur, wymogów wykonawczych oraz referencyjnych nagrań audio, gwarantujący spójność interpretacyjną zespołu.",
        ),
        features: [
          t("dashboard.admin.features.pdf_scores", "Nuty PDF"),
          t("dashboard.admin.features.audio", "Audio referencyjne"),
        ],
        icon: <Music size={22} className="text-ethereal-graphite" />,
        iconBgClass:
          "border-ethereal-graphite/20 bg-ethereal-graphite/10 text-ethereal-graphite",
        path: "/panel/archive-management",
      },
      {
        id: "artists",
        title: t("dashboard.admin.modules.artists_title", "Artyści"),
        description: t(
          "dashboard.admin.modules.artists_desc",
          "Zarządzanie aparatem wykonawczym. Precyzyjna analiza balansu głosów (SATB), przydział do wymagających ról oraz monitorowanie historii artystycznej chórzystów i solistów.",
        ),
        features: [
          t("dashboard.admin.features.satb", "SATB"),
          t("dashboard.admin.features.profiles", "Profile"),
        ],
        icon: <Users size={22} className="text-ethereal-amethyst" />,
        iconBgClass:
          "border-ethereal-amethyst/20 bg-ethereal-amethyst/10 text-ethereal-amethyst",
        path: "/panel/artists",
      },
      {
        id: "contracts",
        title: t("dashboard.admin.modules.contracts_title", "Finanse"),
        description: t(
          "dashboard.admin.modules.contracts_desc",
          "Środowisko prawno-budżetowe. Zautomatyzowane generowanie umów, zarządzanie stawkami ryczałtowymi i godzinowymi oraz pełen audyt budżetowy nadchodzących projektów.",
        ),
        features: [
          t("dashboard.admin.features.rates", "Stawki"),
          t("dashboard.admin.features.budget", "Budżet"),
        ],
        icon: <FileText size={22} className="text-ethereal-incense" />,
        iconBgClass:
          "border-ethereal-incense/20 bg-ethereal-incense/10 text-ethereal-incense",
        path: "/panel/contracts",
      },
      {
        id: "crew",
        title: t("dashboard.admin.modules.crew_title", "Technika"),
        description: t(
          "dashboard.admin.modules.crew_desc",
          "Logistyka wsparcia technicznego i reżyserii. Koordynacja inżynierów dźwięku, reżyserów światła oraz podwykonawców zewnętrznych podczas kluczowych wydarzeń sezonu.",
        ),
        features: [
          t("dashboard.admin.features.sound", "Dźwięk & Światło"),
          t("dashboard.admin.features.vendors", "Podwykonawcy"),
        ],
        icon: <Wrench size={22} className="text-ethereal-ink" />,
        iconBgClass: "border-ethereal-ink/10 bg-white/40 text-ethereal-ink",
        path: "/panel/crew",
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
          className="animate-spin text-ethereal-gold"
        />
        <span className="text-[9px] uppercase font-bold tracking-[0.2em] text-ethereal-graphite">
          {t(
            "dashboard.shared.loading_telemetry",
            "Wczytywanie architektury systemu...",
          )}
        </span>
      </div>
    );
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="relative cursor-default pb-16 w-full max-w-[1800px] mx-auto px-6 lg:px-12"
    >
      <motion.header
        variants={itemKinematics}
        className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6"
      >
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="relative flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-ethereal-sage z-10" />
              <div className="absolute w-1.5 h-1.5 rounded-full bg-ethereal-sage animate-ping opacity-75" />
            </div>
            <p className="text-[10px] uppercase tracking-widest text-ethereal-graphite font-bold">
              {t("dashboard.admin.welcome_back", "Witaj z powrotem")} •{" "}
              {user?.first_name || t("common.admin_generic", "Administratorze")}
            </p>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-ethereal-ink tracking-tight flex items-baseline gap-2">
            {t("dashboard.admin.title_main", "Pulpit")}
            <span className="italic font-serif text-transparent bg-clip-text bg-gradient-to-r from-ethereal-gold to-ethereal-sage pr-1 pb-1 text-[1.15em]">
              {t("dashboard.admin.title_sub", "Produkcyjny")}
            </span>
          </h1>
        </div>

        <div className="flex justify-start md:justify-end">
          <UserLocalClock />
        </div>
      </motion.header>

      {nextRehearsal && (
        <motion.div variants={itemKinematics} className="mb-10">
          <NextRehearsalAlert rehearsal={nextRehearsal} />
        </motion.div>
      )}

      {/* =========================================================
          THE DYNAMIC TRIPTYCH (3 Rows, 2 Asymmetrical Columns)
          ========================================================= */}
      <div className="relative z-30 grid grid-cols-1 md:grid-cols-12 auto-rows-fr gap-6 xl:gap-8">
        {/* TOP LEVEL: Telemetry & Spotlight */}
        <motion.div
          variants={itemKinematics}
          className="md:col-span-12 xl:col-span-3 min-h-[16rem]"
        >
          <TelemetryWidget adminStats={adminStats} />
        </motion.div>
        <motion.div
          variants={itemKinematics}
          className="md:col-span-12 xl:col-span-9 min-h-[16rem]"
        >
          <SpotlightProjectCard
            project={nextProject}
            stats={nextProjectStats}
          />
        </motion.div>

        {/* ROW 1: Asymmetry 7 / 5 */}
        <motion.div
          variants={itemKinematics}
          className="md:col-span-6 xl:col-span-7"
        >
          <SystemModuleCard {...ADMIN_MODULES[0]} /> {/* Projekty */}
        </motion.div>
        <motion.div
          variants={itemKinematics}
          className="md:col-span-6 xl:col-span-5"
        >
          <SystemModuleCard {...ADMIN_MODULES[1]} /> {/* Logistyka */}
        </motion.div>

        {/* ROW 2: Asymmetry 5 / 7 (Counter-balance) */}
        <motion.div
          variants={itemKinematics}
          className="md:col-span-6 xl:col-span-5"
        >
          <SystemModuleCard {...ADMIN_MODULES[2]} /> {/* Archiwum */}
        </motion.div>
        <motion.div
          variants={itemKinematics}
          className="md:col-span-6 xl:col-span-7"
        >
          <SystemModuleCard {...ADMIN_MODULES[3]} /> {/* Artyści */}
        </motion.div>

        {/* ROW 3: Asymmetry 7 / 5 (Resolution) */}
        <motion.div
          variants={itemKinematics}
          className="md:col-span-6 xl:col-span-7"
        >
          <SystemModuleCard {...ADMIN_MODULES[4]} /> {/* Finanse */}
        </motion.div>
        <motion.div
          variants={itemKinematics}
          className="md:col-span-6 xl:col-span-5"
        >
          <SystemModuleCard {...ADMIN_MODULES[5]} /> {/* Technika */}
        </motion.div>
      </div>
    </motion.div>
  );
}
