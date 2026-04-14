/**
 * @file DashboardLayout.tsx
 * @description Master shell for the VoctManager Dashboard.
 * Fixed rendering bug: Replaced SVG stave with DOM nodes so backdrop-filter can refract them.
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
    {/* WARSTWA 1: Oryginalne Plamy - Prześwitują idealnie */}
    <div className="absolute -left-[5%] -top-[5%] h-[45vw] w-[45vw] rounded-full bg-ethereal-gold/30 blur-[100px] mix-blend-multiply" />
    <div className="absolute -bottom-[10%] -right-[5%] h-[55vw] w-[55vw] rounded-full bg-ethereal-sage/30 blur-[120px] mix-blend-multiply" />
    <div className="absolute left-1/2 top-1/2 h-[70vh] w-[70vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ethereal-marble/40 blur-[80px]" />

    <div className="absolute inset-0 flex items-center justify-center opacity-[0.45]">
      <motion.div
        className="w-[300vw] h-[300vh] flex flex-col justify-center -rotate-12"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.2 } },
        }}
      >
        {[1, 2, 3, 4, 5].map((_, index) => (
          <motion.div
            key={`stave-line-${index}`}
            className="w-full h-[1px] bg-ethereal-ink mb-[40px] last:mb-0 shadow-[0_0_2px_rgba(166,146,121,0.5)]"
            style={{ originX: 0 }}
            variants={{
              hidden: { scaleX: 0, opacity: 0 },
              visible: {
                scaleX: 1.1,
                opacity: 1,
                transition: { duration: 3.5, ease: [0.25, 0.1, 0.25, 1] },
              },
            }}
          />
        ))}
      </motion.div>
    </div>

    {/* WARSTWA 3: SZUM */}
    <div className="absolute inset-0 bg-noise opacity-[0.035] mix-blend-overlay" />
  </div>
);

export const DashboardLayout = (): React.JSX.Element => {
  const { user, logout } = useAuth();

  useEffect(() => {
    document.body.classList.add("admin-mode");
    return () => {
      document.body.classList.remove("admin-mode");
    };
  }, []);

  return (
    <div className="relative flex min-h-screen w-full bg-transparent font-sans text-ethereal-ink antialiased">
      <SacralBackdrop />

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

DashboardLayout.displayName = "DashboardLayout";
