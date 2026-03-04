/**
 * @file HeroSection.jsx
 * @description Cinematic entry view utilizing Framer Motion for scroll-linked parallax animations 
 * and custom hooks for device orientation (gyroscope/mouse tracking).
 * @author Krystian Bugalski
 */

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useMouseAndGyro } from '../hooks/useMouseAndGyro';

export default function HeroSection() {
  const scrollContainerRef = useRef(null);
  
  // Track user interaction for multi-dimensional parallax effect
  const { x: gyroX, y: gyroY } = useMouseAndGyro();

  const { scrollYProgress } = useScroll({
    target: scrollContainerRef,
    offset: ["start start", "end end"]
  });

  // Scroll-linked animation values mapping
  const veScale = useTransform(scrollYProgress, [0, 0.3], [1, 1.5]);
  const veOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0]);
  
  const textOpacity = useTransform(scrollYProgress, [0.15, 0.6], [0, 1]);
  const textY = useTransform(scrollYProgress, [0.1, 0.25], [0, 0]); 
  const textFinalOpacity = useTransform(scrollYProgress, [0.5, 1], [1, 0]);

  return (
    <div ref={scrollContainerRef} className="h-[350vh] relative bg-stone-900">
      
      <div className="sticky top-0 h-screen w-full flex items-center justify-center overflow-hidden">
        
        {/* Parallax Cloud Layers */}
        <div className="absolute inset-0 z-0 pointer-events-none mix-blend-screen">
          <motion.div 
            style={{ 
              x: useTransform(gyroX, [-1, 1], [-10, 10]), 
              y: useTransform(gyroY, [1, -1], [-10, 10]) 
            }}
            className="absolute inset-[-5%] bg-[url('/clouds-back.webp')] bg-[length:100%_auto] md:bg-[length:100%_auto] bg-center bg-no-repeat opacity-40"
          />
          <motion.div 
            style={{ 
              x: useTransform(gyroX, [1, -1], [-30, 30]), 
              y: useTransform(gyroY, [1, -1], [-30, 30]) 
            }}
            className="absolute inset-[-5%] bg-[url('/clouds-front.webp')] bg-[length:100%_auto] md:bg-[length:100%_auto] bg-center bg-no-repeat opacity-60"
          />
        </div>

        {/* Brand Monogram */}
        <motion.div style={{ scale: veScale, opacity: veOpacity }} className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none mix-blend-overlay">
          <div className="relative w-full h-full flex items-center justify-center">
            <motion.div 
              style={{ 
                x: useTransform(gyroX, [-1, 1], [-20, 20]), 
                y: useTransform(gyroY, [-1, 1], [-20, 20]),
                fontFamily: "'Cormorant', serif"
              }} 
              className="absolute text-[45vw] leading-none tracking-tighter opacity-30 text-stone-100 font-medium"
              aria-hidden="true"
            >
              VE
            </motion.div>
          </div>
        </motion.div>

        {/* Main Copywriting */}
        <motion.div 
          style={{ opacity: textOpacity, y: textY }} 
          className="absolute max-w-4xl text-center z-30 px-6 pointer-events-auto"
        >
          <motion.div style={{ opacity: textFinalOpacity }}>
            <h1 
              className="text-3xl md:text-5xl lg:text-7xl font-medium tracking-[0.2em] mb-12 text-stone-100 flex flex-col gap-6 uppercase"
              style={{ fontFamily: "'Cormorant', serif" }}
            >
              <span className="opacity-80">Music</span>
              <span className="opacity-60 text-amber-700/80 italic">— Silence —</span>
              <span className="opacity-80">Contemplation</span>
            </h1>
            <p 
              className="text-stone-300 font-medium text-base md:text-xl leading-loose max-w-2xl mx-auto"
              style={{ fontFamily: "'Cormorant', serif" }}
            >
              W ciszy rodzi się muzyka. W ciszy się kontempluje.<br/>
              Muzyka jest kontemplacją duszy w czasie.<br/>
              <span className="text-stone-100 block mt-6 text-lg md:text-2xl italic tracking-wide">Tak powstał Voct – z ciszy i kontemplacji.</span>
            </p>
          </motion.div>
        </motion.div>

        {/* Scroll Indicator Guide */}
        <motion.div style={{ opacity: useTransform(scrollYProgress, [0, 0.05], [1, 0]) }} className="absolute bottom-6 text-[9px] uppercase tracking-[0.4em] font-bold text-stone-400 flex flex-col items-center gap-4 z-40">
          <span>Odkryj sacrum</span>
          <div className="w-px h-12 bg-stone-500/50"></div>
        </motion.div>

      </div>
    </div>
  );
}