/**
 * @file DashboardHome.tsx
 * @description Dashboard view router — picks the manager console or the
 * chorister dashboard once the session is known, and does nothing else. The
 * entrance belongs to whichever of the two it hands over to: both open with
 * `PageTransition`, which under the ink law is the single ramp this surface is
 * allowed. A fade of its own here would sit directly above that one and
 * multiply with it.
 * @architecture Enterprise SaaS 2026
 * @module features/dashboard/DashboardHome
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

  // The loader is cut, not faded, on both edges: it is the thing being waited
  // out, and animating its departure only postpones the screen behind it. The
  // dashboard that replaces it starts at half-ink rather than at nothing, so
  // there is no hole between the two.
  if (isLoading) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center">
        <EtherealLoader
          message={t("dashboard.shared.authorizing", "Synchronizing...")}
        />
      </div>
    );
  }

  return (
    <div className="flex w-full min-h-screen flex-col">
      {isManager(user) ? <AdminDashboard /> : <ArtistDashboard />}
    </div>
  );
}
