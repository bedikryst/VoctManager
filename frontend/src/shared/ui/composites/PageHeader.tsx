/**
 * @file PageHeader.tsx
 * @description Standardized page header composite with strict Ethereal UI typography.
 * Supports different scale variants for main dashboards vs standard subpages.
 * @architecture Enterprise SaaS 2026
 */

import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";
import { Eyebrow, Heading, Emphasis } from "@/shared/ui/primitives/typography";

const pageHeaderVariants = cva(
  "flex w-full flex-col gap-6 md:flex-row md:items-end md:justify-between",
  {
    variants: {
      size: {
        dashboard: "mb-8 px-5 md:px-0",
        standard: "mb-6 px-0",
        // For a page whose own content is bound to the viewport, where the
        // header is a band taken out of the work area rather than an approach
        // to it. Below `md` the title and its one action share a row and the
        // eyebrow steps aside — ~155px of a 844px phone becomes ~45px. From
        // `md` up it IS `standard`: the room that made the tall header right is
        // back, and a page must not read as two different pages across a
        // breakpoint.
        compact:
          "mb-3 flex-row items-center justify-between gap-3 px-0 md:mb-6 md:gap-6",
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
  const isCompact = size === "compact";

  return (
    <header className={cn(pageHeaderVariants({ size }), className)} {...props}>
      <div className="min-w-0 max-w-3xl">
        {roleText && (
          <div
            className={cn(
              "mb-4 flex items-center gap-4",
              // The rule and its overline are an approach to a page. A compact
              // header has no approach — and on a phone the nav dock's active
              // tab is already saying which section this is.
              isCompact && "hidden md:flex",
            )}
          >
            <div
              className="h-px w-12 shrink-0 bg-ethereal-gold/30"
              aria-hidden="true"
            />
            <Eyebrow color="muted">{roleText}</Eyebrow>
          </div>
        )}

        <Heading
          as="h1"
          size={isDashboard ? "huge" : isCompact ? "2xl" : "3xl"}
          weight="medium"
          // `md:text-3xl` names the class the `3xl` step itself emits: from the
          // breakpoint up, a compact title is a standard one.
          className={cn(isCompact && "truncate md:text-3xl")}
        >
          {title} {titleHighlight && <Emphasis>{titleHighlight}</Emphasis>}
        </Heading>
      </div>

      {rightContent && (
        <div
          className={cn(
            "flex w-full items-center md:w-auto md:shrink-0 md:pb-1",
            // Sharing the title's row, the action takes only what it needs —
            // full width would push the title out of the header entirely.
            isCompact && "w-auto shrink-0",
          )}
        >
          {rightContent}
        </div>
      )}
    </header>
  );
}
