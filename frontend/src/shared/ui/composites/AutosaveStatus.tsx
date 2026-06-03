/**
 * @file AutosaveStatus.tsx
 * @description Passive, bottom-center save-state pill for instant-save work areas.
 * Shares the anchor of `EditorActionBar` so a single screen region answers
 * "is my work saved?" across the whole hub: deferred surfaces show the action
 * bar ("Unsaved changes → Save"), instant surfaces show this autosave pill
 * ("Saving…" → "Saved"). Failures are intentionally NOT shown here — they stay
 * in the dedicated red toast channel so a transient success never masks an error.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/AutosaveStatus
 */

import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Text } from "@/shared/ui/primitives/typography";

export interface AutosaveStatusProps {
  /** True while at least one autosave mutation for this surface is in flight. */
  isSaving: boolean;
  /** How long the "Saved" confirmation lingers after saving settles (ms). */
  savedLingerMs?: number;
  /** Optional extra class for the floating wrapper. */
  className?: string;
}

type Phase = "idle" | "saving" | "saved";

const SPRING = { type: "spring" as const, stiffness: 320, damping: 28, mass: 0.9 };

export const AutosaveStatus = ({
  isSaving,
  savedLingerMs = 1800,
  className,
}: AutosaveStatusProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>("idle");
  const wasSaving = useRef(false);

  useEffect(() => {
    if (isSaving) {
      wasSaving.current = true;
      setPhase("saving");
      return;
    }

    if (!wasSaving.current) {
      return;
    }

    // Saving just settled — show a brief confirmation, then fade to idle.
    wasSaving.current = false;
    setPhase("saved");
    const timeoutId = window.setTimeout(() => setPhase("idle"), savedLingerMs);
    return () => window.clearTimeout(timeoutId);
  }, [isSaving, savedLingerMs]);

  const isSavingPhase = phase === "saving";

  return (
    <AnimatePresence>
      {phase !== "idle" && (
        <motion.div
          key="autosave-status"
          role="status"
          aria-live="polite"
          initial={{ y: 60, opacity: 0, x: "-50%" }}
          animate={{ y: 0, opacity: 1, x: "-50%" }}
          exit={{ y: 60, opacity: 0, x: "-50%" }}
          transition={SPRING}
          className={cn(
            "pointer-events-none fixed bottom-6 left-1/2 z-(--z-toast) md:bottom-10",
            className,
          )}
        >
          <GlassCard
            variant="solid"
            padding="none"
            isHoverable={false}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2",
              isSavingPhase
                ? "border-ethereal-gold/30"
                : "border-ethereal-sage/30",
            )}
          >
            {isSavingPhase ? (
              <Loader2
                size={14}
                className="animate-spin text-ethereal-gold"
                aria-hidden="true"
              />
            ) : (
              <Check
                size={14}
                strokeWidth={3}
                className="text-ethereal-sage"
                aria-hidden="true"
              />
            )}
            <Text
              size="xs"
              weight="bold"
              className={cn(
                "uppercase tracking-widest",
                isSavingPhase ? "text-ethereal-graphite" : "text-ethereal-sage",
              )}
            >
              {isSavingPhase
                ? t("common.autosave.saving", "Zapisywanie…")
                : t("common.autosave.saved", "Zapisano")}
            </Text>
          </GlassCard>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
