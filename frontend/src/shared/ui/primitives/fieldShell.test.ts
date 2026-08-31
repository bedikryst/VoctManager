/**
 * @file fieldShell.test.ts
 * @description Proof that folding `Input` and `Textarea` onto `fieldShell` left
 * the rendered surface alone. Each primitive used to carry its own copy of the
 * recipe; those copies are frozen below and replayed through the very `cn()`
 * call the old components made, so the comparison is between two RESOLVED class
 * lists — tailwind-merge has already dropped the losers on both sides. Every
 * remaining difference has to be named in `DECIDED`, which is the point: a
 * change nobody declared fails here.
 *
 * The frozen block is evidence, not code under maintenance. It records what
 * shipped before 2026-07-26 and must never be "updated to match".
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/primitives/fieldShell.test
 */

import { describe, expect, it } from "vitest";

import { cn } from "@/shared/lib/utils";
import { fieldShellVariants } from "@/shared/ui/primitives/fieldShell";
import { inputFieldClasses } from "@/shared/ui/primitives/Input";
import { textareaFieldClasses } from "@/shared/ui/primitives/Textarea";

/* ------------------------------------------------------------------ *
 * The three copies, as they stood before the unification.
 * ------------------------------------------------------------------ */

const LEGACY_SHELL_BASE =
  "w-full rounded-control text-sm text-ethereal-ink transition-all duration-300 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50";

const LEGACY_SHELL_VARIANT = {
  glass:
    "bg-ethereal-marble/90 border border-ethereal-gold/35 shadow-[inset_0_1px_2px_rgba(22,20,18,0.06)] hover:border-ethereal-gold/55 focus:border-ethereal-gold/70 focus:ring-ethereal-gold/20",
  solid:
    "bg-ethereal-marble border border-hairline-strong shadow-glass-solid hover:border-ethereal-gold/40 focus:border-ethereal-gold/50 focus:ring-ethereal-gold/20",
  dark: "bg-ethereal-ink/80 backdrop-blur-xl border border-ethereal-gold/20 text-ethereal-alabaster shadow-2xl hover:border-ethereal-gold/40 focus:bg-ethereal-ink focus:border-ethereal-gold/60 focus:ring-ethereal-gold/20",
  ghost:
    "bg-transparent border border-transparent hover:bg-ethereal-incense/10 focus:bg-ethereal-marble focus:border-ethereal-gold/40 focus:ring-ethereal-gold/20",
} as const;

const LEGACY_SHELL_ERROR =
  "border-ethereal-crimson bg-ethereal-crimson/5 text-ethereal-crimson focus:border-ethereal-crimson focus:ring-ethereal-crimson/20";

const LEGACY_INPUT_BASE =
  "w-full rounded-control text-sm transition-all duration-300 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50";

const LEGACY_INPUT_VARIANT = {
  glass:
    "bg-ethereal-marble/90 backdrop-blur-md border border-ethereal-gold/35 text-ethereal-ink shadow-[inset_0_1px_2px_rgba(22,20,18,0.06)] placeholder:text-ethereal-incense focus:bg-ethereal-marble focus:border-ethereal-gold/70 focus:ring-ethereal-gold/20 hover:border-ethereal-gold/55",
  dark: "bg-ethereal-ink/80 backdrop-blur-xl border border-ethereal-gold/20 text-ethereal-alabaster shadow-2xl placeholder:text-ethereal-incense focus:bg-ethereal-ink focus:border-ethereal-gold/60 focus:ring-ethereal-gold/20 hover:border-ethereal-gold/40",
  ghost:
    "bg-transparent border border-transparent text-ethereal-ink placeholder:text-ethereal-incense hover:bg-ethereal-parchment/40 focus:bg-ethereal-marble/80 focus:border-ethereal-gold/40 focus:ring-ethereal-gold/20",
} as const;

const LEGACY_INPUT_ERROR =
  "border-ethereal-crimson bg-ethereal-crimson/5 focus:border-ethereal-crimson focus:ring-ethereal-crimson/20 text-ethereal-ink placeholder:text-ethereal-crimson/70";

const LEGACY_TEXTAREA_BASE =
  "w-full rounded-control text-sm text-ethereal-ink placeholder:text-ethereal-incense transition-all duration-300 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y";

const LEGACY_TEXTAREA_VARIANT = {
  glass:
    "bg-ethereal-marble/90 backdrop-blur-md border border-ethereal-gold/35 shadow-[inset_0_1px_2px_rgba(22,20,18,0.06)] focus:bg-ethereal-marble focus:border-ethereal-gold/70 focus:ring-ethereal-gold/20 hover:border-ethereal-gold/55",
  solid:
    "bg-ethereal-marble border border-hairline-strong shadow-glass-solid focus:border-ethereal-gold/50 focus:ring-ethereal-gold/20",
  ghost:
    "bg-transparent border border-transparent hover:bg-ethereal-parchment/40 focus:bg-ethereal-marble/80 focus:border-ethereal-gold/40 focus:ring-ethereal-gold/20",
} as const;

const LEGACY_TEXTAREA_ERROR =
  "border-ethereal-crimson bg-ethereal-crimson/5 focus:border-ethereal-crimson focus:ring-ethereal-crimson/20 placeholder:text-ethereal-crimson/70";

/**
 * cva emits `base, variants…, className` as one string; the component then
 * appended its padding AFTER that — which is precisely why a caller's padding
 * used to lose. Both facts are reproduced here.
 */
const legacyShell = (
  variant: keyof typeof LEGACY_SHELL_VARIANT,
  hasError: boolean,
): string =>
  cn(LEGACY_SHELL_BASE, LEGACY_SHELL_VARIANT[variant], hasError && LEGACY_SHELL_ERROR);

const legacyInput = (
  variant: keyof typeof LEGACY_INPUT_VARIANT,
  hasError: boolean,
  opts: { hasLeftIcon?: boolean; hasRightElement?: boolean; className?: string } = {},
): string =>
  cn(
    LEGACY_INPUT_BASE,
    LEGACY_INPUT_VARIANT[variant],
    hasError && LEGACY_INPUT_ERROR,
    opts.className,
    opts.hasLeftIcon ? "pl-4 sm:pl-10" : "pl-4",
    opts.hasRightElement ? "pr-12" : "pr-4",
    "py-3",
  );

const legacyTextarea = (
  variant: keyof typeof LEGACY_TEXTAREA_VARIANT,
  hasError: boolean,
  className?: string,
): string =>
  cn(
    LEGACY_TEXTAREA_BASE,
    LEGACY_TEXTAREA_VARIANT[variant],
    hasError && LEGACY_TEXTAREA_ERROR,
    className,
    "px-4 py-3",
  );

/* ------------------------------------------------------------------ *
 * Diffing
 * ------------------------------------------------------------------ */

interface Delta {
  readonly removed: readonly string[];
  readonly added: readonly string[];
}

const NO_CHANGE: Delta = { removed: [], added: [] };

/**
 * Two declared changes stack when both touch the same rendered surface — the
 * unification's own edits and the touch text scale that landed on top of them.
 */
const merge = (...deltas: readonly Delta[]): Delta => ({
  removed: deltas.flatMap((d) => [...d.removed]).sort(),
  added: deltas.flatMap((d) => [...d.added]).sort(),
});

const classSet = (classes: string): Set<string> =>
  new Set(classes.split(/\s+/).filter(Boolean));

const delta = (before: string, after: string): Delta => {
  const a = classSet(before);
  const b = classSet(after);
  return {
    removed: [...a].filter((c) => !b.has(c)).sort(),
    added: [...b].filter((c) => !a.has(c)).sort(),
  };
};

/**
 * Every intended change to the rendered surface, and nothing else. Read this
 * table as the answer to "what did unification cost".
 */
const DECIDED = {
  /** The 90%-opaque glass fill never needed a blur behind it. */
  blurDropped: { removed: ["backdrop-blur-md"], added: [] } as Delta,
  /** The shell answers a hover on every variant, `solid` included. */
  solidHoverGained: {
    removed: [],
    added: ["hover:border-ethereal-gold/40"],
  } as Delta,
  /** An error no longer repaints the value; on ink that was ink-on-ink. */
  darkErrorKeepsItsText: {
    removed: ["text-ethereal-ink"],
    added: ["text-ink-on-inverse"],
  } as Delta,
  /**
   * 2026-08 (dark mode, stage 4): the `dark` variant dresses an island that is
   * dark in BOTH themes — the practice dock, the score chrome. Every neutral it
   * named is a ladder rung that inverts underneath it, so the fill, the focus
   * fill and the value each move to the token that does not. Three entries and
   * not one, because an errored field keeps its own fill and shows only two of
   * the three.
   */
  darkIslandFill: {
    removed: ["bg-ethereal-ink/80"],
    added: ["bg-surface-inverse/80"],
  } as Delta,
  darkIslandFocusFill: {
    removed: ["focus:bg-ethereal-ink"],
    added: ["focus:bg-surface-inverse"],
  } as Delta,
  darkIslandInk: {
    removed: ["text-ethereal-alabaster"],
    added: ["text-ink-on-inverse"],
  } as Delta,
  /** The field's focus fill, previously only on `Input`/`Textarea`. */
  focusFillGained: {
    removed: [],
    added: ["focus:bg-ethereal-marble"],
  } as Delta,
  /**
   * 2026-08: a control that takes typed text is never under 16px on a touch
   * device — iOS magnifies the page on focus and a home-screen app does not
   * zoom back out on blur. The compact scale returns behind `fine-pointer:`,
   * where no such magnification exists. `FIELD_TEXT_SCALE` owns the recipe;
   * this entry is the surface change it cost, on every variant at once.
   */
  touchTextScale: {
    removed: ["text-sm"],
    added: ["fine-pointer:text-sm", "text-base"],
  } as Delta,
} as const;

/* ------------------------------------------------------------------ *
 * Tests
 * ------------------------------------------------------------------ */

describe("Input — surface after folding onto fieldShell", () => {
  it.each(["glass", "dark", "ghost"] as const)(
    "%s is unchanged apart from the dropped blur, the touch text scale and the inverse tokens",
    (variant) => {
      expect(delta(legacyInput(variant, false), inputFieldClasses({ variant }))).toEqual(
        merge(
          DECIDED.touchTextScale,
          variant === "glass" ? DECIDED.blurDropped : NO_CHANGE,
          ...(variant === "dark"
            ? [DECIDED.darkIslandFill, DECIDED.darkIslandFocusFill, DECIDED.darkIslandInk]
            : []),
        ),
      );
    },
  );

  it("keeps the icon and right-element insets", () => {
    expect(
      delta(
        legacyInput("glass", false, { hasLeftIcon: true, hasRightElement: true }),
        inputFieldClasses({ hasLeftIcon: true, hasRightElement: true }),
      ),
    ).toEqual(merge(DECIDED.touchTextScale, DECIDED.blurDropped));
  });

  it("tints the errored field exactly as before", () => {
    expect(delta(legacyInput("glass", true), inputFieldClasses({ hasError: true }))).toEqual(
      merge(DECIDED.touchTextScale, DECIDED.blurDropped),
    );
    expect(delta(legacyInput("ghost", true), inputFieldClasses({ variant: "ghost", hasError: true }))).toEqual(
      DECIDED.touchTextScale,
    );
  });

  it("stops repainting the value on the dark field's error state", () => {
    // The crimson tint owns the fill here, so only the FOCUS fill shows the
    // island's move to the inverse tokens.
    expect(
      delta(legacyInput("dark", true), inputFieldClasses({ variant: "dark", hasError: true })),
    ).toEqual(
      merge(
        DECIDED.touchTextScale,
        DECIDED.darkErrorKeepsItsText,
        DECIDED.darkIslandFocusFill,
      ),
    );
  });
});

describe("Textarea — surface after folding onto fieldShell", () => {
  it.each(["glass", "solid", "ghost"] as const)("%s", (variant) => {
    const expected =
      variant === "glass"
        ? DECIDED.blurDropped
        : variant === "solid"
          ? DECIDED.solidHoverGained
          : NO_CHANGE;
    expect(delta(legacyTextarea(variant, false), textareaFieldClasses({ variant }))).toEqual(
      merge(DECIDED.touchTextScale, expected),
    );
  });

  it("keeps the resize handle the shell has no opinion about", () => {
    expect(classSet(textareaFieldClasses({})).has("resize-y")).toBe(true);
  });

  it("tints the errored field exactly as before", () => {
    expect(
      delta(legacyTextarea("glass", true), textareaFieldClasses({ hasError: true })),
    ).toEqual(merge(DECIDED.touchTextScale, DECIDED.blurDropped));
  });
});

describe("fieldShell — what the other three controls inherit", () => {
  // `Select`, `DateTimeField` and `TimeField` render a button or a div, which
  // has no `::placeholder`. The class the shell now carries for the two field
  // primitives is dead weight on them, and is listed as such below.
  const INERT = "placeholder:text-ethereal-incense";
  const INERT_ERROR = "placeholder:text-ethereal-crimson/70";

  it("gives the glass field a focus fill, as Input always had", () => {
    expect(delta(legacyShell("glass", false), cn(fieldShellVariants({})))).toEqual(
      merge(DECIDED.touchTextScale, {
        removed: [],
        added: [...DECIDED.focusFillGained.added, INERT],
      }),
    );
  });

  it("adopts the ghost hover and focus fills that had live callers", () => {
    expect(
      delta(legacyShell("ghost", false), cn(fieldShellVariants({ variant: "ghost" }))),
    ).toEqual(
      merge(DECIDED.touchTextScale, {
        removed: ["focus:bg-ethereal-marble", "hover:bg-ethereal-incense/10"],
        added: [INERT, "focus:bg-ethereal-marble/80", "hover:bg-ethereal-parchment/40"],
      }),
    );
  });

  it("leaves the chosen value ink when the field is in error", () => {
    expect(
      delta(legacyShell("glass", true), cn(fieldShellVariants({ hasError: true }))),
    ).toEqual(
      merge(DECIDED.touchTextScale, {
        removed: ["text-ethereal-crimson"],
        added: ["focus:bg-ethereal-marble", INERT_ERROR, "text-ethereal-ink"],
      }),
    );
  });

  it("carries the dark field on the inverse tokens and nothing else", () => {
    expect(
      delta(legacyShell("dark", false), cn(fieldShellVariants({ variant: "dark" }))),
    ).toEqual(
      merge(
        DECIDED.touchTextScale,
        DECIDED.darkIslandFill,
        DECIDED.darkIslandFocusFill,
        DECIDED.darkIslandInk,
        { removed: [], added: [INERT] },
      ),
    );
  });
});

describe("one recipe, three primitives", () => {
  const variants = ["glass", "solid", "dark", "ghost"] as const;

  it.each(variants)("%s — Input and Textarea add layout, never override the shell", (variant) => {
    for (const hasError of [false, true]) {
      const shell = classSet(cn(fieldShellVariants({ variant, hasError })));
      const input = classSet(inputFieldClasses({ variant, hasError }));
      const textarea = classSet(textareaFieldClasses({ variant, hasError }));

      // Nothing the shell decided is missing further down.
      for (const className of shell) {
        expect(input.has(className)).toBe(true);
        expect(textarea.has(className)).toBe(true);
      }

      // And what they add on top is layout, not surface.
      const inputExtras = [...input].filter((c) => !shell.has(c));
      const textareaExtras = [...textarea].filter((c) => !shell.has(c));
      expect(inputExtras.sort()).toEqual(["pl-4", "pr-4", "py-3"]);
      expect(textareaExtras.sort()).toEqual(["px-4", "py-3", "resize-y"]);
    }
  });
});

describe("className contract — the caller's layout wins", () => {
  it("applies a padding the caller passes (the ledger rows' py-2)", () => {
    const next = classSet(inputFieldClasses({ className: "py-2 text-right font-mono" }));
    expect(next.has("py-2")).toBe(true);
    expect(next.has("py-3")).toBe(false);

    // What it used to do: the primitive's padding was appended last and won.
    const before = classSet(legacyInput("glass", false, { className: "py-2 text-right font-mono" }));
    expect(before.has("py-3")).toBe(true);
    expect(before.has("py-2")).toBe(false);
  });

  it("reserves room for a trailing control when asked (PasswordInput's pr-12)", () => {
    expect(classSet(inputFieldClasses({ className: "pr-12" })).has("pr-12")).toBe(true);
    expect(classSet(legacyInput("glass", false, { className: "pr-12" })).has("pr-4")).toBe(true);
  });

  it("still lets a caller re-colour the text", () => {
    const next = classSet(textareaFieldClasses({ className: "text-ethereal-graphite/80" }));
    expect(next.has("text-ethereal-graphite/80")).toBe(true);
    expect(next.has("text-ethereal-ink")).toBe(false);
  });
});
