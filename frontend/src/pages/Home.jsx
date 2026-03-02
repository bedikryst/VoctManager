/**
 * Home Page (Landing Page)
 * @author Krystian Bugalski
 * * The landing page for VoctEnsemble.
 */
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform, useMotionValueEvent } from 'framer-motion';

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const scrollContainerRef = useRef(null);

  // Global scroll listener for the floating navbar
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsScrolled(latest > 100);
  });

  // Localized scroll progress for the Scrollytelling hero section
  const { scrollYProgress } = useScroll({
    target: scrollContainerRef,
    offset: ["start start", "end end"]
  });

  // --- HYPER-MINIMALIST ANIMATION MATHEMATICS ---
  
  // The central "VE" monogram slowly zooms IN and fades out (Cinematic fly-through)
  const veScale = useTransform(scrollYProgress, [0, 0.5], [1, 1.8]);
  const veOpacity = useTransform(scrollYProgress, [0, 0.4], [1, 0]);

  // The ensemble description elegantly fades and slides UP from the void
  const textOpacity = useTransform(scrollYProgress, [0.3, 0.6], [0, 1]);
  const textY = useTransform(scrollYProgress, [0.3, 0.6], [100, 0]);

  // Mouse tracking for the subtle parallax/glitch effect on the "VE" monogram
  useEffect(() => {
    const handleMouseMove = (e) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      setMousePosition({ x, y });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const menuVariants = {
    hidden: { y: '-100%', transition: { duration: 0.8, ease: [0.76, 0, 0.24, 1] } },
    visible: { y: 0, transition: { duration: 0.8, ease: [0.76, 0, 0.24, 1] } }
  };

  const linkVariants = {
    hidden: { y: 50, opacity: 0 },
    visible: i => ({ y: 0, opacity: 1, transition: { delay: 0.2 + (i * 0.1), duration: 0.8, ease: [0.76, 0, 0.24, 1] } })
  };

  return (
    <div className="bg-stone-50 font-sans text-stone-900 selection:bg-amber-600 selection:text-white">
      
      {/* 1. DYNAMIC FLOATING NAVBAR */}
      <motion.nav 
        className={`fixed z-50 transition-all duration-700 ease-in-out flex items-center justify-between ${
          isScrolled 
            ? 'top-6 left-1/2 -translate-x-1/2 w-[92%] max-w-4xl px-6 py-3.5 rounded-2xl bg-white/70 backdrop-blur-xl border border-stone-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.06)]' 
            : 'top-0 left-0 w-full px-8 py-8 md:px-12 bg-transparent text-stone-900'
        }`}
      >
        <div className="flex-1 flex justify-start">
          <button onClick={() => setMenuOpen(true)} className="group flex flex-col space-y-1.5 p-2 hover:opacity-50 transition-opacity" aria-label="Menu">
            <span className={`h-px bg-current transition-all duration-500 ease-out ${isScrolled ? 'w-5 group-hover:w-7' : 'w-7 group-hover:w-9'}`}></span>
            <span className={`h-px bg-current transition-all duration-500 ease-out ${isScrolled ? 'w-7 group-hover:w-5' : 'w-9 group-hover:w-7'}`}></span>
          </button>
        </div>

        <div className="flex-1 flex justify-center pointer-events-none">
          <span className={`font-serif italic tracking-widest transition-all duration-700 ${isScrolled ? 'text-sm md:text-base' : 'text-xl md:text-2xl'}`}>
            VoctEnsemble
          </span>
        </div>

        <div className="flex-1 flex justify-end items-center space-x-5 md:space-x-8">
          <Link to="/panel" className="text-stone-400 hover:text-stone-900 transition-colors" title="Strefa Artysty">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`${isScrolled ? 'w-4 h-4' : 'w-5 h-5'}`}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </Link>
          <Link to="/fundacja" className={`text-[10px] font-bold uppercase tracking-[0.2em] px-5 py-2.5 rounded-xl transition-all border ${isScrolled ? 'border-transparent bg-stone-900 text-stone-100 hover:bg-amber-700 hover:shadow-lg hover:-translate-y-0.5' : 'border-stone-900 text-stone-900 hover:bg-stone-900 hover:text-stone-100'}`}>
            Wesprzyj
          </Link>
        </div>
      </motion.nav>

      {/* 2. FULLSCREEN OVERLAY MENU */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div 
            variants={menuVariants} initial="hidden" animate="visible" exit="hidden"
            className="fixed inset-0 bg-stone-50 text-stone-900 z-[60] flex flex-col justify-between p-8 pt-24"
          >
            <div className="absolute top-8 right-8 md:top-12 md:right-12">
              <button onClick={() => setMenuOpen(false)} className="text-[10px] font-bold uppercase tracking-[0.3em] flex items-center space-x-4 hover:text-amber-600 transition-colors group">
                <span>Zamknij</span>
                <div className="w-12 h-px bg-current group-hover:w-8 transition-all duration-300"></div>
              </button>
            </div>

            <div className="flex flex-col items-center justify-center space-y-6 flex-1">
              {['Zespół', 'Archiwum', 'Fundacja', 'Kontakt'].map((item, i) => (
                <div key={item} className="overflow-hidden">
                  <motion.div custom={i} variants={linkVariants} initial="hidden" animate="visible" exit="hidden">
                    <a 
                      href={item === 'Kontakt' ? `#${item.toLowerCase()}` : `/${item.toLowerCase()}`}
                      onClick={() => setMenuOpen(false)}
                      className="text-6xl md:text-8xl lg:text-[8rem] leading-none font-serif font-light tracking-tighter hover:italic hover:text-amber-600 transition-all duration-300 inline-block"
                    >
                      {item}
                    </a>
                  </motion.div>
                </div>
              ))}
            </div>
            
            <div className="flex justify-center md:justify-between items-end text-[10px] font-bold uppercase tracking-[0.3em] text-stone-400">
              <div className="hidden md:flex space-x-8">
                <a href="https://facebook.com/voctensemble" target="_blank" rel="noreferrer" className="hover:text-stone-900 transition-colors">Facebook</a>
                <a href="https://instagram.com/voctensemble" target="_blank" rel="noreferrer" className="hover:text-stone-900 transition-colors">Instagram</a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. ULTRA-CLEAN SCROLLYTELLING HERO (Pinned to screen for 250vh) */}
      <div ref={scrollContainerRef} className="h-[250vh] relative bg-stone-50">
        
        <div className="sticky top-0 h-screen w-full flex items-center justify-center overflow-hidden">
          
          {/* CENTRAL: Animated Parallax Monogram (Fades out and scales up) */}
          <motion.div style={{ scale: veScale, opacity: veOpacity }} className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <div className="relative w-full h-full flex items-center justify-center">
              <motion.div animate={{ x: mousePosition.x * -50, y: mousePosition.y * -50 }} transition={{ type: "spring", stiffness: 40, damping: 20 }} className="absolute text-[45vw] leading-none font-serif tracking-tighter opacity-[0.03] text-transparent" style={{ WebkitTextStroke: '2px #1c1917' }}>VE</motion.div>
              <motion.div animate={{ x: mousePosition.x * 70, y: mousePosition.y * 70 }} transition={{ type: "spring", stiffness: 30, damping: 25 }} className="absolute text-[45vw] leading-none font-serif tracking-tighter opacity-10 text-transparent" style={{ WebkitTextStroke: '1px #000000' }}>VE</motion.div>
              <motion.div animate={{ x: mousePosition.x * 15, y: mousePosition.y * 15 }} transition={{ type: "spring", stiffness: 60, damping: 15 }} className="absolute text-[45vw] leading-none font-serif tracking-tighter text-stone-900 mix-blend-multiply">VE</motion.div>
            </div>
          </motion.div>

          {/* CENTRAL: Description Text (Fades in from the void) */}
          <motion.div style={{ opacity: textOpacity, y: textY }} className="absolute max-w-3xl text-center z-30 px-6 pointer-events-auto">
            <h2 className="text-4xl md:text-6xl font-serif font-light tracking-tight mb-8 text-stone-900">
              Szukamy perfekcji i wibrujemy <span className="italic text-amber-700">emocjami</span>.
            </h2>
            <p className="text-stone-500 font-medium text-sm md:text-base leading-loose max-w-2xl mx-auto">
              VoctEnsemble to kolektyw wybitnych głosów zjednoczonych wizją dyrektora artystycznego Florentyna de Bazelaire. 
              Od renesansowych mistrzów po współczesne aranżacje – nasza muzyka nie jest tłem. Jest doświadczeniem.
            </p>
          </motion.div>

          {/* Scroll Indicator */}
          <motion.div style={{ opacity: useTransform(scrollYProgress, [0, 0.05], [1, 0]) }} className="absolute bottom-12 text-[9px] uppercase tracking-[0.4em] font-bold text-stone-400 flex flex-col items-center gap-3">
            <span>Przewiń, aby odkryć</span>
            <div className="w-px h-8 bg-stone-300"></div>
          </motion.div>
        </div>
      </div>

      {/* 4. EDITORIAL CONCERTS SECTION */}
      <section className="py-32 md:py-48 px-6 md:px-12 lg:px-24 bg-white relative z-10 border-t border-stone-200">
        <div className="max-w-screen-2xl mx-auto">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-24 border-b border-stone-200 pb-8">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif tracking-tighter text-stone-900 mb-6 md:mb-0">Wybrane Realizacje</h2>
            <Link to="/archiwum" className="text-[10px] uppercase tracking-[0.3em] font-bold text-stone-400 hover:text-amber-700 transition-colors flex items-center gap-3">
              <span>Pełne Portfolio</span>
              <span className="text-lg leading-none">→</span>
            </Link>
          </div>

          <div className="flex flex-col">
            <div className="group border-b border-stone-200 py-12 md:py-16 hover:bg-stone-50 transition-colors cursor-pointer px-4 md:px-8 -mx-4 md:-mx-8">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-12 lg:w-2/3">
                  <span className="text-[10px] uppercase tracking-[0.3em] text-amber-700 font-bold shrink-0">22.02.2025</span>
                  <h3 className="text-5xl md:text-7xl font-serif tracking-tighter group-hover:italic transition-all duration-500 text-stone-900">Hymn Poległym</h3>
                </div>
                <div className="text-left lg:text-right lg:w-1/3">
                  <p className="text-xs uppercase tracking-widest text-stone-500 font-bold">Kraków</p>
                  <p className="text-sm text-stone-400 mt-2 font-medium">Bazylika Mariacka</p>
                </div>
              </div>
            </div>

            <div className="group border-b border-stone-200 py-12 md:py-16 hover:bg-stone-50 transition-colors cursor-pointer px-4 md:px-8 -mx-4 md:-mx-8">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-12 lg:w-2/3">
                  <span className="text-[10px] uppercase tracking-[0.3em] text-amber-700 font-bold shrink-0">18.10.2025</span>
                  <h3 className="text-5xl md:text-7xl font-serif tracking-tighter group-hover:italic transition-all duration-500 text-stone-900">Aeternam</h3>
                </div>
                <div className="text-left lg:text-right lg:w-1/3">
                  <p className="text-xs uppercase tracking-widest text-stone-500 font-bold">Niedzica</p>
                  <p className="text-sm text-stone-400 mt-2 font-medium">Epitafium dla Gazy</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 5. MASSIVE FOOTER / CONTACT SECTION */}
      <footer id="kontakt" className="bg-stone-100 py-32 md:py-40 px-6 md:px-12 lg:px-24 border-t border-stone-200">
        <div className="max-w-screen-2xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-20">
          
          <div className="lg:col-span-7">
            <h2 className="text-5xl md:text-7xl lg:text-[7rem] leading-[0.9] font-serif tracking-tighter text-stone-900 mb-12">
              Stwórzmy to <br/><span className="italic text-amber-700">razem.</span>
            </h2>
            <a href="mailto:kontakt@voctensemble.pl" className="text-xl md:text-3xl font-serif text-stone-500 hover:text-stone-900 transition-colors border-b border-stone-300 hover:border-stone-900 pb-2">
              kontakt@voctensemble.pl
            </a>
          </div>

          <div className="lg:col-span-5 flex flex-col justify-end space-y-16">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-stone-400 mb-6">Wsparcie Fundacji</p>
              <p className="text-base font-medium text-stone-600 mb-6 max-w-md leading-relaxed">
                Niezależność artystyczna wymaga mecenatu. Wesprzyj nasze projekty darowizną na cele statutowe.
              </p>
              <div className="border border-stone-300 p-6 bg-white rounded-2xl shadow-sm max-w-md transition-shadow hover:shadow-md">
                <p className="text-[9px] uppercase tracking-[0.3em] text-stone-400 mb-3 font-bold">Konto Bankowe</p>
                <p className="text-base font-mono text-stone-800 tracking-widest">PL 00 0000 0000 0000 0000 0000</p>
              </div>
              <Link to="/fundacja" className="inline-flex items-center gap-3 mt-6 text-[10px] uppercase tracking-[0.3em] font-bold text-amber-700 hover:text-amber-600 transition-colors group">
                <span>Więcej o Fundacji</span>
                <span className="transform group-hover:translate-x-1 transition-transform">→</span>
              </Link>
            </div>
          </div>
        </div>

        {/* LOGOS & LEGAL */}
        <div className="max-w-screen-2xl mx-auto border-t border-stone-300 pt-16 mt-32 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-12">
          
          <div className="flex flex-wrap gap-8 opacity-50 grayscale hover:grayscale-0 transition-all duration-700">
            <div className="w-32 h-16 border border-stone-400 border-dashed rounded-xl flex items-center justify-center"><span className="text-[7px] uppercase tracking-widest text-stone-500 text-center">Fundacja Logo</span></div>
            <div className="w-20 h-16 border border-stone-400 border-dashed rounded-xl flex items-center justify-center"><span className="text-[7px] uppercase tracking-widest text-stone-500 text-center">Miasto</span></div>
          </div>
          
          {/* THE DEVELOPER CREDIT */}
          <div className="text-left lg:text-right text-[10px] uppercase tracking-[0.3em] font-bold text-stone-400 leading-loose">
            <p>© {new Date().getFullYear()} VoctEnsemble</p>
            <p>Designed & Developed by <span className="text-stone-500 hover:text-amber-700 transition-colors">Krystian Bugalski</span></p>
          </div>
          
        </div>
      </footer>
        
    </div>
  );
}