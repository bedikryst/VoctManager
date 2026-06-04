import { useCallback, useRef, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

// Hover-intent timing — deliberately long. The collapsed rail is already fully
// usable: tooltips appear instantly (delayDuration ~10ms) and every icon is
// clickable in place. Expansion is an opt-in "browse" peek, not the nav path —
// and since the expanded panel overlays content (fixed, no reflow) rather than
// pushing it, a short delay would balloon the rail over the page on every
// routine click-to-navigate. 1700ms sits above a natural aiming pause, so the
// panel only opens on sustained, intentional hover.
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

    expandTimerRef.current = setTimeout(() => {
      if (isHoveredRef.current) {
        setIsExpanded(true);
        syncLayoutVariable(true);
      }
    }, HOVER_ENTER_DELAY_MS);
  }, [clearCollapseTimer, syncLayoutVariable]);

  const handleMouseLeave = useCallback(() => {
    isHoveredRef.current = false;
    clearExpandTimer();

    collapseTimerRef.current = setTimeout(() => {
      if (!isHoveredRef.current) {
        setIsExpanded(false);
        syncLayoutVariable(false);
      }
    }, HOVER_LEAVE_DELAY_MS);
  }, [clearExpandTimer, syncLayoutVariable]);

  // Collapse immediately on route change to prevent a stale expanded rail.
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
