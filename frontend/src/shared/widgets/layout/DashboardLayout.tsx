/**
 * @file DashboardLayout.tsx
 * @description Main authenticated shell for the dashboard experience.
 * Orchestrates the Smart Sidebar, Mobile Nav, and Main Content area.
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
    {/* VoctEnsemble Brand Primary Glow */}
    <div className="absolute -left-[12rem] -top-[8rem] h-[28rem] w-[28rem] rounded-full bg-brand/10 blur-3xl mix-blend-multiply opacity-70" />
    {/* Warm Complementary Glow */}
    <div className="absolute -bottom-[18rem] -right-[10rem] h-[32rem] w-[32rem] rounded-full bg-amber-500/10 blur-3xl mix-blend-multiply opacity-70" />
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
    <div className="relative flex min-h-screen w-full bg-stone-100 font-sans text-stone-900 antialiased selection:bg-brand selection:text-white">
      <AmbientDecorators />

      {/* Enterprise Modular Navigation Components */}
      <DesktopSidebar user={user} logout={logout} />
      {/* Assuming MobileNavigation is also flattened in the same directory */}
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
