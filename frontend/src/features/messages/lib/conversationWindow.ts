/**
 * @file conversationWindow.ts
 * @description How a conversation held in the cache absorbs a window served by
 * the API. Pure functions — the query layer decides when, this decides what.
 *
 * The endpoint no longer returns a whole history: it returns the tail, or the
 * delta since a moment the client names, or one page walked back from a cursor.
 * The client is therefore the only party that knows the full conversation, and
 * every response has to be folded into what it already holds rather than
 * replacing it.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/lib/conversationWindow
 */

import { isOptimisticId } from "./time";
import type { MessageWindowMeta } from "../types/messages.dto";

interface Held {
  id: string;
  created_at: string;
}

/**
 * The cursor a poll asks with: the newest CONFIRMED message. An optimistic
 * bubble carries a client clock and no server row behind it, so asking "since"
 * from one would skip whatever the server accepted in the meantime.
 */
export const pollCursor = (messages: readonly Held[] | undefined): string | undefined => {
  if (!messages) return undefined;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!isOptimisticId(message.id)) return message.created_at;
  }
  return undefined;
};

/**
 * Folds an incoming window into the messages already held.
 *
 * Optimistic sends are carried through untouched and always land last: they are
 * the reader's own text waiting for a round trip, and a poll arriving mid-flight
 * must not make it blink out. Everything else is keyed by id with the server's
 * copy winning, then ordered by instant — parsed, not compared as strings,
 * because an ISO stamp either side of a DST change does not sort lexically.
 */
export const mergeMessages = <T extends Held>(
  held: readonly T[],
  incoming: readonly T[],
  reset: boolean,
): T[] => {
  const pending = held.filter((message) => isOptimisticId(message.id));
  const confirmed = new Map<string, T>();
  if (!reset) {
    for (const message of held) {
      if (!isOptimisticId(message.id)) confirmed.set(message.id, message);
    }
  }
  for (const message of incoming) confirmed.set(message.id, message);

  const ordered = [...confirmed.values()].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  return [...ordered, ...pending];
};

/** Drops one message by id — a send that failed, or one the server replaced. */
export const withoutMessage = <T extends Held>(held: readonly T[], id: string): T[] =>
  held.filter((message) => message.id !== id);

/**
 * Which "is there more history" answer survives a merge. A delta was asked a
 * question about the top of the conversation and answered about the bottom, so
 * it may not overwrite what a real window established; a `reset` window is a
 * fresh tail and speaks for itself.
 */
export const mergeWindowMeta = (
  held: MessageWindowMeta | undefined,
  incoming: MessageWindowMeta,
  askedForDelta: boolean,
): MessageWindowMeta => ({
  has_older:
    held && askedForDelta && !incoming.reset ? held.has_older : incoming.has_older,
  reset: false,
});

/**
 * Folds a whole conversation payload into the one held. The head fields (status,
 * assignee, unread, push opt-in) are always the server's most recent word; only
 * the history is cumulative.
 */
export const mergeConversation = <
  M extends Held,
  T extends { messages: M[]; messages_page: MessageWindowMeta },
>(
  held: T | undefined,
  incoming: T,
  askedForDelta: boolean,
): T => {
  if (!held) return incoming;
  // The spread widens to `T & {…}`, which TypeScript will not narrow back to T
  // on its own; the two overridden fields are the ones typed above.
  return {
    ...incoming,
    messages: mergeMessages<M>(
      held.messages,
      incoming.messages,
      incoming.messages_page.reset,
    ),
    messages_page: mergeWindowMeta(held.messages_page, incoming.messages_page, askedForDelta),
  } as T;
};
