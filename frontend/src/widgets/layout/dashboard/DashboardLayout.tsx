/**
 * @file DashboardLayout.tsx
 * @description Main authenticated shell for the dashboard experience.
 * Orchestrates the Smart Sidebar, Mobile Nav, and Main Content area.
 * Features Ethereal UI ambient light decorators and precise scroll containment.
 * @architecture Enterprise SaaS 2026
 */

import React, { useEffect } from "react";
import { Outlet } from "react-router-dom";

import { useAuth } from "@/app/providers/AuthProvider";
import { DesktopSidebar } from "./components/DesktopSidebar";
import { MobileNavigation } from "./components/MobileNavigation";

export default function DashboardLayout(): React.JSX.Element {
  const { user, logout } = useAuth();

  // Global styling enforcement for the secure admin zone
  useEffect(() => {
    // Activates the system cursor normalization defined in index.css
    document.body.classList.add("admin-mode");

    return () => {
      document.body.classList.remove("admin-mode");
    };
  }, []);

  return (
    // Base Layer: Strict background color, full viewport height, and selection colors
    <div className="relative flex min-h-screen w-full bg-[#f4f2ee] font-sans text-stone-900 antialiased selection:bg-brand selection:text-white">
      {/* Ambient Light Decorators (Ethereal UI - "Sacral Stained Glass" effect) */}
      <div
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        aria-hidden="true"
      >
        {/* VoctEnsemble Brand Blue Glow */}
        <div className="absolute -left-[12rem] -top-[8rem] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(0,35,149,0.08),transparent_70%)] blur-3xl mix-blend-multiply opacity-70" />
        {/* Warm Gold/Amber Glow */}
        <div className="absolute -bottom-[18rem] -right-[10rem] h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(217,119,6,0.08),transparent_70%)] blur-3xl mix-blend-multiply opacity-70" />
      </div>

      {/* Enterprise Modular Navigation Components */}
      <DesktopSidebar user={user} logout={logout} />
      <MobileNavigation user={user} logout={logout} />

      <main
        className="relative z-10 flex min-w-0 flex-1 flex-col px-4 pb-12 pt-24 transition-all duration-300 sm:px-6 md:pl-[120px] md:pr-8 md:pt-8 lg:pr-12"
        id="main-content"
      >
        {/* Maximum readable width container */}
        <div className="mx-auto flex h-full w-full max-w-7xl flex-col">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
