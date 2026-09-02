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
