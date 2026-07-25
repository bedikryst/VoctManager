import React from "react";
import { TypographyBase, type TypographyProps } from "./Typography";

/**
 * The panel's ONLY uppercase overline. Card headers, field labels, tab labels,
 * group dividers and KPI captions all come from here — a hand-rolled
 * `uppercase tracking-*` span is a bug, because it is how the role drifted into
 * sixteen letter-spacings and five sizes in the first place.
 * `size="overline-sm"` is the dense variant (table heads, rows in a scroller).
 */
export const Eyebrow = React.forwardRef<HTMLElement, TypographyProps>(
  ({ as = "span", ...props }, ref) => (
    <TypographyBase
      ref={ref}
      as={as}
      variant="eyebrow"
      size="overline"
      weight="bold"
      color="incense-muted"
      {...props}
    />
  ),
);
Eyebrow.displayName = "Eyebrow";
