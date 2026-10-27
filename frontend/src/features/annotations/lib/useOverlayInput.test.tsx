/**
 * @file useOverlayInput.test.tsx
 * @description Who gets to write on the page, and what a finished gesture hands
 * over.
 *
 * The failures this guards drew ink nobody asked for, or lost ink somebody
 * drew: a right-click or a pen's eraser end laying down a line; the point the
 * pen lifted at cut off the end of every stroke; a palm resting on the glass
 * ending the pencil's line or panning the page under it, or owning the page so
 * the pencil could not start one; a finger re-gripping mid-pinch drawing a line;
 * and a line half-drawn when the tool or the page changed hanging on as a ghost,
 * or landing on the next page.
 * @module features/annotations/lib/useOverlayInput.test
 */

import type React from "react";
import { isValidElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { HttpResponse, http } from "msw";

import { renderHookWithPanel } from "@/test/harness";
import { server } from "@/test/server";
import { ANNOTATIONS_PATH } from "@/shared/offline/swProtocol";

import {
  useOverlayInput,
  type OverlayInput,
  type OverlayInputOptions,
} from "./useOverlayInput";
import type { AnnotationTool } from "./useAnnotationTools";
import { useScoreAnnotator } from "../useScoreAnnotator";

// The annotator's toolbar reaches the viewer's module, which loads pdf.js, and
// pdf.js needs a DOMMatrix that jsdom does not have. Nothing here renders a page.
vi.mock("react-pdf", () => ({
  Document: () => null,
  Page: () => null,
  pdfjs: { GlobalWorkerOptions: {} },
}));

interface PointerInit {
  id?: number;
  type?: "mouse" | "pen" | "touch";
  button?: number;
  /**
   * The browser's own count: false for a touch that lands while another touch
   * is down anywhere on the screen.
   */
  primary?: boolean;
  x: number;
  y: number;
}

/** The fields the router reads, on the element React would hand it. */
const pointer = (
  target: HTMLElement,
  { id = 1, type = "pen", button = 0, primary = true, x, y }: PointerInit,
): React.PointerEvent<HTMLElement> =>
  ({
    pointerId: id,
    pointerType: type,
    button,
    isPrimary: primary,
    clientX: x,
    clientY: y,
    currentTarget: target,
    target,
  }) as unknown as React.PointerEvent<HTMLElement>;

/**
 * A 100 × 100 page at the origin, so client pixels read as hundredths, inside
 * the viewer's scroll box. jsdom lays nothing out and captures no pointers, so
 * both are stood in for; the scroll box records every pan it is asked for.
 */
const arrangePage = () => {
  const viewport = document.createElement("div");
  viewport.setAttribute("data-pdf-viewport", "");
  const surface = document.createElement("div");
  viewport.appendChild(surface);

  const box = { left: 0, top: 0, width: 100, height: 100 } as DOMRect;
  surface.getBoundingClientRect = () => box;
  viewport.getBoundingClientRect = () => box;

  const captured = new Set<number>();
  surface.setPointerCapture = (id) => void captured.add(id);
  surface.hasPointerCapture = (id) => captured.has(id);
  surface.releasePointerCapture = (id) => void captured.delete(id);

  const pans = vi.fn<(axis: "x" | "y") => void>();
  Object.defineProperty(viewport, "scrollTop", {
    get: () => 0,
    set: () => pans("y"),
  });
  Object.defineProperty(viewport, "scrollLeft", {
    get: () => 0,
    set: () => pans("x"),
  });

  return { surface, captured, pans };
};

interface Hand {
  tool: AnnotationTool;
  fingerDraw: boolean;
}

const mount = (initial: Partial<Hand> = {}) => {
  const page = arrangePage();
  const surfaceRef = { current: page.surface };
  const onStroke = vi.fn<OverlayInputOptions["onStroke"]>();
  const onTap = vi.fn<OverlayInputOptions["onTap"]>();
  const onTurnPage = vi.fn<OverlayInputOptions["onTurnPage"]>();
  const view = renderHook(
    ({ tool, fingerDraw }: Hand) =>
      useOverlayInput({
        surfaceRef,
        tool,
        canEdit: true,
        fingerDraw,
        onStroke,
        onTap,
        onTurnPage,
      }),
    { initialProps: { tool: "pen", fingerDraw: false, ...initial } },
  );
  const handlers = () => view.result.current.surfaceHandlers;
  const send = (
    kind: keyof OverlayInput["surfaceHandlers"],
    init: PointerInit,
  ): void => handlers()[kind](pointer(page.surface, init));
  return { ...view, ...page, onStroke, onTap, send };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("only the primary button writes", () => {
  it("lays down no ink for a right-click or a pen's eraser end", () => {
    const { result, send, onStroke } = mount();

    act(() => send("onPointerDown", { type: "mouse", button: 2, x: 10, y: 10 }));
    act(() => send("onPointerUp", { type: "mouse", button: 2, x: 60, y: 60 }));
    act(() => send("onPointerDown", { type: "pen", button: 5, x: 10, y: 10 }));
    act(() => send("onPointerUp", { type: "pen", button: 5, x: 60, y: 60 }));

    expect(result.current.stroke).toBeNull();
    expect(onStroke).not.toHaveBeenCalled();

    act(() => send("onPointerDown", { x: 10, y: 10 }));
    expect(result.current.stroke).toEqual([[0.1, 0.1]]);
  });

  it("places nothing on a right-click", () => {
    const { send, onTap } = mount({ tool: "stamp" });

    act(() => send("onPointerDown", { type: "mouse", button: 2, x: 50, y: 50 }));
    act(() => send("onPointerUp", { type: "mouse", button: 2, x: 50, y: 50 }));
    expect(onTap).not.toHaveBeenCalled();

    act(() => send("onPointerDown", { type: "mouse", x: 50, y: 50 }));
    act(() => send("onPointerUp", { type: "mouse", x: 50, y: 50 }));
    expect(onTap).toHaveBeenCalledWith([0.5, 0.5]);
  });
});

describe("a finished stroke", () => {
  it("keeps every point, the one it lifted at included", () => {
    const { send, onStroke } = mount();

    act(() => send("onPointerDown", { x: 10, y: 10 }));
    // Two moves between renders: a handler reading the list from its render
    // would keep only the second.
    act(() => {
      send("onPointerMove", { x: 30, y: 30 });
      send("onPointerMove", { x: 50, y: 50 });
    });
    act(() => send("onPointerUp", { x: 70, y: 70 }));

    expect(onStroke).toHaveBeenCalledWith([
      [0.1, 0.1],
      [0.3, 0.3],
      [0.5, 0.5],
      [0.7, 0.7],
    ]);
  });

  it("hands over a shape as its two corners, the second where the pen lifted", () => {
    const { send, onStroke } = mount({ tool: "shape" });

    act(() => send("onPointerDown", { x: 10, y: 10 }));
    act(() => send("onPointerMove", { x: 40, y: 40 }));
    act(() => send("onPointerUp", { x: 60, y: 80 }));

    expect(onStroke).toHaveBeenCalledWith([
      [0.1, 0.1],
      [0.6, 0.8],
    ]);
  });
});

describe("palm rejection", () => {
  it("lets a hand resting on the glass neither end the pencil's line nor pan the page", () => {
    const { send, onStroke, pans } = mount();

    act(() => send("onPointerDown", { id: 1, x: 10, y: 10 }));
    act(() => send("onPointerDown", { id: 2, type: "touch", x: 50, y: 50 }));
    act(() => send("onPointerMove", { id: 2, type: "touch", x: 80, y: 80 }));
    act(() => send("onPointerMove", { id: 1, x: 30, y: 30 }));
    // iPadOS cancels the palm's touch once it has seen the pencil.
    act(() => send("onPointerCancel", { id: 2, type: "touch", x: 80, y: 80 }));
    act(() => send("onPointerUp", { id: 1, x: 40, y: 40 }));

    expect(pans).not.toHaveBeenCalled();
    expect(onStroke).toHaveBeenCalledWith([
      [0.1, 0.1],
      [0.3, 0.3],
      [0.4, 0.4],
    ]);
  });

  it("stops a palm that landed first from panning once the pencil writes", () => {
    const { send, pans } = mount();

    act(() => send("onPointerDown", { id: 2, type: "touch", x: 50, y: 50 }));
    act(() => send("onPointerMove", { id: 2, type: "touch", x: 60, y: 60 }));
    const pannedBeforeThePen = pans.mock.calls.length;
    expect(pannedBeforeThePen).toBeGreaterThan(0);

    act(() => send("onPointerDown", { id: 1, x: 10, y: 10 }));
    act(() => send("onPointerMove", { id: 2, type: "touch", x: 70, y: 70 }));

    expect(pans).toHaveBeenCalledTimes(pannedBeforeThePen);
  });

  it("still hands a finger's line to the pinch when a second finger lands", () => {
    const { result, send, onStroke } = mount({ fingerDraw: true });

    act(() => send("onPointerDown", { id: 1, type: "touch", x: 10, y: 10 }));
    act(() => send("onPointerMove", { id: 1, type: "touch", x: 30, y: 30 }));
    act(() => send("onPointerDown", { id: 2, type: "touch", primary: false, x: 60, y: 60 }));
    act(() => send("onPointerUp", { id: 1, type: "touch", x: 40, y: 40 }));

    expect(result.current.stroke).toBeNull();
    expect(onStroke).not.toHaveBeenCalled();
  });

  it("lets the pen take the page from a palm that landed first, with finger drawing on", () => {
    const { result, send, onStroke } = mount({ fingerDraw: true });

    act(() => send("onPointerDown", { id: 2, type: "touch", x: 50, y: 50 }));
    act(() => send("onPointerMove", { id: 2, type: "touch", x: 60, y: 60 }));
    act(() => send("onPointerDown", { id: 1, x: 10, y: 10 }));
    act(() => send("onPointerMove", { id: 2, type: "touch", x: 70, y: 70 }));
    act(() => send("onPointerMove", { id: 1, x: 30, y: 30 }));
    act(() => send("onPointerUp", { id: 2, type: "touch", x: 70, y: 70 }));
    expect(result.current.stroke).toEqual([
      [0.1, 0.1],
      [0.3, 0.3],
    ]);
    act(() => send("onPointerUp", { id: 1, x: 40, y: 40 }));

    expect(onStroke).toHaveBeenCalledExactlyOnceWith([
      [0.1, 0.1],
      [0.3, 0.3],
      [0.4, 0.4],
    ]);
  });
});

describe("a pinch", () => {
  it("draws nothing for a third finger, or for a finger that re-grips while one is down", () => {
    const { result, send, onStroke } = mount({ fingerDraw: true });

    act(() => send("onPointerDown", { id: 1, type: "touch", x: 10, y: 10 }));
    act(() => send("onPointerDown", { id: 2, type: "touch", primary: false, x: 60, y: 60 }));
    // A third finger joins the pinch.
    act(() => send("onPointerDown", { id: 3, type: "touch", primary: false, x: 30, y: 70 }));
    act(() => send("onPointerMove", { id: 3, type: "touch", x: 40, y: 80 }));
    act(() => send("onPointerUp", { id: 3, type: "touch", x: 40, y: 80 }));
    // The first finger lifts and lands again while the second is still down.
    act(() => send("onPointerUp", { id: 1, type: "touch", x: 10, y: 10 }));
    act(() => send("onPointerDown", { id: 4, type: "touch", primary: false, x: 20, y: 20 }));
    act(() => send("onPointerMove", { id: 4, type: "touch", x: 50, y: 50 }));
    expect(result.current.stroke).toBeNull();
    act(() => send("onPointerUp", { id: 4, type: "touch", x: 50, y: 50 }));
    act(() => send("onPointerUp", { id: 2, type: "touch", x: 60, y: 60 }));

    expect(onStroke).not.toHaveBeenCalled();

    // Every finger is up: the next one writes again.
    act(() => send("onPointerDown", { id: 5, type: "touch", x: 10, y: 10 }));
    act(() => send("onPointerUp", { id: 5, type: "touch", x: 30, y: 30 }));
    expect(onStroke).toHaveBeenCalledExactlyOnceWith([
      [0.1, 0.1],
      [0.3, 0.3],
    ]);
  });

  it("forgets a finger whose lift it never saw once a first touch lands again", () => {
    const { send, onStroke } = mount({ fingerDraw: true });

    act(() => send("onPointerDown", { id: 1, type: "touch", x: 10, y: 10 }));
    act(() => send("onPointerDown", { id: 2, type: "touch", primary: false, x: 60, y: 60 }));
    act(() => send("onPointerUp", { id: 1, type: "touch", x: 10, y: 10 }));
    // Finger 2 was never captured; it slid off the page and lifted there.
    act(() => send("onPointerDown", { id: 3, type: "touch", x: 20, y: 20 }));
    act(() => send("onPointerUp", { id: 3, type: "touch", x: 40, y: 40 }));

    expect(onStroke).toHaveBeenCalledExactlyOnceWith([
      [0.2, 0.2],
      [0.4, 0.4],
    ]);
  });
});

describe("a change of tool or page", () => {
  it("drops a line in progress when the pen is put down for another tool", () => {
    const { result, rerender, send, onStroke, captured } = mount();

    act(() => send("onPointerDown", { x: 10, y: 10 }));
    act(() => send("onPointerMove", { x: 30, y: 30 }));
    rerender({ tool: "eraser", fingerDraw: false });

    expect(result.current.stroke).toBeNull();
    expect(captured.size).toBe(0);

    act(() => send("onPointerUp", { x: 40, y: 40 }));
    expect(onStroke).not.toHaveBeenCalled();
  });

  it("gives every page a drawing surface of its own", () => {
    server.use(http.get(`*${ANNOTATIONS_PATH}`, () => HttpResponse.json([])));
    const { result } = renderHookWithPanel(() =>
      useScoreAnnotator({ editionId: "edition-1", mode: "conductor", active: false }),
    );
    const surfaceKey = (pageNumber: number) => {
      const node = result.current.renderPageOverlay({
        pageNumber,
        width: 600,
        height: 800,
        scale: 1,
      });
      return isValidElement(node) ? node.key : null;
    };

    // The same page keeps its surface across renders; a turned page gets a
    // fresh one, so nothing half-drawn rides along onto it.
    expect(surfaceKey(3)).not.toBeNull();
    expect(surfaceKey(3)).toBe(surfaceKey(3));
    expect(surfaceKey(4)).not.toBe(surfaceKey(3));
  });
});
