import React from "react";
import { TypographyBase, type TypographyProps } from "./Typography";

/**
 * Any KPI / statistic — the figure a conductor scans first. Weight stays at
 * 400: Cormorant's lining figures are open and already read light, and 300
 * lets them dissolve into the parchment at these sizes.
 */
export const Metric = React.forwardRef<HTMLElement, TypographyProps>(
  ({ as = "span", size = "4xl", ...props }, ref) => (
    <TypographyBase
      ref={ref}
      as={as}
      variant="metric"
      size={size}
      weight="normal"
      color="default"
      {...props}
    />
  ),
);
Metric.displayName = "Metric";
