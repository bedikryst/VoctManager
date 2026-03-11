/**
 * @file OverlayMenu.jsx
 * @description The Cinematic Curtain (Global Navigation).
 * Features deep dark mode, staggered typographic reveals, an editorial 
 * serif-to-sans hover effect, and contextual background image reveals.
 * Integrates directly with Lenis to prevent scroll-bleeding.
 * @author Krystian Bugalski
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';

// ==========================================
// ANIMATION VARIANTS (Awwwards Physics)
// ==========================================

// Global curtain drop animation utilizing custom bezier easing
const menuVariants = {
  closed: { 
    y: "-100%", 
    transition: { duration: 0.8, ease: [0.76, 0, 0.24, 1] } 
  },
  open: { 
    y: "0%", 
    transition: { duration: 0.8, ease: [0.76, 0, 0.24, 1] } 
  }
};

// Staggered reveal for main navigation links (rising from below)
const linkRevealVariants = {
  closed: { y: "120%", rotate: 5, opacity: 0 },
  open: (i) => ({
    y: "0%",
    rotate: 0,
    opacity: 1,
    transition: { 
      duration: 0.8, 
      delay: 0.3 + (i * 0.08), 
      ease: [0.16, 1, 0.3, 1] 
    }
  })
};

// Smooth fade-up for secondary elements (header, footer, socials)
const fadeUpVariants = {
  closed: { opacity: 0, y: 20 },
  open: (delay) => ({
    opacity: 1, 
    y: 0,
    transition: { duration: 0.8, delay: 0.4 + delay, ease: [0.16, 1, 0.3, 1] }
  })
};

// ==========================================
// NAVIGATION DATA & CONTEXTUAL MEDIA
// ==========================================

const mainLinks = [
  { title: "Strona Główna", path: "/", image: "/wystep2.jpg" }, 
  { title: "O Zespole", path: "/o-zespole", image: "/zespol3.jpg" },
  { title: "Repertuar", path: "/repertuar", image: "/nuty.jpg" }, 
  { title: "Fundacja", path: "/fundacja", image: "/zarzad.jpeg" },
  { title: "Wesprzyj", path: "/donate", image: "/kontakt.jpg" },
];

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function OverlayMenu({ isOpen, setIsOpen }) {
  // State tracking the currently hovered link to reveal its specific background image
  const [hoveredIndex, setHoveredIndex] = useState(null);
  
  const handleLinkClick = () => {
    setIsOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={menuVariants}
          initial="closed"
          animate="open"
          exit="closed"
          // Crucial: Prevents Lenis virtual scroll engine from operating underneath the menu
          data-lenis-prevent="true"
          className="fixed inset-0 z-[999] bg-stone-950 text-[#fdfbf7] flex flex-col justify-between overflow-hidden overscroll-none touch-none"
        >
          
          {/* ========================================== */}
          {/* BACKGROUND LAYERS */}
          {/* ========================================== */}

          {/* 1. Contextual Image Reveal */}
          {/* Images appear with a cinematic scale and fade effect, masked by grayscale and luminosity blending */}
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-stone-950">
            {mainLinks.map((link, i) => (
              <div 
                key={`bg-${i}`} 
                className={`absolute inset-0 transition-all duration-1000 ease-[0.16,1,0.3,1] ${
                  hoveredIndex === i ? 'opacity-20 scale-100' : 'opacity-0 scale-110'
                }`}
              >
                <img 
                  src={link.image} 
                  alt="" 
                  className="w-full h-full object-cover grayscale mix-blend-luminosity"
                />
              </div>
            ))}
          </div>

          {/* 2. Delicate Architectural Grid Overlay */}
          <div className="absolute inset-0 pointer-events-none flex justify-center z-0 opacity-20 mix-blend-screen">
            <div className="w-full max-w-7xl h-full relative">
              <div className="absolute top-0 bottom-0 left-[41.666667%] w-[1px] bg-stone-800" />
              <div className="absolute top-0 bottom-0 left-[58.333333%] w-[1px] bg-stone-800" />
            </div>
          </div>

          {/* ========================================== */}
          {/* FOREGROUND CONTENT */}
          {/* ========================================== */}

          {/* --- Menu Header --- */}
          <motion.div 
            variants={fadeUpVariants} custom={0}
            className="w-full flex justify-center border-b border-stone-800/50 py-6 px-6 relative z-10"
          >
            <div className="w-full max-w-7xl flex justify-between items-center">
              <Link to="/" onClick={handleLinkClick} className="text-sm font-medium tracking-[0.2em] uppercase italic hover:opacity-70 transition-opacity" style={{ fontFamily: "'Cormorant', serif" }}>
                VoctEnsemble
              </Link>
              
              <button 
                onClick={() => setIsOpen(false)}
                className="group flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-bold text-stone-500 hover:text-[#fdfbf7] transition-colors"
                aria-label="Close menu"
              >
                <span className="overflow-hidden relative pb-1">
                  Zamknij
                  <span className="absolute bottom-0 left-0 w-full h-px bg-[#fdfbf7] origin-right scale-x-0 transition-transform duration-500 group-hover:scale-x-100" />
                </span>
                <span className="text-lg font-normal leading-none mb-[2px] group-hover:rotate-90 transition-transform duration-500">×</span>
              </button>
            </div>
          </motion.div>

          {/* --- Main Menu Body --- */}
          <div className="flex-grow flex items-center justify-center w-full px-6 py-12 relative z-10">
            <div className="w-full max-w-7xl flex flex-col md:flex-row justify-between items-start md:items-center">
              
              {/* Secondary Links & Contact (Desktop Only) */}
              <div className="hidden md:flex flex-col gap-12 w-4/12">
                <motion.div variants={fadeUpVariants} custom={0.2}>
                  <p className="text-[#002395] text-[9px] font-bold uppercase tracking-[0.3em] mb-6">Społeczność</p>
                  <ul className="flex flex-col gap-4 text-[10px] uppercase tracking-[0.2em] font-medium text-stone-500">
                    <li><a href="https://instagram.com/voctensemble" target="_blank" rel="noreferrer" className="hover:text-[#fdfbf7] transition-colors">Instagram</a></li>
                    <li><a href="https://facebook.com/voctensemble" target="_blank" rel="noreferrer" className="hover:text-[#fdfbf7] transition-colors">Facebook</a></li>
                    <li><a href="https://www.youtube.com/@VoctEnsemble-nb7gh" target="_blank" rel="noreferrer" className="hover:text-[#fdfbf7] transition-colors">YouTube</a></li>
                  </ul>
                </motion.div>
                <motion.div variants={fadeUpVariants} custom={0.3}>
                  <p className="text-[#002395] text-[9px] font-bold uppercase tracking-[0.3em] mb-6">Biurom / Kontakt</p>
                  <a href="mailto:kontakt@voctensemble.pl" className="text-[10px] uppercase tracking-[0.2em] font-medium text-stone-500 hover:text-[#fdfbf7] transition-colors">
                    kontakt@voctensemble.pl
                  </a>
                </motion.div>
              </div>

              {/* Primary Navigation Links */}
              <nav className="w-full md:w-8/12 flex flex-col gap-4 md:gap-6 mt-12 md:mt-0" onMouseLeave={() => setHoveredIndex(null)}>
                {mainLinks.map((link, i) => (
                  <div key={i} className="overflow-hidden pb-2" onMouseEnter={() => setHoveredIndex(i)}>
                    <motion.div custom={i} variants={linkRevealVariants}>
                      <Link 
                        to={link.path}
                        onClick={handleLinkClick}
                        className={`group flex items-center text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-medium tracking-tight transition-all duration-500 origin-left ${hoveredIndex !== null && hoveredIndex !== i ? 'text-stone-700' : 'text-stone-300 hover:text-[#fdfbf7]'}`}
                      >
                        {/* Index Number */}
                        <span className="text-sm font-bold text-[#002395] mr-6 md:mr-10 mb-6 md:mb-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                          0{i + 1}
                        </span>
                        
                        {/* Font Swap Logic: Sans-serif default, Serif italic on hover */}
                        <span className="group-hover:translate-x-4 group-hover:italic transition-all duration-500" style={{ fontFamily: "inherit" }}>
                          <span className="block group-hover:hidden">{link.title}</span>
                          <span className="hidden group-hover:block" style={{ fontFamily: "'Cormorant', serif" }}>{link.title}</span>
                        </span>
                      </Link>
                    </motion.div>
                  </div>
                ))}
              </nav>

            </div>
          </div>

          {/* --- Menu Footer --- */}
          <motion.div 
            variants={fadeUpVariants} custom={0.5}
            className="w-full flex justify-center border-t border-stone-800/50 py-6 px-6 relative z-10 backdrop-blur-sm"
          >
            <div className="w-full max-w-7xl flex flex-col sm:flex-row justify-between items-center text-[8px] md:text-[9px] uppercase tracking-[0.2em] text-stone-600">
              <p>Kraków, PL — Fundacja VoctEnsemble</p>
              
              {/* Foundation Status Indicator */}
              <div className="mt-4 sm:mt-0 flex items-center gap-3">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-900 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                </div>
                <p className="font-bold text-stone-500">Status: Nieaktywna</p>
              </div>
            </div>
          </motion.div>

        </motion.div>
      )}
    </AnimatePresence>
  );
}