/**
 * @file ProgramCastingRail.tsx
 * @description The programme as a worklist: every piece with how far its casting
 * has got, and one click to open it on the board. It replaces a dropdown that
 * hid the state of the whole programme behind a single line — the conductor's
 * first question here is "which piece is still short?", and a list answers it
 * without being opened.
 * The row language is the Overview setlist's, deliberately: the same fact
 * (gaps on a piece) is stated the same way on both surfaces.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/components/ProgramCastingRail
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Check, ListOrdered } from "lucide-react";

import type { PieceProgress } from "../../hooks/useMicroCasting";
import { cn } from "@/shared/lib/utils";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";

export interface ProgramCastingRailItem {
  readonly pieceId: string;
  readonly position: number;
  readonly title: string;
  readonly progress: PieceProgress;
}

interface ProgramCastingRailProps {
  readonly items: readonly ProgramCastingRailItem[];
  readonly selectedPieceId: string | null;
  readonly onSelect: (pieceId: string) => void;
}

export const ProgramCastingRail = ({
  items,
  selectedPieceId,
  onSelect,
}: ProgramCastingRailProps): React.JSX.Element => {
  const { t } = useTranslation();

  const scored = items.filter((item) => item.progress.hasRequirements);
  const ready = scored.filter((item) => item.progress.missing === 0).length;

  return (
    <SectionCard
      as="h2"
      scroll
      className="max-h-[32dvh] shrink-0"
      bodyClassName="p-0"
      icon={<ListOrdered size={15} aria-hidden="true" />}
      title={t(
        "projects.micro_cast.label.pieces_in_program",
        "Utwory w programie",
      )}
      footer={
        scored.length > 0 ? (
          <Eyebrow color="muted" className="block text-center">
            {t("projects.micro_cast.program.ready", "Obsadzone: {{done}} z {{total}}", {
              done: ready,
              total: scored.length,
            })}
          </Eyebrow>
        ) : undefined
      }
    >
      <ul className="divide-y divide-hairline">
        {items.map((item) => {
          const isSelected = item.pieceId === selectedPieceId;
          const { missing, hasRequirements } = item.progress;

          return (
            <li key={item.pieceId}>
              <button
                type="button"
                onClick={() => onSelect(item.pieceId)}
                aria-current={isSelected ? "true" : undefined}
                className={cn(
                  "relative flex w-full items-center gap-2.5 py-2.5 pl-5 pr-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ethereal-gold/40",
                  isSelected
                    ? "bg-ethereal-gold/8"
                    : "hover:bg-ethereal-ink/3",
                )}
              >
                {isSelected && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 w-0.75 bg-ethereal-gold"
                  />
                )}

                <Text
                  as="span"
                  size="xs"
                  weight="bold"
                  className="w-5 shrink-0 tabular-nums text-ethereal-gold/70"
                >
                  {String(item.position).padStart(2, "0")}
                </Text>

                <Text
                  as="span"
                  size="sm"
                  weight="medium"
                  truncate
                  color={isSelected ? "default" : "graphite"}
                  className="min-w-0 flex-1"
                >
                  {item.title}
                </Text>

                {hasRequirements && missing > 0 && (
                  <Text
                    as="span"
                    size="sm"
                    weight="medium"
                    color="gold"
                    className="shrink-0 tabular-nums"
                  >
                    {t("projects.program.gaps_count", "{{count}} luk", {
                      count: missing,
                    })}
                  </Text>
                )}

                {hasRequirements && missing === 0 && (
                  <span
                    className="shrink-0 text-ethereal-sage"
                    title={t("projects.program.fulfilled", "Obsadzony")}
                  >
                    <Check size={14} aria-hidden="true" />
                    <span className="sr-only">
                      {t("projects.program.fulfilled", "Obsadzony")}
                    </span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
};
