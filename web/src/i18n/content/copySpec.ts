/**
 * @file copySpec.ts
 * @description The key contract for a STATIC PAGE's copy — the rule that turns a field of
 *  `src/content/pages/<page>.yaml` into the dotted key the copy desk addresses it by, and the walk
 *  that enumerates them in reading order.
 *
 *  IT EXISTS ONCE BECAUSE IT IS READ FROM BOTH ENDS. The page renders by looking a key up in the
 *  per-locale overlay (`lib/pageCopy`), and the desk's extractor emits that same key from the same
 *  YAML (`copydesk/`). Two implementations of one rule would diverge in silence: the overlay would
 *  hold a perfectly good translation under a key the page never asks for, and the page would go on
 *  printing Polish with nothing anywhere reporting an error. This module is therefore deliberately
 *  PURE — no Vite-only imports (`?raw`, `astro:*`, `import.meta.glob`), because Node imports it
 *  directly (type-stripping, no build step) when the extractor runs.
 *
 *  A LIST IS KEYED BY AN ID, NEVER BY POSITION. `concerts.yaml` keys most of its lists positionally
 *  and pays for it (spec §6d: inserting one work re-keys every work below it, and the desk loses
 *  their proposals). A page's lists are short and hand-written, so they carry an explicit `id`
 *  field that is not copy and the key uses that — inserting or reordering an entry re-keys nothing.
 *
 *  THE `Html` SUFFIX IS THE SEGMENT KIND. A field whose name ends in `Html` renders through
 *  `set:html` and is an `HTML` segment on the desk; everything else is `TEXT` and is edited as
 *  plain text with no markup path at all (spec §7 — `contenteditable` injects `<div>`/`<br>`/styled
 *  `<span>`, and the whitelist is what stops them). Deriving the kind from the name rather than
 *  declaring it per field means the two can never disagree, and it holds the authoring convention
 *  the content modules already state: `…Html` is authored with inline markup, everything else
 *  without.
 * @architecture Astro islands 2026
 * @module i18n/content/copySpec
 */

/** One translatable field of a list entry. `path` is dotted from the entry, and is also its key. */
export interface CopyField {
  readonly path: string;
  /** Appended to the list's own label, after a `·`, in what the editor reads. */
  readonly label: string;
  /** A constraint the translator has to know about this field. */
  readonly note?: string;
}

/** One line of a page's contract: a single field, or a list whose entries each carry several. */
export type CopyEntry =
  | { readonly kind: "field"; readonly path: string; readonly label: string; readonly note?: string }
  | {
      readonly kind: "list";
      readonly path: string;
      /** The entry field carrying a stable id. It must be declared in the page's `notCopy` table:
          a key part an editor is about to translate is not an identity. */
      readonly keyBy: string;
      readonly label: string;
      readonly fields: readonly CopyField[];
      readonly note?: string;
    };

/**
 * Everything a page's copy needs to be read, validated, keyed and extracted. `schema` is typed as
 * the narrowest thing this module needs of a zod schema, so that nothing here imports zod.
 */
export interface PageCopySpec<T> {
  /** Second part of every key on this page, and the basename of its YAML file. */
  readonly id: string;
  /** What the editor sees this page called on the desk. */
  readonly label: string;
  readonly schema: { parse(input: unknown): T };
  readonly contract: readonly CopyEntry[];
  /**
   * Every field of the YAML that is NOT copy, with the reason. Not documentation: the extractor's
   * suite walks the file and fails on a path that appears in neither table, so a field cannot enter
   * a page without somebody deciding whether it is text a reader is meant to read. Paths use `[]`
   * for a list (`channels.items[].email`).
   */
  readonly notCopy: Readonly<Record<string, string>>;
}

/** A translatable string found in a page's YAML, with everything the desk needs to show it. */
export interface CopyLeaf {
  /** The full dotted key, `page.<id>.<path>`. */
  readonly key: string;
  /** Where the string sits in the parsed document — what a writer addresses to replace it. */
  readonly at: readonly (string | number)[];
  readonly label: string;
  readonly kind: "TEXT" | "HTML";
  readonly value: string;
  /** Position in reading order; declaration order in the contract IS reading order. */
  readonly order: number;
}

/** The namespace every static page's key opens with; with `id` it forms the desk's scope. */
const NAMESPACE = "page";

/** The dotted key a page field is addressed by, on both sides of the desk. */
export function pageKey(id: string, path: string): string {
  return `${NAMESPACE}.${id}.${path}`;
}

/** `HTML` for a field authored with inline markup, `TEXT` for everything else. */
export function segmentKind(path: string): "TEXT" | "HTML" {
  return path.endsWith("Html") ? "HTML" : "TEXT";
}

/** Walk a dotted path, returning the value and the concrete place it was found. */
function resolve(
  root: unknown,
  path: string,
  base: readonly (string | number)[] = [],
): { value: unknown; at: (string | number)[] } {
  let node: unknown = root;
  const at = [...base];
  for (const part of path.split(".")) {
    if (node === null || typeof node !== "object") return { value: undefined, at };
    node = (node as Record<string, unknown>)[part];
    at.push(part);
  }
  return { value: node, at };
}

/**
 * Every translatable string of a parsed page, in reading order.
 *
 * A value that is present but is not a non-empty string is an error rather than an absence: the
 * schema has already validated the shape, so anything else here means the contract names a path
 * that is not copy. An OPTIONAL field that is simply absent is skipped — that is how a page carries
 * a section only some of its instances have.
 */
export function walkCopy<T>(spec: PageCopySpec<T>, data: T): CopyLeaf[] {
  const leaves: CopyLeaf[] = [];
  let order = 0;

  const push = (path: string, label: string, hit: { value: unknown; at: (string | number)[] }) => {
    if (hit.value === undefined || hit.value === null) return;
    if (typeof hit.value !== "string") {
      throw new Error(`[copy] ${pageKey(spec.id, path)}: a copy slot holds ${typeof hit.value}.`);
    }
    if (hit.value.length === 0) return;
    leaves.push({
      key: pageKey(spec.id, path),
      at: hit.at,
      label,
      kind: segmentKind(path),
      value: hit.value,
      order: order++,
    });
  };

  for (const entry of spec.contract) {
    if (entry.kind === "field") {
      push(entry.path, entry.label, resolve(data, entry.path));
      continue;
    }

    const list = resolve(data, entry.path);
    if (!Array.isArray(list.value)) continue;
    for (const [index, item] of list.value.entries()) {
      const id: unknown = (item as Record<string, unknown>)[entry.keyBy];
      if (typeof id !== "string" || id.length === 0) {
        throw new Error(
          `[copy] ${pageKey(spec.id, entry.path)}[${index}] has no \`${entry.keyBy}\` to key it by.`,
        );
      }
      for (const field of entry.fields) {
        push(
          `${entry.path}.${id}.${field.path}`,
          `${entry.label} · ${id} · ${field.label}`,
          resolve(item, field.path, [...list.at, index]),
        );
      }
    }
  }

  return leaves;
}
