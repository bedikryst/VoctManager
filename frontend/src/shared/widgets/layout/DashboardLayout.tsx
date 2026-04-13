/**
 * @file DashboardLayout.tsx
 * @description Master shell for the VoctManager Dashboard.
 * Optimised for zero-latency performance with deep, static Ethereal UI pigmentation.
 * Provides the perfect backdrop for advanced glassmorphism refraction.
 * @architecture Enterprise SaaS 2026
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
    {/* Global Noise - Retained for organic texture integrity */}
    <div className="absolute inset-0 bg-noise opacity-[0.03] mix-blend-multiply" />

    {/* Ethereal Gold - Amplified pigmentation for deeper refraction */}
    <div className="absolute -left-[5%] -top-[5%] h-[45vw] w-[45vw] rounded-full bg-ethereal-gold/30 blur-[100px] mix-blend-multiply" />

    {/* Ethereal Sage - Amplified grounding presence */}
    <div className="absolute -bottom-[10%] -right-[5%] h-[55vw] w-[55vw] rounded-full bg-ethereal-sage/30 blur-[120px] mix-blend-multiply" />

    {/* Center Safe Zone - Neutral marble light to preserve typography legibility */}
    <div className="absolute left-1/2 top-1/2 h-[70vh] w-[70vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ethereal-marble/40 blur-[80px]" />
  </div>
);

export const DashboardLayout = (): React.JSX.Element => {
  const { user, logout } = useAuth();

  // Enforce system cursor and administrative mode styling
  useEffect(() => {
    document.body.classList.add("admin-mode");
    return () => {
      document.body.classList.remove("admin-mode");
    };
  }, []);

  return (
    <div className="relative flex min-h-screen w-full bg-transparent font-sans text-ethereal-ink antialiased">
      {/* Static Decorators Layer */}
      <AmbientDecorators />

      <DesktopSidebar user={user} logout={logout} />
      <MobileNavigation user={user} logout={logout} />

      <main
        className="relative z-10 flex min-w-0 flex-1 flex-col px-4 pb-12 pt-24 transition-all duration-300 sm:px-6 md:pl-[120px] md:pr-8 md:pt-8 lg:pr-12"
        id="main-content"
      >
        <div className="mx-auto flex h-full w-full max-w-7xl flex-col">
          {/* Viewport for the application's domain content */}
          <Outlet />
        </div>
      </main>
    </div>
  );
};
