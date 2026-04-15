import React from "react";
import { TypographyBase, type TypographyProps } from "./Typography";

export const Label = React.forwardRef<HTMLElement, TypographyProps>(
  ({ as = "span", ...props }, ref) => (
    <TypographyBase
      ref={ref}
      as={as}
      variant="body"
      size="sm"
      weight="medium"
      color="muted"
      {...props}
    />
  ),
);
Label.displayName = "Label";
