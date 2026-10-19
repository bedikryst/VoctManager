/**
 * @file collection.dto.ts
 * @description Wire contracts for the collection desk at `/panel/redakcja/zbiorka`.
 * Mirrors `CollectionDeskView` in `backend/payments/views.py`. Every figure is
 * whole PLN; the public vault prints `total` against `goal ?? default_goal`.
 * @module features/copydesk/types/collection.dto
 */

/** The roads money reaches the collection by without passing the gateway. */
export type CollectionSource = "ZRZUTKA" | "BANK_TRANSFER" | "OTHER";

/**
 * One offline source's running total. A source nobody has saved yet arrives as
 * zeros with no `updated_at`.
 */
export interface CollectionTally {
  readonly source: CollectionSource;
  readonly amount: number;
  readonly donors: number;
  readonly updated_at: string | null;
  readonly updated_by_name: string | null;
}

/** A sum and the donors it came from. */
export interface CollectionFigure {
  readonly raised: number;
  readonly donors: number;
}

/** One line of the trail. `user_name` is null for the figure carried over from the site's old file. */
export interface CollectionRevision {
  readonly id: number;
  readonly source: CollectionSource;
  readonly amount: number;
  readonly donors: number;
  readonly user_name: string | null;
  readonly created_at: string;
}

/**
 * `GET|PATCH /api/payments/collection/`.
 *
 * `gateway` is the SETTLED online donations, computed by the server and never
 * typed; `total` is gateway plus every tally, the figure the site prints. `goal`
 * is null while nobody has set one, and the site then uses `default_goal`.
 */
export interface CollectionDesk {
  readonly tallies: readonly CollectionTally[];
  readonly gateway: CollectionFigure;
  readonly total: CollectionFigure;
  readonly goal: number | null;
  readonly default_goal: number;
  readonly show_rail: boolean;
  readonly revisions: readonly CollectionRevision[];
}

/** A tally as written: the source's whole running total, never a delta. */
export interface CollectionTallyWrite {
  readonly source: CollectionSource;
  readonly amount: number;
  readonly donors: number;
}

/**
 * A partial write. Only the keys present are written, and `tallies` carries
 * only the sources the editor changed, so a form opened before a colleague's
 * save does not put the colleague's figure back.
 */
export interface CollectionWrite {
  readonly tallies?: readonly CollectionTallyWrite[];
  readonly goal?: number | null;
  readonly show_rail?: boolean;
}
