/**
 * @file readiness.ts
 * @description The one place that decides what a missing readiness MEANS.
 *
 * `my_readiness` is `null` only when the server declined to answer — a manager
 * previewing a member's songbook, who was promised nobody else sees that note.
 * The read-model drops the prefetch entirely, so the refusal arrives on every
 * piece of the programme at once; one null is therefore the whole programme's
 * answer. Never `NOT_STARTED`, which is a claim about the singer rather than a
 * refusal to make one.
 *
 * Two surfaces ask this question — the songbook group header and
 * `useProjectReadiness` (which feeds the ring on three more) — and they must not
 * be able to disagree.
 * @module features/materials/lib/readiness
 */

import type { MaterialsProgramItem } from "../types/materials.dto";

/**
 * True when a programme exists and its readiness was withheld. False for an
 * empty programme: there is nothing to withhold, and the caller has its own
 * empty state for that.
 */
export const isReadinessWithheld = (
  program: readonly MaterialsProgramItem[],
): boolean =>
  program.length > 0 && program.every((item) => item.piece.my_readiness === null);
