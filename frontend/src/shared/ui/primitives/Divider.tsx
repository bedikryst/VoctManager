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
      "gradient-right":
        "bg-gradient-to-r from-ethereal-incense/20 to-transparent",
      "gradient-bottom":
        "bg-gradient-to-b from-ethereal-incense/15 to-transparent",
      "gradient-fade":
        "bg-gradient-to-r from-transparent via-ethereal-incense/20 to-transparent",
      fade: "bg-gradient-to-r from-transparent via-ethereal-incense/20 to-transparent",
    },
    orientation: {
      horizontal: "h-[1px] w-full",
      vertical: "w-[1px] h-full",
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
