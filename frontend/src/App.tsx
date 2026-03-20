/**
 * @file App.tsx
 * @description Main application routing, global layout orchestrator, and notification registry.
 * Dynamically resolves rendering trees based on active routes (Public vs. Secure Zones).
 * @architecture Enterprise 2026 Standards
 * @module core/App
 */

import React, { useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'sonner';

import GlobalNavbar from './components/layout/GlobalNavbar';
import OverlayMenu from './components/layout/OverlayMenu';
import FooterSection from './components/layout/FooterSection';
import PageTransition from './components/layout/PageTransition';
import CustomCursor from './components/ui/CustomCursor';
import NoiseOverlay from './components/ui/NoiseOverlay';
import Preloader from './components/ui/Preloader';
import ProtectedRoute from './components/layout/ProtectedRoute';
import DashboardLayout from './components/layout/DashboardLayout';

import Home from './pages/Home';
import Login from './pages/Login';

import Contracts from './components/panel/Contracts';
import DashboardHome from './components/panel/DashboardHome';
import Rehearsals from './components/panel/Rehearsals';
import Materials from './components/panel/Materials';
import Schedule from './components/panel/Schedule';
import ArtistManagement from './components/panel/ArtistManagement';
import ProjectManagement from './components/panel/projects/ProjectDashboard';
import ArchiveManagement from './components/panel/archive/ArchiveManagement';
import Resources from './components/panel/Resources';
import CrewManagement from './components/panel/CrewManagement';

export default function App(): React.JSX.Element {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  const isPanelRoute: boolean = location.pathname.startsWith('/panel');
  const isLoginRoute: boolean = location.pathname === '/login';
  
  const shouldShowGlobalComponents: boolean = !isPanelRoute && !isLoginRoute;

  return (
    <>
      {shouldShowGlobalComponents && <Preloader />}
      {shouldShowGlobalComponents && <GlobalNavbar menuOpen={menuOpen} setMenuOpen={setMenuOpen} />}

      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          
          <Route path="/" element={<PageTransition><Home /></PageTransition>} />
          <Route path="/login" element={<PageTransition><Login /></PageTransition>} />

          <Route element={<ProtectedRoute />}>
            <Route path="/panel" element={<DashboardLayout />}>
              <Route index element={<DashboardHome />} />
              <Route path="contracts" element={<Contracts />} />
              <Route path="rehearsals" element={<Rehearsals />} />
              <Route path="artists" element={<ArtistManagement />} />
              <Route path="project-management" element={<ProjectManagement />} />
              <Route path="archive-management" element={<ArchiveManagement />} />
              <Route path="crew" element={<CrewManagement />} />
              <Route path="resources" element={<Resources/>} />
              <Route path="materials" element={<Materials />} />
              <Route path="schedule" element={<Schedule />} />
            </Route>
          </Route>

        </Routes>
      </AnimatePresence>

      {shouldShowGlobalComponents && <FooterSection />}
      {shouldShowGlobalComponents && <OverlayMenu isOpen={menuOpen} setIsOpen={setMenuOpen} />}
      
      <NoiseOverlay />
      {shouldShowGlobalComponents && <CustomCursor />}
      
      <Toaster position="top-right" richColors closeButton duration={4000} />
    </>
  );
}