/**
 * @file markSeen.test.ts
 * @description The queued `seen`: one per edition, keeping whichever read
 * further, and never counted as a change the reader made.
 * @module features/annotations/lib/markSeen.test
 */

import { describe, expect, it } from "vitest";

import type { QueuedWrite } from "@/shared/offline/useOfflineStore";

import { MARKS_SEEN_ENDPOINT, queuedSeen } from "./markSeen";

const held = (editionId: string, at: string): QueuedWrite => ({
  ...queuedSeen([], editionId, at, "label"),
  id: `q-${editionId}`,
  createdAt: 1,
  attempts: 0,
  nextAttemptAt: 0,
  failingSince: null,
});

describe("queuedSeen", () => {
  it("is a background POST to seen/, one per edition", () => {
    const write = queuedSeen([], "edition-1", "2026-10-26T12:00:00Z", "label");

    expect(write).toMatchObject({
      kind: "annotation_seen",
      method: "POST",
      url: MARKS_SEEN_ENDPOINT,
      body: { edition: "edition-1", at: "2026-10-26T12:00:00Z" },
      dedupeKey: "annotation-seen:edition-1",
      background: true,
    });
  });

  it("keeps the further pointer when the same score is left twice offline", () => {
    const queue = [held("edition-1", "2026-10-26T15:00:00Z")];

    const earlier = queuedSeen(queue, "edition-1", "2026-10-26T12:00:00Z", "label");
    const later = queuedSeen(queue, "edition-1", "2026-10-26T18:00:00Z", "label");

    expect(earlier.body).toEqual({ edition: "edition-1", at: "2026-10-26T15:00:00Z" });
    expect(later.body).toEqual({ edition: "edition-1", at: "2026-10-26T18:00:00Z" });
  });

  it("leaves another edition's pointer alone", () => {
    const queue = [held("edition-2", "2026-10-26T18:00:00Z")];

    const write = queuedSeen(queue, "edition-1", "2026-10-26T12:00:00Z", "label");

    expect(write.body).toEqual({ edition: "edition-1", at: "2026-10-26T12:00:00Z" });
  });
});
