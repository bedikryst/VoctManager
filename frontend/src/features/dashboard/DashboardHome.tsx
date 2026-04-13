/**
 * @file DashboardHome.tsx
 * @description Dashboard View Router.
 * Enhanced with Framer Motion for cinematic, staggered entry (The Choir Effect).
 * @architecture Enterprise SaaS 2026
 * @module features/dashboard/DashboardHome
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useAuth } from "@/app/providers/AuthProvider";
import { isManager } from "@/shared/auth/rbac";

import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import AdminDashboard from "./AdminDashboard";
import ArtistDashboard from "./ArtistDashboard";

export default function DashboardHome(): React.JSX.Element {
  const { user, isLoading } = useAuth();
  const { t } = useTranslation();

  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          key="sacral-loader"
          initial={{ opacity: 0, filter: "blur(12px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, filter: "blur(8px)", scale: 0.98 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
          className="absolute inset-0 flex items-center justify-center z-50"
        >
          <EtherealLoader
            message={t("dashboard.shared.authorizing", "Synchronizing Aura...")}
          />
        </motion.div>
      ) : (
        <motion.div
          key="dashboard-stage"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col w-full min-h-screen"
        >
          {isManager(user) ? <AdminDashboard /> : <ArtistDashboard />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
