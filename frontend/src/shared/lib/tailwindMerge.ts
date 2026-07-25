/**
 * @file tailwindMerge.ts
 * @description tailwind-merge taught the Ethereal theme, so `cn()` can tell a
 * custom design token apart from a colour.
 * @module shared/lib
 */

import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge ships knowing stock Tailwind only. Every token this project
 * adds in `app/styles/panel.css` is, to it, an unrecognised value — and an
 * unrecognised `text-*` / `bg-*` / `shadow-*` value falls through to the COLOUR
 * group, where the next real colour deletes it. `text-overline` sitting beside
 * `text-ethereal-incense/60` is not a conflict, but it was resolved as one, and
 * every overline in the panel silently lost its font-size and inherited 16px.
 *
 * So this ledger is not optional bookkeeping: a token that exists in `@theme`
 * but is missing here is a token that can be erased at runtime with no error,
 * no warning, and nothing to see in the built CSS. Add tokens in both places or
 * in neither.
 *
 * The two failure modes it prevents:
 *  - DELETION — a custom value read as a colour and dropped (`text-overline`,
 *    `bg-noise`).
 *  - NON-RESOLUTION — a custom value read as nothing at all, so it never
 *    conflicts with its stock counterpart and both survive (`rounded-nested`
 *    against a caller's `rounded-xl`), leaving CSS source order to decide.
 */
export const etherealTwMerge = extendTailwindMerge({
  extend: {
    // Namespaces Tailwind v4 derives utilities from; the keys mirror the
    // `--<namespace>-*` prefixes declared in panel.css.
    theme: {
      // --text-* → the uppercase overline role. The one that was being deleted.
      text: ["overline", "overline-sm"],
      // --radius-* → the four-step scale.
      radius: ["surface", "nested", "control", "chip"],
      // --shadow-* → glass elevation and the primary button's lighting.
      shadow: [
        "glass-ethereal",
        "glass-ethereal-hover",
        "glass-solid",
        "glass-outline-hover",
        "button-primary",
        "button-primary-hover",
      ],
      // --blur-* → the shared backdrop radius (blur-* and backdrop-blur-*).
      blur: ["ethereal"],
      // --spacing-* → sizing utilities (w-sidebar, h-sheet-expanded, …).
      spacing: ["sheet-expanded", "sidebar"],
    },

    // Hand-written `@utility` classes. These have no theme namespace to be
    // derived from, so each is named into the group it belongs to.
    classGroups: {
      // A background IMAGE. Left in the colour group it and the surface's
      // background-colour would eat each other, in whichever order they met.
      "bg-image": ["bg-noise"],
      z: [{ z: ["nav-dock", "nav-sheet", "focus-trap", "toast"] }],
      // Nav-dock clearance: a real padding-bottom / bottom offset, and must
      // therefore be overridable by (and override) a stock one.
      pb: [{ pb: ["nav-dock"] }],
      bottom: [{ bottom: ["dock"] }],
      animate: ["ethereal-breath"],
    },
  },
});
