/**
 * @file ConfirmModal.tsx
 * @description A high-priority confirmation modal (destructive or warning).
 * Uses a glassmorphism backdrop, portal rendering, and physical spring animations.
 * Strictly decoupled from hardcoded texts via i18next and relies on core primitives.
 * Focus moves in as it opens, Tab stays inside, and focus returns to the opener
 * as it closes.
 * @module shared/ui/composites/ConfirmModal
 */

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cva } from "class-variance-authority";
import { Button, type ButtonProps } from "@/shared/ui/primitives/Button";
import { Heading, Text } from "@/shared/ui/primitives/typography";
import { BodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import { useFocusTrap } from "@/shared/lib/dom/useFocusTrap";
import { OVERLAY_POP_TRANSITION } from "@/shared/ui/kinematics/motion-presets";

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
  confirmDisabled?: boolean;
  children?: React.ReactNode;
  onExitComplete?: () => void;
  confirmTextKey?: string;
  cancelTextKey?: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  /**
   * Replaces the warning triangle; tinted by `isDestructive` like it. `null`
   * drops the icon, and the title, then the only head of the dialog, is set a
   * step larger.
   */
  icon?: React.ReactNode | null;
  /** The buttons' casing; a screen whose buttons are sentence case passes it. */
  casing?: ButtonProps["casing"];
}

export const ConfirmModal = ({
  isOpen,
  title,
  description,
  onConfirm,
  onCancel,
  isLoading = false,
  confirmDisabled = false,
  children,
  onExitComplete,
  confirmTextKey = "common.actions.delete",
  cancelTextKey = "common.actions.cancel",
  confirmText,
  cancelText,
  isDestructive = true,
  icon,
  casing,
}: ConfirmModalProps): React.ReactPortal | null => {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Focus opens on the safe answer: Cancel when confirming destroys something,
  // the confirmation otherwise. It returns to the opener on close.
  useFocusTrap(dialogRef, isOpen && mounted, isDestructive ? cancelRef : confirmRef);

  const handleEscape = useCallback((event: KeyboardEvent) => {
    if (event.key === "Escape" && !isLoading) {
      onCancel();
    }
  }, [isLoading, onCancel]);

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
    <AnimatePresence onExitComplete={onExitComplete}>
      {isOpen && (
        <div className="fixed inset-0 z-focus-trap flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            // A scrim is the absence of light, not a surface: it is black on
            // both themes, which is why it is the rare literal here. `ink` put
            // it one rung from black on the light theme and inverted it into a
            // white veil on the dark one.
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={!isLoading ? onCancel : undefined}
            aria-hidden="true"
          />
          <BodyScrollLock />
          <motion.div
            initial={{ opacity: 0, transform: "translateY(20px) scale(0.95)" }}
            animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
            exit={{ opacity: 0, transform: "translateY(20px) scale(0.95)" }}
            transition={OVERLAY_POP_TRANSITION}
            ref={dialogRef}
            tabIndex={-1}
            className="relative w-full max-w-md bg-ethereal-marble rounded-nested shadow-glass-solid overflow-hidden border border-ethereal-incense/20 flex flex-col outline-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
          >
            <div className="p-6">
              <div className="flex gap-4 items-start">
                {icon !== null && (
                  <div className={iconContainerVariants({ isDestructive })}>
                    {icon ?? <AlertTriangle size={24} aria-hidden="true" />}
                  </div>
                )}
                <div className={icon === null ? undefined : "pt-1"}>
                  <Heading
                    as="h3"
                    id={titleId}
                    size={icon === null ? "2xl" : "lg"}
                    weight={icon === null ? "medium" : "bold"}
                  >
                    {title}
                  </Heading>
                  <Text id={descriptionId} className="mt-2" color="muted">
                    {description}
                  </Text>
                </div>
              </div>
              {children}
            </div>

            <div className="bg-ethereal-alabaster px-6 py-4 flex justify-end gap-3 border-t border-ethereal-incense/10">
              <Button ref={cancelRef} variant="ghost" casing={casing} onClick={onCancel} disabled={isLoading}>
                {resolvedCancelText}
              </Button>
              <Button
                ref={confirmRef}
                variant={isDestructive ? "destructive" : "primary"}
                casing={casing}
                onClick={onConfirm}
                isLoading={isLoading}
                disabled={confirmDisabled}
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
