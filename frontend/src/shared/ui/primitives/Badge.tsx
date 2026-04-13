/**
 * @file Badge.tsx
 * @description Standardised micro-status indicator.
 * @module shared/ui/primitives/Badge
 */

import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border transition-colors",
  {
    variants: {
      variant: {
        success: "bg-emerald-50 text-emerald-600 border-emerald-100",
        danger: "bg-red-50 text-red-600 border-red-100",
        warning: "bg-orange-50 text-orange-600 border-orange-100",
        neutral: "bg-stone-100 text-stone-600 border-stone-200",
        brand: "bg-blue-50 text-brand border-blue-100",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Optional icon rendered prior to the text */
  icon?: React.ReactNode;
}

export function Badge({
  variant,
  icon,
  className,
  children,
  ...props
}: BadgeProps): React.JSX.Element {
  return (
    <span className={cn(badgeVariants({ variant, className }))} {...props}>
      {icon && (
        <span className="shrink-0" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}
