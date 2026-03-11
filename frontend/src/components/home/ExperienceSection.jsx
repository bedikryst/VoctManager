/**
 * @file ExperienceSection.jsx
 * @description Act II: The Cinematic Counterpoint.
 * Transitions from the blinding white of the Hero into a deep, resonant darkness.
 * Features a hardware-accelerated parallax background video, majestic typography,
 * and high-end editorial CTAs.
 * @author Krystian Bugalski
 */

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function ExperienceSection() {
  // ==========================================
  // STATE & REFERENCES
  // ==========================================
  
  const sectionRef = useRef(null);

  // ==========================================
  // SCROLL KINEMATICS
  // ==========================================
  
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"]
  });

  // --- Background Video Parallax ---
  // The video slowly zooms out and translates downward, creating a profound sense of depth
  const videoScale = useTransform(scrollYProgress, [0, 1], [1.15, 1]);
  const videoY = useTransform(scrollYProgress, [0, 1], ["-10%", "10%"]);
  
  // --- Dynamic Lighting (Overlay) ---
  // The dark overlay slowly fades to reveal the concert video, acting as a visual curtain
  const overlayOpacity = useTransform(scrollYProgress, [0.1, 0.3], [0.95, 0.5]);

  // --- Typography Choreography ---
  // The core message floats upward while fading in and out of the darkness
  const textY = useTransform(scrollYProgress, [0.3, 0.7], [80, -80]);
  const textOpacity = useTransform(scrollYProgress, [0.2, 0.4, 0.6, 0.8], [0, 1, 1, 0]);

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <section 
      ref={sectionRef} 
      className="relative h-[150vh] md:h-[200vh] bg-stone-950 text-stone-100 selection:bg-stone-100 selection:text-stone-900"
    >
      
      {/* --- STICKY VIEWPORT --- */}
      <div className="sticky top-0 h-screen w-full overflow-hidden flex flex-col items-center justify-center">
        
        {/* 1. Hardware-Accelerated Parallax Video Background */}
        <motion.div
          className="absolute inset-0 w-full h-full grayscale"
          style={{ 
            scale: videoScale, 
            y: videoY,
            willChange: "transform",
            transformOrigin: "center",
            // Forcing GPU acceleration to maintain 60FPS during video scale/translate
            WebkitBackfaceVisibility: "hidden",
            backfaceVisibility: "hidden"
          }}
          aria-hidden="true"
        >
          <video 
            src="/experience_video.mp4" // TODO: Add path to optimized max. 5MB video loop
            autoPlay 
            loop 
            muted 
            playsInline // Critical for iOS to prevent fullscreen takeover
            poster="/wystep.jpg" // Fallback image while the video buffers
            className="w-full h-full object-cover pointer-events-none"
          />
        </motion.div>
        
        {/* 2. Dynamic Dark Overlay */}
        <motion.div 
          className="absolute inset-0 bg-stone-950" 
          style={{ opacity: overlayOpacity, willChange: "opacity" }} 
          aria-hidden="true"
        />

        {/* 3. Cinematic Typography & CTAs */}
        <motion.div 
          style={{ y: textY, opacity: textOpacity, willChange: "transform, opacity" }} 
          className="relative z-10 flex flex-col items-center text-center px-6 w-full"
        >
          <p className="text-stone-500 text-[9px] md:text-[10px] uppercase tracking-[0.4em] font-bold mb-8">
            Doświadczenie
          </p>
          
          <h2 className="text-5xl md:text-8xl lg:text-[10rem] leading-none tracking-tight mb-6 md:mb-8" style={{ fontFamily: "'Cormorant', serif" }}>
            Voct<span className="italic text-stone-400">Ensemble</span>
          </h2>
          
          <p className="text-xl md:text-3xl lg:text-4xl text-stone-300 italic mb-16 max-w-3xl" style={{ fontFamily: "'Cormorant', serif" }}>
            Przestrzenią autentycznego spotkania.
          </p>

          {/* --- Luxury Editorial CTAs --- */}
          <div className="flex flex-col md:flex-row gap-8 md:gap-16 mt-4">
            
            {/* CTA 1: Discover the Ensemble */}
            <Link to="/zespol" className="group flex items-center gap-4 text-[10px] md:text-xs uppercase tracking-[0.2em] font-medium text-stone-300 md:hover:text-white transition-colors">
              <span className="relative overflow-hidden pb-1">
                Odkryj Zespół
                <span className="absolute bottom-0 left-0 w-full h-px bg-stone-300 md:bg-stone-600 origin-left scale-x-100 transition-transform duration-500 md:group-hover:scale-x-0" />
                <span className="hidden md:block absolute bottom-0 left-0 w-full h-px bg-white origin-right scale-x-0 transition-transform duration-500 md:group-hover:scale-x-100" />
              </span>
              <span className="w-8 h-px bg-stone-300 md:bg-stone-600 md:group-hover:bg-white md:group-hover:w-16 transition-all duration-500" />
            </Link>

            {/* CTA 2: View Concerts */}
            <Link to="/koncerty" className="group flex items-center gap-4 text-[10px] md:text-xs uppercase tracking-[0.2em] font-medium text-stone-300 md:hover:text-white transition-colors">
              <span className="w-8 h-px bg-stone-300 md:bg-stone-600 md:group-hover:bg-white md:group-hover:w-16 transition-all duration-500" />
              <span className="relative overflow-hidden pb-1">
                Zobacz Koncerty
                <span className="absolute bottom-0 right-0 w-full h-px bg-stone-300 md:bg-stone-600 origin-right scale-x-100 transition-transform duration-500 md:group-hover:scale-x-0" />
                <span className="hidden md:block absolute bottom-0 right-0 w-full h-px bg-white origin-left scale-x-0 transition-transform duration-500 md:group-hover:scale-x-100" />
              </span>
            </Link>

          </div>
        </motion.div>

      </div>
    </section>
  );
}