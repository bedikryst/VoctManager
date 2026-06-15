/**
 * @file PasswordRequirements.tsx
 * @description Live "set a password" requirement checklist (≥8 chars, match)
 * shared by the activation and password-reset flows. Coaching only — it mirrors
 * the same rules the hooks enforce on submit.
 * @architecture Enterprise SaaS 2026
 * @module features/auth/components/PasswordRequirements
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Text } from "@/shared/ui/primitives/typography";
import { EASE } from "@/shared/ui/kinematics/motion-presets";

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
    <AnimatePresence>
      {password.length > 0 && (
        <motion.ul
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease: EASE.buttery }}
          className="space-y-2 overflow-hidden rounded-2xl border border-ethereal-incense/15 bg-white/30 p-4"
        >
          <Row
            met={meetsLength}
            label={t("auth.requirements.length", "Co najmniej 8 znaków")}
          />
          <Row
            met={meetsMatch}
            label={t("auth.requirements.match", "Hasła są zgodne")}
          />
        </motion.ul>
      )}
    </AnimatePresence>
  );
};
