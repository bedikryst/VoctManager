/**
 * @file queue.ts
 * @description The reviewer's reading of the payload: which fields are waiting,
 * what stands on each of them, and in what order a person meets them.
 * @architecture Enterprise SaaS 2026
 * @module features/copydesk/lib/queue
 */

import { isOpen } from "./proposals";
import type { CopyDeskProposal, CopyDeskSegment } from "../types/copydesk.dto";

/**
 * One field of one page, in one language, with everything waiting on it.
 *
 * `open` may hold two proposals, and that is the case this whole surface exists
 * for: §6b keeps competing editors on purpose, because auto-resolving them
 * would discard somebody's words silently. The reviewer reads both and chooses
 * — and accepting one does not close the other, which the entry says out loud.
 */
export interface QueueEntry {
  readonly segment: CopyDeskSegment;
  /** Oldest first: the proposal that has been waiting longest reads first. */
  readonly open: readonly CopyDeskProposal[];
  /** The last verdict this field ever received, if it has had one. */
  readonly settled: CopyDeskProposal | null;
}

export interface QueueGroup {
  readonly scope: string;
  readonly label: string;
  readonly entries: readonly QueueEntry[];
  readonly proposals: number;
}

/**
 * The editor left a note and changed nothing about the wording.
 *
 * A real proposal (§6h) and a different act from a rewrite: "this sentence
 * bothers me and I do not know what it should say" is worth carrying. The queue
 * has to tell the two apart, or a note renders as an old → new whose two halves
 * are the same paragraph.
 */
export const isNoteOnly = (
  segment: CopyDeskSegment,
  proposal: CopyDeskProposal,
): boolean => proposal.value === segment.value;

const writtenAt = (proposal: CopyDeskProposal): number =>
  new Date(proposal.updated_at).getTime();

/**
 * Group the queue by page, most recently worked page first.
 *
 * Deliberately not the contents list's order, and for a reason that is about
 * the surface rather than the data: the contents list is a map of the site and
 * sorts by title, while a queue is a record of what arrived. A reviewer opens
 * this from a digest saying somebody spent an evening on one concert, and that
 * concert is what should be under the cursor. Within a page the site's own
 * reading order stands — the payload arrives in it, and re-sorting here would
 * be a second opinion about the shape of a page.
 */
export const buildQueue = (
  segments: readonly CopyDeskSegment[],
): readonly QueueGroup[] => {
  const groups = new Map<string, { label: string; entries: QueueEntry[]; latest: number }>();

  for (const segment of segments) {
    const open = segment.proposals.filter(isOpen);
    if (open.length === 0) continue;

    const group = groups.get(segment.scope) ?? {
      label: segment.scope_label || segment.scope,
      entries: [],
      latest: 0,
    };
    group.entries.push({
      segment,
      open: [...open].sort((a, b) => writtenAt(a) - writtenAt(b)),
      // The payload arrives newest first, so the first settled row found is the
      // last decision anybody made about this field.
      settled: segment.proposals.find((proposal) => !isOpen(proposal)) ?? null,
    });
    group.latest = Math.max(group.latest, ...open.map(writtenAt));
    groups.set(segment.scope, group);
  }

  return [...groups.entries()]
    .sort(([, a], [, b]) => b.latest - a.latest)
    .map(([scope, group]) => ({
      scope,
      label: group.label,
      entries: group.entries,
      proposals: group.entries.reduce((total, entry) => total + entry.open.length, 0),
    }));
};

/** What the header states, counted from the rows the page is drawing. */
export const countQueue = (
  groups: readonly QueueGroup[],
): { proposals: number; fields: number; pages: number } => ({
  proposals: groups.reduce((total, group) => total + group.proposals, 0),
  fields: groups.reduce((total, group) => total + group.entries.length, 0),
  pages: groups.length,
});
