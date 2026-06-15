/**
 * @file PasswordStrengthMeter.tsx
 * @description Presentational four-segment strength read for a password field.
 * Pure UI over the shared `passwordStrength` heuristic — used on the activation
 * flow and in security settings so the strength UX never drifts between them.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/PasswordStrengthMeter
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import { Caption } from "@/shared/ui/primitives/typography";
import {
  PASSWORD_STRENGTH_LEVELS,
  resolvePasswordStrength,
} from "@/shared/lib/password/passwordStrength";

interface PasswordStrengthMeterProps {
  readonly password: string;
  readonly className?: string;
}

export const PasswordStrengthMeter = ({
  password,
  className,
}: PasswordStrengthMeterProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  const strength = resolvePasswordStrength(password);
  if (!strength) return null;

  const { score, level } = strength;

  return (
    <div className={cn("flex items-center gap-3 pl-1 pt-1", className)}>
      <div className="flex h-1 flex-1 gap-1" aria-hidden="true">
        {PASSWORD_STRENGTH_LEVELS.map((segment, index) => (
          <div
            key={segment.key}
            className={cn(
              "h-full flex-1 rounded-full transition-colors duration-300",
              index < score ? level.bar : "bg-ethereal-ink/8",
            )}
          />
        ))}
      </div>
      <Caption color={level.text} className="shrink-0">
        {t(level.key, level.fallback)}
      </Caption>
    </div>
  );
};
