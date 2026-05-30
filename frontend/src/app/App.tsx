/**
 * @file App.tsx
 * @description Main application routing, global layout orchestrator, and notification registry.
 * Dynamically resolves rendering trees for the secure panel and public auth routes.
 * Implements Persistent App Shell architecture for the Dashboard with local route
 * suspension and idle preloading for panel modules.
 * @architecture Enterprise 2026 Standards
 * @module core/App
 */

import React, { Suspense, lazy, useEffect } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { APIProvider } from "@vis.gl/react-google-maps";

import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import ProtectedRoute from "./router/ProtectedRoute";
import ManagerRoute from "./router/ManagerRoute";
import { PANEL_DATA_PRELOADERS } from "./router/panelDataPreloaders";
import {
  DashboardLayout,
  type DashboardRoutePreloader,
} from "@/widgets/panel-shell/DashboardLayout";

import { CSRFProvider } from "@/app/providers/CSRFProvider";

type RouteComponent = React.ComponentType;
type RouteModule<TComponent extends RouteComponent = RouteComponent> = {
  default: TComponent;
};

type PreloadableRoute<TComponent extends RouteComponent = RouteComponent> =
  React.LazyExoticComponent<TComponent> & {
    preload: () => Promise<RouteModule<TComponent>>;
  };

function lazyWithPreload<TComponent extends RouteComponent>(
  factory: () => Promise<RouteModule<TComponent>>,
): PreloadableRoute<TComponent> {
  let modulePromise: Promise<RouteModule<TComponent>> | undefined;

  const load = () => {
    modulePromise ??= factory();
    return modulePromise;
  };

  const Component = lazy(load) as PreloadableRoute<TComponent>;
  Component.preload = load;

  return Component;
}

// Auth routes are public and lazy-loaded.
const Login = lazyWithPreload(() => import("@pages/auth/LoginPage"));
const Activate = lazyWithPreload(() => import("@pages/auth/ActivatePage"));

// Secure shell entry points are lazy-loaded and warmed after the dashboard shell mounts.
const DashboardHome = lazyWithPreload(
  () => import("@features/dashboard/DashboardHome"),
);
const SettingsPage = lazyWithPreload(() => import("@pages/panel/SettingsPage"));
const LogisticsLocationsPage = lazyWithPreload(
  () => import("@pages/panel/LogisticsLocationsPage"),
);
const Schedule = lazyWithPreload(() => import("@features/schedule/Schedule"));
const Materials = lazyWithPreload(() =>
  import("@features/materials/Materials").then((m) => ({
    default: m.Materials,
  })),
);
const ChoristerHubPage = lazyWithPreload(
  () => import("@features/chorister-hub/ChoristerHubPage"),
);

// Manager-only feature trees remain lazy, then preload only for manager sessions.
const Contracts = lazyWithPreload(
  () => import("@features/contracts/Contracts"),
);
const Rehearsals = lazyWithPreload(
  () => import("@features/rehearsals/Rehearsals"),
);
const ArtistManagement = lazyWithPreload(
  () => import("@pages/panel/ArtistsPage"),
);
const ProjectDashboard = lazyWithPreload(() =>
  import("@features/projects/ProjectDashboard").then((m) => ({
    default: m.ProjectDashboard,
  })),
);
const ArchiveManagement = lazyWithPreload(
  () => import("@pages/panel/ArchivePage"),
);
const CrewManagement = lazyWithPreload(
  () => import("@features/crew/CrewManagement"),
);

// Standalone, fullscreen authed route; sibling of the dashboard shell, not nested in it.
const DocumentViewerPage = lazyWithPreload(
  () => import("@pages/panel/DocumentViewerPage"),
);

const PANEL_ROUTE_PRELOADERS: readonly DashboardRoutePreloader[] = [
  { preload: DashboardHome.preload },
  { preload: SettingsPage.preload },
  { preload: ChoristerHubPage.preload },
  { preload: Materials.preload },
  { preload: Schedule.preload },
  { scope: "manager", preload: Contracts.preload },
  { scope: "manager", preload: Rehearsals.preload },
  { scope: "manager", preload: ArtistManagement.preload },
  { scope: "manager", preload: ProjectDashboard.preload },
  { scope: "manager", preload: ArchiveManagement.preload },
  { scope: "manager", preload: CrewManagement.preload },
  { scope: "manager", preload: LogisticsLocationsPage.preload },
];

export default function App(): React.JSX.Element {
  const location = useLocation();

  useEffect(() => {
    document.body.classList.add(
      "theme-panel",
      "bg-ethereal-snow",
      "text-ethereal-ink",
      "selection:bg-ethereal-gold/20",
    );
    document.body.classList.remove(
      "theme-marketing",
      "page-o-nas",
      "page-kontakt",
      "page-koncerty",
    );
  }, [location.pathname]);

  return (
    <CSRFProvider>
      {/*
       * Suspense strategy: EtherealLoader is panel-only.
       *  - Auth lazy routes (`/login`, `/activate`) and `/documents/*` suspend
       *    against the outer boundary with a `null` fallback, so no global
       *    spinner flashes on public auth or full-screen authed surfaces.
       *  - Only `/panel/*` lazy chunks resolve against the inner boundary
       *    that renders <EtherealLoader />.
       *
       * Google Maps APIProvider is scoped inside <ProtectedRoute>, so the Maps
       * SDK ships only to authenticated panel surfaces that use logistics maps.
       */}
      <Suspense fallback={null}>
        <Routes location={location}>
          <Route path="/" element={<Navigate to="/panel" replace />} />
          <Route
            path="/login"
            element={
              <PageTransition>
                <Login />
              </PageTransition>
            }
          />
          <Route
            path="/activate"
            element={
              <PageTransition>
                <Activate />
              </PageTransition>
            }
          />

          <Route
            element={
              <APIProvider
                apiKey={import.meta.env.VITE_GOOGLE_MAPS_FRONTEND_KEY || ""}
                solutionChannel="GMP_visgl_reactgooglemaps_v1_0"
                version="weekly"
                libraries={["places", "geocoding"]}
              >
                <ProtectedRoute />
              </APIProvider>
            }
          >
            <Route
              path="/panel"
              element={
                <Suspense fallback={<EtherealLoader />}>
                  <DashboardLayout
                    routePreloaders={PANEL_ROUTE_PRELOADERS}
                    dataPreloaders={PANEL_DATA_PRELOADERS}
                  />
                </Suspense>
              }
            >
              <Route index element={<DashboardHome />} />
              <Route element={<ManagerRoute />}>
                <Route path="contracts" element={<Contracts />} />
                <Route path="rehearsals" element={<Rehearsals />} />
                <Route path="artists" element={<ArtistManagement />} />
                <Route path="projects" element={<ProjectDashboard />} />
                <Route
                  path="archive-management"
                  element={<ArchiveManagement />}
                />
                <Route path="crew" element={<CrewManagement />} />
                <Route
                  path="locations"
                  element={<LogisticsLocationsPage />}
                />
              </Route>
              <Route path="resources" element={<ChoristerHubPage />} />
              <Route path="materials" element={<Materials />} />
              <Route path="schedule" element={<Schedule />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            <Route
              path="/documents/:docType/:docId"
              element={<DocumentViewerPage />}
            />
          </Route>

          <Route path="*" element={<Navigate to="/panel" replace />} />
        </Routes>
      </Suspense>

      <Toaster position="top-right" richColors closeButton duration={4000} />
    </CSRFProvider>
  );
}
