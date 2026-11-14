/**
 * @file IncomingMarksNotice.test.tsx
 * @description Incoming mark notices use the viewer's labels and never offer
 * a jump when a source page is missing from the open book.
 * @module features/annotations/components/IncomingMarksNotice.test
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";

import { renderWithPanel } from "@/test/harness";
import { PdfImmersiveProvider, PdfPageTextProvider } from "@/shared/ui/composites/PdfViewer/context";

import { IncomingMarksNotice } from "./IncomingMarksNotice";

afterEach(cleanup);

describe("incoming marks", () => {
  it("names the viewer's printed folios and offers a jump", () => {
    const go = vi.fn();
    renderWithPanel(
      <PdfPageTextProvider value={(page) => ({ 16: "s. 14", 17: "bez numeru" })[page] ?? `s. ${page}`}>
        <IncomingMarksNotice count={2} pages={[16, 17]} kind="since" onGoToPage={go} onDismiss={vi.fn()} />
      </PdfPageTextProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /s\. 14, bez numeru/ }));
    expect(go).toHaveBeenCalledOnce();
  });

  it("gives a count without an inaccurate page or jump when a page is unbound", () => {
    const go = vi.fn();
    renderWithPanel(
      <IncomingMarksNotice count={2} pages={[16, null]} kind="since" onGoToPage={go} onDismiss={vi.fn()} />,
    );

    expect(screen.getByRole("status").textContent).toContain("2 nowe oznaczenia");
    expect(screen.queryByRole("button", { name: /ostatniej wizyty/ })).toBeNull();
    expect(go).not.toHaveBeenCalled();
  });

  it("keeps the music clear in performance mode", () => {
    renderWithPanel(
      <PdfImmersiveProvider value>
        <IncomingMarksNotice count={1} pages={[4]} kind="live" onGoToPage={vi.fn()} onDismiss={vi.fn()} />
      </PdfImmersiveProvider>,
    );

    expect(screen.queryByRole("button", { name: /Nowe oznaczenie/ })).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("s. 4");
  });
});
