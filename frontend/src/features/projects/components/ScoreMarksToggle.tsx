/**
 * @file ScoreMarksToggle.tsx
 * @description One switch in the score viewer's toolbar: draw the reader's own
 * marks onto the copy they are looking at. The book itself never changes — the
 * server composes a copy per download — so this is a view control, not a
 * setting, and it carries the same glass chrome as the annotation toolbar it
 * sits beside.
 *
 * It appears only where there is something to draw. A reader with no marks, and
 * a hand-uploaded book that has no page map to place them on, both get no
 * switch rather than one that hands back an identical file.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/components
 */

import React from "react";
import { PencilLine } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Text } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";

interface ScoreMarksToggleProps {
  enabled: boolean;
  onChange: (next: boolean) => void;
  /** Suppresses the switch while the composed copy is still downloading. */
  busy?: boolean;
}

export const ScoreMarksToggle = ({
  enabled,
  onChange,
  busy = false,
}: ScoreMarksToggleProps): React.JSX.Element => {
  const { t } = useTranslation();
  const label = t("projects.score_marks.toggle", "Moje oznaczenia");

  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      disabled={busy}
      aria-pressed={enabled}
      title={t(
        "projects.score_marks.toggle_hint",
        "Dorysowuje Twoje własne notatki do tego egzemplarza. Nikt inny ich nie zobaczy.",
      )}
      className={cn(
        "pointer-events-auto flex items-center gap-2 rounded-full border px-3 py-2",
        "shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-colors",
        "disabled:opacity-60",
        enabled
          ? "border-ethereal-gold/50 bg-ethereal-gold/25 text-ink-on-inverse"
          : "border-line-on-inverse bg-surface-inverse/70 text-ink-on-inverse hover:bg-surface-inverse/85",
      )}
    >
      {/* The icon inherits the pill's own colour; the label states its own,
          because `Text` would otherwise paint itself ink-dark on dark glass. */}
      <PencilLine size={16} aria-hidden="true" className="shrink-0" />
      <Text
        as="span"
        size="sm"
        color="ink-on-inverse"
        className="whitespace-nowrap leading-none"
      >
        {label}
      </Text>
    </button>
  );
};
