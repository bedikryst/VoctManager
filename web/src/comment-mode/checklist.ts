/**
 * @file checklist.ts
 * @description What the server reads in a field before it accepts a trusted translator's save
 *  (`backend/copydesk/trust.py`), read the same way in the browser: which fields open the markup
 *  editor, which brace pairs are slots, the checklist that mirrors `hold_reason`, the emphasis hint
 *  beside it, the link targets the editor offers, and the decided Polish they are all read against.
 *
 *  STRINGS ONLY, NO PROSEMIRROR. The sheet imports this module up front, and the textarea fallback
 *  needs the checklist as much as the rich field does, so it reads the serialized value. ProseMirror
 *  stays in `markup.ts`, in the chunk the mode loads on its own.
 *
 *  THE SERVER'S ORDER. The items come in the order `hold_reason` tests them, so the first unticked
 *  one names the reason a held save comes back with. A mirror that drifts from `trust.py` tells the
 *  editor a save will pass when it will not: change both or neither.
 *
 *  Plain erasable TypeScript importing only `.ts` modules by their full name, so bare `node` runs
 *  it for the tests.
 * @module comment-mode/checklist
 */

import type { DeskSegment, HoldReason } from "./api";
import { decodeEntities, PLACEHOLDER } from "./match.ts";

/** Any pair of braces, as `_BRACES` in `trust.py` finds them: innermost, never nested. */
export const BRACE_PAIR = /\{[^{}]*\}/u;

const BRACE_PAIRS = new RegExp(BRACE_PAIR.source, "gu");
const SLOT = new RegExp(`^${PLACEHOLDER.source}$`, "u");

/** Every brace pair of a value, whole (`{name}`), in order. */
function braceGroups(value: string): string[] {
  return [...value.matchAll(BRACE_PAIRS)].map((match) => match[0]);
}

/**
 * Which fields the markup editor opens: every `HTML` field, markup or not (emphasis can be added to
 * any), and every `TEXT` field whose value or Polish has braces. A plain `TEXT` field keeps the
 * textarea. `polish` is the Polish beside the field, so a translation that lost its slot still
 * opens where the slot can be put back.
 */
export function opensMarkupEditor(field: { readonly kind: string; readonly value: string; readonly polish: string }): boolean {
  return field.kind === "HTML" || BRACE_PAIR.test(field.value) || BRACE_PAIR.test(field.polish);
}

/** What the markup editor may hold in one field, read off the Polish beside it. */
export interface FieldMarkup {
  /** An `HTML` field: emphasis and links. A `TEXT` field holds text, slots and the braces link. */
  readonly html: boolean;
  /**
   * The Polish's slots, whole (`{name}`). A pair of braces is a slot only where the Polish uses
   * that name as one: elsewhere it is text, or the braces link.
   */
  readonly slots: ReadonlySet<string>;
  /**
   * A `TEXT` field whose Polish marks its link with braces around words (`page.press.contact.list`:
   * `{Zostaw kontakt}`). Those words are translated, so only the number of pairs is checked.
   */
  readonly braceLink: boolean;
}

/** The slots of a Polish value: its brace pairs shaped like an identifier. */
export function slotsOf(polish: string): ReadonlySet<string> {
  return new Set(braceGroups(polish).filter((group) => SLOT.test(group)));
}

export function fieldMarkup(kind: string, polish: string): FieldMarkup {
  const slots = slotsOf(polish);
  const html = kind === "HTML";
  return {
    html,
    slots,
    braceLink: !html && braceGroups(polish).some((group) => !slots.has(group)),
  };
}

/** `_braces`: which of the Polish `slots` a value uses, and how many other pairs it carries. */
function bracesOf(value: string, slots: ReadonlySet<string>): { readonly used: ReadonlySet<string>; readonly others: number } {
  const groups = braceGroups(value);
  return {
    used: new Set(groups.filter((group) => slots.has(group))),
    others: groups.filter((group) => !slots.has(group)).length,
  };
}

const LINK_TAG = /<a(?=[\s/>])([^>]*)>/giu;
const LINK_RUN = /<a(?=[\s/>])([^>]*)>([\s\S]*?)<\/a\s*>/giu;
const ATTRIBUTE = /([^\s/>"'=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/gu;

/** Every `href` of one opening tag's attributes, unescaped and trimmed as `_LinkCollector` reads them. */
function hrefsOf(attributes: string): string[] {
  const hrefs: string[] = [];
  for (const attribute of attributes.matchAll(ATTRIBUTE)) {
    const raw = attribute[2] ?? attribute[3] ?? attribute[4];
    if (attribute[1]?.toLowerCase() === "href" && raw !== undefined) hrefs.push(decodeEntities(raw).trim());
  }
  return hrefs;
}

/**
 * Every `href` on an `<a>`. In the order of first use, so the checklist lists them as the text
 * runs.
 */
export function linksOf(html: string): readonly string[] {
  const hrefs = new Set<string>();
  for (const tag of html.matchAll(LINK_TAG)) for (const href of hrefsOf(tag[1] ?? "")) hrefs.add(href);
  return [...hrefs];
}

/** A link target the markup editor offers, with the words it sits on where it was found. */
export interface LinkChoice {
  readonly href: string;
  readonly words: string;
}

/**
 * The link targets of `values`, the decided Polish first, each with its words: the only targets
 * the link control offers and a paste keeps. A target that sits on several phrases lists them all.
 */
export function linkChoices(...values: readonly string[]): readonly LinkChoice[] {
  const words = new Map<string, string[]>();
  for (const value of values) {
    for (const run of value.matchAll(LINK_RUN)) {
      const phrase = decodeEntities((run[2] ?? "").replace(/<[^>]*>/gu, "")).replace(/\s+/gu, " ").trim();
      for (const href of hrefsOf(run[1] ?? "")) {
        const phrases = words.get(href) ?? [];
        if (phrase !== "" && !phrases.includes(phrase)) phrases.push(phrase);
        words.set(href, phrases);
      }
    }
  }
  return [...words].map(([href, phrases]) => ({ href, words: phrases.join(" … ") }));
}

/** One line of the checklist under the field. `ok` is ticked. */
export type ChecklistItem =
  | { readonly kind: "filled"; readonly ok: boolean }
  /** A slot of the Polish, present at least once: the build fills every occurrence. */
  | { readonly kind: "slot"; readonly slot: string; readonly ok: boolean }
  /** Brace pairs that are not slots: as many as the Polish has. */
  | { readonly kind: "braces"; readonly expected: number; readonly actual: number; readonly ok: boolean }
  /** A link target of the Polish (`HTML` only). */
  | { readonly kind: "link"; readonly href: string; readonly ok: boolean }
  /** A link target the Polish does not have (`HTML` only): never ticked. */
  | { readonly kind: "extraLink"; readonly href: string; readonly ok: false };

const REASON: Readonly<Record<ChecklistItem["kind"], HoldReason>> = {
  filled: "empty",
  slot: "slots",
  braces: "slots",
  link: "links",
  extraLink: "links",
};

export interface ChecklistInput {
  /** The value as it will be saved: the serializer's output, or the textarea's text. */
  readonly value: string;
  /** The decided Polish (`decidedPolish`), which the server reads too. */
  readonly polish: string;
  readonly kind: string;
}

/**
 * The checklist for a value beside its Polish: not empty; every slot of the Polish; as many other
 * brace pairs as the Polish; in an `HTML` field the Polish's link targets and no others. An item
 * with nothing to check (no other braces on either side) is left out.
 */
export function checklist({ value, polish, kind }: ChecklistInput): readonly ChecklistItem[] {
  const items: ChecklistItem[] = [{ kind: "filled", ok: value.trim() !== "" }];

  const slots = slotsOf(polish);
  const mine = bracesOf(value, slots);
  const theirs = bracesOf(polish, slots);
  for (const slot of slots) items.push({ kind: "slot", slot, ok: mine.used.has(slot) });
  if (mine.others > 0 || theirs.others > 0) {
    items.push({ kind: "braces", expected: theirs.others, actual: mine.others, ok: mine.others === theirs.others });
  }

  if (kind === "HTML") {
    const links = linksOf(value);
    const expected = linksOf(polish);
    for (const href of expected) items.push({ kind: "link", href, ok: links.includes(href) });
    for (const href of links) if (!expected.includes(href)) items.push({ kind: "extraLink", href, ok: false });
  }
  return items;
}

/** Why the server would hold the value back: the first unticked item's reason, or `null`. */
export function holdReasonOf(items: readonly ChecklistItem[]): HoldReason | null {
  const first = items.find((item) => !item.ok);
  return first ? REASON[first.kind] : null;
}

/** `hold_reason` itself, for one value. */
export function holdReason(input: ChecklistInput): HoldReason | null {
  return holdReasonOf(checklist(input));
}

export interface EmphasisCount {
  readonly em: number;
  readonly strong: number;
}

const EM_TAG = /<em(?=[\s/>])/giu;
const STRONG_TAG = /<strong(?=[\s/>])/giu;

export function emphasisOf(html: string): EmphasisCount {
  return { em: [...html.matchAll(EM_TAG)].length, strong: [...html.matchAll(STRONG_TAG)].length };
}

/**
 * The emphasis hint: the value's `em` and `strong` against the Polish's. A hint only, never an
 * item: the server does not read emphasis, and a translation may move or drop it on purpose.
 */
export function emphasis(value: string, polish: string): { readonly value: EmphasisCount; readonly polish: EmphasisCount; readonly same: boolean } {
  const mine = emphasisOf(value);
  const theirs = emphasisOf(polish);
  return { value: mine, polish: theirs, same: mine.em === theirs.em && mine.strong === theirs.strong };
}

/**
 * The Polish a translation will be published beside, as `CopyDeskService._decided_polish` computes
 * it, from the Polish row of the history the sheet loads: its latest accepted proposal that
 * `copy:apply` has not written yet, else its value. An open Polish proposal is not counted, since it
 * may never ship. The history lists proposals newest first, which is the server's tie-break.
 */
export function decidedPolish(polish: Pick<DeskSegment, "value" | "proposals">): string {
  const reviewedAt = (at: string | null): number => (at === null ? 0 : Date.parse(at));
  const decided = polish.proposals
    .filter((proposal) => proposal.status === "ACCEPTED" && proposal.applied_at === null)
    .sort((a, b) => reviewedAt(b.reviewed_at) - reviewedAt(a.reviewed_at))[0];
  return decided ? decided.value : polish.value;
}
