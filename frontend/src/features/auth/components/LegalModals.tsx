/**
 * @file LegalModals.tsx
 * @description Pre-login modal shell for the Terms of Service and Privacy
 * Policy. Section bodies and the document version live in LegalContent.tsx
 * (shared with the public printable /legal/:type page).
 */

import React from "react";
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

  if (!isOpen) return null;

  // The modal itself has no print styling — the public page does. Open the
  // printable document view instead of window.print()ing the layered modal.
  const handleOpenPrintable = (): void => {
    window.open(`/legal/${type}`, "_blank", "noopener");
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-20 flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-ethereal-ink/60 backdrop-blur-sm"
          aria-hidden="true"
        />

        <div className="relative w-full max-w-4xl">
          <GlassCard
            as={motion.div}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            variant="solid"
            padding="none"
            isHoverable={false}
            className="relative w-full max-h-[90vh] flex flex-col min-h-0 shadow-glass-ethereal overflow-hidden"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-ethereal-incense/10 bg-white/5">
              <div>
                <Heading size="3xl" weight="medium" color="default">
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
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenPrintable}
                  className="hidden sm:flex"
                >
                  <Printer className="w-4 h-4 ml-3" />
                  {t("auth.legal.common.print")}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="rounded-full"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Content Area */}
            <div className="min-h-0 flex-1 overflow-y-auto touch-pan-y overscroll-contain pointer-events-auto p-6 space-y-8 custom-scrollbar bg-white/40">
              {type === "privacy" ? <PrivacyContent /> : <TermsContent />}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-ethereal-incense/10 flex justify-end bg-white/50">
              <Button variant="primary" onClick={onClose} className="mr-6">
                {t("auth.legal.common.close_button")}
              </Button>
            </div>
          </GlassCard>
        </div>
      </div>
    </AnimatePresence>
  );
};
