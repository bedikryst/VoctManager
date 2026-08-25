/**
 * @file NextRehearsalAlert.tsx
 * @description Refined alert banner with strict spatial isolation.
 * Upgraded to Ethereal UI 2026: Mobile-first kinetic rhythms & spatial boundaries.
 * @architecture Enterprise SaaS 2026
 * @module panel/dashboard/components/NextRehearsalAlert
 */

import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { UserMinus } from "lucide-react";

import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { DualTimeDisplay } from "@/widgets/utility/DualTimeDisplay";
import { LocationPreview } from "../../logistics/components/LocationPreview";
import { resolveImminence } from "../../logistics/constants/eventImminence";

import { Badge } from "@/shared/ui/primitives/Badge";
import { Label, Heading } from "@/shared/ui/primitives/typography";
import { Divider } from "@/shared/ui/primitives/Divider";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { KineticActionCue } from "@/shared/ui/kinematics/KineticActionCue";
import { KineticGlow } from "@/shared/ui/kinematics/KineticGlow";
import { cn } from "@/shared/lib/utils";

export interface AdminNextRehearsalDto {
  id?: string | number;
  date_time: string;
  /** Server-derived close of the session; absent on one nobody has timed. */
  end_date_time?: string | null;
  timezone: string;
  location?: {
    id: string;
    name: string;
    category?: string;
    timezone?: string;
  } | null;
  absent_count?: number;
  projectTitle: string;
}

export interface NextRehearsalAlertProps {
  rehearsal: AdminNextRehearsalDto;
}

export function NextRehearsalAlert({
  rehearsal,
}: NextRehearsalAlertProps): React.JSX.Element {
  const { t } = useTranslation();
  const hasAbsences = (rehearsal.absent_count || 0) > 0;
  // `pulse` is the panel's one "happening now" sweep, and this card is on screen
  // for the whole fortnight before a rehearsal. It is spent on the day itself —
  // gold, because the imminence taxonomy reserves crimson for an alarm.
  const isToday = resolveImminence(new Date(rehearsal.date_time)) === "TODAY";

  return (
    <article className="relative w-full">
      <GlassCard
        variant="ethereal"
        padding="none"
        isHoverable={false}
        className={cn(
          "group/alert z-10",
          // Unified interactive-tile hover: gold border + elevation shadow, no lift.
          "hover:border-ethereal-gold/30 hover:shadow-glass-ethereal-hover",
        )}
        backgroundElement={<KineticGlow variant="sage" position="left" />}
      >
        <Link
          to="/panel/rehearsals"
          className="absolute inset-0 z-10 rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ethereal-gold/50"
          aria-label={t(
            "dashboard.admin.aria_open_rehearsal",
            "Open details for the upcoming rehearsal",
          )}
        />

        {/* MAIN CONTAINER: Changed to enforce strict full-width on mobile */}
        <div className="pointer-events-none relative z-20 flex w-full flex-col lg:flex-row lg:items-center lg:justify-between px-6 py-4 lg:px-7 lg:py-5">
          {/* LEFT STRATUM: Information Architecture */}
          <div className="flex w-full flex-col gap-4 lg:w-auto">
            {/* Header: Stacked on mobile, row on tablet+ */}
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
              <Badge
                variant={isToday ? "warning" : "neutral"}
                pulse={isToday}
              >
                {isToday
                  ? t("dashboard.admin.rehearsal_today_badge", "Próba dziś")
                  : t("dashboard.admin.next_rehearsal_badge", "Najbliższa próba")}
              </Badge>
              <Heading
                as="h3"
                size="xl" // roughly subtitle
                color="default"
                className="line-clamp-2"
              >
                {rehearsal.projectTitle}
              </Heading>
            </div>

            {/* KINEMATIC DATA ROW */}
            <div className="flex flex-col gap-y-3 sm:flex-row sm:items-center sm:gap-y-0">
              {/* Date & Time Cluster */}
              <div className="flex flex-row flex-wrap items-center gap-x-4 gap-y-1">
                <time dateTime={rehearsal.date_time} className="shrink-0">
                  <Label as="span" color="muted">
                    {formatLocalizedDate(
                      rehearsal.date_time,
                      { weekday: "long", day: "numeric", month: "long" },
                      undefined,
                      rehearsal.timezone,
                    )}
                  </Label>
                </time>

                <div className="shrink-0 mt-1">
                  <DualTimeDisplay
                    value={rehearsal.date_time}
                    endValue={rehearsal.end_date_time}
                    timeZone={rehearsal.timezone}
                    typography={"sans"}
                    color={"muted"}
                    size={"sm"}
                    weight={"medium"}
                  />
                </div>
              </div>

              {/* SEMANTIC BOUNDARY: Location */}
              {rehearsal.location && (
                <>
                  <div className="hidden sm:block mx-6 h-5">
                    <Divider orientation="vertical" variant="solid" />
                  </div>

                  <div className="pointer-events-auto relative z-30 flex items-center transition-colors hover:text-ethereal-gold mt-1 sm:mt-0">
                    <LocationPreview
                      locationRef={rehearsal.location.id}
                      fallback={rehearsal.location.name}
                      variant="minimal"
                      className="text-[13px] sm:text-[12px]"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* MOBILE HORIZONTAL SEPARATOR */}
          <div className="my-5 block w-full lg:hidden">
            <Divider orientation="horizontal" variant="gradient-fade" />
          </div>

          {/* RIGHT STRATUM: Telemetry & Action (Action Bar) */}
          <div className="relative z-20 flex w-full shrink-0 items-center justify-between lg:w-auto lg:justify-end">
            {/* Desktop semantic boundary */}
            <div className="hidden lg:block h-10 mr-6">
              <Divider orientation="vertical" variant="gradient-fade" />
            </div>

            <div className="flex w-full items-center justify-end gap-4 lg:w-auto">
              {/* Only the shortfall speaks. "100% frekwencji" on a rehearsal
                  nobody has answered yet was a claim about the future, and on a
                  healthy ensemble it sat on the card every single day. */}
              {hasAbsences && (
                <Badge
                  className="mr-auto"
                  variant="danger"
                  icon={<UserMinus size={12} aria-hidden="true" />}
                >
                  {t("dashboard.admin.absences", "Nieobecni: {{count}}", {
                    count: rehearsal.absent_count,
                  })}
                </Badge>
              )}

              {/* Arrow is pushed to the far right on mobile via justify-between */}
              <KineticActionCue direction="right" />
            </div>
          </div>
        </div>
      </GlassCard>
    </article>
  );
}
