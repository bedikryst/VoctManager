/**
 * @file OverlayMenu.tsx
 * @description The Cinematic Curtain (Global Navigation Overlay).
 * Features deep dark mode, staggered typographic reveals, an editorial
 * serif-to-sans hover effect, and contextual background image reveals.
 * Refactored to Enterprise 2026 Standards: Centralized Kinematics, Body Scroll Lock.
 * @module shared/widgets/layout/OverlayMenu
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cva } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";
import { Heading, Text, Eyebrow, Caption } from "@/shared/ui/primitives/typography";
import { MAIN_PUBLIC_LINKS } from "@/shared/config/navigation/public.config";
import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import {
  MENU_PANEL_VARIANTS,
  STAGGERED_REVEAL_VARIANTS,
  FADE_UP_VARIANTS,
} from "@/shared/ui/kinematics/motion-presets";

// --- Types & Interfaces ---
interface OverlayMenuProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

// --- Ethereal UI Variants (CVA) ---
const linkTextVariants = cva(
  "group flex items-center text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-medium tracking-tight transition-all duration-500 origin-left outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold",
  {
    variants: {
      status: {
        active: "text-ethereal-marble hover:text-white",
        muted: "text-ethereal-graphite",
      },
    },
    defaultVariants: {
      status: "active",
    },
  },
);

export const OverlayMenu = ({
  isOpen,
  setIsOpen,
}: OverlayMenuProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Declarative lock ensures scroll integrity beneath the curtain
  useBodyScrollLock(isOpen);

  const handleLinkClick = (): void => {
    setIsOpen(false);
  };

  // --- Render ---
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={MENU_PANEL_VARIANTS}
          initial="closed"
          animate="open"
          exit="closed"
          data-lenis-prevent="true"
          className="fixed inset-0 z-[999] bg-ethereal-ink text-ethereal-marble flex flex-col justify-between overflow-hidden overscroll-none touch-none"
          aria-modal="true"
          role="dialog"
          aria-label={t("nav.overlay.aria.mainMenu", "Główne Menu Nawigacji")}
        >
          {/* Background Layers: Contextual Image Reveal & Grid Overlay */}
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-ethereal-ink">
            {MAIN_PUBLIC_LINKS.map((link, i) => (
              <div
                key={`bg-${i}`}
                className={cn(
                  "absolute inset-0 transition-all duration-1000 ease-[0.16,1,0.3,1]",
                  hoveredIndex === i
                    ? "opacity-20 scale-100"
                    : "opacity-0 scale-110",
                )}
                aria-hidden="true"
              >
                <img
                  src={link.image}
                  alt=""
                  className="w-full h-full object-cover grayscale mix-blend-luminosity"
                  loading="lazy"
                />
              </div>
            ))}
          </div>

          <div
            className="absolute inset-0 pointer-events-none flex justify-center z-0 opacity-20 mix-blend-screen"
            aria-hidden="true"
          >
            <div className="w-full max-w-7xl h-full relative">
              <div className="absolute top-0 bottom-0 left-[41.666667%] w-[1px] bg-ethereal-incense/20" />
              <div className="absolute top-0 bottom-0 left-[58.333333%] w-[1px] bg-ethereal-incense/20" />
            </div>
          </div>

          {/* Top Row: Navigation Header */}
          <motion.div
            variants={FADE_UP_VARIANTS}
            custom={0.4}
            className="w-full flex justify-center border-b border-ethereal-incense/20 py-6 px-6 relative z-10"
          >
            <div className="w-full max-w-7xl flex justify-between items-center">
              <Link
                to="/"
                onClick={handleLinkClick}
                className="outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold"
                aria-label={t("common.aria.backToHome", "Wróć do strony głównej")}
              >
                <Heading as="span" size="xl" color="gold" weight="medium">
                  Voct<Text as="span" weight="light" color="inherit">Ensemble</Text>
                </Heading>
              </Link>

              <button
                onClick={() => setIsOpen(false)}
                className="group flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-bold text-ethereal-graphite hover:text-ethereal-marble transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold p-1"
                aria-label={t("nav.overlay.actions.close", "Zamknij menu")}
              >
                <span className="overflow-hidden relative pb-1">
                  {t("nav.overlay.actions.close", "Zamknij")}
                  <span className="absolute bottom-0 left-0 w-full h-px bg-ethereal-marble origin-right scale-x-0 transition-transform duration-500 group-hover:scale-x-100" />
                </span>
                <span
                  className="text-lg font-normal leading-none mb-[2px] group-hover:rotate-90 transition-transform duration-500"
                  aria-hidden="true"
                >
                  ×
                </span>
              </button>
            </div>
          </motion.div>

          {/* Center Matrix: Menu Body & Links */}
          <div className="flex-grow flex items-center justify-center w-full px-6 py-12 relative z-10">
            <div className="w-full max-w-7xl flex flex-col md:flex-row justify-between items-start md:items-center">
              {/* Secondary Navigation (Desktop Only) */}
              <div className="hidden md:flex flex-col gap-12 w-4/12">
                <motion.div variants={FADE_UP_VARIANTS} custom={0.6}>
                  <Eyebrow color="gold" className="tracking-[0.3em] mb-6">
                    {t("nav.overlay.sections.community", "Społeczność")}
                  </Eyebrow>
                  <ul className="flex flex-col gap-4 text-[10px] uppercase tracking-[0.2em] font-medium text-ethereal-graphite">
                    {["Instagram", "Facebook", "YouTube"].map((social) => (
                      <li key={social}>
                        <a
                          href={`https://${social.toLowerCase()}.com/${social === "YouTube" ? "@voctensemble-nb7gh" : "voctensemble"}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-ethereal-marble transition-colors outline-none focus-visible:text-ethereal-marble"
                        >
                          {social}
                        </a>
                      </li>
                    ))}
                  </ul>
                </motion.div>
                <motion.div variants={FADE_UP_VARIANTS} custom={0.7}>
                  <Eyebrow color="gold" className="tracking-[0.3em] mb-6">
                    {t("nav.overlay.sections.contact", "Biurom / Kontakt")}
                  </Eyebrow>
                  <a
                    href="mailto:kontakt@voctensemble.pl"
                    className="text-[10px] uppercase tracking-[0.2em] font-medium text-ethereal-graphite hover:text-ethereal-marble transition-colors outline-none focus-visible:text-ethereal-marble"
                  >
                    kontakt@voctensemble.pl
                  </a>
                </motion.div>
              </div>

              {/* Primary Navigation Links */}
              <nav
                className="w-full md:w-8/12 flex flex-col gap-4 md:gap-6 mt-12 md:mt-0"
                onMouseLeave={() => setHoveredIndex(null)}
                aria-label={t(
                  "nav.overlay.aria.primaryLinks",
                  "Primary Navigation",
                )}
              >
                {MAIN_PUBLIC_LINKS.map((link, i) => {
                  const isMuted = hoveredIndex !== null && hoveredIndex !== i;
                  return (
                    <div
                      key={link.path}
                      className="overflow-hidden pb-2"
                      onMouseEnter={() => setHoveredIndex(i)}
                    >
                      <motion.div
                        custom={i}
                        variants={STAGGERED_REVEAL_VARIANTS}
                      >
                        <Link
                          to={link.path}
                          onClick={handleLinkClick}
                          className={cn(
                            linkTextVariants({
                              status: isMuted ? "muted" : "active",
                            }),
                          )}
                        >
                          <Text as="span" color="gold" weight="bold" size="sm" className="mr-6 md:mr-10 mb-6 md:mb-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" aria-hidden="true">
                            0{i + 1}
                          </Text>
                          <Text as="span" size="huge" color="inherit" className="group-hover:translate-x-4 group-hover:italic transition-all duration-500 font-sans group-hover:font-serif">
                            {t(link.labelKey)}
                          </Text>
                        </Link>
                      </motion.div>
                    </div>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Bottom Row: System Footer */}
          <motion.div
            variants={FADE_UP_VARIANTS}
            custom={0.9}
            className="w-full flex justify-center border-t border-ethereal-incense/20 py-6 px-6 relative z-10 backdrop-blur-sm"
          >
            <div className="w-full max-w-7xl flex flex-col sm:flex-row justify-between items-center">
              <Caption color="muted" weight="medium" className="uppercase tracking-[0.2em]">
                {t(
                  "nav.overlay.status.location",
                  "Kraków, PL — Fundacja VoctEnsemble",
                )}
              </Caption>

              <div className="mt-4 sm:mt-0 flex items-center gap-3">
                <div className="relative flex h-2 w-2" aria-hidden="true">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ethereal-sage opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-ethereal-sage" />
                </div>
                <Caption color="graphite" weight="bold" className="uppercase tracking-[0.2em]">
                  {t("nav.overlay.status.active", "Status: Aktywna")}
                </Caption>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
