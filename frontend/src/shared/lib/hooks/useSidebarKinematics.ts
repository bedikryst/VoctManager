/**
 * @file useSidebarKinematics.ts
 * @description Globalised sidebar controller for VoctManager.
 * Leverages Zustand for persistence and implements hover-only collapse logic.
 * @module shared/ui/kinematics/hooks/useSidebarKinematics
 */

import { useCallback, useRef, useEffect } from "react";
import { useAppStore } from "@/app/store/useAppStore";

export const useSidebarKinematics = (hoverDelayMs: number = 180) => {
  const isExpanded = useAppStore((state) => state.isSidebarExpanded);
  const setExpanded = useAppStore((state) => state.setSidebarExpanded);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    clearCloseTimeout();
    setExpanded(true);
  }, [clearCloseTimeout, setExpanded]);

  const handleMouseLeave = useCallback(() => {
    // Standard delay to prevent flickering on accidental exits
    timeoutRef.current = setTimeout(() => {
      setExpanded(false);
    }, hoverDelayMs);
  }, [hoverDelayMs, setExpanded]);

  // Clean up on unmount (Architectural Hygiene)
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return {
    isExpanded,
    handleMouseEnter,
    handleMouseLeave,
  };
};
