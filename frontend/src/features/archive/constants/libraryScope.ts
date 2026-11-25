/**
 * @file libraryScope.ts
 * @description The library's search and filters as URL state, and the list
 * they make. The library mirrors its filters into its query string. A piece
 * card opened from it carries the same string plus `from`, naming the list the
 * manager walks from there: `library` for the rows the filters showed, `review`
 * for the review queue. The card's way back lands on the filtered list again
 * rather than on the whole library.
 *
 * Both screens filter through `matchesLibraryFilters`. A second copy of the
 * predicate is how a card's "4 z 17" stops matching the rows the library showed.
 * That includes the quick filter (`only`), so a card opened from the library
 * narrowed to "do przeglądu" walks exactly the pieces awaiting review it listed.
 * @module features/archive/constants/libraryScope
 */

import { foldDiacritics } from "@/shared/lib/text";
import type { Piece } from "@/shared/types";

import { isAwaitingReview } from "../piece-card/reviewQueue";
import { hasPdf } from "./piecePdfs";

export const LIBRARY_PATH = "/panel/archive-management";

/**
 * `?nowy=1` arrives at the library with the new-piece dialog open: the way in
 * from `/new`, which `App.tsx` redirects here. It is read once, on arrival; the
 * library's filter sync then drops it from the URL, so a reload or a way back
 * does not reopen the dialog.
 */
export const NEW_PIECE_PARAM = "nowy";

/**
 * The library's quick filters: the exceptions a manager hunts for, one at a
 * time, each a chip in the toolbar that names its size.
 */
export type LibraryQuickFilter = "review" | "no_pdf";

const QUICK_FILTERS: Readonly<
  Record<LibraryQuickFilter, (piece: Pick<Piece, "editions">) => boolean>
> = {
  review: isAwaitingReview,
  no_pdf: (piece) => !hasPdf(piece),
};

export const matchesQuickFilter = (
  piece: Pick<Piece, "editions">,
  filter: LibraryQuickFilter,
): boolean => QUICK_FILTERS[filter](piece);

export interface LibraryFilters {
  readonly search: string;
  readonly epoch: string;
  readonly composer: string;
  readonly voicing: string;
  /** A quick filter, or "" for none. */
  readonly only: LibraryQuickFilter | "";
}

export const EMPTY_LIBRARY_FILTERS: LibraryFilters = {
  search: "",
  epoch: "",
  composer: "",
  voicing: "",
  only: "",
};

/**
 * The list a card steps through: the library's rows under its filters, or the
 * review queue, which is library-wide whatever the filters say.
 */
export type CardList = "library" | "review";

export interface CardScope {
  readonly list: CardList;
  /** The library's filters at the time, kept for the way back. */
  readonly filters: LibraryFilters;
}

const FILTER_KEYS = ["search", "epoch", "composer", "voicing", "only"] as const;

const PARAM: Readonly<Record<keyof LibraryFilters, string>> = {
  search: "q",
  epoch: "epoch",
  composer: "composer",
  voicing: "voicing",
  only: "only",
};

const readQuickFilter = (value: string | null): LibraryQuickFilter | "" =>
  value === "review" || value === "no_pdf" ? value : "";

/** Names the list a card URL steps through. */
const FROM_PARAM = "from";

const readList = (value: string | null): CardList | null =>
  value === "library" || value === "review" ? value : null;

export const filtersFromParams = (params: URLSearchParams): LibraryFilters => ({
  search: params.get(PARAM.search) ?? "",
  epoch: params.get(PARAM.epoch) ?? "",
  composer: params.get(PARAM.composer) ?? "",
  voicing: params.get(PARAM.voicing) ?? "",
  only: readQuickFilter(params.get(PARAM.only)),
});

/** Only the filters in use, so an unfiltered library keeps a bare URL. */
export const filtersToParams = (filters: LibraryFilters): URLSearchParams => {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = filters[key].trim();
    if (value) params.set(PARAM[key], value);
  }
  return params;
};

const withQuery = (path: string, params: URLSearchParams): string => {
  const query = params.toString();
  return query ? `${path}?${query}` : path;
};

/** The library, showing the list these filters make. */
export const libraryPath = (filters: LibraryFilters | null): string =>
  withQuery(LIBRARY_PATH, filters ? filtersToParams(filters) : new URLSearchParams());

/**
 * A piece's card. Given a scope, the card steps through that list and its way
 * back returns to the library under those filters; without one it stands alone.
 */
export const pieceCardPath = (
  pieceId: string | number,
  scope: CardScope | null,
): string => {
  const path = `${LIBRARY_PATH}/${pieceId}`;
  if (!scope) return path;
  const params = filtersToParams(scope.filters);
  params.set(FROM_PARAM, scope.list);
  return withQuery(path, params);
};

/** The scope a card URL carries, or null when it was opened from elsewhere. */
export const readCardScope = (params: URLSearchParams): CardScope | null => {
  const list = readList(params.get(FROM_PARAM));
  return list ? { list, filters: filtersFromParams(params) } : null;
};

/** History state the card's way back leaves, naming the piece it came from. */
export const libraryReturnState = (pieceId: string | number): { readonly fromPiece: string } => ({
  fromPiece: String(pieceId),
});

export const readReturnedPiece = (state: unknown): string | null =>
  typeof state === "object" &&
  state !== null &&
  "fromPiece" in state &&
  typeof state.fromPiece === "string"
    ? state.fromPiece
    : null;

type FilterablePiece = Pick<Piece, "title" | "composer" | "epoch" | "voicing" | "editions">;

export const matchesLibraryFilters = (
  piece: FilterablePiece,
  filters: LibraryFilters,
): boolean => {
  // Folded, not merely lowercased: this library is Polish, so "gorecki" has to
  // find Górecki and "lukaszewski" Łukaszewski.
  const term = foldDiacritics(filters.search.trim());
  if (term) {
    const composer = piece.composer
      ? foldDiacritics(`${piece.composer.first_name ?? ""} ${piece.composer.last_name}`.trim())
      : "";
    if (!foldDiacritics(piece.title).includes(term) && !composer.includes(term)) return false;
  }
  if (filters.epoch && piece.epoch !== filters.epoch) return false;
  if (filters.composer && piece.composer?.id !== filters.composer) return false;
  if (filters.voicing && piece.voicing !== filters.voicing) return false;
  if (filters.only && !matchesQuickFilter(piece, filters.only)) return false;
  return true;
};
