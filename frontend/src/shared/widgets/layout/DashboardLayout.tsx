/**
 * @file DashboardLayout.tsx
 * @description Master shell for the VoctManager Dashboard.
 * Includes Chiaroscuro vignette (Oculus Effect) for depth rendering.
 * @architecture Enterprise SaaS 2026
 * @module shared/widgets/layout/DashboardLayout
 */

import React, { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { motion } from "framer-motion";

import { useAuth } from "@/app/providers/AuthProvider";
import { DesktopSidebar } from "./DesktopSidebar";
import { MobileNavigation } from "./MobileNavigation";

const SacralBackdrop = (): React.JSX.Element => (
  <div
    className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-ethereal-alabaster"
    aria-hidden="true"
  >
    <div
      className="absolute inset-0"
      style={{ transform: "translateZ(0)", willChange: "transform" }}
    >
      {/* LAYER 0: The Oculus Vignette (Chiaroscuro Base) */}
      {/* Skupia "światło" na górnym centrum, przyciemniając peryferia ekranu */}
      <div className="absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_top,transparent_10%,rgba(22,20,18,0.06)_100%)]" />

      {/* LAYER 1: Core Ethereal Glows (Sub-pixel rendering) */}
      <div className="absolute -left-[5%] -top-[5%] z-[2] h-[45vw] w-[45vw] rounded-full bg-ethereal-gold/20 blur-[100px] mix-blend-multiply" />
      <div className="absolute -bottom-[50%] -right-[10%] z-[2] h-[55vw] w-[55vw] rounded-full bg-ethereal-amethyst/15 blur-[100px] mix-blend-multiply" />

      {/* LAYER 2: The Kinematic Stave */}
      <div className="absolute inset-0 z-[3] flex items-center justify-center">
        <motion.div
          className="flex h-[300vh] w-[300vw] -rotate-[8deg] flex-col justify-center"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.15 } },
          }}
        >
          {[1, 2, 3, 4, 5].map((_, index) => (
            <motion.div
              key={`stave-line-${index}`}
              className="mb-[50px] h-[1px] w-full bg-gradient-to-r from-transparent via-ethereal-incense/80 to-transparent shadow-[0_0_8px_rgba(194,168,120,0.35)] last:mb-0 will-change-[width,opacity]"
              variants={{
                hidden: { width: "0%", opacity: 0 },
                visible: {
                  width: "100%",
                  opacity: 1,
                  transition: { duration: 8, ease: [0.16, 1, 0.3, 1] },
                },
              }}
            />
          ))}
        </motion.div>
      </div>

      {/* LAYER 3: Micro-noise (Film Grain) */}
      <div className="absolute inset-0 z-[4] bg-noise opacity-[0.025] mix-blend-overlay" />
    </div>
  </div>
);

export const DashboardLayout = (): React.JSX.Element => {
  const { user, logout } = useAuth();

  useEffect(() => {
    document.body.classList.add("admin-mode");
    return () => document.body.classList.remove("admin-mode");
  }, []);

  return (
    <div className="relative flex min-h-screen w-full bg-transparent font-sans text-ethereal-ink antialiased">
      <a
        href="#main-content"
        className="sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:not-sr-only focus:rounded-full focus:bg-ethereal-ink focus:px-4 focus:py-2 focus:text-ethereal-marble focus:outline-none focus:ring-2 focus:ring-ethereal-gold"
      >
        Przejdź do głównej treści
      </a>

      <SacralBackdrop />

      <DesktopSidebar user={user} logout={logout} />
      <MobileNavigation user={user} logout={logout} />

      <main
        className="relative z-10 flex min-w-0 flex-1 flex-col px-4 pb-12 pt-24 transition-all duration-300 sm:px-6 md:pl-[var(--sidebar-width)] md:pr-8 md:pt-8 lg:pr-12"
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
