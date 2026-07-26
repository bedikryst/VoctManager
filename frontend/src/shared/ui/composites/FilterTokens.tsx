/**
 * @file FilterTokens.tsx
 * @description The row of removable "this is narrowing your view" chips that
 * sits under a search bar. Three features had typed it three times, each as a
 * bare `rounded-full` button — a private chip off the radius scale, which is
 * the shape `Badge` exists to prevent. Here the button is a bare wrapper and
 * the `Badge` draws the chip; a token carries user content (a typed phrase, a
 * company name), so it is `casing="natural"`.
 * @architecture Enterprise SaaS 2026
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
