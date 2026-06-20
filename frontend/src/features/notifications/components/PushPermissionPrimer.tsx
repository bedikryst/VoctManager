/**
 * @file PushPermissionPrimer.tsx
 * @description "Soft" pre-prompt that explains the value of push notifications
 * before triggering the browser's irreversible permission dialog. Best-practice
 * UX: prevents accidental "Block" decisions which can never be re-asked.
 * @architecture Enterprise SaaS 2026
 * @module notifications/components/PushPermissionPrimer
 */
import React, { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { BellRing, ShieldCheck, Sparkles, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/shared/ui/primitives/Button";
import { Heading, Text } from "@/shared/ui/primitives/typography";
import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";

export interface PushPermissionPrimerProps {
  isOpen: boolean;
  isLoading: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}

export const PushPermissionPrimer: React.FC<PushPermissionPrimerProps> = ({
  isOpen,
  isLoading,
  onAccept,
  onDismiss,
}) => {
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const { t } = useTranslation();

  const HIGHLIGHTS = [
    {
      icon: <BellRing className="w-4 h-4" />,
      label: t("notifications.primer.highlight_essential_label", "Tylko to, co istotne"),
      description: t(
        "notifications.primer.highlight_essential_desc",
        "Zmiany w próbach, zaproszenia do projektów, pilne wiadomości od managera.",
      ),
    },
    {
      icon: <Sparkles className="w-4 h-4" />,
      label: t("notifications.primer.highlight_control_label", "Pełna kontrola"),
      description: t(
        "notifications.primer.highlight_control_desc",
        "Każdy typ zdarzenia możesz włączyć lub wyłączyć osobno.",
      ),
    },
    {
      icon: <ShieldCheck className="w-4 h-4" />,
      label: t("notifications.primer.highlight_security_label", "Bezpieczeństwo"),
      description: t(
        "notifications.primer.highlight_security_desc",
        "Powiadomienia szyfrowane VAPID. Nie udostępniamy ich nikomu.",
      ),
    },
  ];

  useBodyScrollLock(isOpen);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isLoading) onDismiss();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, isLoading, onDismiss]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-(--z-toast) flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-ethereal-ink/40 backdrop-blur-sm"
            onClick={!isLoading ? onDismiss : undefined}
            aria-hidden="true"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: "spring", stiffness: 360, damping: 32 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="relative w-full max-w-md bg-ethereal-marble rounded-3xl shadow-glass-solid overflow-hidden border border-ethereal-incense/20"
          >
            <button
              type="button"
              onClick={onDismiss}
              disabled={isLoading}
              aria-label={t("common.actions.close")}
              className="absolute top-4 right-4 p-2 rounded-lg text-ethereal-graphite/60 hover:text-ethereal-ink hover:bg-ethereal-parchment/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="px-7 pt-7 pb-2">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-ethereal-gold/30 via-ethereal-gold/10 to-transparent flex items-center justify-center mb-5 ring-1 ring-ethereal-gold/30">
                <BellRing className="w-6 h-6 text-ethereal-gold" />
              </div>

              <Heading as="h3" id={titleId} size="lg" weight="bold">
                {t("notifications.primer.title", "Włącz powiadomienia push")}
              </Heading>
              <Text id={descriptionId} color="muted" className="mt-2 leading-relaxed">
                {t(
                  "notifications.primer.description",
                  "Zaraz pojawi się okienko przeglądarki z prośbą o zgodę. Po jej udzieleniu będziesz otrzymywać powiadomienia bezpośrednio na tym urządzeniu — nawet gdy aplikacja jest zamknięta.",
                )}
              </Text>
            </div>

            <ul className="px-7 py-5 space-y-3">
              {HIGHLIGHTS.map((item) => (
                <li key={item.label} className="flex items-start gap-3">
                  <span className="mt-0.5 p-1.5 rounded-lg bg-ethereal-parchment/50 text-ethereal-gold shrink-0">
                    {item.icon}
                  </span>
                  <div>
                    <Text size="sm" weight="medium">
                      {item.label}
                    </Text>
                    <Text size="xs" color="muted" className="mt-0.5">
                      {item.description}
                    </Text>
                  </div>
                </li>
              ))}
            </ul>

            <div className="bg-ethereal-alabaster px-7 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 border-t border-ethereal-incense/10">
              <Button variant="ghost" onClick={onDismiss} disabled={isLoading}>
                {t("notifications.primer.not_now", "Nie teraz")}
              </Button>
              <Button variant="primary" onClick={onAccept} isLoading={isLoading}>
                {t("notifications.primer.enable", "Włącz powiadomienia")}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
