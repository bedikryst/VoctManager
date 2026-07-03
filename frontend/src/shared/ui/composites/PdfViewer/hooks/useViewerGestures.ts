/**
 * @file useViewerGestures.ts
 * @description Touch-first gesture engine for the score viewer: edge-tap and
 * horizontal-swipe page turns, two-finger pinch zoom (live CSS-transform
 * preview committed as a real pdf.js re-render on release) and ctrl/⌘+wheel
 * zoom for desktop trackpads. Listens on the scroll viewport with raw DOM
 * listeners (non-passive where the browser must be pre-empted) and reads all
 * mutable state through a latest-args ref so handlers bind once per mount.
 * Anything interactive opts out via `data-pdf-gesture-exempt` (or by being a
 * native control) — in draw mode the annotation surface therefore always wins.
 * @module shared/ui/composites/PdfViewer
 * @architecture Enterprise SaaS 2026
 */

import { useEffect, useRef, type RefObject } from "react";

import {
  TAP_ZONE_FRACTION,
  TAP_MAX_MOVEMENT_PX,
  TAP_MAX_DURATION_MS,
  SWIPE_MIN_DISTANCE_PX,
  SWIPE_MAX_DURATION_MS,
  SWIPE_AXIS_RATIO,
  WHEEL_ZOOM_SENSITIVITY,
  WHEEL_COMMIT_DELAY_MS,
  PINCH_TAP_SUPPRESS_MS,
  MIN_COMMIT_SCALE_DELTA,
} from "../constants";

export type PageTurnMethod = "tap" | "swipe";

interface UseViewerGesturesArgs {
  /** Scrollable viewport that owns all gesture listeners. */
  viewportRef: RefObject<HTMLDivElement | null>;
  /** Element receiving the live pinch/wheel CSS-transform preview. */
  pinchTargetRef: RefObject<HTMLDivElement | null>;
  enabled: boolean;
  /** Horizontal drags pan the zoomed page instead of turning it. */
  swipeEnabled: boolean;
  zoom: number;
  minZoom: number;
  maxZoom: number;
  onPageDelta: (delta: 1 | -1, method: PageTurnMethod) => void;
  onCenterTap: () => void;
  /** Commit a preview zoom; focal is the anchor point in viewport coords. */
  onZoomTo: (nextZoom: number, focal: { x: number; y: number }) => void;
}

interface TapCandidate {
  id: number;
  x: number;
  y: number;
  startedAt: number;
  pointerType: string;
  exempt: boolean;
}

interface PinchSession {
  startDist: number;
  startZoom: number;
  startMidX: number;
  startMidY: number;
  lastMidX: number;
  lastMidY: number;
  scale: number;
}

interface WheelSession {
  startZoom: number;
  scale: number;
  focal: { x: number; y: number };
  timer: number;
}

const isGestureExemptTarget = (target: EventTarget | null): boolean => {
  const element = target instanceof Element ? target : null;
  if (!element) return true;
  return !!element.closest(
    "button, a, input, textarea, select, [contenteditable='true'], [data-pdf-gesture-exempt]",
  );
};

const hasActiveTextSelection = (): boolean => {
  const selection = window.getSelection();
  return !!selection && !selection.isCollapsed;
};

export const useViewerGestures = (args: UseViewerGesturesArgs): void => {
  const argsRef = useRef(args);
  argsRef.current = args;
  const { enabled } = args;

  useEffect(() => {
    if (!enabled) return;
    const viewport = argsRef.current.viewportRef.current;
    if (!viewport) return;

    let tap: TapCandidate | null = null;
    let pinch: PinchSession | null = null;
    let wheel: WheelSession | null = null;
    let suppressTapUntil = 0;

    const previewTarget = (): HTMLDivElement | null =>
      argsRef.current.pinchTargetRef.current;

    const clearPreview = (): void => {
      const element = previewTarget();
      if (!element) return;
      element.style.transform = "";
      element.style.transformOrigin = "";
      element.style.willChange = "";
    };

    // Origin in untransformed element coords — sessions always begin clean, so
    // scaling around this point keeps the gesture's focal spot in place.
    const beginPreview = (clientX: number, clientY: number): void => {
      const element = previewTarget();
      if (!element) return;
      const rect = element.getBoundingClientRect();
      element.style.transformOrigin = `${clientX - rect.left}px ${clientY - rect.top}px`;
      element.style.willChange = "transform";
    };

    const viewportFocal = (clientX: number, clientY: number): { x: number; y: number } => {
      const rect = viewport.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const clampPreviewScale = (scale: number, startZoom: number): number => {
      const { minZoom, maxZoom } = argsRef.current;
      return Math.min(maxZoom / startZoom, Math.max(minZoom / startZoom, scale));
    };

    const handlePointerDown = (event: PointerEvent): void => {
      if (tap) {
        // A second concurrent pointer means this is not a tap (nor a swipe).
        tap = null;
        return;
      }
      if (pinch) return;
      tap = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        startedAt: performance.now(),
        pointerType: event.pointerType,
        exempt: isGestureExemptTarget(event.target),
      };
    };

    const handlePointerUp = (event: PointerEvent): void => {
      const candidate = tap;
      tap = null;
      if (!candidate || candidate.id !== event.pointerId) return;
      if (performance.now() < suppressTapUntil) return;
      if (candidate.exempt) return;

      const { onPageDelta, onCenterTap, swipeEnabled } = argsRef.current;
      const elapsed = performance.now() - candidate.startedAt;
      const dx = event.clientX - candidate.x;
      const dy = event.clientY - candidate.y;

      if (Math.hypot(dx, dy) <= TAP_MAX_MOVEMENT_PX && elapsed <= TAP_MAX_DURATION_MS) {
        // Double-click is text-selection intent, not navigation.
        if (event.detail > 1) return;
        if (hasActiveTextSelection()) return;
        const rect = viewport.getBoundingClientRect();
        const relX = (event.clientX - rect.left) / Math.max(rect.width, 1);
        if (relX <= TAP_ZONE_FRACTION) onPageDelta(-1, "tap");
        else if (relX >= 1 - TAP_ZONE_FRACTION) onPageDelta(1, "tap");
        else onCenterTap();
        return;
      }

      if (
        swipeEnabled &&
        candidate.pointerType === "touch" &&
        elapsed <= SWIPE_MAX_DURATION_MS &&
        Math.abs(dx) >= SWIPE_MIN_DISTANCE_PX &&
        Math.abs(dx) >= SWIPE_AXIS_RATIO * Math.abs(dy)
      ) {
        onPageDelta(dx < 0 ? 1 : -1, "swipe");
      }
    };

    const handlePointerCancel = (): void => {
      tap = null;
    };

    const handleTouchStart = (event: TouchEvent): void => {
      if (event.touches.length !== 2) return;
      // The annotation drawing surface owns its own touches.
      if (isGestureExemptTarget(event.target)) return;
      event.preventDefault();
      tap = null;
      if (wheel) {
        window.clearTimeout(wheel.timer);
        wheel = null;
      }
      const [a, b] = [event.touches[0], event.touches[1]];
      const midX = (a.clientX + b.clientX) / 2;
      const midY = (a.clientY + b.clientY) / 2;
      clearPreview();
      beginPreview(midX, midY);
      pinch = {
        startDist: Math.max(Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY), 1),
        startZoom: argsRef.current.zoom,
        startMidX: midX,
        startMidY: midY,
        lastMidX: midX,
        lastMidY: midY,
        scale: 1,
      };
    };

    const handleTouchMove = (event: TouchEvent): void => {
      if (!pinch || event.touches.length < 2) return;
      event.preventDefault();
      const [a, b] = [event.touches[0], event.touches[1]];
      const midX = (a.clientX + b.clientX) / 2;
      const midY = (a.clientY + b.clientY) / 2;
      pinch.scale = clampPreviewScale(
        Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY) / pinch.startDist,
        pinch.startZoom,
      );
      pinch.lastMidX = midX;
      pinch.lastMidY = midY;
      const element = previewTarget();
      if (element) {
        element.style.transform = `translate(${midX - pinch.startMidX}px, ${midY - pinch.startMidY}px) scale(${pinch.scale})`;
      }
    };

    const handleTouchEnd = (event: TouchEvent): void => {
      if (!pinch || event.touches.length >= 2) return;
      const session = pinch;
      pinch = null;
      suppressTapUntil = performance.now() + PINCH_TAP_SUPPRESS_MS;

      if (Math.abs(session.scale - 1) > MIN_COMMIT_SCALE_DELTA) {
        // Commit lays the page out at the real zoom first (flushSync in the
        // owner), THEN the preview transform comes off — one paint, no snap.
        argsRef.current.onZoomTo(
          session.startZoom * session.scale,
          viewportFocal(session.lastMidX, session.lastMidY),
        );
        clearPreview();
      } else {
        // Two-finger pan: fold the preview translation into real scroll.
        clearPreview();
        viewport.scrollLeft -= session.lastMidX - session.startMidX;
        viewport.scrollTop -= session.lastMidY - session.startMidY;
      }
    };

    const handleWheel = (event: WheelEvent): void => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const deltaY = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      if (!wheel) {
        clearPreview();
        beginPreview(event.clientX, event.clientY);
        wheel = {
          startZoom: argsRef.current.zoom,
          scale: 1,
          focal: viewportFocal(event.clientX, event.clientY),
          timer: 0,
        };
      }
      wheel.scale = clampPreviewScale(
        wheel.scale * Math.exp(-deltaY * WHEEL_ZOOM_SENSITIVITY),
        wheel.startZoom,
      );
      const element = previewTarget();
      if (element) element.style.transform = `scale(${wheel.scale})`;
      window.clearTimeout(wheel.timer);
      wheel.timer = window.setTimeout(() => {
        if (!wheel) return;
        const session = wheel;
        wheel = null;
        if (Math.abs(session.scale - 1) > MIN_COMMIT_SCALE_DELTA) {
          argsRef.current.onZoomTo(session.startZoom * session.scale, session.focal);
        }
        clearPreview();
      }, WHEEL_COMMIT_DELAY_MS);
    };

    // Safari's proprietary gesture events would otherwise zoom the whole app.
    const preventNativeGesture = (event: Event): void => event.preventDefault();

    viewport.addEventListener("pointerdown", handlePointerDown);
    viewport.addEventListener("pointerup", handlePointerUp);
    viewport.addEventListener("pointercancel", handlePointerCancel);
    viewport.addEventListener("touchstart", handleTouchStart, { passive: false });
    viewport.addEventListener("touchmove", handleTouchMove, { passive: false });
    viewport.addEventListener("touchend", handleTouchEnd);
    viewport.addEventListener("touchcancel", handleTouchEnd);
    viewport.addEventListener("wheel", handleWheel, { passive: false });
    viewport.addEventListener("gesturestart", preventNativeGesture);

    return () => {
      viewport.removeEventListener("pointerdown", handlePointerDown);
      viewport.removeEventListener("pointerup", handlePointerUp);
      viewport.removeEventListener("pointercancel", handlePointerCancel);
      viewport.removeEventListener("touchstart", handleTouchStart);
      viewport.removeEventListener("touchmove", handleTouchMove);
      viewport.removeEventListener("touchend", handleTouchEnd);
      viewport.removeEventListener("touchcancel", handleTouchEnd);
      viewport.removeEventListener("wheel", handleWheel);
      viewport.removeEventListener("gesturestart", preventNativeGesture);
      if (wheel) window.clearTimeout(wheel.timer);
      clearPreview();
    };
  }, [enabled]);
};
