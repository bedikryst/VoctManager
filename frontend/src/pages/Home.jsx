/**
 * @file Home.jsx
 * @description Main landing page orchestrating the scrollytelling experience and dynamic navigation.
 * @author Krystian Bugalski
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion';

// Section Components
import HeroSection from './HeroSection'; 
import WhatWeDoSection from './WhatWeDoSection';
import WhatWeSingSection from './WhatWeSingSection';
import TeamSection from './TeamSection';
import FooterSection from './FooterSection';
import OverlayMenu from './OverlayMenu';

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Monitor scroll position to toggle the navigation bar's visual state
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (latest) => {
    // Threshold set to 2.5x viewport height to match the Hero section's scroll depth
    const threshold = window.innerHeight * 2.5;
    setIsScrolled(latest > threshold);
  });

  // Shared animation config for layout transitions
  const springTransition = { duration: 0.8, ease: [0.76, 0, 0.24, 1] };

  return (
    <div className="bg-stone-50 text-stone-900 cursor-default select-none" style={{ fontFamily: "'Poppins', sans-serif" }}>
      
      {/* Dynamic Navigation Bar */}
      <div className="fixed top-0 left-0 w-full z-50 flex justify-center pointer-events-none">
        <motion.nav 
          layout 
          transition={springTransition}
          className={`pointer-events-auto flex items-center justify-between transition-colors duration-[1300ms] ${
            isScrolled 
              ? 'mt-6 w-[92%] max-w-4xl px-6 py-3.5 rounded-2xl bg-white/20 backdrop-blur-3xl border border-white/30 shadow-[0_8px_30px_rgb(0,0,0,0.1)] text-stone-900' 
              : 'mt-0 w-full px-8 py-8 md:px-12 bg-transparent border-transparent text-stone-100'
          }`}
        >
          {/* Menu Toggle */}
          <motion.div layout transition={springTransition} className="flex-1 flex justify-start">
            <button 
              onClick={() => setMenuOpen(true)} 
              className="group flex flex-col space-y-1.5 p-2 hover:opacity-50 transition-opacity" 
              aria-label="Toggle navigation menu"
            >
              <span className={`h-px bg-current transition-all duration-700 ease-out ${isScrolled ? 'w-5 group-hover:w-7' : 'w-7 group-hover:w-9'}`}></span>
              <span className={`h-px bg-current transition-all duration-700 ease-out ${isScrolled ? 'w-7 group-hover:w-5' : 'w-9 group-hover:w-7'}`}></span>
            </button>
          </motion.div>

          {/* Brand Logotype */}
          <motion.div layout transition={springTransition} className="flex-1 flex justify-center pointer-events-none origin-center">
            <motion.span 
              layout
              transition={springTransition}
              className={`italic tracking-widest transition-colors duration-700 font-medium ${isScrolled ? 'text-sm md:text-base' : 'text-xl md:text-2xl'}`}
              style={{ fontFamily: "'Cormorant', serif" }}
            >
              VoctEnsemble
            </motion.span>
          </motion.div>

          {/* Action Links */}
          <motion.div layout transition={springTransition} className="flex-1 flex justify-end items-center space-x-5 md:space-x-8">
            <Link to="/panel" className={`${isScrolled ? 'text-stone-400 hover:text-stone-900' : 'text-stone-100 hover:text-white'} transition-colors duration-700`} title="Strefa Artysty">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`${isScrolled ? 'w-4 h-4' : 'w-5 h-5'} transition-all duration-700`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </Link>
            <Link to="/fundacja" className={`text-[10px] font-bold uppercase tracking-[0.2em] px-5 py-2.5 rounded-xl transition-all duration-700 border ${isScrolled ? 'border-transparent bg-stone-900 text-stone-100 hover:bg-amber-700 hover:shadow-lg hover:-translate-y-0.5' : 'border-stone-100/50 text-stone-100 hover:bg-stone-100 hover:text-stone-900'}`}>
              Wesprzyj
            </Link>
          </motion.div>
        </motion.nav>
      </div>

      <OverlayMenu isOpen={menuOpen} setIsOpen={setMenuOpen} />

      {/* Page Content Hierarchy */}
      <HeroSection />
      <WhatWeDoSection />
      <WhatWeSingSection />
      <TeamSection />
      <FooterSection />
    </div>
  );
}