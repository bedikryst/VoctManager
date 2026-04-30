/**
 * @file DashboardLayout.tsx
 * @description Master shell for the VoctManager Dashboard.
 * Implements the Persistent App Shell pattern. Delegates background kinetics
 * to isolated persistent layers and orchestrates content-only transitions.
 * @architecture Enterprise SaaS 2026
 * @module shared/widgets/layout/DashboardLayout
 */

import React, { Suspense, useEffect } from "react";
import { useLocation, useOutlet } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import { useAuth } from "@/app/providers/AuthProvider";
import { isManager } from "@/shared/auth/rbac";
import { DesktopSidebar } from "./DesktopSidebar";
import { MobileNavigation } from "./mobile/MobileNavigation";
import { EtherealBackground } from "@/shared/ui/kinematics/EtherealBackground";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { ProjectInvitationToasts } from "@/features/notifications/components/ProjectInvitationToasts";
import { CustomAdminMessageToast } from "@/features/notifications/components/CustomAdminMessageToast";

export interface DashboardRoutePreloader {
  readonly preload: () => Promise<unknown>;
  readonly scope?: "manager";
}

interface DashboardLayoutProps {
  readonly routePreloaders?: readonly DashboardRoutePreloader[];
}

const EMPTY_ROUTE_PRELOADERS: readonly DashboardRoutePreloader[] = [];
const ROUTE_PRELOAD_IDLE_TIMEOUT_MS = 2500;
const ROUTE_PRELOAD_FALLBACK_DELAY_MS = 600;

const DashboardRouteFallback = (): React.JSX.Element => (
  <div className="flex min-h-[420px] w-full items-center justify-center">
    <EtherealLoader fullHeight={false} />
  </div>
);

export const DashboardLayout = ({
  routePreloaders = EMPTY_ROUTE_PRELOADERS,
}: DashboardLayoutProps): React.JSX.Element => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const canPreloadManagerRoutes = isManager(user);

  const outlet = useOutlet();

  useEffect(() => {
    document.body.classList.add("admin-mode");
    return () => document.body.classList.remove("admin-mode");
  }, []);

  useEffect(() => {
    if (routePreloaders.length === 0) return;

    const preloadEligibleRoutes = () => {
      const preloadTasks = routePreloaders
        .filter(
          ({ scope }) => scope !== "manager" || canPreloadManagerRoutes,
        )
        .map(({ preload }) => preload());

      void Promise.allSettled(preloadTasks);
    };

    const scheduleIdleCallback =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback.bind(window)
        : undefined;
    const cancelScheduledIdleCallback =
      typeof window.cancelIdleCallback === "function"
        ? window.cancelIdleCallback.bind(window)
        : undefined;

    if (scheduleIdleCallback && cancelScheduledIdleCallback) {
      const idleCallbackId = scheduleIdleCallback(preloadEligibleRoutes, {
        timeout: ROUTE_PRELOAD_IDLE_TIMEOUT_MS,
      });

      return () => cancelScheduledIdleCallback(idleCallbackId);
    }

    const timeoutId = window.setTimeout(
      preloadEligibleRoutes,
      ROUTE_PRELOAD_FALLBACK_DELAY_MS,
    );

    return () => window.clearTimeout(timeoutId);
  }, [canPreloadManagerRoutes, routePreloaders]);

  return (
    <div className="relative flex min-h-screen w-full bg-transparent font-sans text-ethereal-ink antialiased">
      <EtherealBackground />
      <DesktopSidebar user={user} logout={logout} />
      <MobileNavigation user={user} logout={logout} />
      <main
        className="relative z-10 flex min-w-0 flex-1 flex-col px-4 pt-5 pb-4 sm:px-6 md:pl-[104px] md:pr-8 md:pt-8 lg:pr-12"
        id="main-content"
      >
        <div className="mx-auto flex h-full w-full max-w-7xl flex-col relative">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 flex flex-col w-full h-full"
            >
              <Suspense fallback={<DashboardRouteFallback />}>
                {outlet}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      <ProjectInvitationToasts />
      <CustomAdminMessageToast />
    </div>
  );
};

DashboardLayout.displayName = "DashboardLayout";
