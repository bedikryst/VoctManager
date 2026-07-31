/**
 * @file InlineEditable.test.ts
 * @description Guards the one thing about this primitive that fails silently.
 * `InlineEditable` renders its label through `Text`, which writes `font-sans`
 * and `font-normal` onto the span itself — so a family or weight declared on
 * the button around it resolves to nothing, while the build, the typecheck and
 * eslint all stay green. Two shipped bugs came from exactly that: a `font-serif`
 * that never applied, and a `font-semibold` that had been dead long enough for
 * titles to render normal-weight in display mode and jump to semibold the
 * moment they were clicked into edit mode.
 *
 * These assertions therefore run on RESOLVED class lists — the same `cn()` the
 * component calls, so tailwind-merge has already dropped the losers. A class
 * that loses at runtime loses here too.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/primitives/InlineEditable.test
 */

import { describe, expect, it } from "vitest";

import { cn } from "@/shared/lib/utils";
import {
  inlineEditableTextProps,
  type InlineEditableVariant,
} from "@/shared/ui/primitives/InlineEditable";
import { fieldShellVariants } from "@/shared/ui/primitives/fieldShell";
import { typographyVariants } from "@/shared/ui/primitives/typography/Typography";

const classSet = (value: string): ReadonlySet<string> =>
  new Set(value.split(/\s+/).filter(Boolean));

/** The span `Text` actually renders, for a given variant. */
const resolvedLabel = (variant: InlineEditableVariant): ReadonlySet<string> => {
  const { weight, className } = inlineEditableTextProps(variant);
  return classSet(
    cn(
      typographyVariants({
        variant: "body",
        size: null,
        weight: weight ?? "normal",
        color: "inherit",
      }),
      className,
    ),
  );
};

/** The `<input>` the same variant swaps to, which styles itself directly. */
const resolvedInput = (variant: InlineEditableVariant): ReadonlySet<string> =>
  classSet(
    cn(
      fieldShellVariants({ variant: "glass", hasError: false }),
      "w-auto rounded-chip px-1.5 py-0.5",
      variant === "title" && "font-semibold text-base",
      variant === "display" && "font-serif font-semibold text-2xl tracking-tight",
      variant === "subtle" && "text-xs",
    ),
  );

describe("inlineEditableTextProps — what survives onto the label span", () => {
  it("sets `display` in the serif, with the sans dropped", () => {
    const label = resolvedLabel("display");
    expect(label).toContain("font-serif");
    expect(label).not.toContain("font-sans");
  });

  it("keeps `default` and `subtle` in the sans", () => {
    for (const variant of ["default", "subtle"] as const) {
      expect(resolvedLabel(variant)).toContain("font-sans");
      expect(resolvedLabel(variant)).not.toContain("font-serif");
    }
  });

  it("carries the weight of `title` and `display` past Text's font-normal", () => {
    for (const variant of ["title", "display"] as const) {
      expect(resolvedLabel(variant)).toContain("font-semibold");
      expect(resolvedLabel(variant)).not.toContain("font-normal");
    }
  });

  it("leaves the unweighted variants at Text's own normal", () => {
    expect(resolvedLabel("default")).toContain("font-normal");
    expect(resolvedLabel("subtle")).toContain("font-normal");
  });
});

describe("display mode and edit mode agree", () => {
  it("does not change weight when a title is clicked into its input", () => {
    for (const variant of ["title", "display"] as const) {
      expect(resolvedLabel(variant)).toContain("font-semibold");
      expect(resolvedInput(variant)).toContain("font-semibold");
    }
  });

  it("does not change family when a display title is clicked into its input", () => {
    expect(resolvedLabel("display")).toContain("font-serif");
    expect(resolvedInput("display")).toContain("font-serif");
  });
});

describe("callers can still raise the step", () => {
  it("lets a className size beat the variant's own", () => {
    const button = classSet(cn("text-2xl tracking-tight", "text-3xl"));
    expect(button).toContain("text-3xl");
    expect(button).not.toContain("text-2xl");
  });

  it("keeps a responsive bump alongside the base size", () => {
    const button = classSet(cn("text-2xl tracking-tight", "md:text-3xl"));
    expect(button).toContain("text-2xl");
    expect(button).toContain("md:text-3xl");
  });
});
