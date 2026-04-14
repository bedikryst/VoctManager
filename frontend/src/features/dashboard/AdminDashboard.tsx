/**
 * @file AdminDashboard.tsx
 * @description Mission Control Dashboard for Choir Managers & Conductors.
 * Refactored to High-Density Ethereal UI (2026) with zero tech-debt.
 * Implements ultra-compact architecture, delegating domain lists to sub-components.
 * @module panel/dashboard/AdminDashboard
 */

import React from "react";
import { motion, type Variants } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";

import { UserLocalClock } from "@/shared/widgets/utility/UserLocalClock";
import { useAuth } from "@/app/providers/AuthProvider";
import { useAdminDashboardData } from "./hooks/useAdminDashboardData";

import { NextRehearsalAlert } from "./components/NextRehearsalAlert";
import { TelemetryWidget } from "./components/TelemetryWidget";
import { SpotlightProjectCard } from "./components/SpotlightProjectCard";
import { AdminModulesDirectory } from "./components/AdminModulesDirectory";

// ==========================================
// KINEMATICS TOKENS
// ==========================================

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }, // Błyskawiczne, kaskadowe wejście
  },
};

const itemKinematics: Variants = {
  hidden: { opacity: 0, y: 15, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] },
    transitionEnd: { filter: "", transform: "none" },
  },
};

export const choirOrchestration: Variants = {
  hidden: { opacity: 0, filter: "blur(10px)", y: 20 },
  visible: {
    opacity: 1,
    filter: "blur(0px)",
    y: 0,
    transition: {
      staggerChildren: 0.15,
      ease: [0.25, 0.1, 0.25, 1],
      duration: 0.8,
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
        className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6"
      >
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="relative flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-ethereal-sage z-10 shadow-[0_0_8px_rgba(143,154,138,0.6)]" />
              <div className="absolute w-4 h-4 rounded-full bg-ethereal-sage/30 animate-pulse" />
            </div>
            <p className="text-[10px] uppercase tracking-widest text-ethereal-graphite font-bold">
              {t("dashboard.admin.welcome_back", "Witaj z powrotem")} •{" "}
              {user?.first_name || t("common.admin_generic", "Administratorze")}
            </p>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-ethereal-ink tracking-tight flex items-baseline gap-2">
            {t("dashboard.admin.title_main", "Pulpit")}
            <span className="italic font-serif text-ethereal-ink pr-1 text-[1.15em] opacity-90 drop-shadow-sm">
              {t("dashboard.admin.title_sub", "Produkcyjny")}
            </span>
          </h1>
        </div>

        <div className="flex justify-start md:justify-end pb-1">
          <UserLocalClock />
        </div>
      </motion.header>

      {nextRehearsal && (
        <motion.div variants={itemKinematics} className="mb-8">
          <NextRehearsalAlert rehearsal={nextRehearsal} />
        </motion.div>
      )}

      {/* THE COCKPIT LAYOUT */}
      <div className="flex flex-col gap-5 xl:gap-6 relative z-30">
        {/* UPPER STRATUM: Telemetry & Spotlight */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 xl:gap-6">
          <motion.div
            variants={itemKinematics}
            className="md:col-span-12 xl:col-span-4 min-h-[16rem]"
          >
            <TelemetryWidget adminStats={adminStats} />
          </motion.div>
          <motion.div
            variants={itemKinematics}
            className="md:col-span-12 xl:col-span-8 min-h-[16rem]"
          >
            <SpotlightProjectCard
              project={nextProject}
              stats={nextProjectStats}
            />
          </motion.div>
        </div>

        {/* LOWER STRATUM: High-Density Directory */}
        <div className="mt-2">
          <AdminModulesDirectory itemKinematics={itemKinematics} />
        </div>
      </div>
    </motion.div>
  );
}
