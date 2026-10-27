/**
 * @file SetAsideSection.test.tsx
 * @description "Odłóż uwagi" takes a piece's marks off every stand at once. The
 * failures pinned here: pressed offline it paused and fired on reconnect,
 * sweeping up whatever the conductor drew in between; a page turned while it was
 * in flight sent its answer to the next piece; and the stand's undo history,
 * which names the rows that were just put away, outlived them.
 * @module features/annotations/components/SetAsideSection.test
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { onlineManager } from "@tanstack/react-query";
import { HttpResponse, http } from "msw";

import { renderWithPanel } from "@/test/harness";
import { server } from "@/test/server";
import { ANNOTATIONS_PATH } from "@/shared/offline/swProtocol";

import { SetAsideSection } from "./SetAsideSection";

const SETS_URL = `*${ANNOTATIONS_PATH}set_aside/`;
const RESTORE_URL = `*${ANNOTATIONS_PATH}set_aside/restore/`;
const ARCHIVED_AT = "2026-06-20T19:00:00Z";

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
  it("holds both buttons and says the network is needed", async () => {
    const writes = { count: 0 };
    server.use(
      http.get(SETS_URL, () => HttpResponse.json([{ archived_at: ARCHIVED_AT, count: 4 }])),
      http.post(SETS_URL, () => {
        writes.count += 1;
        return HttpResponse.json({ archived_at: ARCHIVED_AT, count: 7 });
      }),
      http.post(RESTORE_URL, () => {
        writes.count += 1;
        return HttpResponse.json({ restored: 4 });
      }),
    );
    renderWithPanel(<SetAsideSection editionId="edition-1" count={7} />);
    const restore = await screen.findByRole("button", { name: "Przywróć" });

    act(() => setOnline(false));

    const putAway = screen.getByRole("button", { name: "Odłóż 7 uwag" });
    expect((putAway as HTMLButtonElement).disabled).toBe(true);
    expect((restore as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByText("Odkładanie i przywracanie uwag działa tylko z internetem."),
    ).toBeTruthy();
    fireEvent.click(putAway);
    fireEvent.click(putAway);
    fireEvent.click(restore);
    expect(writes.count).toBe(0);
  });
});

describe("the edition a press acts on", () => {
  it("is the one in front of the reader when pressed, even if the page turns before the answer", async () => {
    let answer: () => void = () => {};
    const sent: unknown[] = [];
    server.use(
      http.get(SETS_URL, () => HttpResponse.json([])),
      http.post(SETS_URL, async ({ request }) => {
        sent.push(await request.json());
        await new Promise<void>((resolve) => {
          answer = resolve;
        });
        return HttpResponse.json({ archived_at: ARCHIVED_AT, count: 7 });
      }),
    );
    const onReplaced = vi.fn();
    const { rerender } = renderWithPanel(
      <SetAsideSection editionId="edition-1" count={7} onReplaced={onReplaced} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Odłóż 7 uwag" }));
    fireEvent.click(screen.getByRole("button", { name: "Na pewno?" }));
    await waitFor(() => expect(sent).toEqual([{ edition: "edition-1" }]));

    // The reader turns into the next piece of the book while the server works.
    rerender(<SetAsideSection editionId="edition-2" count={2} onReplaced={onReplaced} />);
    act(() => answer());

    await waitFor(() => expect(onReplaced).toHaveBeenCalledExactlyOnceWith("edition-1"));
  });

  it("ends the edition's history when a set comes back too", async () => {
    server.use(
      http.get(SETS_URL, () => HttpResponse.json([{ archived_at: ARCHIVED_AT, count: 4 }])),
      http.post(RESTORE_URL, () => HttpResponse.json({ restored: 4 })),
    );
    const onReplaced = vi.fn();
    renderWithPanel(
      <SetAsideSection editionId="edition-1" count={0} onReplaced={onReplaced} />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Przywróć" }));

    await waitFor(() => expect(onReplaced).toHaveBeenCalledExactlyOnceWith("edition-1"));
  });
});
