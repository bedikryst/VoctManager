/**
 * @file MovementsList.tsx
 * @description Ordered list of movements inside a multi-movement work.
 * Renders the printed title, tempo marking, and source-PDF page number.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/repertoire/MovementsList
 */

import React from "react";
import { useTranslation } from "react-i18next";

import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import type { Movement } from "@/shared/types";

interface MovementsListProps {
  readonly movements: readonly Movement[];
  /** Show the source-PDF page anchor (useful in the AI review surface, not in artist-facing). */
  readonly showPage?: boolean;
}

export const MovementsList = ({
  movements,
  showPage = false,
}: MovementsListProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  if (movements.length === 0) return null;

  const ordered = [...movements].sort((a, b) => a.order_index - b.order_index);

  return (
    <ul role="list" className="flex flex-col gap-2">
      {ordered.map((mv) => (
        <li
          key={mv.id}
          className="flex items-baseline gap-3 rounded-xl border border-ethereal-incense/15 bg-ethereal-alabaster/55 px-4 py-2"
        >
          <Eyebrow color="muted" size="caption">
            {String(mv.order_index + 1).padStart(2, "0")}
          </Eyebrow>
          <Text size="sm" weight="medium" className="flex-1">
            {mv.title}
          </Text>
          {mv.tempo_marking && (
            <Caption color="muted" className="italic">
              {mv.tempo_marking}
            </Caption>
          )}
          {showPage && mv.starts_on_page != null && (
            <Caption color="muted">
              {t("repertoire.movements.page_short", "s. {{page}}", {
                page: mv.starts_on_page,
              })}
            </Caption>
          )}
        </li>
      ))}
    </ul>
  );
};
