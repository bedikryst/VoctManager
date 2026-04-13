/**
 * @file DashboardHome.tsx
 * @description Dashboard View Router with Ethereal UI Loading States.
 * @module panel/dashboard/DashboardHome
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/app/providers/AuthProvider";
import { isManager } from "@/shared/auth/rbac";

import AdminDashboard from "./AdminDashboard";
import ArtistDashboard from "./ArtistDashboard";

export default function DashboardHome(): React.JSX.Element {
  const { user, isLoading } = useAuth();
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div
        className="flex h-[70vh] flex-col items-center justify-center space-y-8"
        aria-busy="true"
      >
        <div className="relative flex items-center justify-center">
          {/* Ethereal Breathing Animation */}
          <div className="absolute w-24 h-24 bg-ethereal-gold/10 rounded-full blur-xl animate-pulse" />
          <div className="absolute w-12 h-12 border border-ethereal-gold/30 rounded-full animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]" />
          <div className="w-2 h-2 bg-ethereal-gold rounded-full shadow-[0_0_10px_rgba(194,168,120,0.8)]" />
        </div>
        <span className="text-[10px] uppercase font-bold tracking-[0.3em] text-ethereal-graphite animate-pulse">
          {t("dashboard.shared.authorizing", "Synchronizing Aura...")}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full animate-in fade-in duration-700 ease-out">
      {isManager(user) ? <AdminDashboard /> : <ArtistDashboard />}
    </div>
  );
}
