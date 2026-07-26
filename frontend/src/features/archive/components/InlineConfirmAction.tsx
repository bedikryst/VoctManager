/**
 * @file InlineConfirmAction.tsx
 * @description The archive's arm-then-confirm control: one icon button that,
 * on the first press, expands into a labelled confirm plus a way out. It exists
 * for irreversible per-row work that does not deserve a modal — deleting one
 * translation, aborting one ingestion mid-flight.
 *
 * It is one component because the archive had typed the same affordance twice,
 * in two heights and two corner radii, for the two actions that use it. The
 * caller supplies the icon, the labels and the tone; the shape is not theirs.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/InlineConfirmAction
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2, X, type LucideIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Eyebrow } from "@/shared/ui/primitives/typography";

interface InlineConfirmActionProps {
  /** Resting icon — what the action is, before it is armed. */
  readonly icon: LucideIcon;
  /** Accessible name of the resting button (also its tooltip). */
  readonly label: string;
  /** Short verb shown once armed — "Usuń", "Przerwij". */
  readonly confirmLabel: string;
  readonly onConfirm: () => void;
  readonly isPending?: boolean;
}

export const InlineConfirmAction = ({
  icon: Icon,
  label,
  confirmLabel,
  onConfirm,
  isPending = false,
}: InlineConfirmActionProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [isArmed, setIsArmed] = useState(false);

  if (!isArmed) {
    return (
      <button
        type="button"
        onClick={() => setIsArmed(true)}
        aria-label={label}
        title={label}
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-hairline-strong",
          "text-ethereal-graphite/60 transition-colors hover:border-ethereal-crimson/40 hover:text-ethereal-crimson",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
        )}
      >
        <Icon size={14} strokeWidth={1.8} aria-hidden="true" />
      </button>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={onConfirm}
        disabled={isPending}
        aria-label={confirmLabel}
        className={cn(
          "flex h-8 items-center gap-1 rounded-control border border-ethereal-crimson/40 bg-ethereal-crimson/10 px-2",
          "text-ethereal-crimson",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-crimson/40 disabled:opacity-60",
        )}
      >
        {isPending ? (
          <Loader2 size={12} className="animate-spin" aria-hidden="true" />
        ) : (
          <Check size={12} strokeWidth={2.2} aria-hidden="true" />
        )}
        <Eyebrow size="overline-sm" color="inherit">
          {confirmLabel}
        </Eyebrow>
      </button>
      <button
        type="button"
        onClick={() => setIsArmed(false)}
        aria-label={t("common.actions.cancel", "Anuluj")}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-control border border-hairline-strong",
          "text-ethereal-graphite/60 transition-colors hover:text-ethereal-ink",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
        )}
      >
        <X size={14} strokeWidth={1.8} aria-hidden="true" />
      </button>
    </div>
  );
};
