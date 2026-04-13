/**
 * @file DashboardHome.tsx
 * @description Dashboard View Router.
 * Delegates rendering to specialized Role-Based Dashboards to optimize
 * bundle size, separate concerns, and strictly isolate API queries.
 * @architecture Enterprise SaaS 2026
 * @module panel/dashboard/DashboardHome
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/app/providers/AuthProvider";
import { isManager } from "@/shared/auth/rbac";

import AdminDashboard from "./AdminDashboard";
import ArtistDashboard from "./ArtistDashboard";
import { UserLocalClock } from "@/widgets/UserLocalClock";

export default function DashboardHome(): React.JSX.Element {
  const { user, isLoading } = useAuth();
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div
        className="flex h-[60vh] flex-col items-center justify-center space-y-5"
        aria-busy="true"
      >
        <div className="relative flex items-center justify-center">
          <div className="absolute w-16 h-16 border-4 border-brand/20 rounded-full"></div>
          <div className="w-16 h-16 border-4 border-brand rounded-full border-t-transparent animate-spin"></div>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-brand/60">
          {t("dashboard.shared.authorizing", "Autoryzacja...")}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full animate-in fade-in duration-500">
      <div className="flex justify-end w-full mb-6">
        <UserLocalClock />
      </div>

      {isManager(user) ? <AdminDashboard /> : <ArtistDashboard />}
    </div>
  );
}
