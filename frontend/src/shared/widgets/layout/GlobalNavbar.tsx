/**
 * @file GlobalNavbar.tsx
 * @description Global, scroll-responsive navigation bar with kinematic states.
 * Implements "Immersive Mode" (bare) on the Home page, guarantees a clean start.
 * Refactored to Strict TS 7.0, i18next integration, and Ethereal UI compliance.
 * Decoupled logic resides in useNavbarKinematics.
 * @module shared/widgets/layout/GlobalNavbar
 */

import React from "react";
import { Link } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/app/store/useAppStore";
import { cn } from "@/shared/lib/utils";
import { useNavbarKinematics } from "@/shared/lib/hooks/useNavbarKinematics";
import { BASE_TRANSITION, EASE } from "@/shared/ui/kinematics/motion-presets";

// --- Types & Interfaces ---
interface GlobalNavbarProps {
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
}

// Assuming minimal AppStore interface to strictly avoid `any`
interface AppStoreState {
  isLoaded: boolean;
}

// Extension of the base transition specific to navbar breathing time
const NAV_TRANSITION = { ...BASE_TRANSITION, duration: 1.2 };

export const GlobalNavbar = ({
  menuOpen,
  setMenuOpen,
}: GlobalNavbarProps): React.JSX.Element | null => {
  const { t } = useTranslation();

  // Strict typing for Zustand store selector
  const isLoaded = useAppStore(
    (state: unknown) => (state as AppStoreState).isLoaded,
  );

  // Injection of the Kinematic Hook (SRP adherence)
  const { navState, isDarkBg, isMobile, isHome, isHidden } =
    useNavbarKinematics();

  // Render halt for protected zones
  if (isHidden) {
    return null;
  }

  // --- Dynamic Variants Configuration ---
  const navContainerVariants: Variants = {
    bare: {
      width: "100%",
      maxWidth: "100%",
      marginTop: "0px",
      paddingLeft: isMobile ? "24px" : "48px",
      paddingRight: isMobile ? "24px" : "48px",
      paddingTop: "32px",
      paddingBottom: "32px",
      borderRadius: "0px",
      backgroundColor: "rgba(255, 255, 255, 0)",
      borderColor: "rgba(255, 255, 255, 0)",
      boxShadow: "0px 0px 0px rgba(0,0,0,0)",
      transition: NAV_TRANSITION,
    },
    top: {
      width: "100%",
      maxWidth: "100%",
      marginTop: "0px",
      paddingLeft: isMobile ? "24px" : "48px",
      paddingRight: isMobile ? "24px" : "48px",
      paddingTop: "32px",
      paddingBottom: "32px",
      borderRadius: "0px",
      backgroundColor: "rgba(255, 255, 255, 0)",
      borderColor: "rgba(255, 255, 255, 0)",
      boxShadow: "0px 0px 0px rgba(0,0,0,0)",
      transition: NAV_TRANSITION,
    },
    pill: {
      width: "92%",
      maxWidth: "896px",
      marginTop: "24px",
      paddingLeft: "24px",
      paddingRight: "24px",
      paddingTop: "14px",
      paddingBottom: "14px",
      borderRadius: "16px",
      backgroundColor: "rgba(255, 255, 255, 0.7)",
      borderColor: "rgba(255, 255, 255, 0.5)",
      boxShadow: "0px 12px 40px rgba(0,0,0,0.06)",
      transition: NAV_TRANSITION,
    },
  };

  const logoVariants: Variants = {
    bare: {
      opacity: 0,
      y: -15,
      filter: "blur(4px)",
      pointerEvents: "none",
      transition: { duration: 0.6, ease: EASE.buttery },
    },
    top: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      pointerEvents: "auto",
      transition: NAV_TRANSITION,
    },
    pill: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      pointerEvents: "auto",
      transition: NAV_TRANSITION,
    },
  };

  const donateVariants: Variants = {
    bare: {
      opacity: 0,
      x: 20,
      width: 0,
      marginLeft: "0px",
      filter: "blur(4px)",
      pointerEvents: "none",
      transition: { duration: 0.8, ease: EASE.buttery },
    },
    top: {
      opacity: 1,
      x: 0,
      width: isMobile ? 40 : 105,
      marginLeft: isMobile ? "12px" : "20px",
      filter: "blur(0px)",
      pointerEvents: "auto",
      transition: NAV_TRANSITION,
    },
    pill: {
      opacity: 1,
      x: 0,
      width: isMobile ? 40 : 105,
      marginLeft: isMobile ? "12px" : "20px",
      filter: "blur(0px)",
      pointerEvents: "auto",
      transition: NAV_TRANSITION,
    },
  };

  const isBare = navState === "bare";
  const isPill = navState === "pill";
  const lineBgClass = isBare && isDarkBg ? "bg-white" : "bg-stone-900";

  return (
    <div
      className={cn(
        "fixed top-0 left-0 w-full z-[105] flex justify-center pointer-events-none transition-opacity duration-[1.8s] ease-[0.16,1,0.3,1]",
        !isLoaded || menuOpen ? "opacity-0" : "opacity-100",
      )}
    >
      <motion.nav
        variants={navContainerVariants}
        initial={isHome ? "bare" : "top"}
        animate={navState}
        className={cn(
          "pointer-events-auto flex items-center justify-between border shadow-none transition-all duration-700",
          isPill ? "backdrop-blur-[24px]" : "backdrop-blur-none",
        )}
      >
        {/* Navigation Toggle */}
        <motion.div className="flex-1 flex justify-start items-center">
          <button
            onClick={() => setMenuOpen(true)}
            className="group flex flex-col space-y-1.5 p-3 pl-0 hover:opacity-50 active:scale-95 transition-all duration-500 outline-none"
            aria-label={t("nav.aria.openMenu", "Open Navigation Menu")}
            aria-expanded={menuOpen}
          >
            <span
              className={cn(
                "h-px ease-out transition-all duration-[0.6s]",
                lineBgClass,
                isBare
                  ? "w-9 group-hover:w-6"
                  : isPill
                    ? "w-7 group-hover:w-4"
                    : "w-9 group-hover:w-6",
              )}
            />
            <span
              className={cn(
                "h-px ease-out transition-all duration-[0.6s]",
                lineBgClass,
                isBare
                  ? "w-7 group-hover:w-8"
                  : isPill
                    ? "w-5 group-hover:w-6"
                    : "w-7 group-hover:w-8",
              )}
            />
          </button>
        </motion.div>

        {/* Brand Logotype */}
        <motion.div
          variants={logoVariants}
          className="flex-1 flex justify-center origin-center mr-5 md:mr-0 text-stone-900"
        >
          <Link
            to="/"
            style={{
              fontSize: isMobile
                ? isPill
                  ? "0.875rem"
                  : "1rem"
                : isPill
                  ? "1rem"
                  : "1.5rem",
              fontFamily: "'Cormorant', serif",
            }}
            className="flex items-center italic tracking-widest font-medium transition-all duration-1000 outline-none"
            aria-label={t("common.aria.backToHome", "Back to home")}
          >
            <span>V</span>
            <span
              className={cn(
                "overflow-hidden flex items-center whitespace-nowrap transition-all duration-1000",
                isMobile && isPill
                  ? "max-w-0 opacity-0"
                  : "max-w-[100px] opacity-100",
              )}
            >
              oct
            </span>
            <span>E</span>
            <span
              className={cn(
                "overflow-hidden flex items-center whitespace-nowrap transition-all duration-1000",
                isMobile && isPill
                  ? "max-w-0 opacity-0"
                  : "max-w-[100px] opacity-100",
              )}
            >
              nsemble
            </span>
          </Link>
        </motion.div>

        {/* Quick Actions */}
        <motion.div className="flex-1 flex justify-end items-center">
          <Link
            to="/panel"
            className="group active:scale-90 transition-colors duration-500 flex items-center outline-none"
            aria-label={t("nav.aria.accessPanel", "Access Client Panel")}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
              className={cn(
                "flex-shrink-0 transition-all duration-[1.2s] w-5 h-5 md:w-6 md:h-6",
                isBare
                  ? isDarkBg
                    ? "text-white opacity-80 group-hover:opacity-100"
                    : "text-stone-900 opacity-80 group-hover:opacity-100"
                  : "text-stone-500 hover:text-stone-900",
              )}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          </Link>

          <motion.div
            variants={donateVariants}
            className="overflow-hidden flex flex-shrink-0"
          >
            <Link
              to="/wesprzyj"
              className="group active:scale-95 transition-transform flex w-full outline-none"
              aria-label={t("nav.actions.donate", "Support Us")}
            >
              <div
                className={cn(
                  "relative flex items-center justify-center w-full border h-9 md:h-10 rounded-lg md:rounded-xl overflow-hidden transition-all duration-[1.2s]",
                  isPill
                    ? "bg-stone-900 text-stone-100 border-transparent hover:bg-amber-700 hover:shadow-lg hover:-translate-y-0.5"
                    : "bg-transparent border-stone-900/30 text-stone-900 hover:bg-stone-900 hover:text-stone-100 hover:border-transparent",
                )}
              >
                {!isMobile && (
                  <span className="text-[10px] uppercase font-bold tracking-[0.2em] whitespace-nowrap transition-colors duration-300">
                    {t("nav.actions.donate", "Wesprzyj")}
                  </span>
                )}
                {isMobile && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                    className="w-4 h-4 flex-shrink-0 absolute transition-opacity duration-300"
                  >
                    <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                  </svg>
                )}
              </div>
            </Link>
          </motion.div>
        </motion.div>
      </motion.nav>
    </div>
  );
};
