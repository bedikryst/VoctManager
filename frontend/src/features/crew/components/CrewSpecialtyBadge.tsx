/**
 * @file CrewSpecialtyBadge.tsx
 * @description Token-driven badge that renders a crew specialty with the
 * matching Ethereal accent and lucide icon. Single source of visual truth
 * for cards, filter chips, hero strips, and the editor preview.
 * @architecture Enterprise SaaS 2026
 * @module features/crew/components/CrewSpecialtyBadge
 */

import React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import type { CollaboratorSpecialty } from "@/shared/types";

import {
  type CrewSpecialtyAccent,
  getCrewSpecialtyOption,
} from "../constants/crewSpecialties";

type CrewSpecialtyBadgeSize = "sm" | "md";

interface CrewSpecialtyBadgeProps {
  specialty: CollaboratorSpecialty | string;
  size?: CrewSpecialtyBadgeSize;
  className?: string;
  iconOnly?: boolean;
}

const ACCENT_CLASSES: Record<CrewSpecialtyAccent, string> = {
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

const SIZE_CLASSES: Record<CrewSpecialtyBadgeSize, string> = {
  sm: "px-2 py-1 text-[9px] gap-1.5",
  md: "px-2.5 py-1.5 text-[10px] gap-2",
};

const ICON_SIZE: Record<CrewSpecialtyBadgeSize, number> = {
  sm: 11,
  md: 13,
};

export function CrewSpecialtyBadge({
  specialty,
  size = "md",
  className,
  iconOnly = false,
}: CrewSpecialtyBadgeProps): React.JSX.Element {
  const { t } = useTranslation();
  const option = getCrewSpecialtyOption(t, specialty);
  const Icon = option.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border font-bold uppercase tracking-[0.18em] antialiased shadow-sm transition-colors duration-300",
        ACCENT_CLASSES[option.accent],
        SIZE_CLASSES[size],
        iconOnly && "px-2 py-1.5",
        className,
      )}
      title={option.label}
    >
      <Icon size={ICON_SIZE[size]} strokeWidth={1.75} aria-hidden="true" />
      {!iconOnly && <span className="truncate">{option.label}</span>}
    </span>
  );
}
