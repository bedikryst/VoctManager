/**
 * @file planText.ts
 * @description A plan typed as text, read as plan rows. Conductors write the
 * evening as a numbered list in the rehearsal's topic field, because a line
 * of text costs nothing; "Wpisz listą" takes the same lines and lays them out
 * as rows, so the plan costs no more than the text did.
 *
 * Each line is read the same way:
 * - leading numbering ("1.", "2)", a bullet) is dropped;
 * - a clock ("18:30", "8:59", the French "18h30", or "18.30" opening the
 *   line) becomes the row's anchor, and a range ("18:30–18:45") gives the
 *   minutes too;
 * - "10'", "10 min" or "10 mn" becomes the minutes;
 * - "(…)" and anything after a spaced dash (" – …") become the note;
 * - "przerwa" (or "pauza", "pause", "break") makes the row a break;
 * - what is left is the title, matched to the programme with diacritics and
 *   case folded: exactly, else as the one piece whose title starts with the
 *   typed words, holds them, or opens them — words typed past a matched
 *   title ("Lark z Radu") go to the note, so nothing typed is lost.
 *   Anything unmatched becomes a free row under the typed title.
 *
 * The clock is kept as typed: an "8:59" is the conductor's habit, not a typo.
 * Pure: the editor previews what this returns before anything is inserted.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/lib/planText
 */

import { foldDiacritics } from "@/shared/lib/text";

/** One programme piece, as titles are matched against it. */
export interface PlanTextPiece {
  readonly id: string;
  readonly title: string;
}

/** One typed line read as a plan row. */
export interface PlanTextRow {
  /** The programme piece the title matched; null for a free row or a break. */
  readonly piece: string | null;
  /** What the row reads as: the programme's title when matched, else the label. */
  readonly title: string;
  /** The typed title, under which a free row or a break is saved. */
  readonly label: string;
  readonly note: string;
  /** An anchor as "HH:MM"; null when the line names no clock. */
  readonly startsAt: string | null;
  readonly minutes: number | null;
  readonly isBreak: boolean;
}

/** One non-empty line and what it became; `row` is null when no title was left. */
export interface PlanTextLine {
  readonly source: string;
  readonly row: PlanTextRow | null;
}

/** The server's field lengths, so a long line is cut rather than refused whole. */
const LABEL_MAX = 120;
const NOTE_MAX = 200;

const NUMBERING = /^(?:\d{1,2}[.)]\s*(?=\D)|[-–—•*·]\s+)/u;
// No lookbehind in these: a Safari before 16.4 refuses the whole module over one.
/** A clock written "18:30" or the French "18h30" anywhere, optionally a range. */
const COLON_CLOCK =
  /(^|[^\d:.])([01]?\d|2[0-3])[:hH]([0-5]\d)(?:\s*[-–—]\s*([01]?\d|2[0-3])[:.hH]([0-5]\d))?(?!\d|[:.]\d)/u;
/** A dotted clock only where it opens the line: mid-line, "1.15" is a bar or a movement. */
const LEADING_DOT_CLOCK =
  /^()([01]?\d|2[0-3])\.([0-5]\d)(?:\s*[-–—]\s*([01]?\d|2[0-3])[:.hH]([0-5]\d))?(?!\d|[:.]\d)/u;
const MINUTES = /(^|[\s(])(\d{1,3})\s*(?:['’′]|min\.?(?!\p{L})|mn\.?(?!\p{L})|minut\p{L}*)/iu;
const PARENTHESES = /\(([^()]*)\)/gu;
const SPACED_DASH = /\s[-–—]\s/u;
const EDGE_PUNCTUATION = /^[\s\-–—:,;/|.]+|[\s\-–—:,;/|]+$/gu;
const BREAK_WORDS = /^(?:przerwa|pauza|pause|break)(?:\s|$)/u;
const WORD = /[\p{L}\p{N}]+/gu;

/** Words only: diacritics and case folded, punctuation as spaces. */
const matchKey = (value: string): string =>
  foldDiacritics(value)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const wordCount = (key: string): number => (key === "" ? 0 : key.split(" ").length);

/** `value` with `match` cut out, keeping the character the pattern consumed before it. */
const cut = (value: string, match: RegExpExecArray, lead: string): string =>
  `${value.slice(0, match.index + lead.length)} ${value.slice(match.index + match[0].length)}`;

/** Minutes from one wall clock to a later one on the same day; null otherwise. */
const spanOf = (fromH: string, fromM: string, toH: string, toM: string): number | null => {
  const span = Number(toH) * 60 + Number(toM) - (Number(fromH) * 60 + Number(fromM));
  return span > 0 ? span : null;
};

interface ClockHit {
  readonly startsAt: string;
  readonly span: number | null;
  readonly rest: string;
}

const takeClock = (line: string): ClockHit | null => {
  const match = LEADING_DOT_CLOCK.exec(line) ?? COLON_CLOCK.exec(line);
  if (!match) return null;
  const [, lead = "", hours = "", minutes = "", toHours, toMinutes] = match;
  return {
    startsAt: `${hours.padStart(2, "0")}:${minutes}`,
    span:
      toHours !== undefined && toMinutes !== undefined
        ? spanOf(hours, minutes, toHours, toMinutes)
        : null,
    rest: cut(line, match, lead),
  };
};

interface PieceHit {
  readonly piece: PlanTextPiece;
  /** Typed words past the programme's title, kept for the note. */
  readonly rest: string;
}

/**
 * The piece a typed title names. An ambiguous title matches nothing — a free
 * row is easier to fix than a wrong piece.
 */
const matchPiece = (title: string, program: readonly PlanTextPiece[]): PieceHit | null => {
  const typed = matchKey(title);
  if (typed === "") return null;
  const keyed = program
    .map((piece) => ({ piece, key: matchKey(piece.title) }))
    .filter((entry) => entry.key !== "");

  const exact = keyed.find((entry) => entry.key === typed);
  if (exact) return { piece: exact.piece, rest: "" };
  if (typed.length < 3) return null;

  const only = <T>(candidates: readonly T[]): T | null =>
    candidates.length === 1 ? (candidates[0] ?? null) : null;

  // "Laudes" for "Laudes creaturarum", or "Wonderful World" inside "What a
  // Wonderful World": the typed words are the title, abbreviated.
  const abbreviated = keyed.filter((entry) => ` ${entry.key} `.includes(` ${typed} `));
  if (abbreviated.length > 0) {
    const hit = only(abbreviated);
    return hit ? { piece: hit.piece, rest: "" } : null;
  }

  // "Lark z Radu" for "Lark": the title, then words of the conductor's own.
  const opened = only(keyed.filter((entry) => typed.startsWith(`${entry.key} `)));
  if (!opened) return null;
  const words = [...title.matchAll(WORD)];
  const last = words[wordCount(opened.key) - 1];
  const rest =
    last?.index === undefined
      ? ""
      : title.slice(last.index + last[0].length).replace(EDGE_PUNCTUATION, "");
  return { piece: opened.piece, rest };
};

/** The typed title with its first letter raised, as a label is written. */
const asLabel = (title: string): string =>
  `${title.charAt(0).toUpperCase()}${title.slice(1)}`.slice(0, LABEL_MAX);

/** One line read as a row; null when nothing is left to name it by. */
export const parsePlanLine = (
  source: string,
  program: readonly PlanTextPiece[],
): PlanTextRow | null => {
  let line = source.trim().replace(NUMBERING, "").trim();

  const clock = takeClock(line);
  if (clock) line = clock.rest;

  let minutes: number | null = null;
  const minutesMatch = MINUTES.exec(line);
  if (minutesMatch) {
    const value = Number(minutesMatch[2]);
    if (value > 0) minutes = value;
    line = cut(line, minutesMatch, minutesMatch[1] ?? "");
  }
  minutes ??= clock?.span ?? null;

  const bracketed: string[] = [];
  line = line.replace(PARENTHESES, (_whole, inner: string) => {
    if (inner.trim()) bracketed.push(inner.trim());
    return " ";
  });
  line = line.replace(/\s+/gu, " ").replace(EDGE_PUNCTUATION, "");

  const notes: string[] = [];
  const dash = SPACED_DASH.exec(line);
  if (dash) {
    const tail = line.slice(dash.index + dash[0].length).replace(EDGE_PUNCTUATION, "");
    line = line.slice(0, dash.index).replace(EDGE_PUNCTUATION, "");
    if (tail) notes.push(tail);
  }

  const title = line.trim();
  if (!title) return null;

  const isBreak = BREAK_WORDS.test(matchKey(title));
  const hit = isBreak ? null : matchPiece(title, program);
  const label = asLabel(title);
  return {
    piece: hit?.piece.id ?? null,
    title: hit?.piece.title ?? label,
    label,
    note: [hit?.rest ?? "", ...notes, ...bracketed]
      .filter((part) => part !== "")
      .join(", ")
      .slice(0, NOTE_MAX),
    startsAt: clock?.startsAt ?? null,
    minutes,
    isBreak,
  };
};

/** Every non-empty line of `text`, in order, with what it became. */
export const parsePlanText = (
  text: string,
  program: readonly PlanTextPiece[],
): PlanTextLine[] =>
  text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((source) => ({ source, row: parsePlanLine(source, program) }));

/** "1. Lark 2. Laudes" and "1. Lark / 2. Laudes": a numbered list kept on one line. */
const INLINE_ITEM_BREAK = /\s*[/;,|]?\s+(?=\d{1,2}[.)]\s)/u;

/**
 * A rehearsal topic that is really a plan, as lines to read: two lines or
 * more, or one line holding a list numbered from 1. Null for a topic that is
 * a headline ("Antegenerale", "LARK (całość) z Radu").
 */
export const planTextOfFocus = (focus: string): string | null => {
  const lines = focus
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== "");
  if (lines.length >= 2) return lines.join("\n");
  const only = lines[0];
  if (!only || !/^1[.)]\s/u.test(only)) return null;
  const items = only
    .split(INLINE_ITEM_BREAK)
    .map((item) => item.trim())
    .filter((item) => item !== "");
  return items.length >= 2 ? items.join("\n") : null;
};
