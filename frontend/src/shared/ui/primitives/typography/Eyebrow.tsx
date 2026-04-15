import React from "react";
import { TypographyBase, type TypographyProps } from "./Typography";

export const Eyebrow = React.forwardRef<HTMLElement, TypographyProps>(
  ({ as = "span", ...props }, ref) => (
    <TypographyBase
      ref={ref}
      as={as}
      variant="eyebrow"
      size="xs"
      weight="bold"
      color="incense"
      {...props}
    />
  ),
);
Eyebrow.displayName = "Eyebrow";
