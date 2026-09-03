/**
 * @file copydesk.service.ts
 * @description Transport for the copy desk. The desk READS the corpus and
 * writes proposals about it — it never writes the mirror, which only the
 * extractor's staff-only ingest may do.
 * @architecture Enterprise SaaS 2026
 * @module features/copydesk/api/copydesk.service
 */

import api from "@/shared/api/api";
import type {
  CopyDeskContents,
  CopyDeskNotifyResult,
  CopyDeskProposalWrite,
  CopyDeskProposalWritten,
  CopyDeskQueue,
  CopyDeskReviewWrite,
  CopyDeskSegments,
} from "../types/copydesk.dto";

export const COPY_DESK_ENDPOINTS = {
  contents: "/api/copydesk/contents/",
  segments: "/api/copydesk/segments/",
  proposals: "/api/copydesk/proposals/",
  queue: "/api/copydesk/proposals/queue/",
  markSeen: "/api/copydesk/mark-seen/",
  notify: "/api/copydesk/notify/",
} as const;

export const CopyDeskService = {
  getContents: async (): Promise<CopyDeskContents> => {
    const { data } = await api.get<CopyDeskContents>(
      COPY_DESK_ENDPOINTS.contents,
    );
    return data;
  },

  /**
   * One page of the desk, in every language at once.
   *
   * The endpoint can narrow to a locale and the desk deliberately does not ask
   * it to: the locale switch is a way of READING a page, not a different page,
   * and a switch that refetched would put a spinner between the Polish and the
   * French of the same paragraph. One page is ~213 rows.
   */
  getSegments: async (scope: string): Promise<CopyDeskSegments> => {
    const { data } = await api.get<CopyDeskSegments>(
      COPY_DESK_ENDPOINTS.segments,
      { params: { scope } },
    );
    return data;
  },

  /**
   * Writes, or revises in place, the caller's own open proposal for a segment.
   * One per person per segment — this is the autosave, so a row per keystroke
   * would bury the reviewer.
   */
  saveProposal: async (
    payload: CopyDeskProposalWrite,
  ): Promise<CopyDeskProposalWritten> => {
    const { data } = await api.post<CopyDeskProposalWritten>(
      COPY_DESK_ENDPOINTS.proposals,
      payload,
    );
    return data;
  },

  /**
   * The reviewer's screen in one request: every field somebody is waiting on a
   * verdict for, and the summary of what has been accepted and not yet written.
   *
   * Reviewer-only, and it exists because nothing else could answer it — the
   * contents list counts touched segments per page but names none of them, and
   * the editor's read is one page at a time.
   */
  getQueue: async (): Promise<CopyDeskQueue> => {
    const { data } = await api.get<CopyDeskQueue>(COPY_DESK_ENDPOINTS.queue);
    return data;
  },

  /**
   * One verdict. Accepting does NOT touch the public site: it marks a value as
   * one the reviewer intends to commit, `copy:apply` writes it into the
   * repository, and a `git diff` puts it in front of a reader.
   *
   * A corrected `value` makes accept-and-edit one act, so the record holds what
   * was actually written rather than what was proposed and then altered.
   */
  reviewProposal: async ({
    proposalId,
    status,
    value,
  }: CopyDeskReviewWrite): Promise<CopyDeskProposalWritten> => {
    const { data } = await api.post<CopyDeskProposalWritten>(
      `${COPY_DESK_ENDPOINTS.proposals}${proposalId}/review/`,
      value === undefined ? { status } : { status, value },
    );
    return data;
  },

  /** Takes back one's own open proposal; the segment returns to what git holds. */
  withdrawProposal: async (proposalId: string): Promise<void> => {
    await api.delete(`${COPY_DESK_ENDPOINTS.proposals}${proposalId}/`);
  },

  /**
   * "I have finished" — raises this editor's digest now instead of thirty
   * minutes after their last keystroke. It is an accelerator and never a
   * submit: the work is already saved, and the clock reports it either way.
   */
  notifyReviewers: async (): Promise<CopyDeskNotifyResult> => {
    const { data } = await api.post<CopyDeskNotifyResult>(
      COPY_DESK_ENDPOINTS.notify,
    );
    return data;
  },

  /**
   * Stamps the visit the "new since last visit" state is measured from. Called
   * when the reader LEAVES the desk, not when they arrive: a segment that
   * appeared since last time has to survive being read, or the counter clears
   * itself before it has said anything.
   *
   * The stamp lives on the profile, server-side, for the same reason
   * `welcome_seen_at` does — a visit is a fact about the person, not about a
   * browser.
   */
  markSeen: async (): Promise<void> => {
    await api.post(COPY_DESK_ENDPOINTS.markSeen);
  },
};
