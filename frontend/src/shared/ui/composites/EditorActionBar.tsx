/**
 * @file EditorActionBar.tsx
 * @description Floating, accessible save-bar for editor surfaces.
 * Replaces the previously duplicated per-feature FAB pattern with one
 * canonical, motion-aware composite. Supports two confirm modes:
 *  - Imperative: pass `onConfirm` (default).
 *  - Form-bound: pass `formId` to make the confirm button submit a foreign form.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/EditorActionBar
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { Save } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";

export interface EditorActionBarProps {
  /** Visibility flag — typically wired to a dirty-state boolean. */
  isOpen: boolean;
  /** Eyebrow label above the description. Defaults to a localized "Unsaved changes". */
  eyebrow?: string;
  /** Short, action-oriented summary of what is pending. */
  description: string;
  /** Optional badge / chip slot rendered inline with the copy (e.g. counters). */
  metrics?: React.ReactNode;
  /** Cancel handler. Omit to hide the cancel button. */
  onCancel?: () => void;
  /** Confirm handler. Ignored when `formId` is set (form submission takes over). */
  onConfirm?: () => void;
  /** Override the cancel-button copy. Falls back to the i18n "common.actions.cancel" key. */
  cancelText?: string;
  /** Override the confirm-button copy. Falls back to the i18n "common.actions.save" key. */
  confirmText?: string;
  /** Override the confirm-button icon. Defaults to a `Save` glyph. */
  confirmIcon?: React.ReactNode;
  /** When provided, the confirm button becomes `type="submit"` for that form. */
  formId?: string;
  /** Disables both buttons and shows a spinner on confirm. */
  isLoading?: boolean;
  /** Optional extra class for the bar wrapper. */
  className?: string;
}

const SPRING = { type: "spring" as const, stiffness: 320, damping: 28, mass: 0.9 };

export const EditorActionBar = ({
  isOpen,
  eyebrow,
  description,
  metrics,
  onCancel,
  onConfirm,
  cancelText,
  confirmText,
  confirmIcon,
  formId,
  isLoading = false,
  className,
}: EditorActionBarProps): React.JSX.Element => {
  const { t } = useTranslation();

  const resolvedEyebrow =
    eyebrow ?? t("common.editor_action_bar.unsaved", "Niezapisane zmiany");
  const resolvedConfirm = confirmText ?? t("common.actions.save", "Zapisz");
  const resolvedCancel = cancelText ?? t("common.actions.cancel", "Anuluj");

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="editor-action-bar"
          role="status"
          aria-live="polite"
          initial={{ y: 100, opacity: 0, x: "-50%" }}
          animate={{ y: 0, opacity: 1, x: "-50%" }}
          exit={{ y: 100, opacity: 0, x: "-50%" }}
          transition={SPRING}
          className={cn(
            "fixed bottom-6 left-1/2 z-(--z-toast) w-[min(92vw,32rem)] md:bottom-10",
            className,
          )}
        >
          <GlassCard
            variant="solid"
            padding="sm"
            isHoverable={false}
            className="flex flex-col gap-3 rounded-2xl border-ethereal-gold/30 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1 pl-1 sm:pl-2">
              <div className="flex items-center gap-2">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-ethereal-gold shadow-[0_0_0_4px_rgba(194,168,120,0.18)]"
                  aria-hidden="true"
                />
                <Eyebrow color="gold">{resolvedEyebrow}</Eyebrow>
                {metrics && (
                  <span className="ml-1 flex shrink-0 items-center gap-1.5">
                    {metrics}
                  </span>
                )}
              </div>
              <Text size="xs" color="muted" className="truncate">
                {description}
              </Text>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2">
              {onCancel && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onCancel}
                  disabled={isLoading}
                >
                  {resolvedCancel}
                </Button>
              )}
              <Button
                type={formId ? "submit" : "button"}
                form={formId}
                variant="primary"
                size="sm"
                onClick={formId ? undefined : onConfirm}
                disabled={isLoading}
                isLoading={isLoading}
                leftIcon={
                  isLoading
                    ? undefined
                    : (confirmIcon ?? <Save size={14} aria-hidden="true" />)
                }
              >
                {resolvedConfirm}
              </Button>
            </div>
          </GlassCard>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
