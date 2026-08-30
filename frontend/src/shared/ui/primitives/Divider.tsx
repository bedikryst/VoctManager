/**
 * @file Divider.tsx
 * @description Fluid separation kinematics for semantic boundaries.
 * @architecture Enterprise SaaS 2026
 */

import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";

const dividerVariants = cva("shrink-0 pointer-events-none", {
  variants: {
    variant: {
      solid: "bg-ethereal-incense/10",
      // The same rule on the dark frosted chrome that floats over a score
      // (`GlassCard variant="surface"`, the PDF toolbars). The warm `solid` is
      // invisible on `ethereal-ink/70`, which is why both dark bars had drawn
      // their own — one of them under a private component called `Divider`,
      // shadowing this file's export in its own module.
      // The alpha stays where the eye put it: `line-on-inverse` is the rim of
      // an island, and a rule ACROSS one has to survive a busy toolbar. Only
      // the colour moves — to the ink of the island it is drawn on, which is
      // within a point of white in either theme.
      "solid-dark": "bg-ink-on-inverse/15",
      "gradient-right":
        "bg-gradient-to-r from-ethereal-incense/20 to-transparent",
      "gradient-bottom":
        "bg-gradient-to-b from-ethereal-incense/15 to-transparent",
      // `fade` was a second name for this exact string — two spellings of one
      // rule is how a divider ends up looking like two components.
      "gradient-fade":
        "bg-gradient-to-r from-transparent via-ethereal-incense/20 to-transparent",
    },
    orientation: {
      horizontal: "h-px w-full",
      vertical: "w-px h-full",
    },
    position: {
      relative: "",
      "absolute-top": "absolute top-0 left-0 w-full",
      "absolute-bottom": "absolute bottom-0 left-0 w-full",
      "absolute-left": "absolute inset-y-0 left-0 h-full",
      "absolute-right": "absolute inset-y-0 right-0 h-full",
    },
  },
  defaultVariants: {
    variant: "solid",
    orientation: "horizontal",
    position: "relative",
  },
});

export interface DividerProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof dividerVariants> {}

export const Divider = React.forwardRef<HTMLDivElement, DividerProps>(
  ({ className, variant, orientation, position, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="separator"
        aria-orientation={
          orientation === "horizontal" ? "horizontal" : "vertical"
        }
        className={cn(
          dividerVariants({ variant, orientation, position }),
          className,
        )}
        {...props}
      />
    );
  },
);

Divider.displayName = "Divider";
