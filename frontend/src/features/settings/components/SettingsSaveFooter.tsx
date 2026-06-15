/**
 * @file SettingsSaveFooter.tsx
 * @description Shared submit footer for settings forms: animated "saved"
 * confirmation plus the primary save button gated on dirty state. Keeps the
 * save gesture identical across every settings pane.
 * @module features/settings/components/SettingsSaveFooter
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/shared/ui/primitives/Button";
import { Caption } from "@/shared/ui/primitives/typography";
import { DURATION, EASE } from "@/shared/ui/kinematics/motion-presets";

interface SettingsSaveFooterProps {
  readonly isDirty: boolean;
  readonly isPending: boolean;
  readonly showSuccess: boolean;
  readonly label?: string;
}

export const SettingsSaveFooter = ({
  isDirty,
  isPending,
  showSuccess,
  label,
}: SettingsSaveFooterProps): React.JSX.Element => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-end gap-4 pt-2">
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: DURATION.fast, ease: EASE.buttery }}
            className="flex items-center gap-2"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-ethereal-sage" />
            <Caption color="sage">
              {t("common.state.saved", "Zapisano pomyślnie")}
            </Caption>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        type="submit"
        isLoading={isPending}
        disabled={!isDirty}
        className={!isDirty ? "opacity-50 grayscale" : undefined}
      >
        {label ?? t("common.actions.save", "Zapisz zmiany")}
      </Button>
    </div>
  );
};
