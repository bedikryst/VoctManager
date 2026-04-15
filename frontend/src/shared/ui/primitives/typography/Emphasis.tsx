import React from "react";
import { TypographyBase, type TypographyProps } from "./Typography";

export const Emphasis = React.forwardRef<HTMLElement, TypographyProps>(
  ({ as = "em", ...props }, ref) => (
    <TypographyBase
      ref={ref}
      as={as}
      variant="emphasis"
      weight="medium"
      color="gold"
      {...props}
    />
  ),
);
Emphasis.displayName = "Emphasis";
