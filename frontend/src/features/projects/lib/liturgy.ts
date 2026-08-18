/**
 * @file liturgy.ts
 * @description The two order questions a programme of the Mass can be asked on
 * the client: does it follow the rite, and what would it look like if it did.
 * Both are answered against the ranking the server publishes — the slot
 * vocabulary arrives in canonical order, so a slot's position in that array IS
 * its rank, and no second copy of the order of the Mass exists here.
 * Nothing in this module writes: `order` stays the single source of truth for
 * the running order, a programme may contradict the canon on purpose, and the
 * sort is only ever offered to the producer as a proposed edit.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/lib/liturgy
 */

import type { LiturgicalSlotOption } from "../api/project.service";

/**
 * An unclassified item sorts after every classified one, keeping its relative
 * position, rather than being scattered through the rite: these are the pieces
 * nobody has placed yet, and burying them mid-programme is how they stay
 * unplaced. Mirrors `roster.domain.liturgy.canonical_sort_key`.
 */
const UNRANKED = Number.MAX_SAFE_INTEGER;

/** The one fact this module needs from a programme row. */
export interface LiturgicalOrderFacts {
  readonly liturgical_slot?: string;
}

export type SlotRanks = ReadonlyMap<string, number>;

export const buildSlotRanks = (
  slots: readonly LiturgicalSlotOption[],
): SlotRanks => new Map(slots.map((slot, index) => [slot.value, index]));

const rankOf = (item: LiturgicalOrderFacts, ranks: SlotRanks): number =>
  ranks.get(item.liturgical_slot ?? "") ?? UNRANKED;

/**
 * The programme as the rite would run it. Stable: two items sharing a slot (two
 * pieces at Communion) keep the order the producer put them in.
 */
export const sortByLiturgy = <T extends LiturgicalOrderFacts>(
  items: readonly T[],
  ranks: SlotRanks,
): T[] =>
  items
    .map((item, index) => ({ item, index }))
    .sort(
      (left, right) =>
        rankOf(left.item, ranks) - rankOf(right.item, ranks) ||
        left.index - right.index,
    )
    .map((entry) => entry.item);

/**
 * Whether any item's slot sits earlier in the rite than one already passed — a
 * Gloria after the Sanctus. Reported, never corrected (the producer may have
 * moved a piece because the celebrant asked for it); items without a slot are
 * transparent, neither breaking a run nor belonging to one.
 */
export const hasLiturgyOrderProblem = (
  items: readonly LiturgicalOrderFacts[],
  ranks: SlotRanks,
): boolean => {
  let highest: number | null = null;

  for (const item of items) {
    const rank = rankOf(item, ranks);
    if (rank === UNRANKED) continue;
    if (highest !== null && rank < highest) return true;
    highest = rank;
  }

  return false;
};
