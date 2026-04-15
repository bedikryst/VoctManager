import React from "react";
import { TypographyBase, type TypographyProps } from "./Typography";

export const Heading = React.forwardRef<HTMLElement, TypographyProps>(
  ({ as = "h2", size = "3xl", ...props }, ref) => (
    <TypographyBase
      ref={ref}
      as={as}
      variant="heading"
      size={size}
      weight="medium"
      color="default"
      {...props}
    />
  ),
);
Heading.displayName = "Heading";
