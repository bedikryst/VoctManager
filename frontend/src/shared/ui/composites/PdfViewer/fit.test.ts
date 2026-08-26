/**
 * @file fit.test.ts
 * @description Pins the size of the music on the four screens the choir
 * actually reads from. The failure this prevents is not a crash — it is a page
 * that renders correctly and is simply too small to sing from, which no
 * typecheck and no glance at a desktop browser will ever catch.
 *
 * The landscape numbers are the reason the fit became a mode at all: fitting a
 * whole A4 to a screen 390px tall leaves a 311px page inside 844px of glass,
 * so a third of the width carries the music and two thirds carry nothing.
 *
 * Viewport sizes are CSS pixels of the viewer's own box (the modal is
 * full-bleed, so on an installed PWA that is the screen).
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/PdfViewer/fit.test
 */

import { describe, expect, it } from "vitest";

import { resolvePageFit, type PageFitInput } from "./fit";
import { DEFAULT_PAGE_ASPECT } from "./constants";

const fit = (input: Partial<PageFitInput> & Pick<PageFitInput, "viewportWidth" | "viewportHeight">) =>
  resolvePageFit({
    pageAspect: DEFAULT_PAGE_ASPECT,
    immersive: false,
    fitMode: "auto",
    ...input,
  });

describe("resolvePageFit — auto", () => {
  it("keeps the whole page on a tablet held upright, which is what it is for", () => {
    const { resolvedFit, renderedPageWidth } = fit({
      viewportWidth: 820,
      viewportHeight: 1180,
    });
    expect(resolvedFit).toBe("page");
    expect(renderedPageWidth).toBe(748);
  });

  it("keeps the whole page on a phone held upright — half would buy nothing", () => {
    // Width-limited already: half a page fits the same 374px, so the reader
    // would be turning twice as often for an identical stave.
    const { resolvedFit, renderedPageWidth } = fit({
      viewportWidth: 390,
      viewportHeight: 844,
    });
    expect(resolvedFit).toBe("page");
    expect(renderedPageWidth).toBe(374);
  });

  it("switches to half-page on a phone on its side, where whole-page starves", () => {
    const landscapePhone = { viewportWidth: 844, viewportHeight: 390 };
    const auto = fit(landscapePhone);
    const whole = fit({ ...landscapePhone, fitMode: "page" });

    // 320 is the minimum width, not a fit: the arithmetic wants 311, and even
    // that is 37% of an 844px screen. See the floor case below.
    expect(whole.renderedPageWidth).toBe(320);
    expect(auto.resolvedFit).toBe("half");
    expect(auto.renderedPageWidth).toBe(622); // twice the music, same glass
  });

  it("switches to half-page on a tablet on its side", () => {
    const { resolvedFit, renderedPageWidth } = fit({
      viewportWidth: 1180,
      viewportHeight: 820,
    });
    expect(resolvedFit).toBe("half");
    expect(renderedPageWidth).toBe(1080); // the desktop comfort cap, not the height
  });
});

describe("resolvePageFit — explicit modes and edges", () => {
  it("performance mode spends the insets and the comfort cap on the page", () => {
    const desk = { viewportWidth: 1400, viewportHeight: 900, fitMode: "width" as const };
    expect(fit(desk).renderedPageWidth).toBe(1080); // capped for reading comfort
    expect(fit({ ...desk, immersive: true }).renderedPageWidth).toBe(1400);
  });

  it("floors a page that cannot fit, so a short box gets an overhang, not a stamp", () => {
    // Landscape phone, whole-page fit: the height wants 311px and the floor
    // says 320, which makes the page 452px tall inside a 390px box. Deliberate
    // — a page shrunk to fit every box would eventually be unreadable — and the
    // reason `auto` never lands here in the first place.
    const { renderedPageWidth } = fit({
      viewportWidth: 844,
      viewportHeight: 390,
      fitMode: "page",
    });
    expect(renderedPageWidth).toBe(320);
  });

  it("fit-width ignores the height entirely", () => {
    const { renderedPageWidth } = fit({
      viewportWidth: 844,
      viewportHeight: 390,
      fitMode: "width",
    });
    expect(renderedPageWidth).toBe(772); // 844 less the desktop-width insets
  });

  it("honours an explicit choice over what auto would have picked", () => {
    const landscapePhone = { viewportWidth: 844, viewportHeight: 390 };
    expect(fit(landscapePhone).resolvedFit).toBe("half");
    expect(fit({ ...landscapePhone, fitMode: "page" }).resolvedFit).toBe("page");
  });

  it("never renders below the floor, however cramped the box", () => {
    const { renderedPageWidth } = fit({
      viewportWidth: 320,
      viewportHeight: 200,
      fitMode: "page",
    });
    expect(renderedPageWidth).toBe(260); // the fit wants 141
  });

  it("reports no width before the viewport has been measured", () => {
    const { renderedPageWidth, resolvedFit } = fit({
      viewportWidth: 0,
      viewportHeight: 0,
    });
    expect(renderedPageWidth).toBeUndefined();
    expect(resolvedFit).toBe("page");
  });

  it("follows a landscape page, which fits whole and needs no halving", () => {
    // A landscape scan (aspect 0.71) on a landscape screen: the whole page
    // already fills the height, so auto must not start halving music.
    const { resolvedFit } = fit({
      viewportWidth: 1180,
      viewportHeight: 820,
      pageAspect: 0.71,
    });
    expect(resolvedFit).toBe("page");
  });
});
