import React from "react";
import { TypographyBase, type TypographyProps } from "./Typography";

export const Caption = React.forwardRef<HTMLElement, TypographyProps>(
  ({ as = "span", ...props }, ref) => (
    <TypographyBase
      ref={ref}
      as={as}
      variant="caption"
      size="caption"
      weight="normal"
      color="muted"
      {...props}
    />
  ),
);
Caption.displayName = "Caption";
