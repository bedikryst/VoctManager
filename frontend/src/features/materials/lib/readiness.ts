/**
 * @file readiness.ts
 * @description The one place that decides what a missing readiness MEANS, and
 * which items a readiness is asked about at all.
 *
 * `my_readiness` is `null` only when the server declined to answer — a manager
 * previewing a member's songbook, who was promised nobody else sees that note.
 * The read-model drops the prefetch entirely, so the refusal arrives on every
 * piece of the programme at once; one null is therefore the whole programme's
 * answer. Never `NOT_STARTED`, which is a claim about the singer rather than a
 * refusal to make one.
 *
 * An item whose materials are withheld (an instrumental piece on a singer's
 * list) is not the singer's to learn: it carries no readiness control, so it
 * must not count in any ratio either — 6/7 with an unreachable seventh would
 * read as a piece never practised.
 *
 * Three surfaces ask these questions — the songbook group header, its
 * "still to practise" filter and `useProjectReadiness` (which feeds the ring
 * on three more) — and they must not be able to disagree.
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

/** The items a singer is given music for — the only ones readiness is about. */
export const practisedProgram = (
  program: readonly MaterialsProgramItem[],
): MaterialsProgramItem[] =>
  program.filter((item) => !item.piece.materials_withheld);
