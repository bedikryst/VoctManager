/**
 * @file useSidebarKinematics.ts
 * @description Master kinetic controller for the Ethereal Sidebar.
 * Achieves 120fps by directly mutating CSS variables mapped to the GPU,
 * bypassing React's reconciliation cycle for macro-layout shifts.
 * @module shared/ui/kinematics/hooks/useSidebarKinematics
 */

import { useCallback, useRef, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

// Standard architectural constants extracted from magic numbers
const KINEMATIC_CONSTANTS = {
  HOVER_DELAY_MS: 180,
  COMPACT_WIDTH_PX: 88,
  EXPANDED_WIDTH_PX: 280,
} as const;

export const useSidebarKinematics = () => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const location = useLocation();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoveredRef = useRef<boolean>(false);

  /**
   * Mutates the root CSS variable directly to prevent React tree re-renders.
   * This ensures the main DashboardLayout content shifts at 120fps via CSS transitions.
   */
  const syncLayoutVariable = useCallback((expanded: boolean) => {
    const width = expanded
      ? KINEMATIC_CONSTANTS.EXPANDED_WIDTH_PX
      : KINEMATIC_CONSTANTS.COMPACT_WIDTH_PX;

    document.documentElement.style.setProperty("--sidebar-width", `${width}px`);
  }, []);

  const clearKinematicTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    isHoveredRef.current = true;
    clearKinematicTimeout();
    setIsExpanded(true);
    syncLayoutVariable(true);
  }, [clearKinematicTimeout, syncLayoutVariable]);

  const handleMouseLeave = useCallback(() => {
    isHoveredRef.current = false;
    clearKinematicTimeout();

    timeoutRef.current = setTimeout(() => {
      if (!isHoveredRef.current) {
        setIsExpanded(false);
        syncLayoutVariable(false);
      }
    }, KINEMATIC_CONSTANTS.HOVER_DELAY_MS);
  }, [clearKinematicTimeout, syncLayoutVariable]);

  // Synchronize route changes to immediately collapse the sidebar
  // Prevents the "stuck" UI pattern when navigating swiftly
  useEffect(() => {
    if (!isHoveredRef.current && isExpanded) {
      clearKinematicTimeout();
      setIsExpanded(false);
      syncLayoutVariable(false);
    }
  }, [
    location.pathname,
    clearKinematicTimeout,
    syncLayoutVariable,
    isExpanded,
  ]);

  // Clean up kinematic listeners on unmount
  useEffect(() => {
    return () => clearKinematicTimeout();
  }, [clearKinematicTimeout]);

  return {
    isExpanded,
    handleMouseEnter,
    handleMouseLeave,
  };
};
