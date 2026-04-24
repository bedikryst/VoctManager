import { useCallback, useRef, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

// Expand delay: prevents accidental hover expansion while moving the mouse.
// The sidebar is immediately clickable in collapsed state; it only expands
// after deliberate sustained hover (intent confirmation pattern).
const HOVER_ENTER_DELAY_MS = 1700;
const HOVER_LEAVE_DELAY_MS = 380;
const COMPACT_WIDTH_PX = 88;
const EXPANDED_WIDTH_PX = 280;

export const useSidebarKinematics = () => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const location = useLocation();

  const isHoveredRef = useRef<boolean>(false);
  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncLayoutVariable = useCallback((expanded: boolean) => {
    document.documentElement.style.setProperty(
      "--sidebar-width",
      `${expanded ? EXPANDED_WIDTH_PX : COMPACT_WIDTH_PX}px`,
    );
  }, []);

  const clearExpandTimer = useCallback(() => {
    if (expandTimerRef.current) {
      clearTimeout(expandTimerRef.current);
      expandTimerRef.current = null;
    }
  }, []);

  const clearCollapseTimer = useCallback(() => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    isHoveredRef.current = true;
    clearCollapseTimer();

    // Schedule expansion only after sustained hover — icons remain clickable
    // immediately in the collapsed pill, this just delays the visual expansion
    // until the user's intent is clear (not an accidental pass-through).
    expandTimerRef.current = setTimeout(() => {
      if (isHoveredRef.current) {
        setIsExpanded(true);
        syncLayoutVariable(true);
      }
    }, HOVER_ENTER_DELAY_MS);
  }, [clearCollapseTimer, syncLayoutVariable]);

  const handleMouseLeave = useCallback(() => {
    isHoveredRef.current = false;
    clearExpandTimer(); // Cancel any pending expansion

    collapseTimerRef.current = setTimeout(() => {
      if (!isHoveredRef.current) {
        setIsExpanded(false);
        syncLayoutVariable(false);
      }
    }, HOVER_LEAVE_DELAY_MS);
  }, [clearExpandTimer, syncLayoutVariable]);

  // Collapse immediately on route change to prevent "stuck open" sidebar
  useEffect(() => {
    if (!isHoveredRef.current && isExpanded) {
      clearExpandTimer();
      clearCollapseTimer();
      setIsExpanded(false);
      syncLayoutVariable(false);
    }
  }, [
    location.pathname,
    clearExpandTimer,
    clearCollapseTimer,
    syncLayoutVariable,
    isExpanded,
  ]);

  useEffect(() => {
    return () => {
      clearExpandTimer();
      clearCollapseTimer();
    };
  }, [clearExpandTimer, clearCollapseTimer]);

  return { isExpanded, handleMouseEnter, handleMouseLeave };
};
