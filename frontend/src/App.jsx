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
// import Experience from './pages/Experience';
// import Ensemble from './pages/Ensemble';
// import Foundation from './pages/Foundation';
// import Donate from './pages/Donate';
// import Collaborations from './pages/Collaborations';
// import Contact from './pages/Contact';

// --- PANEL COMPONENTS ---
import Contracts from './components/panel/Contracts';
import DashboardHome from './components/panel/DashboardHome';
import Projects from './components/panel/Projects';
import Repertoire from './components/panel/Repertoire';
import Rehearsals from './components/panel/Rehearsals';
import ProgramBuilder from './components/panel/ProgramBuilder';
import Materials from './components/panel/Materials';
import Schedule from './components/panel/Schedule';

export default function App() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // ==========================================
  // LOGIKA WIDOCZNOŚCI GLOBALNYCH KOMPONENTÓW
  // ==========================================
  
  // Zamiast tablicy, sprawdzamy czy ścieżka zaczyna się od /panel lub jest logowaniem
  const isPanelRoute = location.pathname.startsWith('/panel');
  const isLoginRoute = location.pathname === '/login';
  
  // Ukrywamy elementy globalne dla panelu i logowania
  const shouldShowGlobalComponents = !isPanelRoute && !isLoginRoute;

  return (
    <>
      {/* 1. GLOBALNY PRELOADER I NAVBAR (Tylko w strefie publicznej) */}
      {shouldShowGlobalComponents && <Preloader />}
      {shouldShowGlobalComponents && <GlobalNavbar menuOpen={menuOpen} setMenuOpen={setMenuOpen} />}

      {/* 2. SILNIK PRZEJŚĆ KINOWYCH */}
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          
          {/* ========================================== */}
          {/* STREFA PUBLICZNA */}
          {/* ========================================== */}
          <Route path="/" element={<PageTransition><Home /></PageTransition>} />
          <Route path="/login" element={<PageTransition><Login /></PageTransition>} />

          {/* ========================================== */}
          {/* STREFA PRYWATNA (CHRONIONA) */}
          {/* ========================================== */}
          <Route element={<ProtectedRoute />}>
            
            {/* NAPRAWIONE: DashboardLayout JEST TERAZ RODZICEM DLA PODSTRON */}
            <Route path="/panel" element={<DashboardLayout />}>
              
              {/* Ścieżka bazowa: /panel */}
              <Route index element={<DashboardHome />} />

              {/* Ścieżki podrzędne (Zwróć uwagę: nie piszemy tu /panel/contracts, tylko samo contracts) */}
              <Route path="contracts" element={<Contracts />} />
              <Route path="projects" element={<Projects />} />
              <Route path="repertoire" element={<Repertoire />} />
              <Route path="rehearsals" element={<Rehearsals />} />
              <Route path="program" element={<ProgramBuilder />} />

              <Route path="materials" element={<Materials />} />
              <Route path="schedule" element={<Schedule />} />
              
              {/* Kolejne podstrony dodasz tutaj w ten sam sposób: */}
              {/* <Route path="repertoire" element={<Repertoire />} /> */}
              
            </Route>

          </Route>

          {/* MIEJSCE NA NOWE PODSTRONY PUBLICZNE */}
          {/* <Route path="/doswiadczenie" element={<PageTransition><Experience /></PageTransition>} /> */}
          {/* <Route path="/kontakt" element={<PageTransition><Contact /></PageTransition>} /> */}

        </Routes>
      </AnimatePresence>

      {/* 3. STOPKA (Tylko w strefie publicznej) */}
      {shouldShowGlobalComponents && <FooterSection />}

      {/* 4. GLOBALNE NAKŁADKI UI */}
      {shouldShowGlobalComponents && <OverlayMenu isOpen={menuOpen} setIsOpen={setMenuOpen} />}
      <NoiseOverlay />
      {shouldShowGlobalComponents && <CustomCursor />}
    </>
  );
}