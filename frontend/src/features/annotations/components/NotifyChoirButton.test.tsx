/**
 * @file NotifyChoirButton.test.tsx
 * @description "Powiadom chór" pages the whole choir, so what this pins is when
 * it may NOT be pressed and what the reader is told instead: offline it waits
 * for the network rather than firing on reconnect; the cooldown is the server's
 * and is counted down on the server's clock, so a phone set an hour wrong
 * neither wakes it early nor holds it late; a notice the server could not hand
 * on (503) may be sent again; marks no voice in the cast can be told of name
 * that voice rather than offer a press that is refused; and on the toolbar,
 * where there is no room for a line of text, a press on a held chip says why.
 * @module features/annotations/components/NotifyChoirButton.test
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { onlineManager } from "@tanstack/react-query";
import { HttpResponse, http } from "msw";
import { toast } from "sonner";

import { renderWithPanel } from "@/test/harness";
import { server } from "@/test/server";

import { NotifyChoirButton } from "./NotifyChoirButton";

const NEWS_URL = "*/api/projects/:projectId/marks_news/";
const NOTIFY_URL = "*/api/projects/:projectId/notify_marks/";

const news = (overrides: Record<string, unknown> = {}) => ({
  since: "2026-10-01T10:00:00Z",
  notified_at: null,
  next_allowed_at: null,
  recipients: 12,
  unreached_sections: "",
  pieces: [
    { piece_id: "piece-1", title: "Ave verum", composer_name: "W. A. Mozart", count: 3 },
  ],
  ...overrides,
});

/** jsdom reports the tab online; a test that says otherwise must put it back. */
const setOnline = (online: boolean): void => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: online });
  window.dispatchEvent(new Event(online ? "online" : "offline"));
};

afterEach(() => {
  // Unmounted first: the `online` event refetches every mounted query, and the
  // handlers it would reach are already gone. With nothing mounted the query
  // layer no longer hears the window, so it is told directly.
  cleanup();
  setOnline(true);
  onlineManager.setOnline(true);
  vi.restoreAllMocks();
});

describe("offline", () => {
  it("holds the button and says it waits for the network", async () => {
    const presses = { count: 0 };
    server.use(
      http.get(NEWS_URL, () => HttpResponse.json(news())),
      http.post(NOTIFY_URL, () => {
        presses.count += 1;
        return HttpResponse.json({ notified_at: "", recipients: 12, pieces: 1 });
      }),
    );
    renderWithPanel(<NotifyChoirButton projectId="project-1" surface="page" />);
    const button = await screen.findByRole("button", { name: /Powiadom chór/ });

    act(() => setOnline(false));

    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Chór powiadomisz, gdy wróci internet.")).toBeTruthy();
    fireEvent.click(button);
    fireEvent.click(button);
    expect(presses.count).toBe(0);
  });
});

describe("the cooldown", () => {
  it("counts down on the server's clock, not this device's", async () => {
    // The device runs an hour ahead of the server. Compared with the device's
    // clock, a cooldown ending five server-minutes from now is long over.
    const serverNow = Math.floor((Date.now() - 60 * 60_000) / 1000) * 1000;
    server.use(
      http.get(NEWS_URL, () =>
        HttpResponse.json(
          news({
            notified_at: new Date(serverNow - 5 * 60_000).toISOString(),
            next_allowed_at: new Date(serverNow + 5 * 60_000).toISOString(),
          }),
          { headers: { Date: new Date(serverNow).toUTCString() } },
        ),
      ),
    );
    renderWithPanel(<NotifyChoirButton projectId="project-1" surface="page" />);

    expect(
      await screen.findByText(
        "Chór dostał powiadomienie przed chwilą. Następne wyślesz za 5 minut.",
      ),
    ).toBeTruthy();
    const button = screen.getByRole("button", { name: /Powiadom chór/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});

describe("a notice the server could not hand on", () => {
  it("says so, and the same press can be made again", async () => {
    const presses = { count: 0 };
    server.use(
      http.get(NEWS_URL, () => HttpResponse.json(news())),
      http.post(NOTIFY_URL, () => {
        presses.count += 1;
        return HttpResponse.json(
          { detail: "The choir could not be told just now.", code: "unavailable" },
          { status: 503 },
        );
      }),
    );
    const error = vi.spyOn(toast, "error");
    renderWithPanel(<NotifyChoirButton projectId="project-1" surface="page" />);
    const button = await screen.findByRole("button", { name: /Powiadom chór/ });

    fireEvent.click(button);
    fireEvent.click(await screen.findByRole("button", { name: "Wyślij do 12 osób" }));

    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(
        "Nie udało się teraz powiadomić chóru. Spróbuj ponownie za chwilę.",
      ),
    );
    const again = await screen.findByRole("button", { name: /Powiadom chór/ });
    await waitFor(() => expect((again as HTMLButtonElement).disabled).toBe(false));

    fireEvent.click(again);
    fireEvent.click(await screen.findByRole("button", { name: "Wyślij do 12 osób" }));
    await waitFor(() => expect(presses.count).toBe(2));
  });
});

describe("new marks for a section nobody in the cast can be told in", () => {
  it("names the section instead of offering a press that is refused", async () => {
    server.use(
      http.get(NEWS_URL, () =>
        HttpResponse.json(news({ pieces: [], recipients: 0, unreached_sections: "T" })),
      ),
    );
    renderWithPanel(<NotifyChoirButton projectId="project-1" surface="page" />);

    expect(
      await screen.findByText(
        "Nowe uwagi są tylko dla sekcji: tenory. Nikt z tej sekcji nie może jeszcze dostać powiadomienia.",
      ),
    ).toBeTruthy();
    const button = screen.getByRole("button", { name: /Powiadom chór/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});

describe("on the toolbar", () => {
  it("answers a press on a held chip with the reason, and sends nothing", async () => {
    const presses = { count: 0 };
    server.use(
      http.get(NEWS_URL, () => HttpResponse.json(news({ pieces: [] }))),
      http.post(NOTIFY_URL, () => {
        presses.count += 1;
        return HttpResponse.json({ notified_at: "", recipients: 12, pieces: 1 });
      }),
    );
    const info = vi.spyOn(toast, "info");
    renderWithPanel(<NotifyChoirButton projectId="project-1" surface="chrome" />);
    const chip = await screen.findByRole("button", { name: /Powiadom chór/ });

    expect(chip.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(chip);

    expect(info).toHaveBeenCalledWith(
      "Nic nowego od ostatniego powiadomienia.",
      expect.anything(),
    );
    expect(presses.count).toBe(0);
  });
});
