/**
 * @file WhatWeDoSection.jsx
 * @description Editorial exhibition section with a mathematically precise architectural grid.
 * Features staggered typographic reveals, scroll-linked parallax, a physics-based 
 * drag slider, and floating hover images for spatial storytelling.
 * @author Krystian Bugalski
 */

import { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useMotionValue, AnimatePresence, useSpring, useVelocity } from 'framer-motion';
import { useCursor } from '../../context/CursorContext';
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

const lineVariants = {
  hidden: { scaleX: 0 },
  visible: { scaleX: 1, transition: { duration: 1.2, ease: [0.76, 0, 0.24, 1] } }
};

const dotVariants = {
  hidden: { scale: 0, opacity: 0 },
  visible: { scale: 1, opacity: 1, transition: { delay: 0.8, duration: 0.5, ease: "backOut" } }
};

// ==========================================
// DATA MODELS
// ==========================================

const synergies = [
  { 
    domain: "Akustyka & Dźwięk", 
    brands: "Ars Sonora Studio", 
    desc: "Perfekcja w ujęciu akustyki sakralnej i rejestracji wielogłosowej.",
    image: "/synergie_akustyka.jpg" 
  },
  { 
    domain: "Światło & Architektura", 
    brands: "Multiscena • ART Agencja", 
    desc: "Budowanie architektury nastroju i nowoczesnych misteriów poprzez światło.",
    image: "/synergie_swiatlo.jpg" 
  },
  { 
    domain: "Wirtuozeria", 
    brands: "Soliści & Instrumentaliści", 
    desc: "Współpraca z wybitnymi muzykami, poszerzająca polifonię o nowe brzmienia.",
    image: "/synergie_wirtuozeria.jpg" 
  },
  { 
    domain: "Mecenat Kultury", 
    brands: "Fundacje • Domy Kultury", 
    desc: "Razem z instytucjami budujemy przestrzeń dla sztuki wyższej.",
    image: "/synergie_mecenat.jpg" 
  }
];

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

const SynergyCard = ({ domain, brands, desc, image }) => (
  <motion.div className="flex-shrink-0 w-[75vw] md:w-[320px] lg:w-[380px] h-[400px] md:h-[500px] relative group overflow-hidden bg-stone-900 cursor-grab active:cursor-grabbing rounded-xl border border-stone-800 shadow-xl">
    
    {/* Background Image with Hover Scaling */}
    <motion.div 
      className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 ease-[0.16,1,0.3,1] group-hover:scale-110 opacity-80 md:opacity-70 group-hover:opacity-50 grayscale-0 md:grayscale group-hover:grayscale-0"
      style={{ backgroundImage: `url(${image})` }}
    />
    
    {/* Cinematic Dark Gradient Overlay */}
    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent pointer-events-none" />

    {/* Subtle Glass Inner Border */}
    <div className="absolute inset-0 border border-white/10 rounded-xl z-10 pointer-events-none" />

    {/* Card Content */}
    <div className="absolute bottom-0 left-0 w-full p-6 md:p-8 flex flex-col justify-end h-full z-20 pointer-events-none">
      <div className="translate-y-0 md:translate-y-4 group-hover:translate-y-0 transition-transform duration-700 ease-[0.16,1,0.3,1]">
        <p className="text-[9px] md:text-[10px] uppercase tracking-[0.3em] font-bold text-stone-400 mb-3 md:mb-4">
          {domain}
        </p>
        <h3 className="text-2xl md:text-3xl text-white mb-2 leading-tight" style={{ fontFamily: "'Cormorant', serif" }}>
          {brands}
        </h3>
        <p className="text-[12px] md:text-sm text-stone-300 font-light leading-relaxed opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-700 delay-100">
          {desc}
        </p>
      </div>
      
      {/* Decorative Line Reveal */}
      <div className="absolute top-8 left-8 w-px h-12 bg-white/20 origin-top scale-y-100 md:scale-y-0 group-hover:scale-y-100 transition-transform duration-700 delay-200" />
    </div>
  </motion.div>
);

export default function WhatWeDoSection() {
  // ==========================================
  // STATE & REFERENCES
  // ==========================================
  
  const sectionRef = useRef(null);
  const { enterDrag, leaveDrag, enterPointer, leavePointer } = useCursor();

  // ==========================================
  // SCROLL & PARALLAX KINEMATICS
  // ==========================================
  
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  
  const yParallaxFast = useTransform(scrollYProgress, [0, 1], [60, -100]); 
  const yParallaxSlow = useTransform(scrollYProgress, [0, 1], [60, -40]);
  
  // Architectural Grid Line Progression
  const lineProgress = useTransform(scrollYProgress, [0.05, 0.12], [0, 1]);
  const horizontalProgress = useTransform(scrollYProgress, [0.12, 0.20], [0, 1]);
  const lineProgress2 = useTransform(scrollYProgress, [0.2, 0.9], [0, 1]);

  // ==========================================
  // DRAG SLIDER PHYSICS LOGIC
  // ==========================================
  
  const sliderRef = useRef(null);
  const [sliderWidth, setSliderWidth] = useState(0);
  const x = useMotionValue(0);
  const progressWidth = useTransform(x, [0, -sliderWidth || -1000], ["0%", "100%"]);

  useEffect(() => {
    const measureSlider = () => {
      if (sliderRef.current) {
        setSliderWidth(sliderRef.current.scrollWidth - sliderRef.current.offsetWidth);
      }
    };
    measureSlider(); 
    const timeoutId = setTimeout(measureSlider, 250);
    window.addEventListener("resize", measureSlider);
    return () => {
      window.removeEventListener("resize", measureSlider);
      clearTimeout(timeoutId);
    };
  }, []);

  // ==========================================
  // FLOATING HOVER IMAGES LOGIC
  // ==========================================
  
  const [hoveredImage, setHoveredImage] = useState(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Apply spring physics for inertial floating effect
  const springConfig = { damping: 25, stiffness: 150, mass: 0.5 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  // Convert mouse velocity to 3D rotation and scale dynamics
  const velocityX = useVelocity(smoothX);
  const imageRotate = useTransform(velocityX, [-800, 0, 800], [-6, 0, 6]);
  const imageScale = useTransform(velocityX, [-800, 0, 800], [0.93, 1, 0.93]);

  const handleMouseMove = (e) => {
    mouseX.set(e.clientX);
    mouseY.set(e.clientY);
  };

  // Preload images to prevent blank frames during initial hover
  useEffect(() => {
    const imagesToPreload = [
      "/miejsce_tempel.webp",
      "/miejsce_sanktuarium.webp",
      "/miejsce_kolegiata.webp",
      "/miejsce_opactwo.jpg"
    ];
    imagesToPreload.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  // Renders text that triggers a floating contextual image on hover
  const renderHoverText = (text, image) => (
    <span 
      className="text-[#002395] font-medium md:cursor-none relative inline-block group pointer-events-none md:pointer-events-auto"
      onMouseEnter={() => { setHoveredImage(image); enterPointer?.(); }}
      onMouseLeave={() => { setHoveredImage(null); leavePointer?.(); }}
    >
      {text}
      <span className="absolute bottom-0 left-0 w-full h-px bg-[#002395] scale-x-0 md:group-hover:scale-x-100 origin-left transition-transform duration-300" />
    </span>
  );

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <section ref={sectionRef} className="relative bg-[#fdfbf7] text-stone-900 -mb-15 selection:bg-[#002395] selection:text-white overflow-hidden">
      
      {/* --- FLOATING HOVER OVERLAY --- */}
      <motion.div
        className="hidden md:block fixed top-0 left-0 w-[480px] h-[300px] pointer-events-none z-[100] overflow-hidden rounded-xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.4)] border border-stone-200"
        style={{ 
          x: useTransform(smoothX, val => val - 340), 
          y: useTransform(smoothY, val => val - 150),
          rotate: imageRotate,
          scaleX: imageScale,
          transformOrigin: "center",
          WebkitBackfaceVisibility: "hidden",
          backfaceVisibility: "hidden"
        }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ 
          opacity: hoveredImage ? 1 : 0, 
          scale: hoveredImage ? 1 : 0.8 
        }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/40 z-10 pointer-events-none mix-blend-multiply" />
        <div className="absolute inset-0 border border-white/20 rounded-xl z-20 pointer-events-none" />

        <AnimatePresence mode="popLayout">
          {hoveredImage && (
            <motion.img 
              key={hoveredImage}
              src={hoveredImage}
              loading="lazy"
              initial={{ opacity: 0, scale: 1.15 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.15 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 w-full h-full object-cover z-0"
              alt="Contextual Spatial View"
            />
          )}
        </AnimatePresence>
      </motion.div>

      <div className="max-w-7xl mx-auto px-6 md:px-0 relative z-10">

        {/* --- ARCHITECTURAL GRID CONNECTION --- */}
        <motion.div 
          initial={{ scaleX: 0 }} 
          whileInView={{ scaleX: 1 }} 
          viewport={{ once: true }} 
          transition={{ duration: 1.5, ease: [0.76, 0, 0.24, 1] }}
          className="hidden absolute top-0 right-1/2 w-[60%] md:w-[8.333333%] h-px bg-[#002395]/40 origin-right z-0" 
          aria-hidden="true"
        />
        
        {/* Horizontal Connector */}
        <div className="absolute top-[5%] left-[41.666667%] w-[8.5%] h-[2px] bg-stone-200/50">
          <motion.div style={{ scaleX: horizontalProgress }} className="w-full h-full bg-[#002395] origin-right opacity-50" />
        </div>
        
        {/* Incoming Vertical Drop (From 50% to intersection) */}
        <div className="absolute -top-0 left-[50%] w-[2px] h-[5%] bg-stone-200/50">
          <motion.div style={{ scaleY: lineProgress }} className="w-full h-full bg-[#002395] origin-top opacity-50" />
          <div className="absolute top-0 -left-30 w-35 h-48 bg-gradient-to-b from-[#fdfbf7] to-transparent z-10" />
        </div>
        
        {/* Outgoing Vertical Drop (From intersection to bottom) */}        
        <div className="absolute top-[5%] bottom-0 left-[41.666667%] w-[2px] bg-stone-200/50 hidden md:block z-0" aria-hidden="true">
          <motion.div style={{ scaleY: lineProgress2 }} className="w-full h-full bg-[#002395] origin-top opacity-50" />
        </div>

        {/* --- BLOCK 1: Concerts Spirituels --- */}
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }} className="flex flex-col md:flex-row min-h-[50vh] mt-15 md:mt-0 mb-8 md:mb-0 relative pb-8 md:pb-0">
          <div className="md:w-5/12 relative md:pr-12 lg:pr-8">
            <div className="md:sticky md:top-48 z-10 w-full pt-8 md:pt-0">
              <div className="hidden md:flex absolute top-6 md:-right-12 lg:-right-8 w-[12vw] lg:w-[15vw] h-px items-center justify-start z-0" aria-hidden="true">
                <motion.div variants={lineVariants} className="w-full h-full bg-[#002395]/70 origin-right" />
                <motion.div variants={dotVariants} className="absolute left-0 w-2 h-2 rounded-full bg-[#002395] shadow-[0_0_12px_rgba(0,35,149,0.5)]" />
              </div>

              <div className="md:pl-[4vw] lg:pl-[1vw] xl:pl-0 md:pt-14 relative z-10 text-left">
                <FadeBlurIn>
                  <p className="text-[#002395] text-[9px] font-bold uppercase tracking-[0.2em] md:tracking-[0.3em] mb-4">I. Działalność</p>
                </FadeBlurIn>
                <MaskReveal delay={0.1} className="flex flex-col w-max max-w-none">
                  <motion.div initial="initial" whileHover="hover" className="flex flex-col w-max">
                    <ElegantHeading text="Concerts" className="text-5xl md:text-6xl lg:text-8xl font-medium tracking-tight leading-[0.95] inline-block" />
                    <ElegantHeading text="Spirituels" className="text-5xl md:text-6xl lg:text-8xl font-medium tracking-tight leading-[0.95] inline-block" />
                  </motion.div>
                </MaskReveal>
              </div>
            </div>
          </div>
          
          <motion.div style={{ y: yParallaxFast, willChange: "transform" }} className="md:w-7/12 flex flex-col justify-center relative z-0 md:pl-16 lg:pl-28 md:py-50 mt-6 md:mt-0">
            <FadeBlurIn delay={0.2}>
              <p className="text-2xl md:text-4xl text-stone-800 leading-snug mb-8" style={{ fontFamily: "'Cormorant', serif" }}>
                Przywracamy tradycję dawnych <span className="text-[#002395] italic">Concerts Spirituels</span>. 
                Tworzymy pomost między historyczną świadomością a potrzebami współczesnego słuchacza.
              </p>
            </FadeBlurIn>
            <FadeBlurIn delay={0.3}>
              <p className="text-base text-stone-500 font-light leading-relaxed max-w-lg">
                Nasza działalność obejmuje nie tylko autorskie Koncerty Duchowe, ale również starannie przygotowane oprawy liturgiczne, msze ślubne oraz uświetnianie najważniejszych uroczystości kościelnych. Jesteśmy tam, gdzie muzyka musi stać się modlitwą.
              </p>
            </FadeBlurIn>
            <FadeBlurIn delay={0.4} className="mt-10 flex flex-col sm:flex-row gap-6 sm:gap-12">
              <Link to="/kontakt" className="group flex items-center gap-4 text-[10px] md:text-xs uppercase tracking-[0.2em] font-medium text-[#002395] md:text-stone-500 md:hover:text-[#002395] transition-colors">
                <span className="relative overflow-hidden pb-1">
                  Zabookuj koncert
                  <span className="hidden md:block absolute bottom-0 left-0 w-full h-px bg-[#002395] md:bg-stone-300 origin-left scale-x-100 transition-transform duration-500 md:group-hover:scale-x-0" />
                  <span className="hidden md:block absolute bottom-0 left-0 w-full h-px bg-[#002395] origin-right scale-x-0 transition-transform duration-500 md:group-hover:scale-x-100" />
                </span>
                <span className="w-8 h-px bg-[#002395] md:bg-stone-300 md:group-hover:bg-[#002395] md:group-hover:w-16 transition-all duration-500" />
              </Link>
              <Link to="/projekty" className="group flex items-center gap-4 text-[10px] md:text-xs uppercase tracking-[0.2em] font-medium text-[#002395] md:text-stone-500 md:hover:text-[#002395] transition-colors">
                <span className="w-8 h-px bg-[#002395] md:bg-stone-300 md:group-hover:bg-[#002395] md:group-hover:w-16 transition-all duration-500" />
                <span className="relative overflow-hidden pb-1">
                  Zobacz projekty
                  <span className="hidden md:block absolute bottom-0 right-0 w-full h-px bg-[#002395] md:bg-stone-300 origin-right scale-x-100 transition-transform duration-500 md:group-hover:scale-x-0" />
                  <span className="hidden md:block absolute bottom-0 right-0 w-full h-px bg-[#002395] origin-left scale-x-0 transition-transform duration-500 md:group-hover:scale-x-100" />
                </span>
              </Link>
            </FadeBlurIn>
          </motion.div>
        </motion.div>

        {/* --- BLOCK 2: Interdisciplinary Synergies (VISUAL SLIDER) --- */}
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }} className="flex flex-col md:flex-row min-h-[50vh] mb-8 md:mb-0 relative pb-8 md:pb-0">
          <div className="md:w-5/12 relative md:pr-12 lg:pr-8">
            <div className="md:sticky md:top-48 z-10 w-full pt-8 md:pt-0">
              <div className="hidden md:flex absolute top-6 md:-right-12 lg:-right-8 w-[12vw] lg:w-[15vw] h-px items-center justify-start z-0" aria-hidden="true">
                <motion.div variants={lineVariants} className="w-full h-full bg-[#002395]/70 origin-right" />
                <motion.div variants={dotVariants} className="absolute left-0 w-2 h-2 rounded-full bg-[#002395] shadow-[0_0_12px_rgba(0,35,149,0.5)]" />
              </div>

              <div className="md:pl-[4vw] lg:pl-[1vw] xl:pl-0 md:pt-14 relative z-10 text-left">
                <FadeBlurIn>
                  <p className="text-[#002395] text-[10px] font-bold uppercase tracking-[0.2em] md:tracking-[0.3em] mb-4">II. Interdyscyplinarność</p>
                </FadeBlurIn>
                <MaskReveal delay={0.1} className="w-max max-w-none">
                  <motion.div initial="initial" whileHover="hover" className="flex flex-col w-max">
                    <ElegantHeading text="Synergie" className="text-5xl md:text-6xl lg:text-8xl font-medium tracking-tight leading-[0.95] inline-block" />
                    <div>
                      <span className="italic text-5xl md:text-6xl lg:text-8xl font-medium tracking-tight leading-[0.95] pr-3" style={{ fontFamily: "'Cormorant', serif" }}>&</span>
                      <ElegantHeading text="Wirtuozeria" className="text-5xl md:text-6xl lg:text-8xl font-medium tracking-tight leading-[0.95] inline-block" />
                    </div>
                  </motion.div>
                </MaskReveal>
              </div>
            </div>
          </div>
          
          <motion.div style={{ y: yParallaxSlow, willChange: "transform" }} className="md:w-7/12 flex flex-col justify-center relative z-0 md:pl-16 lg:pl-28 md:py-24 mt-6 md:mt-0 w-full overflow-hidden md:overflow-visible">
            <FadeBlurIn delay={0.2} className="pr-6 md:pr-0">
              <p className="text-2xl md:text-4xl text-stone-800 leading-snug mb-12" style={{ fontFamily: "'Cormorant', serif" }}>
                Nasze koncerty to nowoczesne misteria. Aby dźwięk mógł w pełni rezonować z przestrzenią, zapraszamy do współpracy profesjonalistów sztuki.
              </p>
            </FadeBlurIn>
            <div className="w-full relative cursor-none" onMouseEnter={enterDrag} onMouseLeave={leaveDrag}>
              <FadeBlurIn delay={0.3}>
                <div ref={sliderRef} className="overflow-hidden pb-4 md:pb-8 pr-6 md:pr-0">
                  {/* Note: touch-pan-y allows vertical page scrolling while hovering the horizontal slider on mobile */}
                  <motion.div drag="x" dragConstraints={{ right: 0, left: -sliderWidth }} style={{ x }} className="flex gap-4 md:gap-8 force-no-cursor w-max touch-pan-y">
                    {synergies.map((item, idx) => (
                      <SynergyCard key={idx} {...item} />
                    ))}
                  </motion.div>
                </div>
              </FadeBlurIn>
              <div className="md:hidden mt-2 h-[2px] w-full pr-6 bg-[#002395]/10 rounded-full overflow-hidden">
                <motion.div style={{ width: progressWidth }} className="h-full bg-[#002395] rounded-full" />
              </div>
              <FadeBlurIn delay={0.4} className="mt-8 pr-6 md:pr-0 flex justify-end">
                <Link to="/" className="group flex items-center gap-4 text-[10px] md:text-xs uppercase tracking-[0.2em] font-medium text-stone-500 hover:text-[#002395] transition-colors" onMouseEnter={leaveDrag} onMouseLeave={enterDrag}>
                  <span className="relative overflow-hidden pb-1">Więcej o synergii<span className="absolute bottom-0 left-0 w-full h-px bg-stone-300 origin-left scale-x-100 transition-transform duration-500 group-hover:scale-x-0" /><span className="absolute bottom-0 left-0 w-full h-px bg-[#002395] origin-right scale-x-0 transition-transform duration-500 group-hover:scale-x-100" /></span><span className="w-8 h-px bg-stone-300 group-hover:bg-[#002395] group-hover:w-16 transition-all duration-500" />
                </Link>
              </FadeBlurIn>
            </div>
          </motion.div>
        </motion.div>

        {/* --- BLOCK 3: Sacred Spaces --- */}
        <motion.div 
          initial="hidden" 
          whileInView="visible" 
          viewport={{ once: true, amount: 0.15 }}
          className="flex flex-col md:flex-row min-h-[50vh] pb-8 md:pb-0"
          onMouseMove={handleMouseMove}
        >
          <div className="md:w-5/12 relative md:pr-12 lg:pr-8">
            <div className="md:sticky md:top-48 z-10 w-full pt-8 md:pt-0">
              <div className="hidden md:flex absolute top-6 md:-right-12 lg:-right-8 w-[12vw] lg:w-[15vw] h-px items-center justify-start z-0" aria-hidden="true">
                <motion.div variants={lineVariants} className="w-full h-full bg-[#002395]/70 origin-right"/>
                <motion.div variants={dotVariants} className="absolute left-0 w-2 h-2 rounded-full bg-[#002395] shadow-[0_0_12px_rgba(0,35,149,0.5)]" />
              </div>

              <div className="md:pl-[4vw] lg:pl-[1vw] xl:pl-0 md:pt-14 relative z-10 text-left">
                <FadeBlurIn>
                  <p className="text-[#002395] text-[10px] font-bold uppercase tracking-[0.2em] md:tracking-[0.3em] mb-4">III. Wydarzenia</p>
                </FadeBlurIn>
                <MaskReveal delay={0.1} className="w-max max-w-none">
                  <motion.div initial="initial" whileHover="hover" className="flex flex-col w-max">
                    <ElegantHeading text="Przestrzenie" className="text-5xl md:text-6xl lg:text-8xl font-medium tracking-tight leading-[0.95] inline-block" />
                    <ElegantHeading text="Sacrum" className="text-5xl md:text-6xl lg:text-8xl font-medium tracking-tight leading-[0.95] inline-block" />
                  </motion.div>
                </MaskReveal>
              </div>
            </div>
          </div>
          
          <motion.div style={{ y: yParallaxSlow, willChange: "transform" }} className="md:w-7/12 flex flex-col justify-center gap-12 relative z-0 md:pl-16 lg:pl-28 md:py-24 mt-10 md:mt-0">
            <FadeBlurIn delay={0.2}>
              <div className="relative pl-8 md:pl-0 py-4">
                <motion.div variants={{ hidden: { scaleY: 0 }, visible: { scaleY: 1, transition: { duration: 1, ease: [0.76, 0, 0.24, 1] } } }} className="absolute left-0 top-[10px] bottom-[6px] w-px bg-[#002395] origin-top md:hidden" aria-hidden="true" />
                
                <p className="text-2xl md:text-4xl text-stone-800 mb-6 leading-snug" style={{ fontFamily: "'Cormorant', serif" }}>
                  Wzbogaciliśmy liturgię podczas obchodów 28. Dnia Judaizmu w Kościele katolickim pod przewodnictwem bp Roberta Chrząszcza.
                </p>
                <p className="text-stone-500 font-light text-base max-w-lg leading-relaxed">
                  Dopełnieniem tego wydarzenia był nasz występ w krakowskiej {renderHoverText("Synagodze Tempel", "/miejsce_tempel.webp")} w ramach wspomnienia o Błogosławionej Pamięci Tadeuszu Jakubowiczu.
                </p>
              </div>
            </FadeBlurIn>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 pb-10 md:pb-0">
              <FadeBlurIn delay={0.3}>
                <h4 className="text-[#002395] font-bold mb-4 uppercase text-[10px] tracking-[0.2em]">Stolica Apostolska</h4>
                <p className="text-stone-600 text-sm font-light leading-relaxed">
                  W najbliższym czasie uświetnimy liturgię w {renderHoverText("Sanktuarium św. Andrzeja Boboli", "/miejsce_sanktuarium.webp")} w obecności o. Generała jezuitów, o. Artura Sosy-Abascala SJ.
                </p>
              </FadeBlurIn>
              <FadeBlurIn delay={0.4}>
                <h4 className="text-[#002395] font-bold mb-4 uppercase text-[10px] tracking-[0.2em]">Oprawy Uroczystości</h4>
                <p className="text-stone-600 text-sm font-light leading-relaxed">
                  Mieliśmy zaszczyt oprawiać liturgie ślubne w tak monumentalnych przestrzeniach jak {renderHoverText("Kolegiata św. Anny", "/miejsce_kolegiata.webp")} w Krakowie czy historyczne {renderHoverText("Opactwo Benedyktynów w Tyńcu", "/miejsce_opactwo.jpg")}.
                </p>
              </FadeBlurIn>
            </div>
          </motion.div>
        </motion.div>

      </div>
    </section>
  );
}