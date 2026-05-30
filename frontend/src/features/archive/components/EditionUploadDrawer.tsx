/**
 * @file EditionUploadDrawer.tsx
 * @description Slide-over drawer wrapping [EditionUploadZone]. Opens on
 * demand from the Archive header "Wgraj PDF" button rather than living
 * inline — the drop zone is a once-a-week action and shouldn't dominate
 * the daily-use library view.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/EditionUploadDrawer
 */

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Heading, Text } from "@/shared/ui/primitives/typography";
import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";

import { EditionUploadZone } from "./EditionUploadZone";

interface EditionUploadDrawerProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export const EditionUploadDrawer = ({
  isOpen,
  onClose,
}: EditionUploadDrawerProps): React.ReactPortal | null => {
  const { t } = useTranslation();
  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-focus-trap bg-ethereal-ink/20 backdrop-blur-sm"
            aria-hidden="true"
          />
          <motion.div
            initial={{ right: "-100%" }}
            animate={{ right: 0 }}
            exit={{ right: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 z-toast flex w-full flex-col border-l border-ethereal-incense/20 bg-ethereal-parchment shadow-glass-solid md:w-[560px]"
            role="dialog"
            aria-modal="true"
            aria-label={t(
              "archive.upload_drawer.aria",
              "Wgraj partyturę PDF",
            )}
          >
            <header className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 md:px-8 md:pt-8">
              <div className="min-w-0">
                <Heading as="h2" size="2xl" weight="medium" className="font-serif">
                  {t("archive.upload_drawer.title", "Wgraj partyturę")}
                </Heading>
                <Text size="sm" color="graphite" className="mt-1">
                  {t(
                    "archive.upload_drawer.subtitle",
                    "AI rozpozna utwór, doda kompozytora, wyciągnie IPA i tłumaczenia. Pipeline trwa pół minuty.",
                  )}
                </Text>
                <Caption color="muted" className="mt-2 block">
                  {t(
                    "archive.upload_drawer.cost_hint",
                    "Koszt jednego PDF-a: ok. 2-5 ¢ (limit $2 per wydanie).",
                  )}
                </Caption>
              </div>
              <Button
                variant="ghost"
                onClick={onClose}
                aria-label={t("common.actions.close", "Zamknij")}
                className="border border-ethereal-incense/20 bg-ethereal-alabaster/60 p-3 text-ethereal-graphite hover:bg-ethereal-alabaster hover:text-ethereal-ink"
              >
                <X size={18} aria-hidden="true" />
              </Button>
            </header>
            <div className="flex-1 overflow-y-auto px-6 pb-8 md:px-8">
              <EditionUploadZone compact />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
};
