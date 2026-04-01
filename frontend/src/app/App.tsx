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

import GlobalNavbar from '../widgets/layout/public/GlobalNavbar';
import OverlayMenu from '../widgets/layout/public/OverlayMenu';
import FooterSection from '../widgets/layout/public/FooterSection';
import PageTransition from '../shared/ui/PageTransition';
import CustomCursor from '../shared/ui/CustomCursor';
import NoiseOverlay from '../shared/ui/NoiseOverlay';
import Preloader from '../shared/ui/Preloader';
import ProtectedRoute from './widgets/layout/public/ProtectedRoute';
import DashboardLayout from './features/layout/DashboardLayout';

import Home from '../pages/public/HomePage';
import Login from '../pages/public/LoginPage';

import Contracts from './features/panel/contracts/Contracts';
import DashboardHome from './features/panel/dashboard/DashboardHome';
import Rehearsals from '../features/rehearsals/Rehearsals';
import Materials from './features/panel/materials/Materials';
import Schedule from './features/panel/schedule/Schedule';
import ArtistManagement from './features/panel/artists/ArtistManagement';
import ProjectManagement from '../features/projects/ProjectDashboard';
import ArchiveManagement from './features/panel/archive/ArchiveManagement';
import Resources from './features/panel/Resources';
import CrewManagement from './features/panel/crew/CrewManagement';

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