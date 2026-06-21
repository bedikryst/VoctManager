/**
 * @file QuickTile.tsx
 * @description Shared compact "quick destination/tool" tile used by both the
 * chorister and conductor home screens, so the two dashboards speak one tile
 * language. Polymorphic: renders as a router Link (`to`) or a button (`onClick`,
 * e.g. to open a sheet). Big-tap, accent-tinted icon, label + hint.
 * @module features/dashboard/components/QuickTile
 */

import React from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";

export type QuickAccent = "gold" | "sage" | "incense" | "amethyst";

const ACCENT: Record<QuickAccent, { wrap: string; icon: string }> = {
  gold: {
    wrap: "border-ethereal-gold/30 bg-gradient-to-br from-ethereal-gold/20 to-transparent",
    icon: "text-ethereal-gold",
  },
  sage: {
    wrap: "border-ethereal-sage/30 bg-gradient-to-br from-ethereal-sage/20 to-transparent",
    icon: "text-ethereal-sage",
  },
  incense: {
    wrap: "border-ethereal-incense/30 bg-gradient-to-br from-ethereal-incense/20 to-transparent",
    icon: "text-ethereal-incense",
  },
  amethyst: {
    wrap: "border-ethereal-amethyst/30 bg-gradient-to-br from-ethereal-amethyst/20 to-transparent",
    icon: "text-ethereal-amethyst",
  },
};

// transition only transform + border-color (cheap); the hover shadow snaps
// instead of repainting for 300ms. active:scale stays smooth (compositor).
const TILE_BASE =
  "group flex min-h-[104px] flex-col items-start gap-3 rounded-2xl border border-ethereal-incense/15 bg-ethereal-alabaster/60 p-4 text-left shadow-glass-ethereal transition-[transform,border-color] duration-300 hover:border-ethereal-gold/30 hover:shadow-glass-ethereal-hover active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40";

interface QuickTileProps {
  Icon: LucideIcon;
  accent: QuickAccent;
  label: string;
  hint: string;
  to?: string;
  onClick?: () => void;
  /** Marks the button as opening a dialog (for the sheet-launching tile). */
  opensDialog?: boolean;
  expanded?: boolean;
  className?: string;
}

const TileBody = ({
  Icon,
  accent,
  label,
  hint,
}: Pick<
  QuickTileProps,
  "Icon" | "accent" | "label" | "hint"
>): React.JSX.Element => (
  <>
    <span
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-xl border transition-transform duration-300 group-hover:-translate-y-0.5",
        ACCENT[accent].wrap,
      )}
      aria-hidden="true"
    >
      <Icon size={20} strokeWidth={2} className={ACCENT[accent].icon} />
    </span>
    <span className="block w-full min-w-0">
      <Text size="sm" weight="bold" className="block leading-tight break-words">
        {label}
      </Text>
      <Eyebrow color="muted" className="mt-0.5 block truncate">
        {hint}
      </Eyebrow>
    </span>
  </>
);

export const QuickTile = ({
  Icon,
  accent,
  label,
  hint,
  to,
  onClick,
  opensDialog,
  expanded,
  className,
}: QuickTileProps): React.JSX.Element => {
  const body = <TileBody Icon={Icon} accent={accent} label={label} hint={hint} />;

  if (to) {
    return (
      <Link to={to} className={cn(TILE_BASE, className)}>
        {body}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup={opensDialog ? "dialog" : undefined}
      aria-expanded={opensDialog ? expanded : undefined}
      className={cn(TILE_BASE, className)}
    >
      {body}
    </button>
  );
};
