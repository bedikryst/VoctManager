/**
 * @file scoreBook.ts
 * @description Reading the concert binder as what it is: a re-typeset object.
 *
 * A page of the book is one edition's page, trimmed and re-centred onto A4.
 * Markings belong to the EDITION and are stored normalized against ITS page,
 * which is exactly what keeps one mark the same mark whether the singer opened
 * the piece on its own or found it in the binder. Everything here is the
 * arithmetic that lets a screen honour that: which edition page a book page
 * shows, where its rectangle sits, and which piece the reader is standing in.
 *
 * Pure, so the claims can be checked without a browser (`scoreBook.test.ts`) —
 * the failure this guards against draws perfectly and silently on the wrong
 * stave.
 * @module features/annotations/lib
 */

/** One page of the book — mirrors the server's `ScoreBookFrame`. */
export interface BookPageFrame {
  page: number;
  edition: string;
  src_page: number;
  /** `[left, top, width, height]` as fractions of the whole book page. */
  box: [number, number, number, number];
}

/** One programme item's stretch of the book — mirrors `ScoreBookItem`. */
export interface BookItem {
  id: string;
  order: number;
  title: string;
  composer: string;
  is_encore: boolean;
  first_page: number;
  last_page: number;
}

export interface ScoreBook {
  /** Book page (1-based) → what it shows. Front matter and cards are absent. */
  frames: ReadonlyMap<number, BookPageFrame>;
  /** `edition#sourcePage` → every book page that bound it, in binding order. */
  bindings: ReadonlyMap<string, readonly number[]>;
  items: readonly BookItem[];
}

export const EMPTY_SCORE_BOOK: ScoreBook = {
  frames: new Map(),
  bindings: new Map(),
  items: [],
};

const bindingKey = (edition: string, sourcePage: number): string =>
  `${edition}#${sourcePage}`;

export const buildScoreBook = (
  pages: readonly BookPageFrame[],
  items: readonly BookItem[],
): ScoreBook => {
  const bindings = new Map<string, number[]>();
  for (const frame of pages) {
    const key = bindingKey(frame.edition, frame.src_page);
    const bound = bindings.get(key);
    if (bound) bound.push(frame.page);
    else bindings.set(key, [frame.page]);
  }
  return {
    frames: new Map(pages.map((frame) => [frame.page, frame])),
    bindings,
    // The programme's own order, never the page order: an encore bound in the
    // middle of the book is still last in the concert.
    items: [...items].sort((a, b) => a.order - b.order),
  };
};

/**
 * The way back: a marking knows only its edition and the page it was drawn on,
 * so anything that offers to GO to a mark — the index, the "the conductor just
 * wrote this" notice — has to ask the book where that page ended up.
 *
 * One edition page can be bound twice (two programme items sharing a movement),
 * so the answer is the copy nearest to where the reader is standing; jumping
 * them across the whole binder to an identical page would be a worse answer
 * than not moving at all.
 */
export const bookPageFor = (
  book: ScoreBook,
  edition: string,
  sourcePage: number,
  near = 1,
): number | null => {
  const bound = book.bindings.get(bindingKey(edition, sourcePage));
  if (!bound || bound.length === 0) return null;
  return bound.reduce((best, page) =>
    Math.abs(page - near) < Math.abs(best - near) ? page : best,
  );
};

/**
 * Which piece the reader is standing in. Spans are contiguous and ordered by
 * binding, but a page can fall between two of them (front matter, a duplex
 * blank), and that is an honest "nowhere in particular" rather than a guess.
 */
export const itemAtPage = (
  book: ScoreBook,
  page: number,
): BookItem | null =>
  book.items.find(
    (item) => page >= item.first_page && page <= item.last_page,
  ) ?? null;

/**
 * The page to open for the next / previous PIECE — which is not the next page
 * and not always the next entry in the programme either.
 *
 * Two rules earn their place here. Going forward from anywhere before the first
 * piece (the title page, the table of contents) opens the first piece rather
 * than refusing. Going back from the middle of a piece returns to ITS OWN
 * opening first, the way a thumb does in a paper binder — only a reader already
 * standing on a piece's first page is asking for the one before it.
 */
export const pieceJumpTarget = (
  book: ScoreBook,
  page: number,
  delta: 1 | -1,
): number | null => {
  const items = book.items;
  if (items.length === 0) return null;

  // Binding order, because "the next piece" is the next one you reach by
  // turning pages — not the next number in a programme whose encore may have
  // been bound elsewhere.
  const bound = [...items].sort((a, b) => a.first_page - b.first_page);
  if (delta === 1) {
    const next = bound.find((item) => item.first_page > page);
    return next?.first_page ?? null;
  }
  const current = bound.filter((item) => item.first_page <= page).pop();
  if (!current) return null;
  if (current.first_page < page) return current.first_page;
  const index = bound.indexOf(current);
  return index > 0 ? bound[index - 1].first_page : null;
};
