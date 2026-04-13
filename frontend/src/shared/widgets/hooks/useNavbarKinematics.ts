/**
 * @file useNavbarKinematics.ts
 * @description Encapsulates viewport tracking and strictly typed scroll-based kinematics
 * for the global navigation. Adheres to Enterprise 2026 Standards.
 * @module shared/widgets/hooks/useNavbarKinematics
 */

import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useScroll, useMotionValueEvent } from "framer-motion";

export type NavState = "bare" | "top" | "pill";

export interface NavbarKinematics {
  navState: NavState;
  isDarkBg: boolean;
  isMobile: boolean;
  vh: number;
  isHome: boolean;
  isHidden: boolean;
}

export const useNavbarKinematics = (): NavbarKinematics => {
  const location = useLocation();
  const isHome = location.pathname === "/";
  // The navigation is fully concealed within the protected administration panel
  const isHidden = location.pathname.startsWith("/panel");

  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  );
  const [vh, setVh] = useState<number>(
    typeof window !== "undefined" ? window.innerHeight : 0,
  );

  const [navState, setNavState] = useState<NavState>(isHome ? "bare" : "top");
  const [isDarkBg, setIsDarkBg] = useState<boolean>(false);

  // Debounced viewport observer (Memory Safe)
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handleResize = (): void => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsMobile(window.innerWidth < 768);
        setVh(window.innerHeight);
      }, 200);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  // Framer Motion strictly decoupled scroll tracker
  const { scrollY } = useScroll();

  const handleScrollChange = useCallback(
    (latest: number) => {
      if (isHome) {
        const darkStart = isMobile ? vh * 2.5 : vh * 4.5;
        const darkEnd = isMobile ? vh * 4.5 : vh * 6.5;

        setIsDarkBg(latest >= darkStart && latest < darkEnd);
        setNavState(latest < darkEnd ? "bare" : "pill");
      } else {
        setIsDarkBg(false);
        setNavState(latest < 100 ? "top" : "pill");
      }
    },
    [isHome, isMobile, vh],
  );

  useMotionValueEvent(scrollY, "change", handleScrollChange);

  return { navState, isDarkBg, isMobile, vh, isHome, isHidden };
};
