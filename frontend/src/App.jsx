/**
 * @file App.jsx
 * @description Main application routing and global layout orchestrator.
 * Handles cinematic page transitions, global navigation, and fixed UI overlays.
 * @author Krystian Bugalski
 */

import { useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

// --- LAYOUT & UI COMPONENTS ---
import GlobalNavbar from './components/layout/GlobalNavbar';
import OverlayMenu from './components/layout/OverlayMenu';
import FooterSection from './components/layout/FooterSection';
import PageTransition from './components/layout/PageTransition';
import CustomCursor from './components/ui/CustomCursor';
import NoiseOverlay from './components/ui/NoiseOverlay';
import Preloader from './components/ui/Preloader';
import ProtectedRoute from './components/layout/ProtectedRoute';
import DashboardLayout from './components/layout/DashboardLayout';

// --- PAGES ---
import Home from './pages/Home';
import Login from './pages/Login';

// --- PANEL COMPONENTS ---
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

export default function App() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // ==========================================
  // GLOBAL COMPONENTS VISIBILITY LOGIC
  // ==========================================
  
  // Determine if the current route is within the protected dashboard or login screen
  const isPanelRoute = location.pathname.startsWith('/panel');
  const isLoginRoute = location.pathname === '/login';
  
  // Hide global aesthetic components (like custom cursors and public nav) inside the operational panel
  const shouldShowGlobalComponents = !isPanelRoute && !isLoginRoute;

  return (
    <>
      {/* 1. GLOBAL PRELOADER & NAVBAR (Public Zone Only) */}
      {shouldShowGlobalComponents && <Preloader />}
      {shouldShowGlobalComponents && <GlobalNavbar menuOpen={menuOpen} setMenuOpen={setMenuOpen} />}

      {/* 2. CINEMATIC PAGE TRANSITION ENGINE */}
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          
          {/* --- PUBLIC ZONE --- */}
          <Route path="/" element={<PageTransition><Home /></PageTransition>} />
          <Route path="/login" element={<PageTransition><Login /></PageTransition>} />

          {/* --- PROTECTED ZONE (DASHBOARD) --- */}
          <Route element={<ProtectedRoute />}>
            <Route path="/panel" element={<DashboardLayout />}>
              
              {/* Dashboard Index */}
              <Route index element={<DashboardHome />} />

              {/* Administrative Sub-routes */}
              <Route path="contracts" element={<Contracts />} />
              <Route path="rehearsals" element={<Rehearsals />} />
              <Route path="artists" element={<ArtistManagement />} />
              <Route path="project-management" element={<ProjectManagement />} />
              <Route path="archive-management" element={<ArchiveManagement />} />
              <Route path="crew" element={<CrewManagement />} />

              {/* Artist Sub-routes */}
              <Route path="resources" element={<Resources/>} />
              <Route path="materials" element={<Materials />} />
              <Route path="schedule" element={<Schedule />} />
              
            </Route>
          </Route>

        </Routes>
      </AnimatePresence>

      {/* 3. FOOTER (Public Zone Only) */}
      {shouldShowGlobalComponents && <FooterSection />}

      {/* 4. GLOBAL UI OVERLAYS */}
      {shouldShowGlobalComponents && <OverlayMenu isOpen={menuOpen} setIsOpen={setMenuOpen} />}
      <NoiseOverlay />
      {shouldShowGlobalComponents && <CustomCursor />}
    </>
  );
}