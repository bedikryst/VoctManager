/**
 * @file FilterTokens.tsx
 * @description The row of removable "this is narrowing your view" chips that
 * sits under a search bar. Three features had typed it three times, each as a
 * bare `rounded-full` button — a private chip off the radius scale, which is
 * the shape `Badge` exists to prevent. Here the button is a bare wrapper and
 * the `Badge` draws the chip; a token carries user content (a typed phrase, a
 * company name), so it is `casing="natural"`.
 *
 * `FilterToggle` is the same chip as a quick filter: an exception worth hunting
 * for, named with its size ("2 do przeglądu"), that narrows the list while it
 * is pressed. Off, it is an outlined chip; on, it takes the gold tint
 * `ToolbarButton` uses for a mode that is on, and the × a token carries, since
 * a press then clears it. A chip, not a `Button`: a filter beside "Zaznacz
 * wiele" in the same outlined weight read as one more action.
 * @module shared/ui/composites/FilterTokens
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw, X } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";

export interface FilterToken {
  readonly id: string;
  readonly label: string;
  readonly clear: () => void;
}

interface FilterTokensProps {
  readonly tokens: readonly FilterToken[];
  /** Rendered beside the chips — typically the "N of M" line. */
  readonly summary?: React.ReactNode;
  /** Offered only when clearing everything at once is more than one click. */
  readonly onClearAll?: () => void;
  readonly className?: string;
}

export const FilterTokens = ({
  tokens,
  summary,
  onClearAll,
  className,
}: FilterTokensProps): React.JSX.Element | null => {
  const { t } = useTranslation();

  if (tokens.length === 0) return summary ? <>{summary}</> : null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {summary}
      {tokens.map((token) => (
        <button
          key={token.id}
          type="button"
          onClick={token.clear}
          aria-label={t("common.filters.remove_token", {
            defaultValue: "Usuń filtr: {{label}}",
            label: token.label,
          })}
          className="rounded-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40"
        >
          <Badge
            casing="natural"
            variant="outline"
            className="cursor-pointer hover:border-ethereal-gold/40 hover:text-ethereal-ink"
          >
            {token.label}
            <X size={11} aria-hidden="true" />
          </Badge>
        </button>
      ))}
      {onClearAll && tokens.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          leftIcon={<RotateCcw size={13} aria-hidden="true" />}
        >
          {t("common.filters.clear_all", "Wyczyść filtry")}
        </Button>
      )}
    </div>
  );
};

interface FilterToggleProps {
  readonly label: string;
  readonly pressed: boolean;
  readonly onToggle: () => void;
}

export const FilterToggle = ({
  label,
  pressed,
  onToggle,
}: FilterToggleProps): React.JSX.Element => (
  // The chip is 26 px tall; the button's ::after reaches 8 px above and below
  // it, so a thumb gets a target of about 42 px without the line growing.
  <button
    type="button"
    aria-pressed={pressed}
    onClick={onToggle}
    className="relative rounded-chip after:absolute after:inset-x-0 after:-inset-y-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40"
  >
    <Badge
      casing="natural"
      variant="outline"
      className={cn(
        "cursor-pointer tabular-nums hover:border-ethereal-gold/40 hover:text-ethereal-ink",
        pressed && "border-ethereal-gold/50 bg-ethereal-gold/15 text-ethereal-ink",
      )}
    >
      {label}
      {pressed && <X size={11} aria-hidden="true" />}
    </Badge>
  </button>
);
