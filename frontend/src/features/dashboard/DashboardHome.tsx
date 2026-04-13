/**
 * @file DashboardHome.tsx
 * @description Dashboard View Router.
 * Refactored to delegate visual states to the kinematics layer.
 * @module panel/dashboard/DashboardHome
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/app/providers/AuthProvider";
import { isManager } from "@/shared/auth/rbac";

import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import AdminDashboard from "./AdminDashboard";
import ArtistDashboard from "./ArtistDashboard";

export default function DashboardHome(): React.JSX.Element {
  const { user, isLoading } = useAuth();
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <EtherealLoader
        message={t("dashboard.shared.authorizing", "Synchronizing Aura...")}
      />
    );
  }

  return (
    <div className="flex flex-col w-full animate-in fade-in duration-700 ease-out">
      {isManager(user) ? <AdminDashboard /> : <ArtistDashboard />}
    </div>
  );
}
