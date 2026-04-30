/**
 * @file App.tsx
 * @description Main application routing, global layout orchestrator, and notification registry.
 * Dynamically resolves rendering trees based on active routes (Public vs. Secure Zones).
 * Implements Persistent App Shell architecture for the Dashboard.
 * Route trees are code-split via React.lazy — HomePage stays eager for LCP priority,
 * every other page is loaded on demand behind a Suspense boundary.
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
import { DashboardLayout } from "@/shared/widgets/layout/DashboardLayout";

import Home from "@pages/public/HomePage";

import { CSRFProvider } from "@/app/providers/CSRFProvider";

// Public routes — lazy (HomePage stays eager above for LCP priority).
const Login = lazy(() => import("@pages/public/LoginPage"));
const Activate = lazy(() => import("@pages/public/ActivatePage"));

// Secure shell entry points — lazy.
const DashboardHome = lazy(() => import("@features/dashboard/DashboardHome"));
const SettingsPage = lazy(() => import("@pages/app/SettingsPage"));
const LogisticsLocationsPage = lazy(
  () => import("@pages/app/LogisticsLocationsPage"),
);
const Schedule = lazy(() => import("@features/schedule/Schedule"));
const Materials = lazy(() =>
  import("@features/materials/Materials").then((m) => ({
    default: m.Materials,
  })),
);
const ChoristerHubPage = lazy(
  () => import("@features/chorister-hub/ChoristerHubPage"),
);

// Manager-only feature trees — lazy. These are heavy (panels, dnd, react-pdf, maps).
const Contracts = lazy(() => import("@features/contracts/Contracts"));
const Rehearsals = lazy(() => import("@features/rehearsals/Rehearsals"));
const ArtistManagement = lazy(() => import("@pages/app/ArtistsPage"));
const ProjectDashboard = lazy(() =>
  import("@features/projects/ProjectDashboard").then((m) => ({
    default: m.ProjectDashboard,
  })),
);
const ArchiveManagement = lazy(() => import("@pages/app/ArchivePage"));
const CrewManagement = lazy(() => import("@features/crew/CrewManagement"));

export default function App(): React.JSX.Element {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  const isPanelRoute: boolean = location.pathname.startsWith("/panel");
  const isAuthRoute: boolean =
    location.pathname === "/login" || location.pathname === "/activate";

  const shouldShowGlobalComponents: boolean = !isPanelRoute && !isAuthRoute;

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
              <Route path="/panel" element={<DashboardLayout />}>
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
