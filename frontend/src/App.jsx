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

// --- PAGES ---
import Home from './pages/Home';
import Panel from './pages/Dashboard';
// import Experience from './pages/Experience';
// import Ensemble from './pages/Ensemble';
// import Foundation from './pages/Foundation';
// import Donate from './pages/Donate';
// import Collaborations from './pages/Collaborations';
// import Contact from './pages/Contact';

export default function App() {
  const location = useLocation();
  
  // Stan menu wyciągnięty na najwyższy poziom, aby sterować nawigacją globalnie
  const [menuOpen, setMenuOpen] = useState(false);

  const hideFooterRoutes = ['/panel'];
  const shouldShowFooter = !hideFooterRoutes.includes(location.pathname);

  return (
    <>
      <Preloader />
      {/* 1. GLOBALNY PASEK NAWIGACJI (Zawsze widoczny na górze) */}
      <GlobalNavbar menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

      {/* 2. SILNIK PRZEJŚĆ KINOWYCH (Framer Motion) */}
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          
          {/* --- STRONA GŁÓWNA --- */}
          <Route 
            path="/" 
            element={
              <PageTransition>
                <Home />
              </PageTransition>
            } 
          />
          {/* --- PANEL ADMINA --- */}
          <Route 
            path="/panel"
            element={
              <PageTransition>
                <Panel />
              </PageTransition>
            }
          />

          {/* --- MIEJSCE NA NOWE PODSTRONY (Odkomentuj po stworzeniu plików w pages/) --- */}
          {/* <Route path="/doswiadczenie" element={<PageTransition><Experience /></PageTransition>} /> */}
          {/* <Route path="/ensemble" element={<PageTransition><Ensemble /></PageTransition>} /> */}
          {/* <Route path="/mecenat" element={<PageTransition><Foundation /></PageTransition>} /> */}
          {/* <Route path="/wesprzyj" element={<PageTransition><Donate /></PageTransition>} /> */}
          {/* <Route path="/kolaboracje" element={<PageTransition><Collaborations /></PageTransition>} /> */}
          {/* <Route path="/kontakt" element={<PageTransition><Contact /></PageTransition>} /> */}

        </Routes>
      </AnimatePresence>

      {/* 3. STOPKA (Ładuje się pod contentem każdej strony, nie znika podczas animacji przejść) */}
      {shouldShowFooter && <FooterSection />}

      {/* 4. GLOBALNE NAKŁADKI UI (Zawsze na samym wierzchu, omijają rozmycie stron) */}
      <OverlayMenu isOpen={menuOpen} setIsOpen={setMenuOpen} />
      <NoiseOverlay />
      <CustomCursor />
    </>
  );
}