import React from "react";
import { TypographyBase, type TypographyProps } from "./Typography";

export const Text = React.forwardRef<HTMLElement, TypographyProps>(
  ({ as = "p", ...props }, ref) => (
    <TypographyBase
      ref={ref}
      as={as}
      variant="body"
      size="base"
      weight="normal"
      color="default"
      {...props}
    />
  ),
);
Text.displayName = "Text";
