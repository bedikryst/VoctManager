/**
 * @file DashboardLayout.tsx
 * @description Main authenticated shell for the dashboard experience.
 * Orchestrates the Smart Sidebar, Mobile Nav, and Main Content area.
 * Zero Tech-Debt Ethereal UI Edition.
 * @module shared/widgets/layout/DashboardLayout
 */

import React, { useEffect } from "react";
import { Outlet } from "react-router-dom";

import { useAuth } from "@/app/providers/AuthProvider";
import { DesktopSidebar } from "./DesktopSidebar";
import { MobileNavigation } from "./MobileNavigation";

const AmbientDecorators = (): React.JSX.Element => (
  <div
    className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    aria-hidden="true"
  >
    {/* Ethereal Gold Epiphany Glow */}
    <div className="absolute -left-[12rem] -top-[8rem] h-[36rem] w-[36rem] rounded-full bg-ethereal-gold/10 blur-[80px] mix-blend-multiply opacity-80 transition-opacity duration-1000" />
    {/* Ethereal Sage Grounding Glow */}
    <div className="absolute -bottom-[18rem] -right-[10rem] h-[40rem] w-[40rem] rounded-full bg-ethereal-sage/10 blur-[100px] mix-blend-multiply opacity-60 transition-opacity duration-1000" />
  </div>
);

export const DashboardLayout = (): React.JSX.Element => {
  const { user, logout } = useAuth();

  // Global styling enforcement for the secure admin zone
  useEffect(() => {
    document.body.classList.add("admin-mode");
    return () => {
      document.body.classList.remove("admin-mode");
    };
  }, []);

  return (
    // REMOVED bg-stone-100. Using bg-transparent so the body radial-gradient shines through.
    <div className="relative flex min-h-screen w-full bg-transparent font-sans text-ethereal-ink antialiased">
      <AmbientDecorators />

      <DesktopSidebar user={user} logout={logout} />
      <MobileNavigation user={user} logout={logout} />

      <main
        className="relative z-10 flex min-w-0 flex-1 flex-col px-4 pb-12 pt-24 transition-all duration-300 sm:px-6 md:pl-[120px] md:pr-8 md:pt-8 lg:pr-12"
        id="main-content"
      >
        <div className="mx-auto flex h-full w-full max-w-7xl flex-col">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
