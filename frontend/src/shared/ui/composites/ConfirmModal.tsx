/**
 * @file ConfirmModal.tsx
 * @description A high-priority confirmation modal (destructive or warning).
 * Uses a glassmorphism backdrop, portal rendering, and physical spring animations.
 * Strictly decoupled from hardcoded texts via i18next and relies on core primitives.
 * @module shared/ui/composites/ConfirmModal
 */

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cva } from "class-variance-authority";
import { Button } from "@/shared/ui/primitives/Button";
import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";

const iconContainerVariants = cva(
  "p-3 rounded-full flex-shrink-0 transition-colors duration-300",
  {
    variants: {
      isDestructive: {
        true: "bg-red-50 text-red-600",
        false: "bg-amber-50 text-amber-600",
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
  isDestructive = true,
}: ConfirmModalProps): React.ReactPortal | null => {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useBodyScrollLock(isOpen);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) onCancel();
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, isLoading, onCancel]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm cursor-none"
            onClick={!isLoading ? onCancel : undefined}
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-stone-200 flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
          >
            <div className="p-6">
              <div className="flex gap-4 items-start">
                <div className={iconContainerVariants({ isDestructive })}>
                  <AlertTriangle size={24} aria-hidden="true" />
                </div>
                <div className="pt-1">
                  <h3
                    id="confirm-modal-title"
                    className="text-lg font-bold text-stone-900"
                  >
                    {title}
                  </h3>
                  <div className="text-sm text-stone-500 mt-2 leading-relaxed">
                    {description}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-stone-50 px-6 py-4 flex justify-end gap-3 border-t border-stone-100">
              {/* Utilising core primitives for rigorous UI consistency */}
              <Button variant="ghost" onClick={onCancel} disabled={isLoading}>
                {t(cancelTextKey)}
              </Button>
              <Button
                variant={isDestructive ? "danger" : "primary"}
                onClick={onConfirm}
                isLoading={isLoading}
              >
                {t(confirmTextKey)}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
