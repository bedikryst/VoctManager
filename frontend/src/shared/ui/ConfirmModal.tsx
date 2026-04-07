/**
 * @file ConfirmModal.tsx
 * @description A high-priority confirmation modal (destructive or warning).
 * Uses a glassmorphism backdrop, portal rendering, and physical spring animations.
 * Fully decoupled from hardcoded texts for i18n support.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/ConfirmModal
 */

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string | React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export default function ConfirmModal({
  isOpen,
  title,
  description,
  onConfirm,
  onCancel,
  isLoading = false,
  confirmText,
  cancelText,
  isDestructive = true, // Domyślnie true, aby zachować zgodność z Twoimi starymi przyciskami usuwania
}: ConfirmModalProps): React.ReactPortal | null {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  // Używamy portalu, więc upewniamy się, że renderujemy tylko po stronie klienta
  useEffect(() => {
    setMounted(true);
  }, []);

  // Blokowanie przewijania strony pod modalem i obsługa Escape
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape" && !isLoading) onCancel();
      };
      window.addEventListener("keydown", handleEscape);
      return () => {
        document.body.style.overflow = "unset";
        window.removeEventListener("keydown", handleEscape);
      };
    } else {
      document.body.style.overflow = "unset";
    }
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
            className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
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
                <div
                  className={`p-3 rounded-full flex-shrink-0 ${
                    isDestructive
                      ? "bg-red-50 text-red-600"
                      : "bg-amber-50 text-amber-600"
                  }`}
                >
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
              <button
                disabled={isLoading}
                onClick={onCancel}
                className="px-4 py-2 text-sm font-bold text-stone-600 hover:bg-stone-200 rounded-xl transition-colors disabled:opacity-50"
              >
                {cancelText || t("common.actions.cancel", "Anuluj")}
              </button>
              <button
                disabled={isLoading}
                onClick={onConfirm}
                className={`px-4 py-2 text-sm font-bold text-white rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2 ${
                  isDestructive
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-[#002395] hover:bg-blue-800"
                }`}
              >
                {isLoading
                  ? t("common.actions.loading", "Przetwarzanie...")
                  : confirmText || t("common.actions.delete", "Usuń")}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
