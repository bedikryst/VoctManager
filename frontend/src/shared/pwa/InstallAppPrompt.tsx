/**
 * @file InstallAppPrompt.tsx
 * @description Quiet, dismissible "install the app" card surfaced in the panel
 * shell. Offers a one-tap install on Chromium, step instructions on iOS Safari,
 * and never shows once installed or recently dismissed ({@link useInstallPrompt}).
 * @module shared/pwa/InstallAppPrompt
 */
import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Download, Share, SquarePlus, X } from "lucide-react";

import { Button } from "@/shared/ui/primitives/Button";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { useInstallPrompt } from "./useInstallPrompt";

export const InstallAppPrompt = (): React.JSX.Element => {
  const { t } = useTranslation();
  const { shouldOffer, platform, promptInstall, dismiss } = useInstallPrompt();

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
            <img
              src="/icons/icon-192.png"
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 shrink-0 rounded-xl border border-white/10"
            />

            <div className="min-w-0 flex-1">
              <Eyebrow color="parchment" className="block truncate">
                {t("pwa.install.title", "Zainstaluj VoctManager")}
              </Eyebrow>

              {platform === "ios" ? (
                <Text color="parchment-muted" className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs leading-snug">
                  <span>{t("pwa.install.ios_step_1", "Dotknij")}</span>
                  <Share size={13} className="inline text-ethereal-gold" aria-hidden="true" />
                  <span>{t("pwa.install.ios_step_2", "a potem „Do ekranu początkowego”")}</span>
                  <SquarePlus size={13} className="inline text-ethereal-gold" aria-hidden="true" />
                </Text>
              ) : (
                <Text color="parchment-muted" className="mt-0.5 text-xs leading-snug">
                  {t("pwa.install.subtitle", "Pełny ekran i ćwiczenia offline.")}
                </Text>
              )}
            </div>

            {platform === "chromium" && (
              <Button
                variant="primary"
                size="touch"
                leftIcon={<Download size={15} aria-hidden="true" />}
                onClick={() => void promptInstall()}
                className="shrink-0"
              >
                {t("pwa.install.action", "Zainstaluj")}
              </Button>
            )}

            <button
              type="button"
              onClick={dismiss}
              aria-label={t("pwa.install.dismiss", "Zamknij")}
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
