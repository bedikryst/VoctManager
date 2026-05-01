/**
 * @file App.tsx
 * @description Main application routing, global layout orchestrator, and notification registry.
 * Dynamically resolves rendering trees based on active routes (Public vs. Secure Zones).
 * Implements Persistent App Shell architecture for the Dashboard with local route
 * suspension and idle preloading for panel modules.
 * @architecture Enterprise 2026 Standards
 * @module core/App
 */

import React, { Suspense, lazy, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { APIProvider } from "@vis.gl/react-google-maps";

import { GlobalNavbar } from "@/shared/widgets/layout/GlobalNavbar";
import { OverlayMenu } from "@/shared/widgets/layout/OverlayMenu";
import { FooterSection } from "@/shared/widgets/layout/FooterSection";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { CustomCursor } from "@/shared/ui/kinematics/CustomCursor";
import { NoiseOverlay } from "@/shared/ui/kinematics/NoiseOverlay";
import { Preloader } from "@/shared/ui/kinematics/Preloader";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import ProtectedRoute from "./router/ProtectedRoute";
import ManagerRoute from "./router/ManagerRoute";
import {
  DashboardLayout,
  type DashboardRoutePreloader,
} from "@/shared/widgets/layout/DashboardLayout";

import Home from "@pages/public/HomePage";

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

// Public routes are lazy-loaded while HomePage stays eager for LCP priority.
const Login = lazyWithPreload(() => import("@pages/public/LoginPage"));
const Activate = lazyWithPreload(() => import("@pages/public/ActivatePage"));

// Secure shell entry points are lazy-loaded and warmed after the dashboard shell mounts.
const DashboardHome = lazyWithPreload(
  () => import("@features/dashboard/DashboardHome"),
);
const SettingsPage = lazyWithPreload(() => import("@pages/app/SettingsPage"));
const LogisticsLocationsPage = lazyWithPreload(
  () => import("@pages/app/LogisticsLocationsPage"),
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
  () => import("@pages/app/ArtistsPage"),
);
const ProjectDashboard = lazyWithPreload(() =>
  import("@features/projects/ProjectDashboard").then((m) => ({
    default: m.ProjectDashboard,
  })),
);
const ArchiveManagement = lazyWithPreload(
  () => import("@pages/app/ArchivePage"),
);
const CrewManagement = lazyWithPreload(
  () => import("@features/crew/CrewManagement"),
);

// Standalone, fullscreen authed route — sibling of the dashboard shell, not nested in it.
const DocumentViewerPage = lazyWithPreload(
  () => import("@pages/app/DocumentViewerPage"),
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
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  const isPanelRoute: boolean = location.pathname.startsWith("/panel");
  const isDocumentViewerRoute: boolean =
    location.pathname.startsWith("/documents/");
  const isAuthRoute: boolean =
    location.pathname === "/login" || location.pathname === "/activate";

  const shouldShowGlobalComponents: boolean =
    !isPanelRoute && !isAuthRoute && !isDocumentViewerRoute;

  return (
    <CSRFProvider>
      <APIProvider
        apiKey={import.meta.env.VITE_GOOGLE_MAPS_FRONTEND_KEY || ""}
        onLoad={() => console.log("Maps API Core Initialized")}
        solutionChannel="GMP_visgl_reactgooglemaps_v1_0"
        version="weekly"
        libraries={["places", "geocoding"]}
      >
        {shouldShowGlobalComponents && <Preloader />}
        {shouldShowGlobalComponents && (
          <GlobalNavbar menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
        )}

        <Suspense fallback={<EtherealLoader />}>
          <Routes location={location}>
            <Route
              path="/"
              element={
                <PageTransition>
                  <Home />
                </PageTransition>
              }
            />
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

            <Route element={<ProtectedRoute />}>
              <Route
                path="/panel"
                element={
                  <DashboardLayout routePreloaders={PANEL_ROUTE_PRELOADERS} />
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
          </Routes>
        </Suspense>

        {shouldShowGlobalComponents && <FooterSection />}
        {shouldShowGlobalComponents && (
          <OverlayMenu isOpen={menuOpen} setIsOpen={setMenuOpen} />
        )}

        {shouldShowGlobalComponents && <NoiseOverlay />}
        {shouldShowGlobalComponents && <CustomCursor />}

        <Toaster position="top-right" richColors closeButton duration={4000} />
      </APIProvider>
    </CSRFProvider>
  );
}
