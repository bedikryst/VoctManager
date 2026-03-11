/**
 * @file Home.jsx
 * @description Main landing page orchestrating the scrollytelling experience.
 * Features a dynamic, scroll-responsive navigation bar, Lenis smooth scrolling integration,
 * and robust scroll-locking mechanisms for the overlay menu.
 * @author Krystian Bugalski
 */

import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useMotionValueEvent } from 'framer-motion';
import { ReactLenis } from 'lenis/react';
import { useAppStore } from '../store/useAppStore';

// --- COMPONENTS ---
import HeroSection from '../components/home/HeroSection'; 
import ExperienceSection from '../components/home/ExperienceSection';
import WhatWeDoSection from '../components/home/WhatWeDoSection';
import WhatWeSingSection from '../components/home/WhatWeSingSection';
import TeamSection from '../components/home/TeamSection';
import FooterSection from '../components/layout/FooterSection';
import OverlayMenu from '../components/layout/OverlayMenu';
import Preloader from '../components/ui/Preloader';
import NoiseOverlay from '../components/ui/NoiseOverlay';

export default function Home() {
  // ==========================================
  // STATE & REFERENCES
  // ==========================================
  
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [windowData, setWindowData] = useState({ 
    vh: window.innerHeight, 
    isMobile: window.innerWidth < 768 
  });
  
  const isLoaded = useAppStore((state) => state.isLoaded);
  const heroRef = useRef(null);
  const lenisRef = useRef(null);

  // ==========================================
  // LIFECYCLE & EVENT LISTENERS
  // ==========================================

  // Debounced window resize listener for responsive layout adjustments
  useEffect(() => {
    let timeoutId;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setWindowData({ vh: window.innerHeight, isMobile: window.innerWidth < 768 });
      }, 200); 
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  // Overlay Menu Scroll Lock (Handles both DOM and virtual scroll engines)
  useEffect(() => {
    if (menuOpen) {
      // Lock native body scroll for touch devices
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none'; 
      
      // Pause Lenis virtual scroll engine for desktop
      if (lenisRef.current?.lenis) {
        lenisRef.current.lenis.stop();
      }
    } else {
      // Restore default scroll behavior
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      
      if (lenisRef.current?.lenis) {
        lenisRef.current.lenis.start();
      }
    }

    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      if (lenisRef.current?.lenis) lenisRef.current.lenis.start();
    };
  }, [menuOpen]);

  // ==========================================
  // SCROLL KINEMATICS & ANIMATIONS
  // ==========================================

  // Track scroll progress strictly within the Hero Section viewport
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ["end 99%", "end 20%"] 
  });

  useMotionValueEvent(heroProgress, "change", (latest) => setIsScrolled(latest > 0));

  // --- Navigation Bar Interpolations ---
  // Transforms properties based on scroll position to create a shrinking/blurring header effect
  const navWidth = useTransform(heroProgress, [0, 1], ["100%", "92%"]);
  const navMaxWidth = useTransform(heroProgress, [0, 1], ["4000px", "896px"]); 
  const padXStart = windowData.isMobile ? "32px" : "48px";
  const navPaddingX = useTransform(heroProgress, [0, 1], [padXStart, "24px"]);
  const navTop = useTransform(heroProgress, [0, 1], ["0px", "24px"]);
  const navPaddingY = useTransform(heroProgress, [0, 1], ["32px", "14px"]);
  const navRadius = useTransform(heroProgress, [0, 1], ["0px", "16px"]);
  
  const navBg = useTransform(heroProgress, [0, 1], ["rgba(255, 255, 255, 0)", "rgba(255, 255, 255, 0.5)"]);
  const navBlur = useTransform(heroProgress, [0, 1], ["blur(0px)", "blur(24px)"]);
  const navBorder = useTransform(heroProgress, [0, 1], ["rgba(255, 255, 255, 0)", "rgba(255, 255, 255, 0.6)"]);
  const navShadow = useTransform(heroProgress, [0, 1], ["0px 0px 0px rgba(0,0,0,0)", "0px 8px 30px rgba(0,0,0,0.08)"]);
  
  const textColor = useTransform(heroProgress, [0, 1], ["#1c1917", "#1c1917"]); 
  const logoFontSizeMobile = useTransform(heroProgress, [0, 1], ["1rem", "0.875rem"]); 
  const logoFontSizeDesktop = useTransform(heroProgress, [0, 1], ["1.5rem", "1rem"]); 
  const logoTextMaxWidth = useTransform(heroProgress, [0, 1], ["80px", "0px"]); 
  const logoTextOpacity = useTransform(heroProgress, [0, 1], [1, 0]);
  
  const line1Width = useTransform(heroProgress, [0, 1], ["28px", "20px"]);
  const line2Width = useTransform(heroProgress, [0, 1], ["36px", "28px"]);
  
  const lockColor = useTransform(heroProgress, [0, 1], ["#1c1917", "#a8a29e"]);
  const lockSize = useTransform(heroProgress, [0, 1], ["20px", "16px"]); 
  const btnWidthMobile = useTransform(heroProgress, [0, 1], ["80px", "44px"]);
  const btnBgBase = useTransform(heroProgress, [0, 1], ["rgba(28,25,23,0)", "rgba(28,25,23,1)"]);
  const btnBorderBase = useTransform(heroProgress, [0, 1], ["rgba(28,25,23,0.3)", "rgba(28,25,23,0)"]);
  const btnTextColor = useTransform(heroProgress, [0, 1], ["#1c1917", "#f5f5f4"]);
  const btnTextOpacity = useTransform(heroProgress, [0, 1], [1, 0]);
  const btnIconOpacity = useTransform(heroProgress, [0, 1], [0, 1]);

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <ReactLenis 
      ref={lenisRef}
      root 
      options={{ 
        lerp: 0.05, 
        smoothWheel: true, 
        smoothTouch: false,
        syncTouch: false,
      }} 
    > 
      <Preloader />
      <NoiseOverlay />

      {/* --- GLOBAL NAVIGATION --- */}
      <div className={`fixed top-0 left-0 w-full z-[105] flex justify-center pointer-events-none transition-opacity duration-700 ${menuOpen ? 'opacity-0' : 'opacity-100'}`}>
        <motion.nav 
          style={{ 
            width: navWidth, maxWidth: navMaxWidth, marginTop: navTop, 
            paddingLeft: navPaddingX, paddingRight: navPaddingX, 
            paddingTop: navPaddingY, paddingBottom: navPaddingY, 
            borderRadius: navRadius, backgroundColor: navBg, 
            borderColor: navBorder, boxShadow: navShadow, 
            backdropFilter: navBlur, WebkitBackdropFilter: navBlur 
          }}
          className="pointer-events-auto flex items-center justify-between border shadow-none"
        >
          {/* Menu Toggle */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: isLoaded ? 1 : 0 }} transition={{ duration: 1 }} className="flex-1 flex justify-start">
            <button onClick={() => setMenuOpen(true)} className="group flex flex-col space-y-1.5 p-3 pl-0 hover:opacity-50 active:scale-95 transition-opacity" aria-label="Open Menu">
              <motion.span style={{ backgroundColor: textColor, width: line1Width }} className={`h-px ease-out transition-all duration-300 ${isScrolled ? 'group-hover:!w-7' : 'group-hover:!w-9'}`} />
              <motion.span style={{ backgroundColor: textColor, width: line2Width }} className={`h-px ease-out transition-all duration-300 ${isScrolled ? 'group-hover:!w-5' : 'group-hover:!w-7'}`} />
            </button>
          </motion.div>

          {/* Brand Logotype */}
          <div className="flex-1 flex justify-center pointer-events-none origin-center mr-5 md:mr-0">
            <motion.div 
              initial={{ y: -60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 2.2, delay: 1.8, ease: [0.5, 1, 0.89, 1] }} 
              style={{ color: textColor, fontSize: windowData.isMobile ? logoFontSizeMobile : logoFontSizeDesktop, fontFamily: "'Cormorant', serif" }} 
              className="flex items-center italic tracking-widest font-medium"
            >
              <span>V</span>
              <motion.span style={{ maxWidth: windowData.isMobile ? logoTextMaxWidth : '100px', opacity: windowData.isMobile ? logoTextOpacity : 1 }} className="overflow-hidden flex items-center whitespace-nowrap">oct</motion.span>
              <span>E</span>
              <motion.span style={{ maxWidth: windowData.isMobile ? logoTextMaxWidth : '100px', opacity: windowData.isMobile ? logoTextOpacity : 1 }} className="overflow-hidden flex items-center whitespace-nowrap">nsemble</motion.span>
            </motion.div>
          </div>

          {/* Action Links */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: isLoaded ? 1 : 0 }} transition={{ duration: 1 }} className="flex-1 flex justify-end items-center space-x-3 md:space-x-8">
            <Link to="/panel" className="group active:scale-90" aria-label="Client Panel">
              <motion.svg style={{ color: lockColor, width: lockSize, height: lockSize }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`flex-shrink-0 transition-colors duration-300 ${isScrolled ? 'group-hover:!text-stone-900' : 'group-hover:!text-stone-500'}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </motion.svg>
            </Link>
            <Link to="/fundacja" className="group active:scale-95 transition-transform flex">
              <motion.div style={{ width: windowData.isMobile ? btnWidthMobile : 'auto', backgroundColor: btnBgBase, borderColor: btnBorderBase, color: btnTextColor }} className={`relative flex items-center justify-center border h-9 md:h-10 px-4 md:px-5 rounded-lg md:rounded-xl overflow-hidden transition-all duration-300 ${isScrolled ? 'group-hover:!bg-amber-700 group-hover:shadow-lg group-hover:-translate-y-0.5' : 'group-hover:!bg-stone-900 group-hover:!text-stone-100 group-hover:!border-transparent'}`}>
                {!windowData.isMobile && ( <span className="text-[10px] uppercase font-bold tracking-[0.2em] whitespace-nowrap transition-colors duration-300">Wesprzyj</span> )}
                {windowData.isMobile && ( <motion.span style={{ opacity: btnTextOpacity }} className="absolute text-[9px] uppercase font-bold tracking-[0.1em] whitespace-nowrap">Wesprzyj</motion.span> )}
                {windowData.isMobile && ( <motion.svg style={{ opacity: btnIconOpacity }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="absolute w-4 h-4 flex-shrink-0"> <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" /> </motion.svg> )}
              </motion.div>
            </Link>
          </motion.div>
        </motion.nav>
      </div>

      {/* --- PAGE LAYOUT (SCROLLYTELLING SECTIONS) --- */}
      <div className={`bg-[#fdfbf7] text-stone-900 ${!isLoaded ? 'overflow-hidden h-screen' : ''}`} style={{ fontFamily: "'Poppins', sans-serif" }}>
        <OverlayMenu isOpen={menuOpen} setIsOpen={setMenuOpen} />
        
        <div ref={heroRef} className="relative z-0">
          <HeroSection />
        </div>
        <div className="relative z-10 -mt-[50vh]">
          <ExperienceSection />
        </div>
        <WhatWeDoSection />
        <WhatWeSingSection />
        <TeamSection />
        <FooterSection />
      </div>
      
    </ReactLenis>
  );
}