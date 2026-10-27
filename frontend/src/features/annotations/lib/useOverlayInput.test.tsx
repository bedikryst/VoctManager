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
 * or landing on the next page. And the cost of a line: a render of the page per
 * sample, and a pen's folded samples thrown away.
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
import type { NormPoint } from "../types/annotations.dto";

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
  /** What is held down during a move: 1 the writing end, 32 a pen's eraser end. */
  buttons?: number;
  /**
   * The browser's own count: false for a touch that lands while another touch
   * is down anywhere on the screen.
   */
  primary?: boolean;
  x: number;
  y: number;
  /** The samples the browser folded into this move, the event's own last. */
  folded?: ReadonlyArray<{ x: number; y: number }>;
}

/** The fields the router reads, on the element React would hand it. */
const pointer = (
  target: HTMLElement,
  { id = 1, type = "pen", button = 0, buttons = 1, primary = true, x, y, folded }: PointerInit,
): React.PointerEvent<HTMLElement> =>
  ({
    pointerId: id,
    pointerType: type,
    button,
    buttons,
    isPrimary: primary,
    clientX: x,
    clientY: y,
    currentTarget: target,
    target,
    nativeEvent: folded
      ? {
          getCoalescedEvents: () =>
            folded.map((sample) => ({ clientX: sample.x, clientY: sample.y })),
        }
      : undefined,
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
  const onPreview = vi.fn<OverlayInputOptions["onPreview"]>();
  const onTap = vi.fn<OverlayInputOptions["onTap"]>();
  const onErase = vi.fn<OverlayInputOptions["onErase"]>();
  const onTurnPage = vi.fn<OverlayInputOptions["onTurnPage"]>();
  let renders = 0;
  const view = renderHook(
    ({ tool, fingerDraw }: Hand) => {
      renders += 1;
      return useOverlayInput({
        surfaceRef,
        tool,
        canEdit: true,
        fingerDraw,
        onStroke,
        onPreview,
        onTap,
        onErase,
        onTurnPage,
      });
    },
    { initialProps: { tool: "pen", fingerDraw: false, ...initial } },
  );
  const handlers = () => view.result.current.surfaceHandlers;
  const send = (
    kind: keyof OverlayInput["surfaceHandlers"],
    init: PointerInit,
  ): void => handlers()[kind](pointer(page.surface, init));
  /** The line in progress as the page would draw it now; null between lines. */
  const live = (): readonly NormPoint[] | null => onPreview.mock.lastCall?.[0] ?? null;
  return { ...view, ...page, onStroke, onTap, onErase, send, live, renders: () => renders };
};

/** What a trace that travelled reports beside its points. */
const MOVED = { tapped: false };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("only the primary button writes", () => {
  it("lays down no ink for a right-click or a pen's eraser end", () => {
    const { live, send, onStroke } = mount();

    act(() => send("onPointerDown", { type: "mouse", button: 2, x: 10, y: 10 }));
    act(() => send("onPointerUp", { type: "mouse", button: 2, x: 60, y: 60 }));
    act(() => send("onPointerDown", { type: "pen", button: 5, x: 10, y: 10 }));
    act(() => send("onPointerUp", { type: "pen", button: 5, x: 60, y: 60 }));

    expect(live()).toBeNull();
    expect(onStroke).not.toHaveBeenCalled();

    act(() => send("onPointerDown", { x: 10, y: 10 }));
    expect(live()).toEqual([[0.1, 0.1]]);
  });

  it("rubs out with a pen's eraser end for as long as it is pressed, whatever tool is armed", () => {
    const { send, onErase, onTap, onStroke } = mount({ tool: "stamp" });

    act(() => send("onPointerDown", { type: "pen", button: 5, buttons: 32, x: 10, y: 10 }));
    act(() => send("onPointerMove", { type: "pen", button: -1, buttons: 32, x: 20, y: 10 }));
    // Lifted to a hover: the pen still reports where it is.
    act(() => send("onPointerMove", { type: "pen", button: -1, buttons: 0, x: 30, y: 10 }));
    act(() => send("onPointerMove", { type: "pen", button: -1, buttons: 0, x: 40, y: 10 }));
    act(() => send("onPointerUp", { type: "pen", button: 5, buttons: 0, x: 40, y: 10 }));

    expect(onErase.mock.calls).toEqual([
      [[0.1, 0.1], { first: true }],
      [[0.2, 0.1], { first: false }],
    ]);
    expect(onTap).not.toHaveBeenCalled();
    expect(onStroke).not.toHaveBeenCalled();
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
    ], MOVED);
  });

  it("draws a line in progress without rendering the page", () => {
    const { send, live, renders } = mount();

    act(() => send("onPointerDown", { x: 10, y: 10 }));
    const before = renders();
    act(() => {
      send("onPointerMove", { x: 30, y: 30 });
      send("onPointerMove", { x: 50, y: 50 });
    });

    expect(renders()).toBe(before);
    expect(live()).toEqual([
      [0.1, 0.1],
      [0.3, 0.3],
      [0.5, 0.5],
    ]);
  });

  it("keeps the samples a pen's move folded together", () => {
    const { send, onStroke } = mount();

    act(() => send("onPointerDown", { x: 10, y: 10 }));
    act(() =>
      send("onPointerMove", {
        x: 40,
        y: 40,
        folded: [
          { x: 20, y: 20 },
          { x: 30, y: 30 },
          { x: 40, y: 40 },
        ],
      }),
    );
    act(() => send("onPointerUp", { x: 40, y: 40 }));

    expect(onStroke).toHaveBeenCalledWith(
      [
        [0.1, 0.1],
        [0.2, 0.2],
        [0.3, 0.3],
        [0.4, 0.4],
      ],
      MOVED,
    );
  });

  it("measures the step between points on the screen", () => {
    const { send, onStroke } = mount();

    act(() => send("onPointerDown", { x: 10, y: 10 }));
    // One screen pixel is jitter; the lift is still where the line ends.
    act(() => send("onPointerMove", { x: 11, y: 10 }));
    act(() => send("onPointerMove", { x: 30, y: 10 }));
    act(() => send("onPointerUp", { x: 31, y: 10 }));

    expect(onStroke).toHaveBeenCalledWith(
      [
        [0.1, 0.1],
        [0.3, 0.1],
        [0.31, 0.1],
      ],
      MOVED,
    );
  });

  it("hands over a shape as its two corners, the second where the pen lifted", () => {
    const { send, onStroke } = mount({ tool: "shape" });

    act(() => send("onPointerDown", { x: 10, y: 10 }));
    act(() => send("onPointerMove", { x: 40, y: 40 }));
    act(() => send("onPointerUp", { x: 60, y: 80 }));

    expect(onStroke).toHaveBeenCalledWith([
      [0.1, 0.1],
      [0.6, 0.8],
    ], MOVED);
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
    ], MOVED);
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
    const { live, send, onStroke } = mount({ fingerDraw: true });

    act(() => send("onPointerDown", { id: 1, type: "touch", x: 10, y: 10 }));
    act(() => send("onPointerMove", { id: 1, type: "touch", x: 30, y: 30 }));
    act(() => send("onPointerDown", { id: 2, type: "touch", primary: false, x: 60, y: 60 }));
    act(() => send("onPointerUp", { id: 1, type: "touch", x: 40, y: 40 }));

    expect(live()).toBeNull();
    expect(onStroke).not.toHaveBeenCalled();
  });

  it("lets the pen take the page from a palm that landed first, with finger drawing on", () => {
    const { live, send, onStroke } = mount({ fingerDraw: true });

    act(() => send("onPointerDown", { id: 2, type: "touch", x: 50, y: 50 }));
    act(() => send("onPointerMove", { id: 2, type: "touch", x: 60, y: 60 }));
    act(() => send("onPointerDown", { id: 1, x: 10, y: 10 }));
    act(() => send("onPointerMove", { id: 2, type: "touch", x: 70, y: 70 }));
    act(() => send("onPointerMove", { id: 1, x: 30, y: 30 }));
    act(() => send("onPointerUp", { id: 2, type: "touch", x: 70, y: 70 }));
    expect(live()).toEqual([
      [0.1, 0.1],
      [0.3, 0.3],
    ]);
    act(() => send("onPointerUp", { id: 1, x: 40, y: 40 }));

    expect(onStroke).toHaveBeenCalledExactlyOnceWith([
      [0.1, 0.1],
      [0.3, 0.3],
      [0.4, 0.4],
    ], MOVED);
  });
});

describe("a pinch", () => {
  it("draws nothing for a third finger, or for a finger that re-grips while one is down", () => {
    const { live, send, onStroke } = mount({ fingerDraw: true });

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
    expect(live()).toBeNull();
    act(() => send("onPointerUp", { id: 4, type: "touch", x: 50, y: 50 }));
    act(() => send("onPointerUp", { id: 2, type: "touch", x: 60, y: 60 }));

    expect(onStroke).not.toHaveBeenCalled();

    // Every finger is up: the next one writes again.
    act(() => send("onPointerDown", { id: 5, type: "touch", x: 10, y: 10 }));
    act(() => send("onPointerUp", { id: 5, type: "touch", x: 30, y: 30 }));
    expect(onStroke).toHaveBeenCalledExactlyOnceWith([
      [0.1, 0.1],
      [0.3, 0.3],
    ], MOVED);
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
    ], MOVED);
  });
});

describe("the selection's loop", () => {
  it("is traced like ink, and says when the pointer never left its tap", () => {
    const { send, onStroke } = mount({ tool: "select" });

    act(() => send("onPointerDown", { x: 20, y: 20 }));
    act(() => send("onPointerMove", { x: 25, y: 22 }));
    act(() => send("onPointerUp", { x: 24, y: 21 }));
    expect(onStroke).toHaveBeenLastCalledWith(expect.any(Array), { tapped: true });

    act(() => send("onPointerDown", { x: 20, y: 20 }));
    act(() => send("onPointerMove", { x: 60, y: 20 }));
    act(() => send("onPointerMove", { x: 60, y: 60 }));
    act(() => send("onPointerUp", { x: 20, y: 60 }));
    expect(onStroke).toHaveBeenLastCalledWith(
      [
        [0.2, 0.2],
        [0.6, 0.2],
        [0.6, 0.6],
        [0.2, 0.6],
      ],
      MOVED,
    );
  });

  it("leaves the finger to pan on a stylus device", () => {
    const { send, onStroke, pans } = mount({ tool: "select" });

    act(() => send("onPointerDown", { id: 2, type: "touch", x: 50, y: 50 }));
    act(() => send("onPointerMove", { id: 2, type: "touch", x: 70, y: 70 }));
    act(() => send("onPointerUp", { id: 2, type: "touch", x: 70, y: 70 }));

    expect(pans).toHaveBeenCalled();
    expect(onStroke).not.toHaveBeenCalled();
  });
});

describe("a change of tool or page", () => {
  it("drops a line in progress when the pen is put down for another tool", () => {
    const { live, rerender, send, onStroke, captured } = mount();

    act(() => send("onPointerDown", { x: 10, y: 10 }));
    act(() => send("onPointerMove", { x: 30, y: 30 }));
    rerender({ tool: "eraser", fingerDraw: false });

    expect(live()).toBeNull();
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
