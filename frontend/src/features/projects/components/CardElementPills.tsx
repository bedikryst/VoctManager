/**
 * @file CardElementPills.tsx
 * @description The single card-element picker shared by both score-book surfaces:
 * the package settings (book-wide default) and the per-item designer (override).
 * One control, one element vocabulary — so the global default and the per-item
 * deviation read identically, and both state "on" the way every other toggle in
 * the tab does. The per-item surface additionally passes a readiness resolver to
 * paint each pill's data-confidence dot; the global default omits it (readiness
 * is a per-piece signal). `CardElementLegend` decodes those dots and belongs
 * beside the pills — it explains nothing anywhere else.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/components/CardElementPills
 */

import React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { Caption } from "@/shared/ui/primitives/typography";

import type { CardElement, ElementStatus } from "../api/project.service";
import { TogglePill } from "./TogglePill";

interface CardElementPillsProps {
  /** Available elements, in canonical (print) order. */
  elements: CardElement[];
  /** Currently-selected elements. */
  selected: ReadonlySet<CardElement>;
  onToggle: (element: CardElement) => void;
  /** Dim + block interaction when the card master switch is off. */
  disabled?: boolean;
  /** Per-item only: resolves the data-confidence status painted as a trailing dot
   *  (with a screen-reader label). Omitted on the global default row. */
  statusFor?: (element: CardElement) => ElementStatus;
}

const STATUS_ORDER = ["ready", "low", "missing", "na"] as const;

const STATUS_DOT: Record<ElementStatus, string> = {
  ready: "bg-ethereal-sage",
  low: "bg-ethereal-gold",
  missing: "bg-ethereal-ink/20",
  // Hollow ring: "cannot exist here" (piece already in the book's language),
  // visually distinct from the filled "data missing" dot.
  na: "border border-ethereal-ink/30 bg-transparent",
};

const STATUS_LABEL: Record<ElementStatus, { key: string; fallback: string }> = {
  ready: { key: "projects.score_package.element_status.ready", fallback: "Dane gotowe" },
  low: { key: "projects.score_package.element_status.low", fallback: "Niska pewność" },
  missing: { key: "projects.score_package.element_status.missing", fallback: "Brak danych" },
  na: { key: "projects.score_package.element_status.na", fallback: "Nie dotyczy" },
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
        const status = statusFor?.(element);
        const statusLabel = status
          ? t(STATUS_LABEL[status].key, STATUS_LABEL[status].fallback)
          : undefined;
        return (
          <TogglePill
            key={element}
            label={t(`projects.score_package.elements.${element}`, element)}
            active={selected.has(element)}
            disabled={disabled}
            onChange={() => onToggle(element)}
            title={statusLabel}
            trailing={
              status && (
                <>
                  <span
                    className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status])}
                    aria-hidden="true"
                  />
                  <span className="sr-only">{statusLabel}</span>
                </>
              )
            }
          />
        );
      })}
    </div>
  );
}

/** Decodes the confidence dots the per-item pills carry. */
export function CardElementLegend(): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {STATUS_ORDER.map((status) => (
        <span key={status} className="flex items-center gap-1.5">
          <span
            className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status])}
            aria-hidden="true"
          />
          <Caption color="muted">
            {t(STATUS_LABEL[status].key, STATUS_LABEL[status].fallback)}
          </Caption>
        </span>
      ))}
    </div>
  );
}
