/**
 * @file ConfirmModal.tsx
 * @description A high-priority confirmation modal (destructive or warning).
 * Uses a glassmorphism backdrop, portal rendering, and physical spring animations.
 * Strictly decoupled from hardcoded texts via i18next and relies on core primitives.
 * @module shared/ui/composites/ConfirmModal
 */

import React, { useEffect, useEffectEvent, useId, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cva } from "class-variance-authority";
import { Button } from "@/shared/ui/primitives/Button";
import { Heading, Text } from "@/shared/ui/primitives/typography";
import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";

const iconContainerVariants = cva(
  "p-3 rounded-full flex-shrink-0 transition-colors duration-300",
  {
    variants: {
      isDestructive: {
        true: "bg-ethereal-crimson/10 text-ethereal-crimson",
        false: "bg-ethereal-gold/10 text-ethereal-gold",
      },
    },
    defaultVariants: {
      isDestructive: true,
    },
  },
);

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string | React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  confirmTextKey?: string;
  cancelTextKey?: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export const ConfirmModal = ({
  isOpen,
  title,
  description,
  onConfirm,
  onCancel,
  isLoading = false,
  confirmTextKey = "common.actions.delete",
  cancelTextKey = "common.actions.cancel",
  confirmText,
  cancelText,
  isDestructive = true,
}: ConfirmModalProps): React.ReactPortal | null => {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  useBodyScrollLock(isOpen);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleEscape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape" && !isLoading) {
      onCancel();
    }
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [handleEscape, isOpen]);

  if (!mounted) return null;

  const resolvedConfirmText = confirmText ?? t(confirmTextKey);
  const resolvedCancelText = cancelText ?? t(cancelTextKey);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-(--z-toast) flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-ethereal-ink/40 backdrop-blur-sm cursor-none"
            onClick={!isLoading ? onCancel : undefined}
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-ethereal-marble rounded-2xl shadow-glass-solid overflow-hidden border border-ethereal-incense/20 flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
          >
            <div className="p-6">
              <div className="flex gap-4 items-start">
                <div className={iconContainerVariants({ isDestructive })}>
                  <AlertTriangle size={24} aria-hidden="true" />
                </div>
                <div className="pt-1">
                  <Heading as="h3" id={titleId} size="lg" weight="bold">
                    {title}
                  </Heading>
                  <Text id={descriptionId} className="mt-2" color="muted">
                    {description}
                  </Text>
                </div>
              </div>
            </div>

            <div className="bg-ethereal-alabaster px-6 py-4 flex justify-end gap-3 border-t border-ethereal-incense/10">
              <Button variant="ghost" onClick={onCancel} disabled={isLoading}>
                {resolvedCancelText}
              </Button>
              <Button
                variant={isDestructive ? "destructive" : "primary"}
                onClick={onConfirm}
                isLoading={isLoading}
              >
                {resolvedConfirmText}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
