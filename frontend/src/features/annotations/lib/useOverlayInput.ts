/**
 * @file useOverlayInput.ts
 * @description Input routing for the drawing surface over one page: which
 * pointer draws, which pans, which taps, and what a lifted pointer leaves
 * behind. The overlay renders; this decides.
 *
 * Routing follows `fingerDraw`. On a stylus device the finger PANS the score
 * (a manual scroll of the viewer viewport, because the surface owns every touch
 * while a tracing tool is armed) and only pen or mouse draw. On a device with no
 * stylus the finger draws, because reserving it for panning would leave the
 * reader unable to write at all. Two fingers are never a stroke: a second
 * pointer abandons the line in progress and hands the gesture to the viewer's
 * pinch zoom, and no finger starts anything while another is still down — the
 * re-grip after a pinch and a third finger belong to the pinch. A pen stroke is
 * the exception to that rule — while one is live, a touch is the hand resting on
 * the glass, so it neither pans, nor draws, nor ends the line — and a pen that
 * lands on a touch's line takes the page from it: that touch was the palm,
 * which got there first. The selection's loop is traced, and routed, exactly
 * like ink. The selection's frame keeps its presses from the surface, so it
 * counts its touches here (`handleTouches`): a pinch begun with one finger on
 * it is still a pinch, and the frame lets go of the marks (`onSecondTouch`).
 *
 * Only the primary button writes or places. A right-click is nothing, and a
 * pen's eraser end is not ink: pressed to the page it erases what it passes
 * (`onErase`) for as long as it is held, whatever tool is armed — the way the
 * other end of a pencil works. A surface that lets touches through (browse, the
 * eraser itself) never sees it.
 *
 * Points accumulate in a ref, so a move handler never reads a list a render
 * ago, and the point the pointer lifted at is part of the line.
 * A line in progress is never React state: every sample goes to `onPreview`,
 * which draws it outside the render, and the page re-renders once, when the
 * finished line becomes a mark.
 *
 * A point is kept once the pointer has travelled `MIN_STEP_PX` on the SCREEN
 * since the last one, so a line holds the same density across zoom levels and
 * along both axes of a page that is taller than it is wide. A pen reports far
 * more often than the screen paints, and the browser folds the extra samples
 * into one event; they are unfolded here (`getCoalescedEvents`), or a quick
 * curve comes out as a polygon.
 *
 * While a link waits for where it leads (`seekingTarget`), the page under it is
 * often the wrong one. A finger's tap in an edge zone and its swipe then turn
 * the page, as they do in the viewer, which never sees them on this surface;
 * the middle of the paper takes the target. A target is a page and a height,
 * so any spot across the middle will do. A mouse or a pen places anywhere: it
 * aims at the sign itself, and the bar, the keys or a finger turn the page.
 *
 * Changing tool abandons whatever the old tool had started; changing page is
 * the caller's remount (`useScoreAnnotator`'s `renderPageOverlay` keys the
 * surface by page), so nothing drawn on one page lands on the next.
 * @module features/annotations/lib
 */

import type React from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";

import {
  resolveSwipeTurn,
  resolveTapZone,
  type TapZone,
} from "@/shared/ui/composites/PdfViewer";

import type { NormPoint } from "../types/annotations.dto";
import { pageFraction } from "./markBounds";
import { DRAWING_TOOLS, type AnnotationTool } from "./useAnnotationTools";

/** Marks the wrappers around placed marks, so the surface below never treats a
 *  press on an existing mark as a request to place a new one. */
export const MARK_ATTR = "data-annotation-mark";

/**
 * Marks the cards beside a mark (its actions, a note's composer, a
 * selection's), so the stand's tool keys leave alone a card that holds focus:
 * a letter typed after tapping one of its buttons would put the tool down, and
 * the composer or the selection with it.
 */
export const CARD_ATTR = "data-annotation-card";

/** Pointer drift beyond this many px stops being a tap and becomes a drag/pan. */
const MOUSE_SLOP_PX = 6;
/**
 * A finger is not a mouse. A tap on a tablet wanders ten-odd pixels before it
 * lifts, and reading that wander as a drag is what made tapping a note nudge it
 * instead of opening it — the single biggest reason the text tool felt stiff.
 */
const TOUCH_SLOP_PX = 14;

export const slopFor = (pointerType: string): number =>
  pointerType === "mouse" ? MOUSE_SLOP_PX : TOUCH_SLOP_PX;

/** Moves shorter than this, in screen pixels, are jitter, kept out of payloads. */
const MIN_STEP_PX = 2;

/** A pen's eraser end, as `button` reports it pressing and `buttons` holding it. */
const PEN_ERASER_BUTTON = 5;
const PEN_ERASER_BUTTONS = 32;

/** What the armed tool makes of a press on blank paper. */
export interface SurfaceModes {
  /** Pen, highlighter or shape: a drag lays down ink. */
  drawing: boolean;
  /** The drag is a shape: only where it began and where it is now count. */
  shaping: boolean;
  /** A drag draws a loop round marks to select them; a tap picks one. */
  selecting: boolean;
  placing: boolean;
  stamping: boolean;
  /** A tap sets one end of a jump link: where it sits, then where it leads. */
  linking: boolean;
  erasing: boolean;
  browsing: boolean;
}

export const surfaceModes = (
  tool: AnnotationTool,
  canEdit: boolean,
): SurfaceModes => ({
  drawing: canEdit && DRAWING_TOOLS.has(tool),
  shaping: canEdit && tool === "shape",
  selecting: canEdit && tool === "select",
  placing: canEdit && tool === "note",
  stamping: canEdit && tool === "stamp",
  linking: canEdit && tool === "link",
  erasing: canEdit && tool === "eraser",
  browsing: tool === "pointer",
});

/** How a finished trace was made, beyond its points. */
export interface TraceGesture {
  /** The pointer never left the tap slop: a tap, whatever the points say. */
  tapped: boolean;
}

export interface OverlayInputOptions {
  /** The surface covering the page; its box is the 0..1 frame of every point. */
  surfaceRef: React.RefObject<HTMLElement | null>;
  tool: AnnotationTool;
  canEdit: boolean;
  /** True → a bare finger draws; false → the finger pans and only a stylus draws. */
  fingerDraw: boolean;
  /**
   * A link's first end is placed and the next tap says where it leads: a
   * finger's edge taps and swipes turn the page instead of placing.
   */
  seekingTarget: boolean;
  /**
   * A finished drag with a tracing tool: every point as drawn, the lift
   * included. A shape hands over two points, its corners. A single point is a
   * press that never moved, and the caller decides whether that is a mark.
   */
  onStroke: (points: NormPoint[], gesture: TraceGesture) => void;
  /**
   * The line in progress, on every sample that changed it, and null once it
   * ends or is abandoned. The list is this hook's own and keeps growing: read
   * it, never keep it.
   */
  onPreview: (points: readonly NormPoint[] | null) => void;
  /** A tap on blank paper while a note, a stamp or a link is armed. */
  onTap: (point: NormPoint) => void;
  /**
   * Where a pen's eraser end is on the page while pressed: once where it
   * lands (`first`), then on every move until it lifts.
   */
  onErase: (point: NormPoint, rub: { first: boolean }) => void;
  /**
   * A finger that pressed and lifted in a page-turn edge zone without
   * travelling, while a pen tool held the surface — or, while a link seeks its
   * target, an edge tap or a swipe. The surface is gesture-exempt, so the
   * viewer never sees those touches; without this a reader with the pencil in
   * hand would be stranded on one page.
   */
  onTurnPage: (delta: 1 | -1) => void;
  /**
   * A touch landed on the page while another was already down, on the surface
   * or on a handle counted through `handleTouches`: a pinch is starting, and
   * whatever a finger was carrying is let go.
   */
  onSecondTouch: () => void;
}

type SurfacePointerHandler = (event: React.PointerEvent<HTMLElement>) => void;

/**
 * Touches on a handle that keeps its presses from the surface (the selection's
 * frame), counted with the surface's own, so a pinch begun on the handle is
 * seen as one by both.
 */
export interface HandleTouches {
  /** A press on the handle. True when another touch was already down. */
  down: (event: React.PointerEvent<Element>) => boolean;
  /** A lift or a cancel on the handle. */
  up: (pointerId: number) => void;
}

export interface OverlayInput {
  surfaceHandlers: {
    onPointerDown: SurfacePointerHandler;
    onPointerMove: SurfacePointerHandler;
    onPointerUp: SurfacePointerHandler;
    onPointerCancel: SurfacePointerHandler;
    onPointerLeave: SurfacePointerHandler;
  };
  handleTouches: HandleTouches;
}

interface LiveStroke {
  pointerId: number;
  pointerType: string;
  points: NormPoint[];
  /** Where the pointer is captured, so an abandoned line can let it go. */
  element: Element;
  startX: number;
  startY: number;
  /** Screen position of the last point kept. */
  lastX: number;
  lastY: number;
  /** Still within the tap slop of where it landed. */
  tapped: boolean;
}

/** Finger-pan session while a pen tool is armed (stylus-first routing). */
interface Pan {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  viewport: HTMLElement;
}

/** Tap candidate for note/stamp placement, settled on pointer-up. */
interface Tap {
  pointerId: number;
  pointerType: string;
  x: number;
  y: number;
  startedAt: number;
  slop: number;
  moved: boolean;
}

interface Sample {
  clientX: number;
  clientY: number;
}

/**
 * Which way a tap at `clientX` on the surface turns, in the viewer's own
 * geometry. The surface covers the page, so its box is the paper.
 */
const edgeZoneAt = (clientX: number, surface: Element): TapZone => {
  const viewport = surface.closest<HTMLElement>("[data-pdf-viewport]");
  if (!viewport) return 0;
  return resolveTapZone(
    clientX,
    viewport.getBoundingClientRect(),
    surface.getBoundingClientRect(),
  );
};

/** Every position a move reports: a pen's folded samples, or the event alone. */
const samplesOf = (event: React.PointerEvent<HTMLElement>): readonly Sample[] => {
  if (event.pointerType !== "pen") return [event];
  const native: PointerEvent | undefined = event.nativeEvent;
  const folded =
    typeof native?.getCoalescedEvents === "function" ? native.getCoalescedEvents() : [];
  return folded.length > 0 ? folded : [event];
};

export const useOverlayInput = ({
  surfaceRef,
  tool,
  canEdit,
  fingerDraw,
  seekingTarget,
  onStroke,
  onPreview,
  onTap,
  onErase,
  onTurnPage,
  onSecondTouch,
}: OverlayInputOptions): OverlayInput => {
  const { drawing, shaping, selecting, placing, stamping, linking } = surfaceModes(
    tool,
    canEdit,
  );
  const tapping = placing || stamping || linking;
  const tracing = drawing || selecting;
  const turnsFromTaps = linking && seekingTarget;
  const strokeRef = useRef<LiveStroke | null>(null);
  const panRef = useRef<Pan | null>(null);
  const tapRef = useRef<Tap | null>(null);
  /** The pen whose eraser end is pressed to the page, by pointer id. */
  const rubRef = useRef<number | null>(null);
  /** Touches down on this surface, by pointer id. */
  const touchesRef = useRef(new Set<number>());

  // Read at the moment a gesture ends, never as a reason to rebuild the
  // handlers: the overlay hands in fresh closures on every render.
  const callbacks = useRef({ onStroke, onPreview, onTap, onErase, onTurnPage, onSecondTouch });
  callbacks.current = { onStroke, onPreview, onTap, onErase, onTurnPage, onSecondTouch };

  /**
   * Counts a press if it is a touch, and answers whether another touch was
   * already down. A primary touch is the first of its interaction anywhere on
   * the screen, so nothing counted before it can still be down: an id whose
   * lift landed elsewhere is forgotten there.
   */
  const countTouch = useCallback((event: React.PointerEvent<Element>): boolean => {
    if (event.pointerType !== "touch") return false;
    if (event.isPrimary) touchesRef.current.clear();
    const othersDown = touchesRef.current.size > 0;
    touchesRef.current.add(event.pointerId);
    return othersDown;
  }, []);

  const handleTouches = useMemo<HandleTouches>(
    () => ({
      down: countTouch,
      up: (pointerId) => {
        touchesRef.current.delete(pointerId);
      },
    }),
    [countTouch],
  );

  const toNorm = useCallback(
    (clientX: number, clientY: number): NormPoint => {
      const rect = surfaceRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return [0, 0];
      return [
        pageFraction((clientX - rect.left) / rect.width),
        pageFraction((clientY - rect.top) / rect.height),
      ];
    },
    [surfaceRef],
  );

  const abandonStroke = useCallback(() => {
    const live = strokeRef.current;
    strokeRef.current = null;
    if (!live) return;
    callbacks.current.onPreview(null);
    if (live.element.hasPointerCapture(live.pointerId)) {
      live.element.releasePointerCapture(live.pointerId);
    }
  }, []);

  // Whatever a tool started ends with it: a line left half-drawn when the pen
  // is put down for the eraser would otherwise hang on the page as a ghost that
  // no pointer-up will ever commit.
  useEffect(
    () => () => {
      panRef.current = null;
      tapRef.current = null;
      rubRef.current = null;
      abandonStroke();
    },
    [tool, abandonStroke],
  );

  const onPointerDown = useCallback<SurfacePointerHandler>(
    (event) => {
      if (
        canEdit &&
        event.pointerType === "pen" &&
        event.button === PEN_ERASER_BUTTON
      ) {
        // The pen turned over: nothing it started with the writing end goes on.
        abandonStroke();
        tapRef.current = null;
        event.currentTarget.setPointerCapture(event.pointerId);
        rubRef.current = event.pointerId;
        callbacks.current.onErase(toNorm(event.clientX, event.clientY), { first: true });
        return;
      }
      if (event.button !== 0) return;
      // Counted whatever the tool, so the count is true when a pen tool is
      // picked up mid-gesture.
      const othersDown = countTouch(event);
      if (othersDown) callbacks.current.onSecondTouch();
      if (tracing) {
        const live = strokeRef.current;
        if (live && live.pointerId !== event.pointerId) {
          if (live.pointerType === "pen" && event.pointerType === "touch") return;
          // A second pointer means a pinch is starting, not a line: drop the
          // stroke so the viewer's zoom gesture takes the page cleanly. A pen
          // goes on to start its own line.
          abandonStroke();
          if (event.pointerType !== "pen") return;
        }
        if (othersDown) {
          // Part of a gesture already under way: it neither draws nor pans, and
          // a pan that was running hands the page to the viewer's pinch.
          panRef.current = null;
          return;
        }
        if (event.pointerType === "touch" && !fingerDraw) {
          const viewport =
            surfaceRef.current?.closest<HTMLElement>("[data-pdf-viewport]");
          if (viewport) {
            event.currentTarget.setPointerCapture(event.pointerId);
            panRef.current = {
              pointerId: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
              lastX: event.clientX,
              lastY: event.clientY,
              viewport,
            };
          }
          return;
        }
        // The pen has landed: a palm that began panning a moment earlier stops
        // moving the page under the line.
        if (event.pointerType === "pen") panRef.current = null;
        event.currentTarget.setPointerCapture(event.pointerId);
        const start = toNorm(event.clientX, event.clientY);
        strokeRef.current = {
          pointerId: event.pointerId,
          pointerType: event.pointerType,
          points: [start],
          element: event.currentTarget,
          startX: event.clientX,
          startY: event.clientY,
          lastX: event.clientX,
          lastY: event.clientY,
          tapped: true,
        };
        callbacks.current.onPreview(strokeRef.current.points);
      } else if (tapping) {
        // A press that started on an existing mark belongs to that mark.
        if ((event.target as Element | null)?.closest?.(`[${MARK_ATTR}]`)) return;
        // A swipe may leave the page before it lifts, and still turns it.
        if (turnsFromTaps && event.pointerType === "touch") {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        tapRef.current = {
          pointerId: event.pointerId,
          pointerType: event.pointerType,
          x: event.clientX,
          y: event.clientY,
          startedAt: performance.now(),
          slop: slopFor(event.pointerType),
          moved: false,
        };
      }
    },
    [abandonStroke, canEdit, countTouch, fingerDraw, surfaceRef, tapping, toNorm, tracing, turnsFromTaps],
  );

  const onPointerMove = useCallback<SurfacePointerHandler>(
    (event) => {
      if (rubRef.current === event.pointerId) {
        // Held only while the eraser end is still pressed; a pen lifted to a
        // hover keeps reporting moves.
        if ((event.buttons & PEN_ERASER_BUTTONS) === 0) {
          rubRef.current = null;
          return;
        }
        callbacks.current.onErase(toNorm(event.clientX, event.clientY), { first: false });
        return;
      }
      const pan = panRef.current;
      if (pan && pan.pointerId === event.pointerId) {
        pan.viewport.scrollLeft -= event.clientX - pan.lastX;
        pan.viewport.scrollTop -= event.clientY - pan.lastY;
        pan.lastX = event.clientX;
        pan.lastY = event.clientY;
        return;
      }
      const tap = tapRef.current;
      if (tap && tap.pointerId === event.pointerId) {
        if (Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > tap.slop) {
          tap.moved = true;
        }
        return;
      }
      const live = strokeRef.current;
      if (!live || live.pointerId !== event.pointerId) return;
      const slop = slopFor(live.pointerType);
      let changed = false;
      for (const { clientX, clientY } of samplesOf(event)) {
        if (live.tapped && Math.hypot(clientX - live.startX, clientY - live.startY) > slop) {
          live.tapped = false;
        }
        if (shaping) {
          live.points = [live.points[0], toNorm(clientX, clientY)];
          changed = true;
          continue;
        }
        if (Math.hypot(clientX - live.lastX, clientY - live.lastY) < MIN_STEP_PX) continue;
        live.points.push(toNorm(clientX, clientY));
        live.lastX = clientX;
        live.lastY = clientY;
        changed = true;
      }
      if (changed) callbacks.current.onPreview(live.points);
    },
    [shaping, toNorm],
  );

  const onPointerUp = useCallback<SurfacePointerHandler>(
    (event) => {
      touchesRef.current.delete(event.pointerId);
      if (rubRef.current === event.pointerId) {
        rubRef.current = null;
        return;
      }
      const pan = panRef.current;
      if (pan && pan.pointerId === event.pointerId) {
        panRef.current = null;
        // A finger that pressed and lifted without travelling did not pan — it
        // tapped, and in the edge zones that is the score's page turn.
        const travelled = Math.hypot(
          event.clientX - pan.startX,
          event.clientY - pan.startY,
        );
        if (travelled <= TOUCH_SLOP_PX) {
          const zone = edgeZoneAt(event.clientX, event.currentTarget);
          if (zone !== 0) callbacks.current.onTurnPage(zone);
        }
        return;
      }
      const tap = tapRef.current;
      if (tap && tap.pointerId === event.pointerId) {
        tapRef.current = null;
        if (turnsFromTaps && tap.pointerType === "touch") {
          const turn = tap.moved
            ? resolveSwipeTurn(
                tap.pointerType,
                event.clientX - tap.x,
                event.clientY - tap.y,
                performance.now() - tap.startedAt,
              )
            : edgeZoneAt(event.clientX, event.currentTarget);
          if (turn !== 0) {
            callbacks.current.onTurnPage(turn);
            return;
          }
        }
        if (!tap.moved) callbacks.current.onTap(toNorm(event.clientX, event.clientY));
        return;
      }
      const live = strokeRef.current;
      if (!live || live.pointerId !== event.pointerId) return;
      const lift = toNorm(event.clientX, event.clientY);
      const last = live.points[live.points.length - 1];
      const points = shaping
        ? [live.points[0], lift]
        : lift[0] === last[0] && lift[1] === last[1]
          ? [...live.points]
          : [...live.points, lift];
      const tapped =
        live.tapped &&
        Math.hypot(event.clientX - live.startX, event.clientY - live.startY) <=
          slopFor(live.pointerType);
      abandonStroke();
      callbacks.current.onStroke(points, { tapped });
    },
    [abandonStroke, shaping, toNorm, turnsFromTaps],
  );

  // Per pointer: iPadOS cancels a resting palm's touch once it sees the pencil,
  // and that cancel must not take the pencil's line with it.
  const onPointerCancel = useCallback<SurfacePointerHandler>(
    (event) => {
      touchesRef.current.delete(event.pointerId);
      if (rubRef.current === event.pointerId) rubRef.current = null;
      if (panRef.current?.pointerId === event.pointerId) panRef.current = null;
      if (tapRef.current?.pointerId === event.pointerId) tapRef.current = null;
      if (strokeRef.current?.pointerId === event.pointerId) abandonStroke();
    },
    [abandonStroke],
  );

  // A note/stamp tap candidate that slides off the page is CANCELLED, not
  // dropped at the edge. A stroke holds pointer capture, so leave never fires
  // mid-stroke and its commit is untouched.
  const onPointerLeave = useCallback<SurfacePointerHandler>((event) => {
    if (panRef.current?.pointerId === event.pointerId) panRef.current = null;
    if (tapRef.current?.pointerId === event.pointerId) tapRef.current = null;
  }, []);

  return {
    surfaceHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onPointerLeave,
    },
    handleTouches,
  };
};
