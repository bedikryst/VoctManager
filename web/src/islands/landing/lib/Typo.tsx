/**
 * @file Typo.tsx
 * @description Micro-typography for React islands: `<Typo>` walks its own JSX and runs every
 *  string leaf through the locale's pass (lib/typo.ts). Wrap an island's root once and its whole
 *  subtree gets the orphan, abbreviation and dash rules — including copy that arrives as a prop
 *  or a formatted amount.
 *
 *  It exists because the build-time HTML pass (lib/typoHtml.ts) deliberately skips island markup:
 *  rewriting text React is about to hydrate is a hydration mismatch, and React answers one by
 *  throwing the server HTML away and re-rendering — which would erase the fix a moment after it
 *  appeared. Running the same rules INSIDE the render makes both passes produce the same string,
 *  so the server markup and the client render agree.
 *
 *  Recursion stops at a custom component: `<Typo>` sees `<GiveForm />` as one opaque node, never
 *  its output. Each island component that carries prose therefore wraps its OWN root — the build
 *  warns (voct:typography) with the exact spot if one is missed.
 *
 *  Only children are touched. Attribute strings (`aria-label`, `title`, `placeholder`) are left
 *  alone: nothing wraps them onto a second line, so a pinned space there would buy nothing.
 * @architecture Astro islands 2026
 * @module islands/landing/lib/Typo
 */

import { Children, cloneElement, Fragment, isValidElement, type ReactNode } from "react";

import { DEFAULT_LOCALE, type Locale } from "../../../i18n/config";
import { INLINE_ELEMENTS, typoFor } from "../../../lib/typo";

/** Elements whose text is code or preformatted — their spacing is content, not typesetting. */
const VERBATIM = new Set(["code", "pre", "kbd", "samp", "script", "style", "textarea"]);

/**
 * A pinned subtree and the last character it renders. The tail travels to the next sibling as its
 * left context, which is what lets a rule bind across a tag: in
 * `<strong>… 2026</strong> — Uzupełniono` the dash is a different string leaf than the word that
 * has to hold it. It is dropped at a block boundary and at a component, whose output is unknown
 * from here.
 */
interface Pinned {
  readonly node: ReactNode;
  readonly tail: string;
}

/**
 * Rebuild `node` with every string leaf pinned, reading `context` as the character before it.
 * Returns the node itself when nothing changed, so an untouched subtree keeps its identity and
 * React has nothing to reconcile.
 */
function pin(node: ReactNode, pass: (text: string) => string, context: string): Pinned {
  if (typeof node === "string") {
    if (node === "") return { node, tail: context };
    // Every rule re-emits its left context unchanged, so the borrowed character slices back off.
    const pinned = pass(context + node).slice(context.length);
    return { node: pinned, tail: pinned.slice(-1) };
  }
  if (typeof node === "number") return { node, tail: String(node).slice(-1) };
  // Renders nothing at all — the context carries straight through it.
  if (node == null || typeof node === "boolean") return { node, tail: context };

  if (Array.isArray(node)) {
    let changed = false;
    let tail = context;
    // `Children.map`, not `Array.map`: a plain array rebuilt here is a dynamic list to React, and
    // its items — static JSX siblings that never needed keys — would each raise the missing-key
    // warning. Children.map assigns the positional keys itself, identically on server and client.
    const next = Children.map(node, (child: ReactNode) => {
      const pinned = pin(child, pass, tail);
      tail = pinned.tail;
      if (pinned.node !== child) changed = true;
      return pinned.node;
    });
    // Untouched children keep their original array — same identity, nothing for React to redo.
    return { node: changed ? next : node, tail };
  }

  if (!isValidElement(node)) return { node, tail: "" };
  // A component renders its own text — that is its own `<Typo>` to place, not ours to reach into.
  if (typeof node.type !== "string" && node.type !== Fragment) return { node, tail: "" };
  if (typeof node.type === "string" && VERBATIM.has(node.type)) return { node, tail: "" };

  const inline = node.type === Fragment || INLINE_ELEMENTS.has(node.type as string);
  const children = (node.props as { children?: ReactNode }).children;
  if (children === undefined) return { node, tail: "" };

  const pinned = pin(children, pass, inline ? context : "");
  return {
    node: pinned.node === children ? node : cloneElement(node, undefined, pinned.node),
    tail: inline ? pinned.tail : "",
  };
}

/**
 * Apply `locale`'s micro-typography to every string in this subtree. Defaults to Polish: island
 * copy is Polish on every page of the site, including the translated ones, where the vault and
 * the player are still the Polish originals.
 */
export function Typo({
  children,
  locale = DEFAULT_LOCALE,
}: {
  children: ReactNode;
  locale?: Locale;
}) {
  return <>{pin(children, typoFor(locale), "").node}</>;
}
