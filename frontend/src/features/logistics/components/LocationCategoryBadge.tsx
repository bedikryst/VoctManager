/**
 * @file LocationCategoryBadge.tsx
 * @description Maps a venue's category to a tone, an icon and a label on the
 * shared `Badge`. A domain wrapper owns the mapping, never a surface of its own
 * — this file used to draw its own chip, at a corner radius and a letter-spacing
 * the panel uses nowhere else.
 * @architecture Enterprise SaaS 2026
 * @module features/logistics/components/LocationCategoryBadge
 */

import React from "react";
import { useTranslation } from "react-i18next";

import type { LocationCategory } from "@/shared/types";
import { Badge } from "@/shared/ui/primitives/Badge";
import { ACCENT_BADGE } from "@/shared/ui/primitives/accents";

import { getLocationCategoryOption } from "../constants/locationCategories";

interface LocationCategoryBadgeProps {
  category: LocationCategory | string;
  /** The long, plural form — for a section header or the atlas legend. */
  plural?: boolean;
  className?: string;
}

export function LocationCategoryBadge({
  category,
  plural = false,
  className,
}: LocationCategoryBadgeProps): React.JSX.Element {
  const { t } = useTranslation();
  const option = getLocationCategoryOption(t, category);
  const Icon = option.icon;

  return (
    <Badge
      variant={ACCENT_BADGE[option.accent]}
      icon={<Icon size={11} strokeWidth={1.75} aria-hidden="true" />}
      title={option.description}
      className={className}
    >
      {plural ? option.plural : option.label}
    </Badge>
  );
}
