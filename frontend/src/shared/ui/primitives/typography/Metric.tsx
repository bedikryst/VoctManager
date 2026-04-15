import React from "react";
import { TypographyBase, type TypographyProps } from "./Typography";

export const Metric = React.forwardRef<HTMLElement, TypographyProps>(
  ({ as = "span", size = "4xl", ...props }, ref) => (
    <TypographyBase
      ref={ref}
      as={as}
      variant="metric"
      size={size}
      weight="light"
      color="default"
      {...props}
    />
  ),
);
Metric.displayName = "Metric";
