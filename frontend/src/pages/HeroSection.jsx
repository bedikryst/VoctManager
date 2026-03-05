/**
 * @file HeroSection.jsx
 * @description Immersive typographic scrollytelling based on "Architecture of Silence".
 * Absolute minimalism: pure ivory background, a central acoustic string, and flawless 60FPS performance.
 * @author Krystian Bugalski
 */

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useMouseAndGyro } from '../hooks/useMouseAndGyro';

export default function HeroSection() {
  const scrollContainerRef = useRef(null);
  
  const { x: gyroX, y: gyroY } = useMouseAndGyro();

  const { scrollYProgress } = useScroll({
    target: scrollContainerRef,
    offset: ["start start", "end end"]
  });

  // --- REŻYSERIA SCEN (Scrollytelling) ---
  const scene1Opacity = useTransform(scrollYProgress, [0, 0.15, 0.25], [1, 1, 0]);
  const scene1Y = useTransform(scrollYProgress, [0, 0.25], [0, -40]);

  const scene2Opacity = useTransform(scrollYProgress, [0.25, 0.35, 0.55, 0.65], [0, 1, 1, 0]);
  const scene2Scale = useTransform(scrollYProgress, [0.25, 0.65], [0.95, 1.05]);

  const scene3Opacity = useTransform(scrollYProgress, [0.65, 0.75, 0.9, 1], [0, 1, 1, 0]);
  const scene3Y = useTransform(scrollYProgress, [0.65, 1], [30, -30]);

  const indicatorOpacity = useTransform(scrollYProgress, [0, 0.05], [1, 0]);

  return (
    <div ref={scrollContainerRef} className="h-[400vh] relative bg-[#fdfbf7]">
      
      <div className="sticky top-0 h-screen w-full flex items-center justify-center overflow-hidden">
        
        {/* --- CENTRALNA STRUNA (Acoustic String) --- */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-full bg-stone-200 z-0">
          <motion.div 
            style={{ scaleY: scrollYProgress }} 
            className="w-full h-full bg-[#002395]/40 origin-top"
          />
        </div>

        {/* Tło Paralaksy: Concerts Spirituels */}
        <motion.div 
          style={{ 
            x: useTransform(gyroX, [-1, 1], [-20, 20]), 
            y: useTransform(gyroY, [-1, 1], [-20, 20]),
            fontFamily: "'Cormorant', serif",
            WebkitTextStroke: "1px rgba(0, 35, 149, 0.05)", 
            color: "transparent",
            willChange: "transform"
          }} 
          className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none select-none text-[15vw] leading-none whitespace-nowrap opacity-60 italic"
          aria-hidden="true"
        >
          Concerts Spirituels
        </motion.div>

        {/* --- SCENA 1 --- */}
        <motion.div 
          style={{ opacity: scene1Opacity, y: scene1Y }} 
          className="absolute z-10 text-center px-6 w-full max-w-2xl bg-[#fdfbf7]/80 backdrop-blur-sm py-8 md:backdrop-blur-none md:bg-transparent"
        >
          <p className="text-stone-500 font-medium text-xl md:text-3xl italic tracking-wide inline-block bg-[#fdfbf7] px-4" style={{ fontFamily: "'Cormorant', serif" }}>
            z tęsknoty, natchnienia i marzenia.
          </p>
          <p className="mt-6 md:mt-8 text-stone-400 text-sm md:text-base leading-relaxed inline-block bg-[#fdfbf7] px-4" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Jak anachoreci, w odosobnieniu, z daleka od zgiełku<br className="hidden md:block"/> i muzyki, zatęskniono za muzyką.
          </p>
        </motion.div>

        {/* --- SCENA 2 --- */}
        <motion.div 
          style={{ opacity: scene2Opacity, scale: scene2Scale }} 
          className="absolute z-20 text-center w-full px-4 bg-[#fdfbf7]/80 backdrop-blur-sm py-12 md:backdrop-blur-none md:bg-transparent"
        >
          <h2 
            className="flex flex-col items-center gap-4 md:gap-6 text-4xl md:text-6xl lg:text-8xl font-medium tracking-[0.2em] uppercase text-stone-900"
            style={{ fontFamily: "'Cormorant', serif" }}
          >
            <span className="opacity-80 inline-block bg-[#fdfbf7] px-4">Music</span>
            <span className="text-[#002395] italic tracking-widest lowercase text-3xl md:text-5xl lg:text-7xl relative">
              <span className="bg-[#fdfbf7] px-4 md:px-8">— silence —</span>
            </span>
            <span className="opacity-80 inline-block bg-[#fdfbf7] px-4">Contemplation</span>
          </h2>
        </motion.div>

        {/* --- SCENA 3 --- */}
        <motion.div 
          style={{ opacity: scene3Opacity, y: scene3Y }} 
          className="absolute z-30 text-center px-6 w-full max-w-3xl bg-[#fdfbf7]/80 backdrop-blur-sm py-12 md:backdrop-blur-none md:bg-transparent"
        >
          <div className="space-y-6 text-stone-600 font-medium text-xl md:text-3xl leading-relaxed" style={{ fontFamily: "'Cormorant', serif" }}>
            <p className="bg-[#fdfbf7] inline-block px-4">Głos jest lustrem duszy.</p><br/>
            <p className="bg-[#fdfbf7] inline-block px-4 mt-2">Muzyka – przestrzenią spotkania.</p>
            
            <div className="pt-8 mt-8 border-t border-[#002395]/10 flex flex-col items-center">
              {/* ZMIENIONA KOLEJNOŚĆ TEKSTU */}
              <p className="text-stone-500 text-xl md:text-2xl italic tracking-wide leading-snug bg-[#fdfbf7] px-6 pb-2">
                z tęsknoty za absolutną jednością brzmienia i ducha
              </p>
              <p className="text-stone-800 text-2xl md:text-4xl italic tracking-wide leading-snug bg-[#fdfbf7] px-6 pt-2">
                powstał <span className="text-[#002395] font-semibold not-italic">VoctEnsemble</span>
              </p>
            </div>
          </div>
        </motion.div>

        {/* Scroll Indicator Guide */}
        <motion.div 
          style={{ opacity: indicatorOpacity }} 
          className="absolute bottom-8 text-[10px] uppercase tracking-[0.4em] font-bold text-[#002395]/60 flex flex-col items-center gap-4 z-40 pointer-events-none"
        >
          <span className="bg-[#fdfbf7] px-4">Odkryj sacrum</span>
        </motion.div>

      </div>
    </div>
  );
}