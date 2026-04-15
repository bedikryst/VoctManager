/**
 * @file SectionHeader.tsx
 * @description Domain-agnostic header for BENTO Grid modules.
 * @architecture Enterprise SaaS 2026
 */

import React from "react";
import { cn } from "@/shared/lib/utils";
import { Eyebrow } from "@/shared/ui/primitives/typography";
import { Divider } from "@/shared/ui/primitives/Divider";

export interface SectionHeaderProps extends React.HTMLAttributes<HTMLElement> {
  title: string;
  icon?: React.ReactNode;
  withFluidDivider?: boolean;
}

export function SectionHeader({
  title,
  icon,
  withFluidDivider = true,
  className,
  ...props
}: SectionHeaderProps): React.JSX.Element {
  return (
    <header
      className={cn("relative flex items-center gap-3 pb-5 mb-6", className)}
      {...props}
    >
      {icon && (
        <div className="text-ethereal-gold" aria-hidden="true">
          {icon}
        </div>
      )}
      <Eyebrow as="h2" color="muted">
        {title}
      </Eyebrow>

      {withFluidDivider && (
        <Divider variant="gradient-right" position="absolute-bottom" />
      )}
    </header>
  );
}
