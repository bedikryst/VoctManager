/**
 * @file DashboardLayout.tsx
 * @description Master shell for the VoctManager Dashboard.
 * Delegates background kinetics to isolated persistent layers.
 * @architecture Enterprise SaaS 2026
 * @module shared/widgets/layout/DashboardLayout
 */

import React, { useEffect } from "react";
import { Outlet } from "react-router-dom";

import { useAuth } from "@/app/providers/AuthProvider";
import { DesktopSidebar } from "./DesktopSidebar";
import { MobileNavigation } from "./mobile/MobileNavigation";
import { EtherealBackground } from "@/shared/ui/kinematics/EtherealBackground";

export const DashboardLayout = (): React.JSX.Element => {
  const { user, logout } = useAuth();

  useEffect(() => {
    document.body.classList.add("admin-mode");
    return () => document.body.classList.remove("admin-mode");
  }, []);

  return (
    <div className="relative flex min-h-screen w-full bg-transparent font-sans text-ethereal-ink antialiased">
      {/* Accessibility Focus Anchor */}
      <a
        href="#main-content"
        className="sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:not-sr-only focus:rounded-full focus:bg-ethereal-ink focus:px-4 focus:py-2 focus:text-ethereal-marble focus:outline-none focus:ring-2 focus:ring-ethereal-gold"
      >
        Przejdź do głównej treści
      </a>

      {/* Layer 0: Isolated Persistent Background */}
      <EtherealBackground />

      {/* Layer 1: Navigation Overlay */}
      <DesktopSidebar user={user} logout={logout} />
      <MobileNavigation user={user} logout={logout} />

      {/* Layer 2: Main Dynamic Content */}
      <main
        className="relative z-10 flex min-w-0 flex-1 flex-col px-4 pt-8 pb-4 transition-all duration-300 sm:px-6 md:pl-[var(--sidebar-width)] md:pr-8 md:pt-8 lg:pr-12"
        id="main-content"
      >
        <div className="mx-auto flex h-full w-full max-w-7xl flex-col">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

DashboardLayout.displayName = "DashboardLayout";
