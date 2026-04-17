/**
 * @file useSidebarKinematics.ts
 * @description Globalised sidebar controller for VoctManager.
 * Leverages Zustand for persistence and implements robust hover/navigation logic.
 * Prevents race conditions and "stuck" states during heavy DOM repaints or transitions.
 * @module shared/ui/kinematics/hooks/useSidebarKinematics
 */

import { useCallback, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAppStore } from "@/app/store/useAppStore";

export const useSidebarKinematics = (hoverDelayMs: number = 180) => {
  const isExpanded = useAppStore((state) => state.isSidebarExpanded);
  const setExpanded = useAppStore((state) => state.setSidebarExpanded);
  const location = useLocation();

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Synchronous ref to track true physical pointer presence, bypassing React batching delays.
  const isHoveredRef = useRef<boolean>(false);

  const clearCloseTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    isHoveredRef.current = true;
    clearCloseTimeout();
    setExpanded(true);
  }, [clearCloseTimeout, setExpanded]);

  const handleMouseLeave = useCallback(() => {
    isHoveredRef.current = false;
    clearCloseTimeout();
    timeoutRef.current = setTimeout(() => {
      // Double check before execution to prevent execution if mouse re-entered
      if (!isHoveredRef.current) {
        setExpanded(false);
      }
    }, hoverDelayMs);
  }, [hoverDelayMs, setExpanded, clearCloseTimeout]);

  // 1. Navigation Sync: Immediate kinetic feedback on route change
  // Eliminates the "stuck on expanded" bug when clicking a link and swiping away quickly.
  useEffect(() => {
    if (!isHoveredRef.current) {
      clearCloseTimeout();
      setExpanded(false);
    }
  }, [location.pathname, clearCloseTimeout, setExpanded]);

  // 2. Architectural Hygiene: Clean up on unmount to prevent global state leaks
  // Solves the race condition where unmounting clears the timeout but leaves the store strictly `true`.
  useEffect(() => {
    return () => {
      clearCloseTimeout();
      if (!isHoveredRef.current) {
        setExpanded(false);
      }
    };
  }, [clearCloseTimeout, setExpanded]);

  return {
    isExpanded,
    handleMouseEnter,
    handleMouseLeave,
  };
};
