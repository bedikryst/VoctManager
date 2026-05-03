/**
 * @file LocationCategoryBadge.tsx
 * @description Token-driven badge that renders a logistics category with the
 * matching Ethereal accent and lucide icon. Single source of visual truth
 * for cards, atlas legend, filter chips, and the editor preview.
 * @architecture Enterprise SaaS 2026
 * @module features/logistics/components/LocationCategoryBadge
 */

import React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import type { LocationCategory } from "@/shared/types";

import {
  type LocationCategoryAccent,
  getLocationCategoryOption,
} from "../constants/locationCategories";

type LocationCategoryBadgeSize = "sm" | "md";

interface LocationCategoryBadgeProps {
  category: LocationCategory | string;
  size?: LocationCategoryBadgeSize;
  className?: string;
  iconOnly?: boolean;
  /** Render the long, plural form (used in section headers and the atlas legend). */
  plural?: boolean;
}

const ACCENT_CLASSES: Record<LocationCategoryAccent, string> = {
  gold: "border-ethereal-gold/35 bg-ethereal-gold/10 text-ethereal-gold",
  amethyst:
    "border-ethereal-amethyst/35 bg-ethereal-amethyst/10 text-ethereal-amethyst",
  crimson:
    "border-ethereal-crimson/30 bg-ethereal-crimson/10 text-ethereal-crimson",
  sage: "border-ethereal-sage/35 bg-ethereal-sage/10 text-ethereal-sage",
  graphite:
    "border-ethereal-graphite/25 bg-ethereal-graphite/10 text-ethereal-graphite",
  incense:
    "border-ethereal-incense/30 bg-ethereal-incense/10 text-ethereal-incense",
};

const SIZE_CLASSES: Record<LocationCategoryBadgeSize, string> = {
  sm: "px-2 py-1 text-[9px] gap-1.5",
  md: "px-2.5 py-1.5 text-[10px] gap-2",
};

const ICON_SIZE: Record<LocationCategoryBadgeSize, number> = {
  sm: 11,
  md: 13,
};

export function LocationCategoryBadge({
  category,
  size = "md",
  className,
  iconOnly = false,
  plural = false,
}: LocationCategoryBadgeProps): React.JSX.Element {
  const { t } = useTranslation();
  const option = getLocationCategoryOption(t, category);
  const Icon = option.icon;
  const label = plural ? option.plural : option.label;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border font-bold uppercase tracking-[0.18em] antialiased shadow-sm transition-colors duration-300",
        ACCENT_CLASSES[option.accent],
        SIZE_CLASSES[size],
        iconOnly && "px-2 py-1.5",
        className,
      )}
      title={label}
    >
      <Icon size={ICON_SIZE[size]} strokeWidth={1.75} aria-hidden="true" />
      {!iconOnly && <span className="truncate">{label}</span>}
    </span>
  );
}
