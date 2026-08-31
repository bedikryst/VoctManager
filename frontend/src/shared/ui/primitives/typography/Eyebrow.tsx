import React from "react";
import { TypographyBase, type TypographyProps } from "./Typography";

/**
 * The panel's ONLY uppercase overline. Card headers, field labels, tab labels,
 * group dividers and KPI captions all come from here — a hand-rolled
 * `uppercase tracking-*` span is a bug, because it is how the role drifted into
 * sixteen letter-spacings and five sizes in the first place.
 * `size="overline-sm"` is the dense variant (table heads, rows in a scroller).
 */
export interface EyebrowProps extends Omit<TypographyProps, "size"> {
  /**
   * The role has exactly the two sizes `panel.css` declares, and the type says
   * so. `caption` used to be reachable here and 52 call sites took it: it
   * resolves to `text-[11px]`, which is the same 11px as `overline` and carries
   * no line-height, so every one of them was paying an arbitrary value to
   * silently drop the role's own 1.15 leading. An escape hatch that renders
   * identically to the default is not a third size — it is a way to lose one.
   */
  size?: "overline" | "overline-sm";
}

export const Eyebrow = React.forwardRef<HTMLElement, EyebrowProps>(
  ({ as = "span", ...props }, ref) => (
    <TypographyBase
      ref={ref}
      as={as}
      variant="eyebrow"
      size="overline"
      weight="bold"
      // `muted`, because a default is what lands when nobody chose, and the
      // role's previous default was the dimmest value in the panel:
      // `incense/60` reads 1.62 against the light theme's tightest surface,
      // below the gold accent and below every neutral. 353 of the 371 call
      // sites already name a colour, and `muted` is what 189 of them name — so
      // this is the value the role behaves as in the wild, now also the one it
      // falls back to. It is 2.86 and still short of the 4.5 prose wants; the
      // floor for the secondary role as a whole is a separate, larger decision
      // (dark-mode spec §1.2). This only stops the default from being a trap.
      color="muted"
      {...props}
    />
  ),
);
Eyebrow.displayName = "Eyebrow";
