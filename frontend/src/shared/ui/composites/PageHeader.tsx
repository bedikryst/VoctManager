/**
 * @file PageHeader.tsx
 * @description Standardized page header composite with strict Ethereal UI typography.
 * Supports different scale variants for main dashboards vs standard subpages.
 * @architecture Enterprise SaaS 2026
 */

import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";
import { Typography } from "@/shared/ui/primitives/Typography";

const pageHeaderVariants = cva(
  "flex flex-col gap-6 md:flex-row md:items-end justify-between w-full",
  {
    variants: {
      size: {
        dashboard: "mb-8 px-5 md:px-0",
        standard: "mb-6 px-0",
      },
    },
    defaultVariants: {
      size: "standard",
    },
  },
);

export interface PageHeaderProps
  extends
    Omit<React.HTMLAttributes<HTMLElement>, "title">,
    VariantProps<typeof pageHeaderVariants> {
  roleText?: string;
  title: string;
  titleHighlight?: string;
  rightContent?: React.ReactNode;
}

export function PageHeader({
  roleText,
  title,
  titleHighlight,
  rightContent,
  size,
  className,
  ...props
}: PageHeaderProps): React.JSX.Element {
  const isDashboard = size === "dashboard";

  return (
    <header className={cn(pageHeaderVariants({ size }), className)} {...props}>
      <div className="max-w-2xl">
        {roleText && (
          <div className="mb-4 flex items-center gap-4">
            <div
              className="h-[1px] w-12 shrink-0 bg-ethereal-gold/30"
              aria-hidden="true"
            />
            <Typography variant="eyebrow" color="muted">
              {roleText}
            </Typography>
          </div>
        )}

        <Typography
          as="h1"
          variant="title"
          className={cn(
            isDashboard ? "md:text-5xl" : "md:text-4xl text-3xl",
            "font-medium",
          )}
        >
          {title}{" "}
          {titleHighlight && (
            <span className="italic text-ethereal-gold/90">
              {titleHighlight}
            </span>
          )}
        </Typography>
      </div>

      {rightContent && (
        <div className="hidden pb-2 md:block">{rightContent}</div>
      )}
    </header>
  );
}
