/**
 * @file GlobalNavbar.jsx
 * @description The global, scroll-responsive navigation bar.
 * Implements a flawless "Immersive Mode" (bare) on the Home page, guaranteeing 
 * a completely clean start without logo flashes. Mathematically tracks viewport 
 * to assemble into a pill with precise button dimensions.
 * @author Krystian Bugalski
 */

import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, useScroll, useMotionValueEvent } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';

export default function GlobalNavbar({ menuOpen, setMenuOpen }) {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const isLoaded = useAppStore((state) => state.isLoaded);

  // ==========================================
  // STATE
  // ==========================================
  const [windowData, setWindowData] = useState({ 
    isMobile: typeof window !== 'undefined' ? window.innerWidth < 768 : false,
    vh: typeof window !== 'undefined' ? window.innerHeight : 0 
  });
  
  // Zaczynamy OD RAZU w dobrym stanie, żeby zapobiec pojawianiu się logo po preloaderze!
  const [navState, setNavState] = useState(isHome ? "bare" : "top"); 
  const [isDarkBg, setIsDarkBg] = useState(false);

  useEffect(() => {
    let timeoutId;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setWindowData({ 
          isMobile: window.innerWidth < 768,
          vh: window.innerHeight
        });
      }, 200); 
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  // ==========================================
  // GLOBAL SCROLL LOGIC
  // ==========================================
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    if (isHome) {
      const vh = windowData.vh;
      const darkStart = windowData.isMobile ? vh * 2.5 : vh * 4.5;
      const darkEnd = windowData.isMobile ? vh * 4.5 : vh * 6.5;
      
      setIsDarkBg(latest >= darkStart && latest < darkEnd);

      if (latest < darkEnd) {
        setNavState("bare");
      } else {
        setNavState("pill");
      }
    } else {
      setIsDarkBg(false);
      if (latest < 100) {
        setNavState("top");
      } else {
        setNavState("pill");
      }
    }
  });

  // ==========================================
  // UKRYWANIE MENU NA STRONIE /PANEL
  // ==========================================
  if (location.pathname === '/panel') {
    return null; 
  }

  // ==========================================
  // ANIMATION VARIANTS (Awwwards Easing)
  // ==========================================
  
  const butteryEase = [0.16, 1, 0.3, 1]; 
  const transitionConfig = { duration: 1.2, ease: butteryEase };

  const navContainerVariants = {
    bare: {
      width: "100%",
      maxWidth: "100%",
      marginTop: "0px",
      paddingLeft: windowData.isMobile ? "24px" : "48px",
      paddingRight: windowData.isMobile ? "24px" : "48px",
      paddingTop: "32px",
      paddingBottom: "32px",
      borderRadius: "0px",
      backgroundColor: "rgba(255, 255, 255, 0)",
      borderColor: "rgba(255, 255, 255, 0)",
      boxShadow: "0px 0px 0px rgba(0,0,0,0)",
      transition: transitionConfig
    },
    top: {
      width: "100%",
      maxWidth: "100%", 
      marginTop: "0px",
      paddingLeft: windowData.isMobile ? "24px" : "48px",
      paddingRight: windowData.isMobile ? "24px" : "48px",
      paddingTop: "32px",
      paddingBottom: "32px",
      borderRadius: "0px",
      backgroundColor: "rgba(255, 255, 255, 0)",
      borderColor: "rgba(255, 255, 255, 0)",
      boxShadow: "0px 0px 0px rgba(0,0,0,0)",
      transition: transitionConfig
    },
    pill: {
      width: "92%",
      maxWidth: "896px",
      marginTop: "24px",
      paddingLeft: "24px",
      paddingRight: "24px",
      paddingTop: "14px",
      paddingBottom: "14px",
      borderRadius: "16px",
      backgroundColor: "rgba(255, 255, 255, 0.7)",
      borderColor: "rgba(255, 255, 255, 0.5)",
      boxShadow: "0px 12px 40px rgba(0,0,0,0.06)",
      transition: transitionConfig
    }
  };

  const logoVariants = {
    bare: { opacity: 0, y: -15, filter: "blur(4px)", pointerEvents: "none", transition: { duration: 0.6, ease: butteryEase } },
    top: { opacity: 1, y: 0, filter: "blur(0px)", pointerEvents: "auto", transition: transitionConfig },
    pill: { opacity: 1, y: 0, filter: "blur(0px)", pointerEvents: "auto", transition: transitionConfig }
  };

  // Nowe precyzyjne wartości szerokości Donate: 105px (desktop) / 40px (mobile)
  const donateVariants = {
    bare: { 
      opacity: 0, x: 20, width: 0, marginLeft: "0px", filter: "blur(4px)", 
      pointerEvents: "none", transition: { duration: 0.8, ease: butteryEase } 
    },
    top: { 
      opacity: 1, x: 0, width: windowData.isMobile ? 40 : 105, marginLeft: windowData.isMobile ? "12px" : "20px", filter: "blur(0px)", 
      pointerEvents: "auto", transition: transitionConfig 
    },
    pill: { 
      opacity: 1, x: 0, width: windowData.isMobile ? 40 : 105, marginLeft: windowData.isMobile ? "12px" : "20px", filter: "blur(0px)", 
      pointerEvents: "auto", transition: transitionConfig 
    }
  };

  const isBare = navState === "bare";
  const isPill = navState === "pill";

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div 
      // Zmieniono wjazd (brak translate-y), menu pojawia się przez czysty, elegancki fade-in.
      className={`fixed top-0 left-0 w-full z-[105] flex justify-center pointer-events-none transition-opacity duration-[1.8s] ease-[0.16,1,0.3,1] ${
        !isLoaded || menuOpen ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <motion.nav 
        variants={navContainerVariants}
        initial={isHome ? "bare" : "top"} // Bezpośrednie inicjowanie właściwego stanu zapobiega mruganiu "VoctEnsemble"
        animate={navState}
        className={`pointer-events-auto flex items-center justify-between border shadow-none transition-all duration-700 ${isPill ? 'backdrop-blur-[24px]' : 'backdrop-blur-none'}`}
      >
        
        {/* --- LEFT: Menu Toggle --- */}
        <motion.div className="flex-1 flex justify-start items-center">
          <button 
            onClick={() => setMenuOpen(true)} 
            className="group flex flex-col space-y-1.5 p-3 pl-0 hover:opacity-50 active:scale-95 transition-all duration-500" 
            aria-label="Open Menu"
          >
            <span className={`h-px ease-out transition-all duration-[0.6s] ${isBare && isDarkBg ? 'bg-white' : 'bg-stone-900'} ${isBare ? 'w-9 group-hover:w-6' : (isPill ? 'w-7 group-hover:w-4' : 'w-9 group-hover:w-6')}`} />
            <span className={`h-px ease-out transition-all duration-[0.6s] ${isBare && isDarkBg ? 'bg-white' : 'bg-stone-900'} ${isBare ? 'w-7 group-hover:w-8' : (isPill ? 'w-5 group-hover:w-6' : 'w-7 group-hover:w-8')}`} />
          </button>
        </motion.div>

        {/* --- CENTER: Brand Logotype --- */}
        <motion.div 
          variants={logoVariants}
          className="flex-1 flex justify-center origin-center mr-5 md:mr-0 text-stone-900"
        >
          <Link
            to="/" 
            style={{ fontSize: windowData.isMobile ? (isPill ? "0.875rem" : "1rem") : (isPill ? "1rem" : "1.5rem"), fontFamily: "'Cormorant', serif" }} 
            className="flex items-center italic tracking-widest font-medium transition-all duration-1000"
          >
            <span>V</span>
            <span className={`overflow-hidden flex items-center whitespace-nowrap transition-all duration-1000 ${windowData.isMobile && isPill ? 'max-w-0 opacity-0' : 'max-w-[100px] opacity-100'}`}>oct</span>
            <span>E</span>
            <span className={`overflow-hidden flex items-center whitespace-nowrap transition-all duration-1000 ${windowData.isMobile && isPill ? 'max-w-0 opacity-0' : 'max-w-[100px] opacity-100'}`}>nsemble</span>
          </Link>
        </motion.div>

        {/* --- RIGHT: Action Links --- */}
        <motion.div className="flex-1 flex justify-end items-center">
          
          {/* Ikona Panelu */}
          <Link to="/panel" className="group active:scale-90 transition-colors duration-500 flex items-center" aria-label="Client Panel">
            <svg 
              xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" 
              className={`flex-shrink-0 transition-all duration-[1.2s] w-5 h-5 md:w-6 md:h-6 ${isBare ? (isDarkBg ? 'text-white opacity-80 group-hover:opacity-100' : 'text-stone-900 opacity-80 group-hover:opacity-100') : 'text-stone-500 hover:text-stone-900'}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </Link>
          
          {/* Donate Button Wrapper */}
          <motion.div variants={donateVariants} className="overflow-hidden flex flex-shrink-0">
            <Link to="/wesprzyj" className="group active:scale-95 transition-transform flex w-full">
              {/* DODANO: w-full, USUNIĘTO: px-4 md:px-5 */}
              <div className={`relative flex items-center justify-center w-full border h-9 md:h-10 rounded-lg md:rounded-xl overflow-hidden transition-all duration-[1.2s] ${isPill ? 'bg-stone-900 text-stone-100 border-transparent hover:bg-amber-700 hover:shadow-lg hover:-translate-y-0.5' : 'bg-transparent border-stone-900/30 text-stone-900 hover:bg-stone-900 hover:text-stone-100 hover:border-transparent'}`}>
                {!windowData.isMobile && ( <span className="text-[10px] uppercase font-bold tracking-[0.2em] whitespace-nowrap transition-colors duration-300">Wesprzyj</span> )}
                {windowData.isMobile && ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0 absolute transition-opacity duration-300"> <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" /> </svg> )}
              </div>
            </Link>
          </motion.div>
        </motion.div>

      </motion.nav>
    </div>
  );
}