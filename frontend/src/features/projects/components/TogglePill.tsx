/**
 * @file TogglePill.tsx
 * @description The score-book cockpit's only binary control — a rounded pill with
 * a filled check when active. Every on/off decision in the tab goes through it
 * (book structure, card elements), so "on" is stated one way everywhere instead
 * of a check circle on one row and a bare gold fill on the next.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/components/TogglePill
 */

import React from "react";
import { Check } from "lucide-react";

import { cn } from "@/shared/lib/utils";

interface TogglePillProps {
  label: string;
  active: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Smaller, quieter variant for secondary (set-once) structural options. */
  subtle?: boolean;
  /**
   * Marker rendered after the label — the card-element pills ride a data-confidence
   * dot here, which is about the piece's data rather than the toggle's state.
   */
  trailing?: React.ReactNode;
  title?: string;
}

export function TogglePill({
  label,
  active,
  onChange,
  disabled = false,
  subtle = false,
  trailing,
  title,
}: TogglePillProps): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      disabled={disabled}
      title={title}
      onClick={() => onChange(!active)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
        subtle ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
        disabled && "cursor-not-allowed opacity-40",
        active
          ? "border-ethereal-gold/45 bg-ethereal-gold/12 text-ethereal-ink"
          : "border-ethereal-ink/12 bg-transparent text-ethereal-graphite/70 hover:border-ethereal-gold/35 hover:text-ethereal-ink",
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full border transition-colors",
          subtle ? "h-3 w-3" : "h-3.5 w-3.5",
          active
            ? "border-ethereal-gold bg-ethereal-gold text-ethereal-alabaster"
            : "border-ethereal-ink/25",
        )}
        aria-hidden="true"
      >
        {active && <Check size={subtle ? 8 : 9} strokeWidth={3} />}
      </span>
      {label}
      {trailing}
    </button>
  );
}
