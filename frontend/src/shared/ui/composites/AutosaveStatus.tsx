/**
 * @file AutosaveStatus.tsx
 * @description Passive save status for instant-save work areas.
 * Shares the anchor of `EditorActionBar` so a single screen region answers
 * "is my work saved?" across the whole hub: deferred surfaces show the action
 * bar ("Unsaved changes → Save"), instant surfaces show this autosave pill
 * ("Saving…" → "Saved"). Failures are intentionally NOT shown here — they stay
 * in the dedicated red toast channel so a transient success never masks an error.
 * @module shared/ui/composites/AutosaveStatus
 */

import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Portal } from "@/shared/lib/dom/Portal";
import { useBottomBarSlot } from "@/shared/lib/dom/useBottomBarSlot";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";

export interface AutosaveStatusProps {
  /** True while at least one autosave mutation for this surface is in flight. */
  isSaving: boolean;
  /** Suppress the success confirmation when a save in the batch failed. */
  saveFailed?: boolean;
  /** Document headers can render the status in flow. */
  placement?: "dock" | "inline";
  /** How long the "Saved" confirmation lingers after saving settles (ms). */
  savedLingerMs?: number;
  /** Optional extra class for the floating wrapper. */
  className?: string;
}

type Phase = "idle" | "saving" | "saved";

const SPRING = { type: "spring" as const, stiffness: 320, damping: 28, mass: 0.9 };

export const AutosaveStatus = ({
  isSaving,
  saveFailed = false,
  placement = "dock",
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
    setPhase(saveFailed ? "idle" : "saved");
    const timeoutId = window.setTimeout(() => setPhase("idle"), savedLingerMs);
    return () => window.clearTimeout(timeoutId);
  }, [isSaving, saveFailed, savedLingerMs]);

  const isSavingPhase = phase === "saving";
  const label = isSavingPhase
    ? t("common.autosave.saving", "Zapisywanie…")
    : t("common.autosave.saved", "Zapisano");

  if (placement === "inline") {
    return (
      <Text as="span" size="sm" color="graphite" role="status" className={className}>
        {phase !== "idle" ? label : null}
      </Text>
    );
  }

  return <DockAutosaveStatus phase={phase} label={label} className={className} />;
};

const DockAutosaveStatus = ({ phase, label, className }: {
  phase: Phase;
  label: string;
  className?: string;
}): React.JSX.Element => {
  const slotRef = useBottomBarSlot();
  const isSavingPhase = phase === "saving";

  return (
    <Portal>
    <AnimatePresence>
      {phase !== "idle" && (
        <motion.div
          key="autosave-status"
          ref={slotRef}
          role="status"
          aria-live="polite"
          initial={{ y: 60, opacity: 0, x: "-50%" }}
          animate={{ y: 0, opacity: 1, x: "-50%" }}
          exit={{ y: 60, opacity: 0, x: "-50%" }}
          transition={SPRING}
          className={cn(
            "pointer-events-none fixed bottom-dock left-1/2 z-dock-bar",
            className,
          )}
        >
          <GlassCard
            variant="solid"
            padding="none"
            isHoverable={false}
            className={cn(
              "rounded-control px-4 py-2",
              isSavingPhase
                ? "border-ethereal-gold/30"
                : "border-ethereal-sage/30",
            )}
            contentClassName="flex-row items-center gap-2"
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
            <Eyebrow
              size="overline-sm"
              color={isSavingPhase ? "graphite" : "sage"}
            >
              {label}
            </Eyebrow>
          </GlassCard>
        </motion.div>
      )}
    </AnimatePresence>
    </Portal>
  );
};
