import React from "react";
import { TypographyBase, type TypographyProps } from "./Typography";

export const Unit = React.forwardRef<HTMLElement, TypographyProps>(
  ({ as = "span", ...props }, ref) => (
    <TypographyBase
      ref={ref}
      as={as}
      variant="unit"
      size="sm"
      weight="normal"
      color="muted"
      {...props}
    />
  ),
);
Unit.displayName = "Unit";
