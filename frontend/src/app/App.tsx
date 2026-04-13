/**
 * @file App.tsx
 * @description Main application routing, global layout orchestrator, and notification registry.
 * Dynamically resolves rendering trees based on active routes (Public vs. Secure Zones).
 * @architecture Enterprise 2026 Standards
 * @module core/App
 */

import React, { useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Toaster } from "sonner";
import { APIProvider } from "@vis.gl/react-google-maps";

import GlobalNavbar from "@/widgets/layout/public/GlobalNavbar";
import OverlayMenu from "@/widgets/layout/public/OverlayMenu";
import FooterSection from "@/widgets/layout/public/FooterSection";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { CustomCursor } from "@/shared/ui/kinematics/CustomCursor";
import { NoiseOverlay } from "@/shared/ui/kinematics/NoiseOverlay";
import { Preloader } from "@/shared/ui/kinematics/Preloader";
import ProtectedRoute from "./router/ProtectedRoute";
import ManagerRoute from "./router/ManagerRoute";
import DashboardLayout from "@/widgets/layout/dashboard/DashboardLayout";
import SettingsPage from "@pages/app/SettingsPage";
import LogisticsLocationsPage from "@pages/app/LogisticsLocationsPage";

import Home from "@pages/public/HomePage";
import Login from "@pages/public/LoginPage";
import Activate from "@pages/public/ActivatePage";

import Contracts from "@features/contracts/Contracts";
import DashboardHome from "@features/dashboard/DashboardHome";
import Rehearsals from "@features/rehearsals/Rehearsals";
import Materials from "@features/materials/Materials";
import Schedule from "@features/schedule/Schedule";
import ArtistManagement from "@pages/app/ArtistsPage";
import ProjectManagement from "@features/projects/ProjectDashboard";
import ArchiveManagement from "@pages/app/ArchivePage";
import Resources from "@features/resources/Resources";
import CrewManagement from "@features/crew/CrewManagement";

export default function App(): React.JSX.Element {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  const isPanelRoute: boolean = location.pathname.startsWith("/panel");
  const isAuthRoute: boolean =
    location.pathname === "/login" || location.pathname === "/activate";

  const shouldShowGlobalComponents: boolean = !isPanelRoute && !isAuthRoute;

  return (
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

      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
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
                <Route
                  path="project-management"
                  element={<ProjectManagement />}
                />
                <Route
                  path="archive-management"
                  element={<ArchiveManagement />}
                />
                <Route path="crew" element={<CrewManagement />} />
                <Route path="locations" element={<LogisticsLocationsPage />} />
              </Route>
              <Route path="resources" element={<Resources />} />
              <Route path="materials" element={<Materials />} />
              <Route path="schedule" element={<Schedule />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Routes>
      </AnimatePresence>

      {shouldShowGlobalComponents && <FooterSection />}
      {shouldShowGlobalComponents && (
        <OverlayMenu isOpen={menuOpen} setIsOpen={setMenuOpen} />
      )}

      {shouldShowGlobalComponents && <NoiseOverlay />}
      {shouldShowGlobalComponents && <CustomCursor />}

      <Toaster position="top-right" richColors closeButton duration={4000} />
    </APIProvider>
  );
}
