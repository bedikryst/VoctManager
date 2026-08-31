/**
 * @file PasswordRequirements.tsx
 * @description Live "set a password" requirement checklist (≥8 chars, match)
 * shared by the activation and password-reset flows. It is the only place
 * either screen states the rule: it is visible from the first paint, before
 * anything is typed, so nobody has to guess what will be accepted and no static
 * prose above the field has to repeat it. Mirrors the rules the hooks enforce
 * on submit.
 * @architecture Enterprise SaaS 2026
 * @module features/auth/components/PasswordRequirements
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Text } from "@/shared/ui/primitives/typography";

const Row = ({
  met,
  label,
}: {
  readonly met: boolean;
  readonly label: string;
}): React.JSX.Element => (
  <li className="flex items-center gap-2.5">
    <span
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors duration-300",
        met
          ? "bg-ethereal-sage/20 text-ethereal-sage"
          : "bg-ethereal-ink/8 text-transparent",
      )}
      aria-hidden="true"
    >
      <Check className="h-2.5 w-2.5" strokeWidth={3} />
    </span>
    <Text
      size="xs"
      className={cn(
        "transition-colors duration-300",
        met ? "text-ethereal-sage" : "text-ethereal-graphite/60",
      )}
    >
      {label}
    </Text>
  </li>
);

interface PasswordRequirementsProps {
  readonly password: string;
  readonly confirmPassword: string;
}

export const PasswordRequirements = ({
  password,
  confirmPassword,
}: PasswordRequirementsProps): React.JSX.Element => {
  const { t } = useTranslation();
  const meetsLength = password.length >= 8;
  const meetsMatch = confirmPassword.length > 0 && password === confirmPassword;

  return (
    <ul className="space-y-2 rounded-nested border border-hairline-strong bg-ethereal-marble/30 p-4">
      <Row met={meetsLength} label={t("auth.requirements.length")} />
      <Row met={meetsMatch} label={t("auth.requirements.match")} />
    </ul>
  );
};
