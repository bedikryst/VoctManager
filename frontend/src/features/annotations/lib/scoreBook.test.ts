/**
 * @file scoreBook.test.ts
 * @description Pins the two things the binder's navigation has to get right and
 * that no type can catch: that "the next piece" follows the BINDING (an encore
 * bound early is reached early, whatever its number in the programme), and that
 * going back from the middle of a piece returns to that piece's own opening
 * first — the way a thumb does in a paper binder — instead of skipping to the
 * one before it.
 * @module features/annotations/lib/scoreBook.test
 * @architecture Enterprise SaaS 2026
 */

import { describe, expect, it } from "vitest";

import {
  bookPageFor,
  buildScoreBook,
  itemAtPage,
  pieceJumpTarget,
  type BookItem,
  type BookPageFrame,
} from "./scoreBook";

const item = (
  id: string,
  order: number,
  first: number,
  last: number,
  overrides: Partial<BookItem> = {},
): BookItem => ({
  id,
  order,
  title: id,
  composer: "",
  is_encore: false,
  first_page: first,
  last_page: last,
  ...overrides,
});

const frame = (page: number, edition: string, srcPage: number): BookPageFrame => ({
  page,
  edition,
  src_page: srcPage,
  box: [0.02, 0.02, 0.96, 0.95],
});

// Front matter on page 1, then three pieces; the encore is bound second but
// sings last.
const book = buildScoreBook(
  [frame(2, "E1", 1), frame(3, "E1", 2), frame(5, "E2", 1), frame(7, "E3", 4)],
  [
    item("kyrie", 1, 2, 3),
    item("bis", 3, 4, 5, { is_encore: true }),
    item("gloria", 2, 6, 8),
  ],
);

describe("buildScoreBook", () => {
  it("indexes pages by what the reader counts, keeping the programme's order", () => {
    expect(book.frames.get(3)).toEqual(frame(3, "E1", 2));
    // Page 1 is the title page: it shows no edition, so nothing may be drawn on it.
    expect(book.frames.get(1)).toBeUndefined();
    expect(book.items.map((i) => i.id)).toEqual(["kyrie", "gloria", "bis"]);
  });
});

describe("itemAtPage", () => {
  it("covers a piece's opening card, not only its music", () => {
    // Page 4 carries the encore's divider card — it has no frame, but the
    // reader is unambiguously standing in that piece.
    expect(itemAtPage(book, 4)?.id).toBe("bis");
    expect(itemAtPage(book, 7)?.id).toBe("gloria");
  });

  it("says nowhere rather than guessing on front matter", () => {
    expect(itemAtPage(book, 1)).toBeNull();
  });
});

describe("bookPageFor", () => {
  it("finds the book page an edition page was bound to", () => {
    expect(bookPageFor(book, "E1", 2)).toBe(3);
    expect(bookPageFor(book, "E3", 4)).toBe(7);
  });

  it("says nothing for a page the binder trimmed away", () => {
    expect(bookPageFor(book, "E1", 9)).toBeNull();
  });

  it("picks the copy nearest the reader when a page is bound twice", () => {
    const twice = buildScoreBook(
      [frame(2, "E1", 1), frame(9, "E1", 1)],
      [item("a", 1, 2, 2), item("b", 2, 9, 9)],
    );
    expect(bookPageFor(twice, "E1", 1, 8)).toBe(9);
    expect(bookPageFor(twice, "E1", 1, 3)).toBe(2);
  });
});

describe("pieceJumpTarget", () => {
  it("follows the binding, so the encore bound second is reached second", () => {
    expect(pieceJumpTarget(book, 2, 1)).toBe(4);
    expect(pieceJumpTarget(book, 4, 1)).toBe(6);
  });

  it("opens the first piece from the front matter instead of refusing", () => {
    expect(pieceJumpTarget(book, 1, 1)).toBe(2);
  });

  it("goes back to the piece in hand before the one before it", () => {
    expect(pieceJumpTarget(book, 3, -1)).toBe(2); // mid-piece → its own start
    expect(pieceJumpTarget(book, 2, -1)).toBeNull(); // already at the first
    expect(pieceJumpTarget(book, 6, -1)).toBe(4);
  });

  it("has nowhere to go past the last piece", () => {
    expect(pieceJumpTarget(book, 8, 1)).toBeNull();
  });

  it("is silent on a book with no programme at all", () => {
    const bare = buildScoreBook([], []);
    expect(pieceJumpTarget(bare, 1, 1)).toBeNull();
    expect(pieceJumpTarget(bare, 1, -1)).toBeNull();
  });
});
