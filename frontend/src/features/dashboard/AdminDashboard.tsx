/**
 * @file AdminDashboard.tsx
 * @description Refined Mission Control.
 * Fixes: Type assertion removal & Backdrop-filter preservation.
 */

import React from "react";
import { motion, type Variants, type Transition } from "framer-motion";
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
// KINETIC TOKENS (Strictly Typed, No Assertions)
// ==========================================

/**
 * Bezier curve defined as a constant to satisfy Framer's Easing type
 * without 'as const' keyword.
 */
const EtherealEasing = [0.16, 1, 0.3, 1] as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 15,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 1.4,
      ease: EtherealEasing,
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
      <div className="flex h-[60vh] flex-col items-center justify-center space-y-6">
        <Loader2
          size={40}
          strokeWidth={1}
          className="animate-spin text-ethereal-gold/60"
        />
        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-ethereal-graphite/40">
          {t("dashboard.shared.loading", "Harmonizowanie systemów...")}
        </span>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="mx-auto w-full max-w-[1600px] px-6 pb-24 lg:px-10"
    >
      {/* HEADER STRATUM */}
      <motion.header
        variants={itemVariants}
        className="mb-8 flex flex-col gap-8 md:flex-row md:items-end md:justify-between"
      >
        <div className="max-w-2xl">
          <div className="mb-4 flex items-center gap-4">
            <div className="h-[1px] w-12 bg-ethereal-gold/30" />
            <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-ethereal-graphite/60">
              {t("dashboard.admin.role", "Principal Conductor Control")}
            </span>
          </div>
          <h1 className="font-serif text-5xl leading-[1.1] tracking-tight text-ethereal-ink md:text-7xl">
            {t("dashboard.admin.welcome", "Witaj, ")}
            <span className="italic text-ethereal-gold/90">
              {user?.first_name || "Maestro"}
            </span>
          </h1>
        </div>
        <div className="hidden md:block pb-2">
          <UserLocalClock />
        </div>
      </motion.header>

      {/* CORE BENTO GRID */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {nextRehearsal && (
          <motion.div variants={itemVariants} className="lg:col-span-12">
            <NextRehearsalAlert rehearsal={nextRehearsal} />
          </motion.div>
        )}

        <motion.div
          variants={itemVariants}
          className="lg:col-span-4 lg:min-h-[400px]"
        >
          <TelemetryWidget adminStats={adminStats} />
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="lg:col-span-8 lg:min-h-[400px]"
        >
          <SpotlightProjectCard
            project={nextProject}
            stats={nextProjectStats}
          />
        </motion.div>

        <motion.div variants={itemVariants} className="lg:col-span-12">
          <div className="mb-5 flex items-center gap-6">
            <div className="h-[1px] flex-1 bg-ethereal-incense/10" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-ethereal-graphite/40">
              {t("dashboard.admin.directory_sub", "06 Modułów")}
            </span>
          </div>
          <AdminModulesDirectory itemKinematics={itemVariants} />
        </motion.div>
      </div>
    </motion.div>
  );
}
