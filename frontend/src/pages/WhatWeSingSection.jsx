/**
 * @file WhatWeSingSection.jsx
 * @description Repertoire section featuring high-velocity parallax scrolling, glassmorphism panels, 
 * brutalist image clipping, and large outline typography to visually represent polyphony.
 * @author Krystian Bugalski
 */

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

// SVG Noise filter encoded as a data URI for texture overlays
const noiseBg = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`;

export default function WhatWeSingSection() {
  const containerRef = useRef(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  // High-velocity parallax mapping for floating card effects
  const yFast = useTransform(scrollYProgress, [0, 1], [300, -300]);
  const ySlow = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const yReverse = useTransform(scrollYProgress, [0, 1], [-200, 100]);
  
  // Scroll-linked transforms for the background outline typography
  const bgTextY = useTransform(scrollYProgress, [0, 1], ["0%", "-40%"]);
  const bgTextYReverse = useTransform(scrollYProgress, [0, 1], ["-20%", "20%"]);

  return (
    <section ref={containerRef} className="relative py-32 md:py-48 lg:py-64 bg-stone-50 overflow-hidden z-10">
      

      {/* Background: Outline Typography Parallax */}
      <div className="absolute inset-0 -left-25 pointer-events-none flex flex-col justify-between z-0 opacity-[0.15] overflow-hidden">
        <motion.div style={{ y: bgTextY }} className="whitespace-nowrap mt-32">
          <span 
            className="text-[25vw] leading-none" 
            style={{ fontFamily: "'Cormorant', serif", WebkitTextStroke: '2px #44403c', color: 'transparent' }}
          >
            POLIFONIA POLIFONIA
          </span>
        </motion.div>
        <motion.div style={{ y: bgTextYReverse }} className="whitespace-nowrap -ml-[20vw] mt-64">
          <span 
            className="text-[25vw] leading-none italic" 
            style={{ fontFamily: "'Cormorant', serif", WebkitTextStroke: '2px #44403c', color: 'transparent' }}
          >
            HARMONIA HARMONIA
          </span>
        </motion.div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 md:px-12 relative z-10">
        
        {/* Section Header */}
        <div className="mb-24 md:mb-40 relative z-20 inline-block pr-8 pb-4">
          <p className="mb-6 text-[10px] font-bold uppercase tracking-[0.4em] text-amber-700">Repertuar</p>
          <h2 
            className="text-5xl md:text-7xl lg:text-[7rem] leading-none tracking-tighter text-stone-900"
            style={{ fontFamily: "'Cormorant', serif" }}
          >
            Co śpiewamy<span className="italic text-amber-700">?</span>
          </h2>
        </div>

        {/* Content Layer 1: Image Left, Glass Panel Right */}
        <div className="flex flex-col lg:flex-row relative items-center mb-32 md:mb-64">
          
          {/* Brutalist Image Wrapper */}
          <motion.div style={{ y: ySlow }} className="w-full lg:w-5/12 relative z-10">
            <div 
              className="w-full h-[60vh] md:h-[80vh] bg-cover bg-center grayscale shadow-2xl bg-stone-800" 
              style={{ 
                backgroundImage: "url('/flor.jpg')", 
                clipPath: "polygon(2% 0, 100% 4%, 96% 100%, 0 97%)"
              }}
            >
              <div className="absolute inset-0 opacity-30 mix-blend-overlay" style={{ backgroundImage: noiseBg }}></div>
              <div className="absolute inset-0 bg-stone-900/20 mix-blend-multiply"></div>
            </div>
          </motion.div>

          {/* Glassmorphism Content Panel */}
          <motion.div style={{ y: yFast }} className="w-full lg:w-8/12 lg:-ml-32 mt-12 lg:mt-0 z-20">
            <div className="p-10 md:p-16 lg:p-24 backdrop-blur-2xl bg-white/40 border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.08)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/80 to-transparent"></div>
              
              <h3 
                className="text-3xl md:text-5xl mb-8 leading-tight tracking-tight text-stone-900"
                style={{ fontFamily: "'Cormorant', serif" }}
              >
                Nade wszystko, <span className="italic">dzielimy się.</span>
              </h3>
              <p className="text-base md:text-lg leading-loose text-stone-600 max-w-xl">
                Dzielimy się naszym śpiewem, przemyślanymi narracjami muzycznymi utkanymi z utworów, w których muzyka i słowo są odbiciem lustrzanym samych siebie. Muzyka jako odbicie duszy słowa, a słowa niesione i wyrażane poprzez ułożenie dźwięków.
              </p>
              <p 
                className="mt-12 text-2xl md:text-3xl font-medium tracking-tight text-amber-800/90"
                style={{ fontFamily: "'Cormorant', serif" }}
              >
                Ubóstwiamy heterofonię, politonalność i polifonię.
              </p>
            </div>
          </motion.div>
        </div>

        {/* Content Layer 2: Glass Panel Left, Image Right */}
        <div className="flex flex-col-reverse lg:flex-row relative items-center">
          
          {/* Glassmorphism Content Panel (Reverse Parallax) */}
          <motion.div style={{ y: yReverse }} className="w-full lg:w-7/12 lg:-mr-20 mt-12 lg:mt-0 z-20">
            <div className="p-10 md:p-16 lg:p-20 backdrop-blur-3xl bg-white/40 border border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.06)] relative">
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/80 to-transparent"></div>
              <p className="text-base md:text-lg leading-loose text-stone-600 max-w-xl mb-8">
                Nie czulibyśmy się sobą, śpiewając muzykę, która nie obejmowałaby całego człowieka, dotykała jego głębi i próbowała urzec go pięknem mimo jego złożoności i kruchości. Interesuje nas świat. Jest dla nas źródłem inspiracji.
              </p>
              <p className="text-base md:text-lg leading-loose text-stone-600 max-w-xl">
                Muzyka wokalna czerpie z geniuszu ludzkiego, z Biblii i z mądrości przodków, do której kompozytorzy cały czas sięgają, by wyrażać to, co przeżywają i co ich najbardziej dotyka. Do tej przestrzeni zapraszamy naszych słuchaczy.
              </p>
            </div>
          </motion.div>

          {/* Brutalist Image Wrapper */}
          <motion.div style={{ y: ySlow }} className="w-full lg:w-6/12 relative z-10">
            <div 
              className="w-full h-[50vh] md:h-[70vh] bg-cover bg-center grayscale shadow-2xl bg-stone-800" 
              style={{ 
                backgroundImage: "url('/portret.jpg')", 
                clipPath: "polygon(0 3%, 98% 0, 100% 95%, 4% 100%)" 
              }}
            >
              <div className="absolute inset-0 opacity-40 mix-blend-overlay" style={{ backgroundImage: noiseBg }}></div>
              <div className="absolute inset-0 bg-amber-900/10 mix-blend-color"></div>
            </div>
          </motion.div>
          
        </div>

      </div>
    </section>
  );
}