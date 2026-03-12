/**
 * @file HeroSection.jsx
 * @description Immersive typographic scrollytelling entry point.
 * Orchestrates a cinematic opening sequence utilizing scroll-linked opacity,
 * complex blur filters, and an editorial lateral typographic frame.
 * Acts as the visual and thematic anchor for the "Architecture of Silence" concept.
 * @author Krystian Bugalski
 */

import { useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useMouseAndGyro } from '../../hooks/useMouseAndGyro';
import { useScrollyAudio } from '../../hooks/useScrollyAudio';

export default function HeroSection() {
  // ==========================================
  // STATE & REFERENCES
  // ==========================================
  
  const scrollContainerRef = useRef(null);
  const [isSoundOn, setIsSoundOn] = useState(false);
  
  // Custom hooks for interactive audio-visual feedback
  const { x: gyroX, y: gyroY } = useMouseAndGyro();
  useScrollyAudio(isSoundOn);

  // ==========================================
  // SCROLL KINEMATICS
  // ==========================================
  
  const { scrollYProgress } = useScroll({
    target: scrollContainerRef,
    offset: ["start start", "end end"]
  });

  // --- SCENE 1: The Intro (0% - 20%) ---
  // Fades out and blurs the initial poetic text as the user starts scrolling
  const scene1Opacity = useTransform(scrollYProgress, [0, 0.1, 0.2], [1, 1, 0]);
  const scene1Y = useTransform(scrollYProgress, [0, 0.2], [0, -60]);
  const scene1Blur = useTransform(scrollYProgress, [0.1, 0.2], ["blur(0px)", "blur(10px)"]);

  // --- SCENE 2: Core Message (18% - 55%) ---
  // A sharp, monumental typographic reveal that scales up and refocuses
  const scene2Opacity = useTransform(scrollYProgress, [0.18, 0.28, 0.45, 0.55], [0, 1, 1, 0]);
  const scene2Scale = useTransform(scrollYProgress, [0.18, 0.55], [0.92, 1.05]);
  const scene2Blur = useTransform(scrollYProgress, [0.18, 0.28, 0.45, 0.55], ["blur(20px)", "blur(0px)", "blur(0px)", "blur(20px)"]);
  const silenceSpacing = useTransform(scrollYProgress, [0.2, 0.35], ["0.5em", "0.1em"]);

  // --- SCENE 3: Resolution (52% - 85%) ---
  // The final manifesto statement. Leaves a 15% buffer at the end for a clean transition.
  const scene3Opacity = useTransform(scrollYProgress, [0.52, 0.62, 0.75, 0.85], [0, 1, 1, 0]);
  const scene3Y = useTransform(scrollYProgress, [0.52, 0.85], [40, -80]);
  const scene3Blur = useTransform(scrollYProgress, [0.52, 0.65], ["blur(15px)", "blur(0px)"]);

  // --- GLOBAL UI ELEMENTS ---
  const indicatorOpacity = useTransform(scrollYProgress, [0, 0.05], [1, 0]);
  const editorialY = useTransform(scrollYProgress, [0, 1], [150, -150]);

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <motion.div 
      ref={scrollContainerRef} 
      className="h-[300vh] md:h-[500vh] relative"
    >
      
      {/* --- SOUND DESIGN TOGGLE --- */}
      <button 
        onClick={() => setIsSoundOn(!isSoundOn)}
        className="hidden md:flex fixed bottom-8 right-8 z-50 items-center gap-3 mix-blend-difference text-stone-100 opacity-60 hover:opacity-100 transition-opacity"
        aria-label={isSoundOn ? "Disable ambient sound" : "Enable ambient sound"}
      >
        <span className="text-[9px] uppercase tracking-[0.3em] font-medium">
          Sound [{isSoundOn ? 'On' : 'Off'}]
        </span>
        <div className="w-8 h-px bg-current opacity-50" aria-hidden="true" />
      </button>
      
      {/* Fade-out mask for the bottom of the axis line */}
     {/* <div className="absolute bottom-[113] left-1/2 -translate-x-1/2 w-20 h-48 bg-gradient-to-t from-[#fdfbf7] to-transparent z-10" aria-hidden="true" />*/}
      {/* --- STICKY CINEMATIC VIEWPORT --- */}
      <div className="sticky top-0 h-screen w-full flex items-center justify-center overflow-hidden">

        {/* --- CENTRAL TIMELINE AXIS --- */}
        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-stone-200/50 z-0 pointer-events-none">
          <motion.div 
            style={{ scaleY: scrollYProgress }} 
            className="w-full h-full bg-[#002395] origin-top opacity-100"
          />
        </div>

        {/* --- EDITORIAL FRAME (Lateral Typography) --- */}
        <div className="absolute -left-43 top-0 h-full flex items-center justify-center z-40 pointer-events-none select-none opacity-40">
          <motion.div style={{ y: editorialY }}>
            <div 
              className="-rotate-90 hidden md:block whitespace-nowrap text-stone-500 text-[15px] uppercase tracking-[0.6em] font-medium"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Listen &bull; FEEL &bull; Support
            </div>
          </motion.div>
        </div>

        {/* ========================================== */}
        {/* SCENES RENDERING */}
        {/* ========================================== */}

        {/* --- SCENE 1 --- */}
        <motion.div 
          style={{ opacity: scene1Opacity, y: scene1Y, filter: scene1Blur, willChange: "transform, opacity, filter" }} 
          className="absolute z-10 text-center w-full max-w-2xl py-12 md:py-16 pointer-events-none text-stone-900 flex flex-col items-center justify-center"
        >
          <p className="font-medium text-stone-500 text-xl md:text-3xl italic tracking-wide" style={{ fontFamily: "'Cormorant', serif" }}>
            z tęsknoty, natchnienia i marzenia.
          </p>
          <p className="mt-6 md:mt-8 px-4 text-sm md:text-base text-stone-400 leading-relaxed font-light" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Jak anachoreci, w odosobnieniu, z daleka od zgiełku<br className="hidden md:block" />i muzyki, zatęskniono za muzyką.
          </p>
        </motion.div>

        {/* --- SCENE 2 --- */}
        <motion.div 
          style={{ opacity: scene2Opacity, scale: scene2Scale, filter: scene2Blur, willChange: "transform, opacity, filter", background: "linear-gradient(to bottom, rgba(253,251,247,0) 0%, rgba(253,251,247,1) 25%, rgba(253,251,247,1) 75%, rgba(253,251,247,0) 100%)" }} 
          className="absolute z-20 text-center w-[120vw] h-[55vh] md:h-[70vh] md:w-full py-16 md:py-20 pointer-events-none text-stone-900 flex flex-col items-center justify-center"
        >
          <h2 className="flex flex-col items-center gap-4 md:gap-6 text-3xl md:text-6xl lg:text-8xl font-medium uppercase text-stone-900" style={{ fontFamily: "'Cormorant', serif" }}>
            <span className="opacity-60 inline-block tracking-[0.2em]">Music</span>
            <motion.span style={{ letterSpacing: silenceSpacing }} className="text-[#002395] italic lowercase text-3xl md:text-5xl lg:text-7xl flex items-center gap-4">
              <span className="opacity-40 font-light">—</span>silence<span className="opacity-40 font-light">—</span>
            </motion.span>
            <span className="opacity-60 inline-block tracking-[0.2em]">Contemplation</span>
          </h2>
        </motion.div>

        {/* --- SCENE 3 --- */}
        <motion.div 
          style={{ opacity: scene3Opacity, filter: scene3Blur, y: scene3Y, willChange: "transform, opacity, filter", background: "linear-gradient(to bottom, rgba(253,251,247,0) 0%, rgba(253,251,247,1) 20%, rgba(253,251,247,1) 80%, rgba(253,251,247,0) 100%)" }} 
          className="absolute z-20 text-center w-[120vw] h-[60vh] md:w-full py-16 md:py-20 px-6 md:px-0 pointer-events-none text-stone-900 flex flex-col items-center justify-center"
        >
          <div className="space-y-4 md:space-y-6 font-medium text-lg md:text-3xl leading-relaxed flex flex-col items-center text-stone-600 max-w-3xl w-full" style={{ fontFamily: "'Cormorant', serif" }}>
            <p>Głos jest lustrem duszy.</p>
            <p>Muzyka – przestrzenią spotkania.</p>
            <div className="pt-6 mt-6 md:pt-8 md:mt-8 flex flex-col items-center relative w-full">
              <div className="absolute top-0 md:-top-3 w-24 md:w-32 h-[1px] bg-gradient-to-r from-transparent via-[#002395]/30 to-transparent" aria-hidden="true" />
              <p className="text-stone-500 text-[15px] md:text-2xl italic tracking-wide leading-snug">z tęsknoty za absolutną jednością brzmienia i ducha</p>
              <p className="text-stone-800 text-xl md:text-4xl italic tracking-wide leading-snug mt-3 md:mt-4">
                powstał <span className="text-[#002395] font-semibold not-italic">VoctEnsemble</span>
              </p>
            </div>
          </div>
        </motion.div>

        {/* --- SCROLL INDICATOR GUIDE --- */}
        <motion.div style={{ opacity: indicatorOpacity }} className="absolute bottom-8 text-[9px] uppercase tracking-[0.4em] font-medium text-stone-400 flex flex-col items-center gap-4 z-40 pointer-events-none">
          <span className="px-6 py-1">Odkryj sacrum</span>
        </motion.div>

      </div>
    </motion.div>
  );
}