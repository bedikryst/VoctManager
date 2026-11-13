/**
 * @file ScoreCopyLayers.tsx
 * @description The score viewer's copy switches: one pill per layer of marks
 * this reader may have drawn onto the copy they are looking at and will
 * download — the conductor's marks for the choir, those for the rehearsal
 * leader, the conductor's own, the reader's own pencil. Each names its audience
 * and how many marks it adds, so "for the choir" and "mine" never read as the
 * same thing. The book itself never changes; this picks a copy, not a setting.
 *
 * A layer appears only where it has something on this book. All pills off is
 * the clean book, which is a legitimate copy to keep.
 * @module features/projects/components
 */

import React from "react";
import { PencilLine } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Text } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";

import type { BookCopyLayerOption } from "../api/project.score-marks";
import type { ScoreMarkLayer } from "../api/project.service";

interface ScoreCopyLayersProps {
  options: readonly BookCopyLayerOption[];
  selected: readonly ScoreMarkLayer[];
  onToggle: (layer: ScoreMarkLayer) => void;
  /** Suppresses the switches while the composed copy is still downloading. */
  busy?: boolean;
}

export const ScoreCopyLayers = ({
  options,
  selected,
  onToggle,
  busy = false,
}: ScoreCopyLayersProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  if (options.length === 0) return null;

  const labels: Record<ScoreMarkLayer, string> = {
    shared: t("projects.score_copy.layer.shared", "Dla chóru"),
    leader: t("projects.score_copy.layer.leader", "Dla prowadzącego"),
    conductor: t("projects.score_copy.layer.conductor", "Dyrygenckie"),
    personal: t("projects.score_copy.layer.personal", "Mój ołówek"),
  };
  const hints: Record<ScoreMarkLayer, string> = {
    shared: t(
      "projects.score_copy.layer.shared_hint",
      "Oznaczenia dyrygenta dla całego chóru.",
    ),
    leader: t(
      "projects.score_copy.layer.leader_hint",
      "Oznaczenia dla osoby prowadzącej próbę.",
    ),
    conductor: t(
      "projects.score_copy.layer.conductor_hint",
      "Prywatne oznaczenia dyrygenta. Nikt inny ich nie dostaje.",
    ),
    personal: t(
      "projects.score_copy.layer.personal_hint",
      "Twoje własne notatki. Nikt inny ich nie zobaczy.",
    ),
  };

  return (
    <div
      role="group"
      aria-label={t("projects.score_copy.layers_label", "Oznaczenia w tym egzemplarzu")}
      className="pointer-events-auto flex flex-wrap items-center gap-1.5"
    >
      {options.map(({ layer, count }) => {
        const active = selected.includes(layer);
        return (
          <button
            key={layer}
            type="button"
            onClick={() => onToggle(layer)}
            disabled={busy}
            aria-pressed={active}
            title={hints[layer]}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-2",
              "shadow-glass-ethereal backdrop-blur-xl transition-colors",
              "disabled:opacity-60",
              active
                ? "border-ethereal-gold/50 bg-ethereal-gold/25 text-ink-on-inverse"
                : "border-line-on-inverse bg-surface-inverse/70 text-ink-on-inverse hover:bg-surface-inverse/85",
            )}
          >
            {/* The icon inherits the pill's own colour; the label states its
                own, because `Text` would otherwise paint itself ink-dark on
                dark glass. */}
            <PencilLine size={16} aria-hidden="true" className="shrink-0" />
            <Text
              as="span"
              size="sm"
              color="ink-on-inverse"
              className="whitespace-nowrap leading-none"
            >
              {labels[layer]}
            </Text>
            <Text
              as="span"
              size="xs"
              color="ink-on-inverse-muted"
              className="tabular-nums leading-none"
            >
              {count}
            </Text>
          </button>
        );
      })}
    </div>
  );
};
