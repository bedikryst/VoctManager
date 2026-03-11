/**
 * @file TeamSection.jsx
 * @description The Voices / Team Section - The Conductor & The Vision.
 * Features a complex "Focus Frame" effect utilizing a PINNED SCROLL on Desktop,
 * alongside a fluid, natural flow with automated viewport animations on Mobile.
 * @author Krystian Bugalski
 */

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import ElegantHeading from '../ui/ElegantHeading';

// ==========================================
// ANIMATION VARIANTS
// ==========================================

const blurVariants = {
  hidden: { opacity: 0, y: 30, filter: "blur(8px)" },
  visible: (delay) => ({
    opacity: 1, 
    y: 0, 
    filter: "blur(0px)",
    transition: { duration: 1.2, delay: delay, ease: [0.16, 1, 0.3, 1] }
  })
};

const maskVariants = {
  hidden: { y: "100%", rotate: 7, opacity: 0 },
  visible: (delay) => ({
    y: "0%", 
    rotate: 0, 
    opacity: 1,
    transition: { duration: 1.2, delay: delay, ease: [0.16, 1, 0.3, 1] }
  })
};

// ==========================================
// HELPER COMPONENTS
// ==========================================

const FadeBlurIn = ({ children, delay = 0, className = "" }) => (
  <motion.div variants={blurVariants} custom={delay} className={className} style={{ willChange: "transform, opacity, filter" }}>
    {children}
  </motion.div>
);

const MaskReveal = ({ children, delay = 0, className = "" }) => (
  <div className={`overflow-hidden pt-10 pb-12 -mt-10 -mb-12 px-4 -mx-4 ${className}`}>
    <motion.div variants={maskVariants} custom={delay}>
      {children}
    </motion.div>
  </div>
);

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function TeamSection() {
  // ==========================================
  // STATE & REFERENCES
  // ==========================================
  
  const sectionRef = useRef(null);

  // ==========================================
  // SCROLL KINEMATICS (Desktop Only)
  // ==========================================
  
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end end"] });
  
  // Content Parallax mappings
  const contentY = useTransform(scrollYProgress, [0, 1], [80, -20]); 
  const smallContentY = useTransform(scrollYProgress, [0, 1], [20, -20]);
  const imageInternalY = useTransform(scrollYProgress, [0, 1], ["-5%", "5%"]);

  // --- Desktop Scroll Timing for The Focus Frame ---
  const topVerticalProgress = useTransform(scrollYProgress, [0.5, 0.7], [0, 1]);
  const horizontalProgress = useTransform(scrollYProgress, [0.37, 0.5], [0, 1]);
  const frameProgress = useTransform(scrollYProgress, [0.62, 0.99], [0, 1]);

  // ==========================================
  // RENDER
  // ==========================================

  return (
    // Note: Height is dynamic on mobile to prevent scroll trapping, pinned to 150vh on desktop
    <section ref={sectionRef} className="relative bg-[#fdfbf7] text-stone-900 h-auto py-12 md:py-0 md:h-[150vh] selection:bg-[#002395] selection:text-white">
      
      {/* Sticky viewport enabled exclusively on desktop screens */}
      <div className="relative md:sticky md:top-0 md:-mt-30 md:h-screen w-full flex flex-col justify-center overflow-hidden">
        
        {/* ========================================== */}
        {/* ARCHITECTURAL GRID LAYER (Desktop Only)    */}
        {/* ========================================== */}
        <div className="absolute inset-0 max-w-7xl mx-auto px-6 md:px-0 w-full hidden md:block z-0 pointer-events-none" aria-hidden="true">
          {/* Vertical Drop Connector */}
          <div className="absolute top-30 left-[70.75%] w-[2px] h-[15vh] bg-stone-200/30">
            <motion.div style={{ scaleY: topVerticalProgress }} className="w-full h-full bg-[#002395] origin-top opacity-50" />
          </div>
          {/* Horizontal Bridge */}
          <div className="absolute top-30 left-[58.333333%] w-[12.4%] h-[2px] bg-stone-200/30">
            <motion.div style={{ scaleX: horizontalProgress }} className="w-full h-full bg-[#002395] origin-left opacity-50" />
          </div>
          {/* Incoming Sticky Compensator */}
          <div className="absolute -top-[10vh] left-[58.33333%] w-[2px] bottom-[86.7%] bg-stone-200/0">
            <motion.div style={{ scaleY: horizontalProgress }} className="w-full h-full bg-[#002395] origin-bottom opacity-50" />
          </div>
        </div>

        {/* ========================================== */}
        {/* FOREGROUND CONTENT                         */}
        {/* ========================================== */}
        <div className="max-w-7xl mx-auto px-6 md:px-0 relative z-20 w-full">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }} className="flex flex-col md:flex-row relative items-center">
            
            {/* --- Left Column: Typographic Vision --- */}
            <motion.div style={{ y: contentY, willChange: "transform" }} className="md:w-5/12 relative md:pr-16 lg:pr-20 z-10 w-full mb-20 md:mb-0">
              <div className="w-full text-left">
                <FadeBlurIn>
                  <p className="text-[#002395] text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] md:tracking-[0.3em] mb-4">VI. Idea</p>
                </FadeBlurIn>
                
                <MaskReveal delay={0.1} className="w-full md:w-max md:max-w-none mb-0 md:mb-12">
                  <motion.div initial="initial" whileHover="hover" className="flex flex-col w-max">
                    <ElegantHeading text="Wspólnota" className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-medium tracking-tight leading-[0.95] inline-block" />
                    <ElegantHeading text="Artystyczna" className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-medium tracking-tight leading-[0.95] inline-block" />
                  </motion.div>
                </MaskReveal>

                <FadeBlurIn delay={0.3}>
                  <p className="text-xl md:text-2xl text-stone-800 leading-snug mb-8 italic" style={{ fontFamily: "'Cormorant', serif" }}>
                    "VoctEnsemble to nie tylko głosy – to żywy organizm, którego tożsamość opiera się na jedności artystycznej i ludzkiej harmonii."
                  </p>
                  <p className="text-sm text-stone-500 font-light leading-relaxed">
                    Pod kierownictwem Florent’a de Bazelaire wnosimy na polską scenę muzyczną nową jakość estetyczną i duchową. Naszą misją jest zgłębianie człowieczeństwa za pomocą muzyki sakralnej.
                  </p>
                </FadeBlurIn>
              </div>
            </motion.div>
            
            {/* --- Right Column: Cinematic Portrait & Frame --- */}
            <div className="md:w-7/12 flex flex-col items-center justify-center relative z-20 w-full md:pt-12 pb-20 md:pb-0">
              
              <FadeBlurIn delay={0.4} className="w-full relative flex justify-center">
                
                {/* Mobile Specific: Horizontal entry line piercing the image center */}
                <div className="absolute top-1/2 left-[-1.5rem] right-1/2 h-[2px] z-10 -translate-y-1/2 md:hidden pointer-events-none">
                  <motion.div
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true, amount: 0.8 }}
                    transition={{ delay: 0.6, duration: 1, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full h-full bg-[#002395] origin-left opacity-50"
                  />
                </div>

                <div className="relative w-full max-w-sm aspect-[3/4] mx-auto z-20">
                  
                  {/* Desktop Focus Frame (Scroll-Bound) */}
                  <div className="absolute -inset-4 md:-inset-6 z-30 pointer-events-none hidden md:block">
                    <motion.div style={{ scaleX: frameProgress }} className="absolute top-0 left-0 right-0 h-px bg-[#002395]/40 origin-center" />
                    <motion.div style={{ scaleX: frameProgress }} className="absolute bottom-0 left-0 right-0 h-px bg-[#002395]/40 origin-center" />
                    <motion.div style={{ scaleY: frameProgress }} className="absolute top-0 bottom-0 left-0 w-px bg-[#002395]/40 origin-center" />
                    <motion.div style={{ scaleY: frameProgress }} className="absolute top-0 bottom-0 right-0 w-px bg-[#002395]/40 origin-center" />
                  </div>

                  {/* Mobile Focus Frame (Time-Bound, triggers after the horizontal line) */}
                  <div className="absolute -inset-4 z-30 pointer-events-none md:hidden">
                    <motion.div initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true, amount: 0.8 }} transition={{ duration: 0.8, delay: 1.6, ease: "easeOut" }} className="absolute top-0 left-0 right-0 h-px bg-[#002395]/40 origin-center" />
                    <motion.div initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true, amount: 0.8 }} transition={{ duration: 0.8, delay: 1.6, ease: "easeOut" }} className="absolute bottom-0 left-0 right-0 h-px bg-[#002395]/40 origin-center" />
                    <motion.div initial={{ scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true, amount: 0.8 }} transition={{ duration: 0.8, delay: 1.6, ease: "easeOut" }} className="absolute top-0 bottom-0 left-0 w-px bg-[#002395]/40 origin-center" />
                    <motion.div initial={{ scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true, amount: 0.8 }} transition={{ duration: 0.8, delay: 1.6, ease: "easeOut" }} className="absolute top-0 bottom-0 right-0 w-px bg-[#002395]/40 origin-center" />
                  </div>

                  {/* Portrait Container */}
                  <div className="absolute inset-0 overflow-hidden bg-stone-200 shadow-2xl">
                    <motion.div 
                      className="absolute inset-[-10%] w-[120%] h-[120%]"
                      style={{ y: imageInternalY, willChange: "transform" }}
                    >
                      <img 
                        src="/florentyn.jpg" 
                        alt="Florent de Bazelaire dyrygujący chórem" 
                        loading="lazy" // Performance optimization
                        className="w-full h-full object-cover object-[50%_30%] grayscale hover:grayscale-0 transition-all duration-2000"
                      />
                    </motion.div>
                    
                    {/* Vignette and Dark Overlays */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-80 pointer-events-none" />
                    <div className="absolute inset-0 border border-stone-900/10 mix-blend-multiply pointer-events-none" />

                    {/* Image Label */}
                    <div className="absolute bottom-6 left-6 right-6 flex flex-col items-start text-left text-white pointer-events-none">
                      <p className="text-[9px] uppercase tracking-[0.3em] font-bold text-white/60 mb-2">Dyrygent & Założyciel</p>
                      <h4 className="text-2xl font-medium tracking-wide" style={{ fontFamily: "'Cormorant', serif" }}>
                        Florent de Bazelaire
                      </h4>
                    </div>
                  </div>

                </div>
              </FadeBlurIn>

            </div>
            
          </motion.div>
        </div>

      </div>
    </section>
  );
}