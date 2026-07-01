/**
 * @file CardElementPills.tsx
 * @description The single card-element picker shared by both score-book surfaces:
 * the package settings (book-wide default) and the per-item designer (override).
 * One control, one element vocabulary — so the global default and the per-item
 * deviation read identically. The per-item surface additionally passes a
 * readiness resolver to paint each pill's data-confidence dot; the global default
 * omits it (readiness is a per-piece signal).
 * @architecture Enterprise SaaS 2026
 * @module features/projects/components/CardElementPills
 */

import React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import type { CardElement, ElementStatus } from "../api/project.service";

interface CardElementPillsProps {
  /** Available elements, in canonical (print) order. */
  elements: CardElement[];
  /** Currently-selected elements. */
  selected: ReadonlySet<CardElement>;
  onToggle: (element: CardElement) => void;
  /** Dim + block interaction when the card master switch is off. */
  disabled?: boolean;
  /** Per-item only: resolves the data-confidence status painted as a leading dot
   *  (with a screen-reader label). Omitted on the global default row. */
  statusFor?: (element: CardElement) => ElementStatus;
}

const STATUS_DOT: Record<ElementStatus, string> = {
  ready: "bg-ethereal-sage",
  low: "bg-ethereal-gold",
  missing: "bg-ethereal-ink/20",
  // Hollow ring: "cannot exist here" (piece already in the book's language),
  // visually distinct from the filled "data missing" dot.
  na: "border border-ethereal-ink/30 bg-transparent",
};

// Screen-reader equivalent of the coloured status dot (which is aria-hidden),
// so non-sighted users learn each element's data state, not just the row badge.
const STATUS_SR: Record<ElementStatus, { key: string; fallback: string }> = {
  ready: { key: "projects.score_package.element_status.ready", fallback: "dane gotowe" },
  low: { key: "projects.score_package.element_status.low", fallback: "niska pewność danych" },
  missing: { key: "projects.score_package.element_status.missing", fallback: "brak danych" },
  na: { key: "projects.score_package.element_status.na", fallback: "nie dotyczy" },
};

export function CardElementPills({
  elements,
  selected,
  onToggle,
  disabled = false,
  statusFor,
}: CardElementPillsProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {elements.map((element) => {
        const on = selected.has(element);
        const status = statusFor?.(element);
        return (
          <button
            key={element}
            type="button"
            role="switch"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onToggle(element)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
              disabled && "cursor-not-allowed opacity-40",
              on
                ? "border-ethereal-gold/45 bg-ethereal-gold/12 text-ethereal-ink"
                : "border-ethereal-ink/12 bg-transparent text-ethereal-graphite/70 hover:border-ethereal-gold/35 hover:text-ethereal-ink",
            )}
          >
            {status && (
              <span
                className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status])}
                aria-hidden="true"
              />
            )}
            {t(`projects.score_package.elements.${element}`, element)}
            {status && (
              <span className="sr-only">
                {t(STATUS_SR[status].key, STATUS_SR[status].fallback)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
