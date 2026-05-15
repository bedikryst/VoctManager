/**
 * @file App.tsx
 * @description Main application routing, global layout orchestrator, and notification registry.
 * Dynamically resolves rendering trees based on active routes (Marketing Site vs. Secure Panel).
 * Implements Persistent App Shell architecture for the Dashboard with local route
 * suspension and idle preloading for panel modules.
 * @architecture Enterprise 2026 Standards
 * @module core/App
 */

import React, { Suspense, lazy, useState, useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { APIProvider } from "@vis.gl/react-google-maps";

import { GlobalNavbar } from "@/widgets/marketing-shell/GlobalNavbar";
import { OverlayMenu } from "@/widgets/marketing-shell/OverlayMenu";
import { FooterSection } from "@/widgets/marketing-shell/FooterSection";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { CustomCursor } from "@/shared/ui/kinematics/CustomCursor";
import { NoiseOverlay } from "@/shared/ui/kinematics/NoiseOverlay";
import { Preloader } from "@/shared/ui/kinematics/Preloader";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import ProtectedRoute from "./router/ProtectedRoute";
import ManagerRoute from "./router/ManagerRoute";
import { PANEL_DATA_PRELOADERS } from "./router/panelDataPreloaders";
import {
  DashboardLayout,
  type DashboardRoutePreloader,
} from "@/widgets/panel-shell/DashboardLayout";

import Home from "@pages/marketing/HomePage";

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

// Marketing site pages are lazy-loaded while HomePage stays eager for LCP priority.
const EnsemblePage = lazyWithPreload(() => import("@pages/marketing/EnsemblePage"));
const ExperiencePage = lazyWithPreload(() => import("@pages/marketing/ExperiencePage"));
const FoundationPage = lazyWithPreload(() => import("@pages/marketing/FoundationPage"));
const DonatePage = lazyWithPreload(() => import("@pages/marketing/DonatePage"));
const CollaborationsPage = lazyWithPreload(() => import("@pages/marketing/CollaborationsPage"));
const ContactPage = lazyWithPreload(() => import("@pages/marketing/ContactPage"));

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

// Standalone, fullscreen authed route — sibling of the dashboard shell, not nested in it.
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
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  const isPanelRoute: boolean = location.pathname.startsWith("/panel");
  const isDocumentViewerRoute: boolean =
    location.pathname.startsWith("/documents/");
  const isAuthRoute: boolean =
    location.pathname === "/login" || location.pathname === "/activate";

  const shouldShowMarketingShell: boolean =
    !isPanelRoute && !isAuthRoute && !isDocumentViewerRoute;

  // DOM Theme Orchestrator
  useEffect(() => {
    if (shouldShowMarketingShell) {
      document.body.classList.add("theme-marketing");
      document.body.classList.remove("theme-panel", "bg-ethereal-snow", "text-ethereal-ink", "selection:bg-ethereal-gold/20");
    } else {
      document.body.classList.add("theme-panel", "bg-ethereal-snow", "text-ethereal-ink", "selection:bg-ethereal-gold/20");
      document.body.classList.remove("theme-marketing");
    }
  }, [shouldShowMarketingShell]);

  return (
    <CSRFProvider>
      <APIProvider
        apiKey={import.meta.env.VITE_GOOGLE_MAPS_FRONTEND_KEY || ""}
        onLoad={() => console.log("Maps API Core Initialized")}
        solutionChannel="GMP_visgl_reactgooglemaps_v1_0"
        version="weekly"
        libraries={["places", "geocoding"]}
      >
        {shouldShowMarketingShell && <Preloader />}
        {shouldShowMarketingShell && (
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
              path="/o-zespole"
              element={
                <PageTransition>
                  <EnsemblePage />
                </PageTransition>
              }
            />
            <Route
              path="/repertuar"
              element={
                <PageTransition>
                  <ExperiencePage />
                </PageTransition>
              }
            />
            <Route
              path="/fundacja"
              element={
                <PageTransition>
                  <FoundationPage />
                </PageTransition>
              }
            />
            <Route
              path="/darowizna"
              element={
                <PageTransition>
                  <DonatePage />
                </PageTransition>
              }
            />
            <Route
              path="/wspolpraca"
              element={
                <PageTransition>
                  <CollaborationsPage />
                </PageTransition>
              }
            />
            <Route
              path="/kontakt"
              element={
                <PageTransition>
                  <ContactPage />
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
                  <DashboardLayout
                    routePreloaders={PANEL_ROUTE_PRELOADERS}
                    dataPreloaders={PANEL_DATA_PRELOADERS}
                  />
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

        {shouldShowMarketingShell && <FooterSection />}
        {shouldShowMarketingShell && (
          <OverlayMenu isOpen={menuOpen} setIsOpen={setMenuOpen} />
        )}

        {shouldShowMarketingShell && <NoiseOverlay />}
        {shouldShowMarketingShell && <CustomCursor />}

        <Toaster position="top-right" richColors closeButton duration={4000} />
      </APIProvider>
    </CSRFProvider>
  );
}
