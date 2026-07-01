/**
 * @file TogglePill.tsx
 * @description Unified binary control for the score-book cockpit — a rounded pill
 * with a filled check when active. Replaces the raw square checkboxes (a form
 * texture) with one premium control language shared across the panel and the
 * per-item rows.
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
}

export function TogglePill({
  label,
  active,
  onChange,
  disabled = false,
  subtle = false,
}: TogglePillProps): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      disabled={disabled}
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
    </button>
  );
}
