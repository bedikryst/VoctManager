/**
 * @file ReadinessRing.tsx
 * @description Compact "your part-readiness for this programme" badge — a sage
 * progress ring + count, linking the schedule to the Songbook where the work
 * actually happens. Renders nothing until there is a programme to be ready for.
 * @module features/schedule/components/ReadinessRing
 */

import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { CompletionRing } from "@/shared/ui/composites/CompletionRing";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import type { ProjectReadiness } from "../hooks/useProjectReadiness";

interface ReadinessRingProps {
  readiness: ProjectReadiness;
  /** Deep link into the Songbook for this project's pieces. */
  to: string;
  /** Tone of the surrounding surface, so text contrasts correctly. */
  surface?: "light" | "dark";
}

export const ReadinessRing = ({
  readiness,
  to,
  surface = "light",
}: ReadinessRingProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  const { ready, total, pct, hasData } = readiness;

  if (!hasData) return null;

  const isDark = surface === "dark";
  const complete = ready === total;

  return (
    <Link
      to={to}
      className={cn(
        "group inline-flex items-center gap-3 rounded-2xl border px-3 py-2 transition-all active:scale-[0.99]",
        isDark
          ? "border-ethereal-incense/30 bg-ethereal-incense/10 hover:border-ethereal-sage/50"
          : "border-ethereal-incense/15 bg-ethereal-alabaster shadow-glass-ethereal hover:border-ethereal-sage/40",
      )}
    >
      <CompletionRing value={pct} tone={complete ? "sage" : "gold"} size={38} strokeWidth={3.5}>
        <span
          className={cn(
            "text-[11px] font-bold tabular-nums",
            isDark ? "text-ethereal-parchment" : "text-ethereal-ink",
          )}
        >
          {ready}/{total}
        </span>
      </CompletionRing>

      <div className="min-w-0">
        <Eyebrow color={isDark ? "parchment-muted" : "muted"} className="block">
          {complete
            ? t("schedule.readiness.ready_title", "Partie gotowe")
            : t("schedule.readiness.title", "Gotowość partii")}
        </Eyebrow>
        <Text
          size="sm"
          weight="semibold"
          color={isDark ? "parchment" : "default"}
          className="flex items-center gap-1"
        >
          {complete
            ? t("schedule.readiness.ready_cta", "Powtórz w Śpiewniku")
            : t("schedule.readiness.cta", "Ćwicz w Śpiewniku")}
          <ArrowRight
            size={12}
            aria-hidden="true"
            className="transition-transform group-hover:translate-x-0.5"
          />
        </Text>
      </div>
    </Link>
  );
};
