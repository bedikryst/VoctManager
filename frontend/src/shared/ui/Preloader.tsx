/**
 * @file Preloader.tsx
 * @description Advanced abstract geometric preloader.
 * Orchestrates an immersive sequence with a glowing aura, expanding
 * resonance waves, and a staggered editorial typography reveal.
 * @module ui/Preloader
 */

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "../../app/store/useAppStore";

export default function Preloader(): React.JSX.Element {
  // Expected to return a boolean indicating readiness
  const isLoaded = useAppStore((state: any) => state.isLoaded);
  const setIsLoaded = useAppStore((state: any) => state.setIsLoaded);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 3200);
    return () => clearTimeout(timer);
  }, [setIsLoaded]);

  return (
    <AnimatePresence>
      {!isLoaded && (
        <motion.div
          exit={{
            opacity: 0,
            filter: "blur(12px)",
            transition: { duration: 1.2, ease: "easeInOut" },
          }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#fdfbf7] pointer-events-none overflow-hidden"
        >
          {/* Layer 1: Ambient Glow */}
          <motion.div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              background:
                "radial-gradient(circle at 70% 30%, #fbd38d, transparent 50%), radial-gradient(circle at 30% 70%, #90cdf4, transparent 50%)",
            }}
            animate={{ backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"] }}
            transition={{ duration: 20, ease: "linear", repeat: Infinity }}
          />

          {/* Layer 2: Resonance Waves */}
          <motion.div
            className="absolute rounded-full border border-[#002395]/20"
            style={{ width: "80px", height: "80px" }}
            initial={{ scale: 0.1, opacity: 0 }}
            animate={{
              scale: [0.1, 3, 6],
              opacity: [0, 0.8, 0],
              borderWidth: ["1px", "1px", "0px"],
            }}
            transition={{ duration: 4, ease: "easeOut", times: [0, 0.4, 1] }}
          />
          <motion.div
            className="absolute rounded-full border border-[#002395]/10"
            style={{ width: "120px", height: "120px" }}
            initial={{ scale: 0.1, opacity: 0 }}
            animate={{
              scale: [0.1, 2.5, 5],
              opacity: [0, 0.5, 0],
              borderWidth: ["1px", "1px", "0px"],
            }}
            transition={{
              duration: 4,
              ease: "easeOut",
              delay: 0.4,
              times: [0, 0.4, 1],
            }}
          />

          {/* Layer 3: Choreographed Typography */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <motion.div
              initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
              animate={{
                opacity: [0, 0.8, 0],
                y: [10, 0, -10],
                filter: ["blur(4px)", "blur(0px)", "blur(4px)"],
              }}
              transition={{
                duration: 1.8,
                delay: 0.2,
                ease: "easeInOut",
                times: [0, 0.5, 1],
              }}
              className="absolute top-[20%] left-[10%] md:left-[15%] text-stone-400 italic text-lg md:text-2xl tracking-wider"
              style={{ fontFamily: "'Cormorant', serif" }}
            >
              séquence
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
              animate={{
                opacity: [0, 0.8, 0],
                y: [10, 0, -10],
                filter: ["blur(4px)", "blur(0px)", "blur(4px)"],
              }}
              transition={{
                duration: 1.8,
                delay: 1.2,
                ease: "easeInOut",
                times: [0, 0.5, 1],
              }}
              className="absolute bottom-[25%] right-[10%] md:right-[20%] text-stone-400 italic text-lg md:text-2xl tracking-wider"
              style={{ fontFamily: "'Cormorant', serif" }}
            >
              respiration
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
              animate={{
                opacity: [0, 0.8, 0],
                y: [10, 0, -10],
                filter: ["blur(4px)", "blur(0px)", "blur(4px)"],
              }}
              transition={{
                duration: 1.8,
                delay: 2.2,
                ease: "easeInOut",
                times: [0, 0.5, 1],
              }}
              className="absolute top-[55%] left-[20%] md:left-[30%] text-stone-500 italic text-xl md:text-3xl tracking-widest"
              style={{ fontFamily: "'Cormorant', serif" }}
            >
              résonance
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
