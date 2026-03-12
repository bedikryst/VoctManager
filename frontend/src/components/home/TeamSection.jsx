/**
 * @file TeamSection.jsx
 * @description The Voices / Team Section - The Conductor & The Vision.
 * Features a complex "Focus Frame" effect utilizing a PINNED SCROLL on Desktop,
 * and perfectly synchronized local scrollytelling typography.
 * @author Krystian Bugalski
 */

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import ElegantHeading from '../ui/ElegantHeading';

export default function TeamSection() {
  // ==========================================
  // STATE & REFERENCES
  // ==========================================
  
  const sectionRef = useRef(null);
  const textBlockRef = useRef(null);

  // ==========================================
  // GLOBAL SCROLL KINEMATICS (Desktop Grid & Frame)
  // ==========================================
  
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end end"] });
  
  const imageInternalY = useTransform(scrollYProgress, [0, 1], ["-5%", "5%"]);

  const topVerticalProgress = useTransform(scrollYProgress, [0.5, 0.7], [0, 1]);
  const horizontalProgress = useTransform(scrollYProgress, [0.37, 0.5], [0, 1]);
  const frameProgress = useTransform(scrollYProgress, [0.62, 0.99], [0, 1]);

  // ==========================================
  // LOCAL SCROLLYTELLING (Typography)
  // ==========================================
  
  const { scrollYProgress: textScroll } = useScroll({ target: textBlockRef, offset: ["start 80%", "end 30%"] });
  const textOpacity = useTransform(textScroll, [0, 0.3, 0.8, 1], [0, 1, 1, 0]);
  const textY = useTransform(textScroll, [0, 0.3, 0.8, 1], [40, 0, 0, -40]);
  const textBlur = useTransform(textScroll, [0, 0.3, 0.8, 1], ["blur(12px)", "blur(0px)", "blur(0px)", "blur(12px)"]);

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <section ref={sectionRef} className="relative bg-[#fdfbf7] text-stone-900 h-auto py-12 md:py-0 md:h-[150vh] selection:bg-[#002395] selection:text-white">
      
      <div className="relative md:sticky md:top-0 md:h-screen w-full flex flex-col justify-center overflow-hidden">
        
        {/* --- ARCHITECTURAL GRID LAYER --- */}
        <div className="absolute inset-0 max-w-7xl mx-auto px-6 md:px-0 w-full hidden md:block z-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-[13.2%] left-[70.75%] w-[2px] h-[15%] bg-stone-200/30">
            <motion.div style={{ scaleY: topVerticalProgress }} className="w-full h-full bg-[#002395] origin-top opacity-50" />
          </div>
          <div className="absolute top-[13.2%] left-[58.333333%] w-[12.4%] h-[2px] bg-stone-200/30">
            <motion.div style={{ scaleX: horizontalProgress }} className="w-full h-full bg-[#002395] origin-left opacity-50" />
          </div>
          
        </div>

        {/* --- FOREGROUND CONTENT --- */}
        <div className="max-w-7xl mx-auto px-6 md:px-0 relative z-20 w-full">
          <div className="flex flex-col md:flex-row relative items-center">
            
            {/* --- Left Column: Typographic Vision --- */}
            <div ref={textBlockRef} className="md:w-5/12 relative md:pr-16 lg:pr-20 z-10 w-full mb-20 md:mb-0">
              <motion.div 
                style={{ opacity: textOpacity, y: textY, filter: textBlur, willChange: "transform, opacity, filter" }}
                className="w-full text-left"
              >
                <p className="text-[#002395] text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] md:tracking-[0.3em] mb-4">VI. Fundament</p>
                
                <div className="flex flex-col w-max mb-12">
                  <ElegantHeading text="Wspólnota" className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-medium tracking-tight leading-[0.95] inline-block" />
                  <ElegantHeading text="Artystyczna" className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-medium tracking-tight leading-[0.95] inline-block" />
                </div>

                <p className="text-xl md:text-2xl text-stone-800 leading-snug mb-8 italic border-l-2 border-[#002395]/30 pl-6" style={{ fontFamily: "'Cormorant', serif" }}>
                  "VoctEnsemble to nie tylko głosy – to żywy organizm, którego tożsamość opiera się na jedności artystycznej i ludzkiej harmonii."
                </p>
                <p className="text-sm text-stone-500 font-light leading-relaxed pl-6">
                  Pod kierownictwem Florent’a de Bazelaire wnosimy na polską scenę muzyczną nową jakość estetyczną i duchową. Naszą misją jest zgłębianie człowieczeństwa za pomocą muzyki sakralnej.
                </p>
              </motion.div>
            </div>
            
            {/* --- Right Column: Cinematic Portrait & Frame --- */}
            <div className="md:w-7/12 flex flex-col items-center justify-center relative z-20 w-full md:pt-12 pb-20 md:pb-0">
              
              <div className="w-full relative flex justify-center group">
                
                {/* Mobile Specific Line */}
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
                  
                  {/* Desktop Focus Frame */}
                  <div className="absolute -inset-4 md:-inset-6 z-30 pointer-events-none hidden md:block">
                    <motion.div style={{ scaleX: frameProgress }} className="absolute top-0 left-0 right-0 h-px bg-[#002395]/40 origin-center" />
                    <motion.div style={{ scaleX: frameProgress }} className="absolute bottom-0 left-0 right-0 h-px bg-[#002395]/40 origin-center" />
                    <motion.div style={{ scaleY: frameProgress }} className="absolute top-0 bottom-0 left-0 w-px bg-[#002395]/40 origin-center" />
                    <motion.div style={{ scaleY: frameProgress }} className="absolute top-0 bottom-0 right-0 w-px bg-[#002395]/40 origin-center" />
                  </div>

                  {/* Mobile Focus Frame */}
                  <div className="absolute -inset-4 z-30 pointer-events-none md:hidden">
                    <motion.div initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true, amount: 0.8 }} transition={{ duration: 0.8, delay: 1.6, ease: "easeOut" }} className="absolute top-0 left-0 right-0 h-px bg-[#002395]/40 origin-center" />
                    <motion.div initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true, amount: 0.8 }} transition={{ duration: 0.8, delay: 1.6, ease: "easeOut" }} className="absolute bottom-0 left-0 right-0 h-px bg-[#002395]/40 origin-center" />
                    <motion.div initial={{ scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true, amount: 0.8 }} transition={{ duration: 0.8, delay: 1.6, ease: "easeOut" }} className="absolute top-0 bottom-0 left-0 w-px bg-[#002395]/40 origin-center" />
                    <motion.div initial={{ scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true, amount: 0.8 }} transition={{ duration: 0.8, delay: 1.6, ease: "easeOut" }} className="absolute top-0 bottom-0 right-0 w-px bg-[#002395]/40 origin-center" />
                  </div>

                  {/* Portrait Container */}
                  <div className="absolute inset-0 overflow-hidden bg-stone-200 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.3)]">
                    <motion.div 
                      className="absolute inset-[-10%] w-[120%] h-[120%]"
                      style={{ y: imageInternalY, willChange: "transform" }}
                    >
                      <img 
                        src="/florentyn.jpg" 
                        alt="Florent de Bazelaire dyrygujący chórem" 
                        loading="lazy" 
                        className="w-full h-full object-cover object-[50%_30%] grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-[2s] ease-[0.16,1,0.3,1]"
                      />
                    </motion.div>
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-80 pointer-events-none transition-opacity duration-1000 group-hover:opacity-60" />
                    <div className="absolute inset-0 border border-stone-900/10 mix-blend-multiply pointer-events-none" />

                    {/* Image Label */}
                    <div className="absolute bottom-6 left-6 right-6 flex flex-col items-start text-left text-white pointer-events-none transform transition-transform duration-1000 group-hover:-translate-y-2">
                      <p className="text-[9px] uppercase tracking-[0.3em] font-bold text-white/60 mb-2">Dyrygent & Założyciel</p>
                      <h4 className="text-2xl font-medium tracking-wide" style={{ fontFamily: "'Cormorant', serif" }}>
                        Florent de Bazelaire
                      </h4>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </section>
  );
}