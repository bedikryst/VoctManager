/**
 * @file conversationWindow.test.ts
 * @description The arithmetic that decides which messages a reader still has.
 *
 * Once the API serves windows instead of histories, the cache is the only place
 * the whole conversation exists — so every property here is one that loses
 * somebody's messages when it breaks, silently and on someone else's phone: a
 * poll must never drop what it did not ask about, an unconfirmed send must
 * survive the poll that lands mid-flight, and a window that arrives out of order
 * must still read in order.
 * @module features/messages/lib/conversationWindow.test
 */

import { describe, expect, it } from "vitest";

import {
  mergeConversation,
  mergeMessages,
  mergeWindowMeta,
  pollCursor,
  withoutMessage,
} from "./conversationWindow";
import type { MessageDTO, ThreadDetail } from "../types/messages.dto";

const message = (id: string, created_at: string, body = id): MessageDTO => ({
  id,
  body,
  created_at,
  sender: { id: 1, name: "Ada" },
  is_mine: false,
});

const AT = {
  first: "2026-08-20T09:00:00Z",
  second: "2026-08-20T10:00:00Z",
  third: "2026-08-20T11:00:00Z",
} as const;

describe("pollCursor", () => {
  it("names the newest CONFIRMED message, ignoring what is still in flight", () => {
    const held = [
      message("a", AT.first),
      message("b", AT.second),
      message("optimistic-1", AT.third),
    ];
    expect(pollCursor(held)).toBe(AT.second);
  });

  it("asks for the whole window when nothing is confirmed yet", () => {
    expect(pollCursor([])).toBeUndefined();
    expect(pollCursor([message("optimistic-1", AT.first)])).toBeUndefined();
    expect(pollCursor(undefined)).toBeUndefined();
  });
});

describe("mergeMessages", () => {
  it("appends a delta without touching the history it says nothing about", () => {
    const held = [message("a", AT.first), message("b", AT.second)];
    const merged = mergeMessages(held, [message("c", AT.third)], false);
    expect(merged.map((m) => m.id)).toEqual(["a", "b", "c"]);
  });

  it("prepends an older window in reading order", () => {
    const held = [message("c", AT.third)];
    const merged = mergeMessages(
      held,
      [message("a", AT.first), message("b", AT.second)],
      false,
    );
    expect(merged.map((m) => m.id)).toEqual(["a", "b", "c"]);
  });

  it("lets the server's copy win over the one held under the same id", () => {
    const held = [message("a", AT.first, "stara treść")];
    const merged = mergeMessages(held, [message("a", AT.first, "[treść usunięta]")], false);
    expect(merged).toHaveLength(1);
    expect(merged[0].body).toBe("[treść usunięta]");
  });

  it("carries an unconfirmed send through a poll, and keeps it last", () => {
    const held = [message("a", AT.first), message("optimistic-1", AT.third)];
    const merged = mergeMessages(held, [message("b", AT.second)], false);
    expect(merged.map((m) => m.id)).toEqual(["a", "b", "optimistic-1"]);
  });

  it("drops the held history on reset, but never the send still in flight", () => {
    const held = [message("old", AT.first), message("optimistic-1", AT.third)];
    const merged = mergeMessages(held, [message("tail", AT.second)], true);
    expect(merged.map((m) => m.id)).toEqual(["tail", "optimistic-1"]);
  });

  it("orders by instant, not by the text of the stamp", () => {
    // The hour Poland leaves DST: 02:30+02:00 happens BEFORE 02:00+01:00, and
    // sorting the strings would put them the other way round.
    const merged = mergeMessages(
      [message("after", "2026-10-25T02:00:00+01:00")],
      [message("before", "2026-10-25T02:30:00+02:00")],
      false,
    );
    expect(merged.map((m) => m.id)).toEqual(["before", "after"]);
  });
});

describe("withoutMessage", () => {
  it("removes exactly the message named", () => {
    const held = [message("a", AT.first), message("optimistic-1", AT.second)];
    expect(withoutMessage(held, "optimistic-1").map((m) => m.id)).toEqual(["a"]);
  });
});

describe("mergeWindowMeta", () => {
  const held = { has_older: true, reset: false };

  it("keeps what a real window established when a delta answers", () => {
    expect(mergeWindowMeta(held, { has_older: false, reset: false }, true).has_older).toBe(
      true,
    );
  });

  it("takes the server's word when the window was not a delta", () => {
    expect(mergeWindowMeta(held, { has_older: false, reset: false }, false).has_older).toBe(
      false,
    );
  });

  it("takes the server's word when the poll was told to start over", () => {
    expect(mergeWindowMeta(held, { has_older: true, reset: true }, true)).toEqual({
      has_older: true,
      reset: false,
    });
  });
});

describe("mergeConversation", () => {
  const thread = (
    messages: MessageDTO[],
    overrides: Partial<ThreadDetail> = {},
  ): ThreadDetail =>
    ({
      id: "t1",
      subject: "Nuty",
      context_type: "GENERAL",
      context_id: null,
      status: "OPEN",
      last_message_at: AT.third,
      created_at: AT.first,
      artist: { id: "a1", name: "Ada", voice_type: "SOPRANO" },
      assignee: null,
      unread: false,
      messages,
      messages_page: { has_older: false, reset: false },
      ...overrides,
    }) as ThreadDetail;

  it("takes the head from the server and keeps the history cumulative", () => {
    const held = thread([message("a", AT.first)], {
      status: "OPEN",
      messages_page: { has_older: true, reset: false },
    });
    const incoming = thread([message("b", AT.second)], { status: "RESOLVED" });

    const merged = mergeConversation(held, incoming, true);

    expect(merged.status).toBe("RESOLVED");
    expect(merged.messages.map((m) => m.id)).toEqual(["a", "b"]);
    // The delta was asked about the end of the conversation, so it may not
    // retract the "there is history above" the first window established.
    expect(merged.messages_page.has_older).toBe(true);
  });

  it("adopts a first window whole", () => {
    const incoming = thread([message("a", AT.first)]);
    expect(mergeConversation(undefined, incoming, false)).toBe(incoming);
  });
});
