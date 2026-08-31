/**
 * @file ReadinessRing.tsx
 * @description Compact "your part-readiness for this programme" badge — a sage
 * progress ring + count, linking the schedule to the Songbook where the work
 * actually happens. Renders nothing until there is a programme to be ready for.
 *
 * Withheld readiness (a manager previewing a member's view) states itself in
 * words and keeps the slot: the ring cannot be drawn at nought, because the
 * server declined to answer and nought would answer for it.
 *
 * The ring is also a door into the Songbook, which is why it reads the preview
 * itself: a member who CONDUCTS a project is served their own (empty) readiness
 * rather than a withheld one, so that one row would otherwise keep a live link
 * and drop the manager into their own songbook from inside somebody's view.
 * @module features/schedule/components/ReadinessRing
 */

import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, EyeOff } from "lucide-react";

import { useArtistPreview } from "@/app/providers/ArtistPreviewProvider";
import { cn } from "@/shared/lib/utils";
import { CompletionRing } from "@/shared/ui/composites/CompletionRing";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { INERT_SURFACE } from "@/shared/ui/primitives/inertSurface";
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
  const { isPreview } = useArtistPreview();
  const { ready, total, pct, hasData, isWithheld } = readiness;

  if (!hasData) return null;

  const isDark = surface === "dark";
  const complete = ready === total;

  if (isWithheld) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-3 rounded-2xl border border-dashed px-3 py-2",
          isDark
            ? "border-ethereal-incense/30 bg-ethereal-incense/5"
            : "border-ethereal-incense/25 bg-ethereal-parchment/40",
        )}
      >
        <span
          className={cn(
            "flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full border border-dashed",
            isDark
              ? "border-ethereal-incense/40 text-ink-on-inverse/70"
              : "border-ethereal-incense/35 text-ethereal-graphite/60",
          )}
        >
          <EyeOff size={15} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <Eyebrow color={isDark ? "ink-on-inverse-muted" : "muted"} className="block">
            {t("schedule.readiness.title", "Gotowość partii")}
          </Eyebrow>
          <Text size="sm" color={isDark ? "ink-on-inverse-muted" : "muted"}>
            {t(
              "schedule.readiness.withheld",
              "Ukryta — widzi ją tylko chórzysta",
            )}
          </Text>
        </div>
      </div>
    );
  }

  const shellClasses = cn(
    "group inline-flex items-center gap-3 rounded-2xl border px-3 py-2 transition-all",
    isDark
      ? "border-ethereal-incense/30 bg-ethereal-incense/10"
      : "border-ethereal-incense/15 bg-ethereal-alabaster shadow-glass-ethereal",
    isPreview
      ? INERT_SURFACE
      : cn(
          "active:scale-[0.99]",
          isDark ? "hover:border-ethereal-sage/50" : "hover:border-ethereal-sage/40",
        ),
  );

  const body = (
    <>
      <CompletionRing value={pct} tone={complete ? "sage" : "gold"} size={38} strokeWidth={3.5}>
        <span
          className={cn(
            "text-[11px] font-bold tabular-nums",
            isDark ? "text-ink-on-inverse" : "text-ethereal-ink",
          )}
        >
          {ready}/{total}
        </span>
      </CompletionRing>

      <div className="min-w-0">
        <Eyebrow color={isDark ? "ink-on-inverse-muted" : "muted"} className="block">
          {complete
            ? t("schedule.readiness.ready_title", "Partie gotowe")
            : t("schedule.readiness.title", "Gotowość partii")}
        </Eyebrow>
        <Text
          size="sm"
          weight="semibold"
          color={isDark ? "ink-on-inverse" : "default"}
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
    </>
  );

  if (isPreview) {
    return (
      <span inert className={shellClasses}>
        {body}
      </span>
    );
  }

  return (
    <Link to={to} className={shellClasses}>
      {body}
    </Link>
  );
};
