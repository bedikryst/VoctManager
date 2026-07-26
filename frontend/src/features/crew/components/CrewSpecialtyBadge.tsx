/**
 * @file CrewSpecialtyBadge.tsx
 * @description Maps a collaborator's specialty to a tone, an icon and a label
 * on the shared `Badge`. A domain wrapper owns the mapping, never a surface of
 * its own — this file used to draw its own chip (a fourth corner radius and a
 * fifth letter-spacing for the panel's one chip role).
 * @architecture Enterprise SaaS 2026
 * @module features/crew/components/CrewSpecialtyBadge
 */

import React from "react";
import { useTranslation } from "react-i18next";

import type { CollaboratorSpecialty } from "@/shared/types";
import { Badge } from "@/shared/ui/primitives/Badge";
import { ACCENT_BADGE } from "@/shared/ui/primitives/accents";

import { getCrewSpecialtyOption } from "../constants/crewSpecialties";

interface CrewSpecialtyBadgeProps {
  specialty: CollaboratorSpecialty | string;
  className?: string;
}

export function CrewSpecialtyBadge({
  specialty,
  className,
}: CrewSpecialtyBadgeProps): React.JSX.Element {
  const { t } = useTranslation();
  const option = getCrewSpecialtyOption(t, specialty);
  const Icon = option.icon;

  return (
    <Badge
      variant={ACCENT_BADGE[option.accent]}
      icon={<Icon size={11} strokeWidth={1.75} aria-hidden="true" />}
      title={option.description}
      className={className}
    >
      {option.label}
    </Badge>
  );
}
