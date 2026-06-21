/**
 * @file DashboardLayout.tsx
 * @description Master shell for the VoctManager Dashboard.
 * Implements the Persistent App Shell pattern. Delegates background kinetics
 * to isolated persistent layers and orchestrates content-only transitions.
 * @architecture Enterprise SaaS 2026
 * @module widgets/panel-shell/DashboardLayout
 */

import React, { Suspense, useEffect } from "react";
import { useLocation, useOutlet } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";

import { useAuth } from "@/app/providers/AuthProvider";
import type { AuthUser } from "@/shared/auth/auth.types";
import { isArtist, isManager } from "@/shared/auth/rbac";
import { DesktopSidebar } from "./DesktopSidebar";
import { MobileNavigation } from "./mobile/MobileNavigation";
import { CommandPaletteProvider } from "./command/CommandPaletteProvider";
import { EtherealBackground } from "@/shared/ui/kinematics/EtherealBackground";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { ProjectInvitationToasts } from "@/features/notifications/components/ProjectInvitationToasts";
import { CustomAdminMessageToast } from "@/features/notifications/components/CustomAdminMessageToast";
import { useOfflineSync } from "@/shared/offline/useOfflineSync";
import { OfflineStatusBadge } from "@/shared/offline/OfflineStatusBadge";
import { InstallAppPrompt } from "@/shared/pwa/InstallAppPrompt";

export interface DashboardRoutePreloader {
  readonly preload: () => Promise<unknown>;
  readonly scope?: "manager";
}

export interface DashboardDataPreloader {
  readonly preload: (context: {
    readonly queryClient: QueryClient;
    readonly user: AuthUser;
  }) => Promise<unknown>;
  readonly scope?: "artist" | "manager";
}

interface DashboardLayoutProps {
  readonly routePreloaders?: readonly DashboardRoutePreloader[];
  readonly dataPreloaders?: readonly DashboardDataPreloader[];
}

const EMPTY_ROUTE_PRELOADERS: readonly DashboardRoutePreloader[] = [];
const EMPTY_DATA_PRELOADERS: readonly DashboardDataPreloader[] = [];
const ROUTE_PRELOAD_IDLE_TIMEOUT_MS = 2500;
const ROUTE_PRELOAD_FALLBACK_DELAY_MS = 600;
const DATA_PRELOAD_IDLE_TIMEOUT_MS = 1200;
const DATA_PRELOAD_FALLBACK_DELAY_MS = 120;

const DashboardRouteFallback = (): React.JSX.Element => (
  <div className="flex min-h-[420px] w-full items-center justify-center">
    <EtherealLoader fullHeight={false} />
  </div>
);

export const DashboardLayout = ({
  routePreloaders = EMPTY_ROUTE_PRELOADERS,
  dataPreloaders = EMPTY_DATA_PRELOADERS,
}: DashboardLayoutProps): React.JSX.Element => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const offlineSync = useOfflineSync();
  const canPreloadArtistRoutes = isArtist(user);
  const canPreloadManagerRoutes = isManager(user);

  const outlet = useOutlet();

  // Collapse hubs whose sub-routes are in-page tabs (project hub, settings) into a
  // single transition key, so switching tabs keeps the page mounted — header, nav
  // and loaded data persist instead of the whole shell exiting + re-animating.
  // Every other route keeps its full-path key and transitions normally.
  const collapsedHubMatch =
    /^(\/panel\/projects\/[^/]+|\/panel\/settings)/.exec(location.pathname);
  const transitionKey = collapsedHubMatch ? collapsedHubMatch[1] : location.pathname;

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

  useEffect(() => {
    if (!user || dataPreloaders.length === 0) return;

    const preloadEligibleData = () => {
      const preloadTasks = dataPreloaders
        .filter(({ scope }) => {
          if (scope === "manager") return canPreloadManagerRoutes;
          if (scope === "artist") return canPreloadArtistRoutes;
          return true;
        })
        .map(({ preload }) => preload({ queryClient, user }));

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
      const idleCallbackId = scheduleIdleCallback(preloadEligibleData, {
        timeout: DATA_PRELOAD_IDLE_TIMEOUT_MS,
      });

      return () => cancelScheduledIdleCallback(idleCallbackId);
    }

    const timeoutId = window.setTimeout(
      preloadEligibleData,
      DATA_PRELOAD_FALLBACK_DELAY_MS,
    );

    return () => window.clearTimeout(timeoutId);
  }, [
    canPreloadArtistRoutes,
    canPreloadManagerRoutes,
    dataPreloaders,
    queryClient,
    user,
  ]);

  return (
    <CommandPaletteProvider user={user}>
    <div className="relative flex min-h-screen w-full bg-transparent font-sans text-ethereal-ink antialiased">
      <EtherealBackground />
      <DesktopSidebar user={user} logout={logout} />
      <MobileNavigation user={user} logout={logout} />
      <main
        className="relative z-10 flex min-w-0 flex-1 flex-col px-4 pt-5 pb-nav-dock transition-[padding] duration-300 ease-out sm:px-6 fine-pointer:pl-[calc(var(--sidebar-pad,var(--spacing-sidebar))+1.5rem)] fine-pointer:pr-6 fine-pointer:pt-6"
        id="main-content"
      >
        <div className="relative mx-auto flex h-full w-full max-w-[1500px] flex-col">
          <Suspense fallback={<DashboardRouteFallback />}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={transitionKey}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="flex-1 flex flex-col w-full h-full"
              >
                {outlet}
              </motion.div>
            </AnimatePresence>
          </Suspense>
        </div>
      </main>
      <ProjectInvitationToasts />
      <CustomAdminMessageToast />
      {/* Bottom dock — stacks the transient offline + install affordances so they
          never overlap, clear of the mobile nav (safe-area aware). Sits a notch
          higher than the editor save bars so an offline badge is never hidden by
          one. Lives at body level already, so no Portal is needed here. */}
      <div className="fixed inset-x-0 bottom-[calc(var(--nav-dock-h)+2.25rem)] z-40 flex flex-col items-center gap-2">
        <OfflineStatusBadge {...offlineSync} />
        <InstallAppPrompt />
      </div>
    </div>
    </CommandPaletteProvider>
  );
};

DashboardLayout.displayName = "DashboardLayout";
