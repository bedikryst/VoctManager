/**
 * @file messageRuns.ts
 * @description Whether a message opens a run of consecutive messages by one
 * sender — the predicate behind `MessageBubble`'s `group.startsRun`.
 *
 * Identity is drawn once per run rather than once per message: a thirteen-person
 * channel repeating the same name and avatar down twelve rows states the fact
 * eleven times too often, and the gutter alone is enough to hold the block
 * together. Callers pass a single day group, so a day divider always breaks a run.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/lib/messageRuns
 */

interface HasSender {
  readonly sender: { readonly id: number } | null;
}

/** @param items one day group, in order; `index` a position inside it. */
export const startsSenderRun = (items: readonly HasSender[], index: number): boolean =>
  index === 0 || items[index - 1].sender?.id !== items[index].sender?.id;

/**
 * True when a 1:1 thread has been answered by more than one person, which is
 * what an unassigned thread in the management queue looks like. Below that the
 * header already names the one other party and a per-message byline is the same
 * fact a third time.
 */
export const hasSeveralCounterparts = (messages: readonly (HasSender & { is_mine: boolean })[]): boolean =>
  new Set(messages.filter((m) => !m.is_mine).map((m) => m.sender?.id ?? 0)).size > 1;
