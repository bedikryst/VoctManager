/**
 * @file AppUpdatePrompt.tsx
 * @description The ambient "a new version is ready" offer in the panel shell —
 * the surface that keeps a fault screen from being the first thing a member
 * learns about a deploy. Same family as the install nudge and the offline badge
 * it stacks with: an ink pill in the shell's floating column, dismissible,
 * absent whenever there is nothing to say.
 *
 * Quiet on purpose. Since `sw.ts` stopped letting a new build seize open tabs,
 * running the previous one is merely stale rather than broken, so this is an
 * invitation and never an alarm.
 * @architecture Enterprise SaaS 2026
 * @module shared/pwa/AppUpdatePrompt
 */
import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { RefreshCw, X } from "lucide-react";

import { Button } from "@/shared/ui/primitives/Button";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { useAppUpdate } from "./useAppUpdate";

export const AppUpdatePrompt = (): React.JSX.Element => {
  const { t } = useTranslation();
  const { shouldOffer, isApplying, applyUpdate, dismiss } = useAppUpdate();

  return (
    <AnimatePresence>
      {shouldOffer && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-none flex w-full justify-center px-4"
        >
          <div className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-white/10 bg-ethereal-ink/95 p-3 shadow-glass-ethereal backdrop-blur-xl">
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-ethereal-gold/30 bg-ethereal-gold/10"
              aria-hidden="true"
            >
              <RefreshCw size={16} className="text-ethereal-gold" />
            </span>

            <div className="min-w-0 flex-1">
              <Eyebrow color="parchment" className="block truncate">
                {t("pwa.update.title", "Nowa odsłona")}
              </Eyebrow>
              <Text color="parchment-muted" className="mt-0.5 text-xs leading-snug">
                {t(
                  "pwa.update.subtitle",
                  "Odśwież, gdy skończysz — wczytamy najnowszą wersję.",
                )}
              </Text>
            </div>

            <Button
              variant="primary"
              size="touch"
              isLoading={isApplying}
              leftIcon={<RefreshCw size={15} aria-hidden="true" />}
              onClick={applyUpdate}
              className="shrink-0"
            >
              {t("pwa.update.action", "Odśwież")}
            </Button>

            <button
              type="button"
              onClick={dismiss}
              aria-label={t("pwa.update.dismiss", "Zamknij")}
              className="shrink-0 self-start rounded-full p-1 text-ethereal-marble/70 transition-colors hover:text-white"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
