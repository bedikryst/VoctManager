/**
 * @file DashboardLayout.tsx
 * @description Master shell for the VoctManager Dashboard.
 * Implements the Persistent App Shell pattern. Delegates background kinetics
 * to isolated persistent layers and orchestrates content-only transitions.
 * @architecture Enterprise SaaS 2026
 * @module shared/widgets/layout/DashboardLayout
 */

import React, { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import { useAuth } from "@/app/providers/AuthProvider";
import { DesktopSidebar } from "./DesktopSidebar";
import { MobileNavigation } from "./mobile/MobileNavigation";
import { EtherealBackground } from "@/shared/ui/kinematics/EtherealBackground";
import { ProjectInvitationToasts } from "@/features/notifications/components/ProjectInvitationToasts";

export const DashboardLayout = (): React.JSX.Element => {
  const { user, logout } = useAuth();
  const location = useLocation();

  useEffect(() => {
    document.body.classList.add("admin-mode");
    return () => document.body.classList.remove("admin-mode");
  }, []);

  return (
    <div className="relative flex min-h-screen w-full bg-transparent font-sans text-ethereal-ink antialiased">
      <EtherealBackground />
      <DesktopSidebar user={user} logout={logout} />
      <MobileNavigation user={user} logout={logout} />
      <main
        className="relative z-10 flex min-w-0 flex-1 flex-col px-4 pt-8 pb-4 sm:px-6 md:pl-[104px] md:pr-8 md:pt-8 lg:pr-12"
        id="main-content"
      >
        <div className="mx-auto flex h-full w-full max-w-7xl flex-col relative">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 flex flex-col w-full h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      <ProjectInvitationToasts />;
    </div>
  );
};

DashboardLayout.displayName = "DashboardLayout";
