/**
 * @file FooterSection.tsx
 * @description The Cinematic Epilogue (Awwwards Style Footer).
 * Features high-contrast dark mode, a live status indicator with local time,
 * an architectural "Back to Top" thread, and a massive interactive typographic monolith.
 * @architecture Enterprise 2026 Standards (Strict TypeScript & Framer Motion Variants)
 * @author Krystian Bugalski
 */

import React, { useRef, useEffect, useState } from "react";
import { motion, useScroll, useTransform, Variants } from "framer-motion";
import { Link } from "react-router-dom";
import ElegantHeading from "../../../shared/ui/ElegantHeading";

// --- Animation Variants ---
const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 1.2,
      delay: delay,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  }),
};

export default function FooterSection(): React.JSX.Element {
  // --- State & References ---
  const footerRef = useRef<HTMLElement>(null);
  const [currentTime, setCurrentTime] = useState<string>("");

  // Live clock initialization for the status indicator
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("pl-PL", {
          timeZone: "Europe/Warsaw",
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // --- Scroll Kinematics ---
  const { scrollYProgress } = useScroll({
    target: footerRef,
    offset: ["start end", "end end"],
  });

  const massiveTextY = useTransform(scrollYProgress, [0, 1], [100, 0]);
  const lineProgress = useTransform(scrollYProgress, [0, 0.5], [0, 1]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // --- Render ---
  return (
    <footer
      ref={footerRef}
      className="relative bg-stone-950 text-[#fdfbf7] pt-32 md:pt-48 pb-6 overflow-hidden selection:bg-[#fdfbf7] selection:text-stone-950"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-0 relative z-10">
        {/* The Final Thread (Architectural Grid Line & Return Button) */}
        <div
          className="absolute top-0 bottom-[40%] left-[58.333333%] w-[1px] hidden md:block z-0"
          aria-hidden="true"
        >
          <motion.div
            style={{ scaleY: lineProgress }}
            className="w-full h-full bg-stone-800 origin-top"
          />

          <motion.button
            onClick={scrollToTop}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 1 }}
            transition={{ delay: 0.5, duration: 1 }}
            aria-label="Scroll to top"
            className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-16 h-16 rounded-full border border-stone-800 bg-stone-950 flex items-center justify-center group hover:border-[#fdfbf7] transition-colors duration-500"
          >
            <div className="w-1 h-1 bg-stone-500 rounded-full group-hover:bg-[#fdfbf7] group-hover:-translate-y-2 transition-all duration-300" />
          </motion.button>
        </div>

        {/* Top Row: Live Status Indicator */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="flex justify-between items-center border-b border-stone-800/50 pb-8 mb-20 md:mb-32"
        >
          <motion.div
            variants={fadeUpVariants}
            custom={0.1}
            className="flex items-center gap-3"
          >
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </div>
            <p className="text-[9px] uppercase tracking-[0.3em] text-stone-400 font-bold">
              Fundacja Nieaktywna
            </p>
          </motion.div>

          <motion.div
            variants={fadeUpVariants}
            custom={0.2}
            className="text-[9px] uppercase tracking-[0.3em] text-stone-500 text-right"
          >
            <p>Kraków, PL — {currentTime} CET</p>
          </motion.div>
        </motion.div>

        {/* Block 1: Content & Navigation Layout */}
        <div className="flex flex-col md:flex-row justify-between relative z-10 mb-32 md:mb-40">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="md:w-5/12 mb-20 md:mb-0"
          >
            <motion.p
              variants={fadeUpVariants}
              custom={0.1}
              className="text-[#002395] text-[9px] md:text-[10px] font-bold uppercase tracking-[0.3em] mb-6"
            >
              VII. Mecenat
            </motion.p>

            <div className="mb-8">
              <ElegantHeading
                text="Stań się"
                className="text-5xl sm:text-6xl md:text-7xl font-medium tracking-tight leading-[0.95] block text-[#fdfbf7]"
              />
              <ElegantHeading
                text=" częścią"
                className="text-5xl sm:text-6xl md:text-7xl font-medium tracking-tight leading-[0.95] block text-[#fdfbf7]"
              />
              <ElegantHeading
                text="harmonii."
                className="text-5xl sm:text-6xl md:text-7xl font-medium tracking-tight leading-[0.95] block text-stone-500 italic"
              />
            </div>

            <motion.p
              variants={fadeUpVariants}
              custom={0.3}
              className="text-stone-400 font-light text-sm max-w-sm mb-12 leading-relaxed"
            >
              Tworzymy pomost między sztuką a odbiorcą. Wesprzyj działania
              naszej fundacji i pomóż nam przywracać muzyce jej pierwotną siłę
              dotykania serc.
            </motion.p>

            <motion.div
              variants={fadeUpVariants}
              custom={0.4}
              className="flex flex-col sm:flex-row gap-8 items-start sm:items-center"
            >
              <Link
                to="/wesprzyj"
                className="group relative inline-flex items-center justify-center px-10 py-5 bg-[#fdfbf7] text-stone-950 overflow-hidden rounded-full transition-transform active:scale-95 w-max"
              >
                <div className="absolute inset-0 w-full h-full bg-[#002395] rounded-full scale-0 group-hover:scale-100 transition-transform duration-500 ease-[0.16,1,0.3,1] origin-center" />
                <span className="relative z-10 text-[10px] uppercase tracking-[0.2em] font-bold group-hover:text-white transition-colors duration-500">
                  Wesprzyj Fundację
                </span>
              </Link>
            </motion.div>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="md:w-5/12 flex flex-col justify-between"
          >
            <div>
              <motion.p
                variants={fadeUpVariants}
                custom={0.2}
                className="text-stone-500 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.3em] mb-6"
              >
                Biuletyn Artystyczny
              </motion.p>
              <motion.form
                variants={fadeUpVariants}
                custom={0.3}
                className="relative w-full group"
              >
                <input
                  type="email"
                  placeholder="Zostaw swój email"
                  className="w-full bg-transparent border-b border-stone-800 py-4 text-sm text-[#fdfbf7] placeholder-stone-600 focus:outline-none focus:border-[#002395] transition-colors peer"
                />
                <button
                  type="submit"
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-stone-600 peer-focus:text-[#002395] group-hover:text-[#fdfbf7] transition-colors"
                >
                  <span className="text-[9px] uppercase tracking-[0.2em] font-bold">
                    Wyślij
                  </span>
                </button>
              </motion.form>
            </div>

            <motion.div
              variants={fadeUpVariants}
              custom={0.4}
              className="mt-20 md:mt-0 grid grid-cols-2 gap-8 text-[10px] uppercase tracking-[0.2em] font-bold text-stone-500"
            >
              <div className="flex flex-col gap-5">
                <span className="text-stone-700 mb-2">Fundacja</span>
                <Link
                  to="/fundacja"
                  className="hover:text-[#fdfbf7] transition-colors w-max"
                >
                  O nas
                </Link>
                <a
                  href="mailto:kontakt@voctensemble.pl"
                  className="hover:text-[#fdfbf7] transition-colors w-max"
                >
                  Kontakt
                </a>
              </div>
              <div className="flex flex-col gap-5">
                <span className="text-stone-700 mb-2">Społeczność</span>
                <a
                  href="https://instagram.com/voctensemble"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#fdfbf7] transition-colors w-max"
                >
                  Instagram
                </a>
                <a
                  href="https://facebook.com/voctensemble"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#fdfbf7] transition-colors w-max"
                >
                  Facebook
                </a>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Block 2: Interactive Typographic Monolith */}
        <div className="w-full relative flex flex-col items-center justify-end h-[20vh] md:h-[35vh]">
          <motion.div
            style={{ y: massiveTextY }}
            className="absolute bottom-[-5%] w-full flex justify-center overflow-hidden"
          >
            <h1
              className="text-[16vw] font-bold leading-none tracking-tighter text-transparent select-none transition-all duration-700 hover:text-[#fdfbf7] cursor-default"
              style={{ WebkitTextStroke: "1px rgba(253,251,247,0.15)" }}
            >
              VOCTENSEMBLE
            </h1>
          </motion.div>

          <div className="w-full flex flex-col sm:flex-row justify-between items-center text-[8px] md:text-[9px] uppercase tracking-[0.2em] text-stone-600 relative z-10 pb-2 border-t border-stone-800/50 pt-6 mt-12 bg-stone-950/80 backdrop-blur-sm">
            <p>© {new Date().getFullYear()} VoctEnsemble.</p>
            <p className="mt-2 sm:mt-0">
              Code & Design by{" "}
              <a
                href="https://github.com/bedikryst"
                target="_blank"
                rel="noreferrer"
                className="text-stone-400 hover:text-[#fdfbf7] transition-colors"
              >
                K. Bugalski
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
