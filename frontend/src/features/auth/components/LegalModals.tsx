/**
 * @file LegalModals.tsx
 * @description Pre-login modal shell for the Terms of Service and Privacy
 * Policy. Section bodies and the document version live in LegalContent.tsx
 * (shared with the public printable /legal/:type page).
 *
 * It portals to `document.body`: `AuthShell` gives its header a higher stacking
 * order than the `<main>` this modal is rendered from, so an in-tree dialog let
 * the back link and the language switcher float over its own scrim.
 */

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X, Printer } from "lucide-react";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Heading, Eyebrow } from "@/shared/ui/primitives/typography";
import { Button } from "@/shared/ui/primitives/Button";
import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import {
  PrivacyContent,
  TermsContent,
  LEGAL_DOCS_UPDATED_DISPLAY,
} from "./LegalContent";

export interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "privacy" | "terms";
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  onClose,
  type,
}) => {
  const { t } = useTranslation();
  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  // The modal itself has no print styling — the public page does. Open the
  // printable document view instead of window.print()ing the layered modal.
  const handleOpenPrintable = (): void => {
    window.open(`/legal/${type}`, "_blank", "noopener");
  };

  const titleId = `legal-modal-${type}-title`;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-focus-trap flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-ethereal-ink/60 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Same width as the printable `/legal/:type` page: one document, one
              size, whichever way a member opens it. */}
          <div className="relative w-full max-w-3xl">
            <GlassCard
              as={motion.div}
              animationEngine="framer"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              variant="solid"
              padding="none"
              isHoverable={false}
              className="relative flex max-h-[90vh] w-full min-h-0 flex-col overflow-hidden shadow-glass-ethereal"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-4 border-b border-hairline bg-white/5 p-6">
                <div>
                  <Heading id={titleId} size="3xl" weight="medium" color="default">
                    {type === "privacy"
                      ? t("auth.legal.privacy.title")
                      : t("auth.legal.terms.title")}
                  </Heading>
                  <Eyebrow color="muted" className="mt-1">
                    {t("auth.legal.common.last_updated", {
                      date: LEGAL_DOCS_UPDATED_DISPLAY,
                    })}
                  </Eyebrow>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleOpenPrintable}
                    className="hidden sm:flex"
                    leftIcon={<Printer className="h-4 w-4" />}
                  >
                    {t("auth.legal.common.print")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    aria-label={t("auth.legal.common.close_button")}
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </Button>
                </div>
              </div>

              {/* Content Area */}
              {/* No `space-y` here — the document owns its own vertical rhythm. */}
              <div className="custom-scrollbar pointer-events-auto min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white/40 p-6 touch-pan-y">
                {type === "privacy" ? <PrivacyContent /> : <TermsContent />}
              </div>

              {/* Footer */}
              <div className="flex justify-end border-t border-hairline bg-white/50 p-4">
                <Button variant="primary" onClick={onClose}>
                  {t("auth.legal.common.close_button")}
                </Button>
              </div>
            </GlassCard>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
