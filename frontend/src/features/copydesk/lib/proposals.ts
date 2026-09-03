/**
 * @file proposals.ts
 * @description What one cell of the desk is actually in — read off the segment
 * and the proposals hanging on it, in one place, so the editor, the chips and
 * the "original" toggle cannot disagree about it.
 * @architecture Enterprise SaaS 2026
 * @module features/copydesk/lib/proposals
 */

import type {
  CopyDeskProposal,
  CopyDeskSegment,
} from "../types/copydesk.dto";

/** Still editable: the author may revise it, the reviewer has not settled it. */
export const isOpen = (proposal: CopyDeskProposal): boolean =>
  proposal.status === "DRAFT" || proposal.status === "PROPOSED";

/**
 * One field of one page in one language, with everything standing on it.
 *
 * The split between `mine` and `others` is the shape §6b chose on purpose: two
 * editors may hold competing open proposals on one segment, and the desk shows
 * both rather than letting one person's words silently replace another's. Only
 * `mine` is editable here — the reviewer is the one who chooses between them.
 */
export interface CopyDeskCell {
  readonly segment: CopyDeskSegment;
  /** The caller's own open proposal, which the autosave revises in place. */
  readonly mine: CopyDeskProposal | null;
  /** Somebody else's open proposal on the same field. */
  readonly others: readonly CopyDeskProposal[];
  /**
   * The verdict on the caller's OWN wording that is still news to them.
   *
   * A verdict is feedback to the person who wrote the words: "accepted" tells
   * an editor their sentence stood, "rejected" tells them it did not, and both
   * belong on the cell where they are looking. Somebody else's decision is not
   * news about this field — once it has been written into the repository it
   * simply IS the text the site holds, which the cell is already showing.
   *
   * Authorship alone does not make it news, though, which is why this is
   * narrowed further by `isStandingVerdict`.
   */
  readonly settled: CopyDeskProposal | null;
  /**
   * Wording a reviewer has accepted that the repository has not received yet —
   * whoever wrote it.
   *
   * `segment.value` is git's, and between the verdict and the next run of
   * `apply-copy` it cannot show this: the cell would print the sentence being
   * replaced, or nothing at all where a field is being translated for the first
   * time, under a chip saying the change was accepted. That gap is hours or days
   * wide, because writing the patch out is a person's errand from a checkout —
   * so the desk states the decided text rather than letting the wait read as
   * lost work.
   */
  readonly awaiting: CopyDeskProposal | null;
}

/**
 * Whether the last verdict on the caller's own wording still describes the row.
 *
 * The two verdicts are not symmetrical, and reading them as one fact is what
 * hangs "Przyjęte" over fields where nothing has been accepted. REJECTED is an
 * event about an attempt — it can only ever mean "the words you sent were
 * turned down", so it stands until a reviewer says something else, including
 * while the editor is rewriting in answer to it. ACCEPTED reads as a STATE of
 * the field, and a state has to still be true; it stops being so in three ways:
 *
 * - once `apply-copy` has written it, the field itself is the evidence, and the
 *   chip becomes decoration on every row that sentence ever touched — for the
 *   account that ran the bulk translation import, one accepted proposal per
 *   cell across the whole translated corpus, every one of them its own;
 * - once the editor has started writing again, it is a verdict on the previous
 *   round while the field on screen holds words nobody has reviewed;
 * - and while a decided sentence waits for the repository, the gold panel under
 *   the field already says exactly that, with the decided text in it.
 */
const isStandingVerdict = (
  settled: CopyDeskProposal,
  mine: CopyDeskProposal | null,
  awaiting: CopyDeskProposal | null,
): boolean =>
  settled.status !== "ACCEPTED" ||
  (mine === null && settled.applied_at === null && settled.id !== awaiting?.id);

export const readCell = (segment: CopyDeskSegment): CopyDeskCell => {
  let mine: CopyDeskProposal | null = null;
  const others: CopyDeskProposal[] = [];
  let settled: CopyDeskProposal | null = null;
  let awaiting: CopyDeskProposal | null = null;

  // The payload arrives newest first, so the first settled row found is the
  // last decision made about this field. Whether it is still worth showing is
  // decided afterwards and never here: a scan that skipped the rows
  // `isStandingVerdict` rejects would fall through to an older decision and
  // report a rejection the editor has already had accepted since.
  for (const proposal of segment.proposals) {
    if (isOpen(proposal)) {
      if (proposal.is_mine) mine ??= proposal;
      else others.push(proposal);
      continue;
    }
    if (settled === null && proposal.is_mine) settled = proposal;
    if (
      awaiting === null &&
      proposal.status === "ACCEPTED" &&
      proposal.applied_at === null &&
      proposal.value !== segment.value
    ) {
      awaiting = proposal;
    }
  }

  return {
    segment,
    mine,
    others,
    settled:
      settled !== null && isStandingVerdict(settled, mine, awaiting)
        ? settled
        : null,
    awaiting,
  };
};

/**
 * What the editor is looking at: their own proposal where they have written
 * one, and otherwise the value the repository holds.
 *
 * Never another editor's proposal. A cell showing somebody else's unaccepted
 * wording as the current text would make an editor revise a sentence the site
 * has never carried.
 */
export const currentValue = (cell: CopyDeskCell): string =>
  cell.mine ? cell.mine.value : cell.segment.value;

/** True once the editor has written something of their own into this field. */
export const isTouched = (cell: CopyDeskCell): boolean => cell.mine !== null;

/**
 * The editor changed the wording, rather than only leaving a note.
 *
 * A comment-only proposal is legitimate — "this sentence bothers me, I do not
 * know what it should say" is worth carrying to the reviewer — but it is not a
 * rewrite, and the surface should not dress it up as one.
 */
export const hasNewWording = (cell: CopyDeskCell): boolean =>
  cell.mine !== null && cell.mine.value !== cell.segment.value;
