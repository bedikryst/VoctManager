/**
 * @file copydesk.dto.ts
 * @description Wire contracts for the copy desk — the editorial surface over the
 * public site's text. Mirrors `backend/copydesk/dtos.py`; every field here is
 * server-authoritative, because the desk reads a PROJECTION of git and owns
 * nothing about it.
 * @architecture Enterprise SaaS 2026
 * @module features/copydesk/types/copydesk.dto
 */

/**
 * One line of the contents list: a page of the corpus with its counts.
 *
 * `segments` counts ROWS, not fields — one field in one locale is one segment,
 * so a concert with 71 editable fields reports 213. The surface says so once
 * rather than dividing, because nothing guarantees every key holds all three
 * locales (a row retired by the extractor leaves its siblings standing).
 *
 * The four counts after it are all subsets of `segments`, which is what lets
 * them share a sentence: `touched` has an open proposal on it, `accepted` one
 * the reviewer has settled but `apply-copy` has not yet written, `new` appeared
 * after the reader's last visit, and `stale` is a translation whose Polish has
 * moved since it was written.
 */
export interface CopyDeskScopeSummary {
  readonly scope: string;
  readonly label: string;
  readonly segments: number;
  readonly touched: number;
  readonly accepted: number;
  readonly new: number;
  readonly stale: number;
}

/**
 * `GET /api/copydesk/contents/`.
 *
 * `is_reviewer` is the server's own answer to "may this account settle
 * proposals" (staff, per §6b of the spec) and is not derivable from the panel's
 * identity payload — accepting is the decision to commit to the repository, so
 * the capability to EDIT copy says nothing about it.
 */
export interface CopyDeskContents {
  readonly scopes: readonly CopyDeskScopeSummary[];
  readonly is_reviewer: boolean;
}

/** The public site's languages, in the order the desk prints them. */
export const SITE_LOCALES = ["pl", "en", "fr"] as const;
export type SiteLocale = (typeof SITE_LOCALES)[number];

/** Polish is the source every translation renders — never a column like the others. */
export const SOURCE_LOCALE: SiteLocale = "pl";

/**
 * Where one proposal stands. `DRAFT` and `PROPOSED` are open and editable in
 * place; the desk only ever writes `PROPOSED`, because a draft is invisible to
 * the digest and an editor who cannot see that distinction would have written
 * into a drawer.
 */
export type CopyProposalStatus = "DRAFT" | "PROPOSED" | "ACCEPTED" | "REJECTED";

export interface CopyDeskProposal {
  readonly id: string;
  readonly value: string;
  readonly status: CopyProposalStatus;
  readonly comment: string;
  readonly author_id: number | null;
  readonly author_name: string;
  readonly is_mine: boolean;
  /** A translation whose Polish has moved since this proposal was written. */
  readonly is_stale: boolean;
  readonly source_known: boolean;
  readonly updated_at: string;
  readonly reviewed_at: string | null;
  readonly applied_at: string | null;
}

/**
 * One editable field of one page, in one language — the unit everything on the
 * desk is built from.
 *
 * `value` is what the repository holds today (what the site is serving), NOT
 * what the reader has proposed: a proposal lives in `proposals`, and the desk
 * shows the two together precisely so an editor can see what they are changing
 * from. `source_value` is the Polish this row renders, carried per segment so
 * the source is on screen without a second request.
 */
export interface CopyDeskSegment {
  readonly id: string;
  readonly key: string;
  readonly locale: SiteLocale;
  readonly kind: "TEXT" | "HTML";
  readonly scope: string;
  readonly scope_label: string;
  readonly label: string;
  readonly order: number;
  readonly value: string;
  readonly source_value: string;
  readonly is_stale: boolean;
  readonly source_known: boolean;
  readonly is_new: boolean;
  readonly proposals: readonly CopyDeskProposal[];
}

/** `GET /api/copydesk/segments/?scope=…` — one page, in the site's reading order. */
export interface CopyDeskSegments {
  readonly segments: readonly CopyDeskSegment[];
}

/**
 * `POST /api/copydesk/proposals/` — the autosave.
 *
 * `comment` travels on every call because the server replaces it: sending the
 * value alone would silently erase the note the editor left beside it.
 */
export interface CopyDeskProposalWrite {
  readonly segment_id: string;
  readonly value: string;
  readonly comment: string;
}

export interface CopyDeskProposalWritten {
  readonly id: string;
  readonly status: CopyProposalStatus;
}

/**
 * `POST /api/copydesk/notify/` — "I have finished", which raises the digest the
 * clock would otherwise raise thirty minutes after the last keystroke.
 *
 * `proposals` counts what was announced (zero when nothing has changed since the
 * last digest); `delivered` is false when the claim succeeded but there was no
 * active reviewer account to address it to — a distinction worth keeping,
 * because reporting that as "sent" would be a lie to whoever pressed it.
 */
export interface CopyDeskNotifyResult {
  readonly proposals: number;
  readonly delivered: boolean;
}
