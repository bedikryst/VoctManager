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
import { DualTimeDisplay } from "@/shared/widgets/utility/DualTimeDisplay";
import { LocationPreview } from "../../logistics/components/LocationPreview";

import { Badge } from "@/shared/ui/primitives/Badge";
import { StatusBadge } from "@/shared/ui/primitives/StatusBadge";
import { Label, Heading } from "@/shared/ui/primitives/typography";
import { Divider } from "@/shared/ui/primitives/Divider";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { KineticActionCue } from "@/shared/ui/kinematics/KineticActionCue";
import { KineticGlow } from "@/shared/ui/kinematics/KineticGlow";
import { cn } from "@/shared/lib/utils";

export interface AdminNextRehearsalDto {
  id?: string | number;
  date_time: string;
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

  return (
    <article className="relative w-full">
      <GlassCard
        variant="ethereal"
        padding="none"
        className={cn(
          "group/alert relative z-10 overflow-hidden transition-all duration-700 ease-[0.16,1,0.3,1]",
          "hover:border-ethereal-gold/30 hover:shadow-[0_16px_48px_rgba(166,146,121,0.15)]",
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
              <StatusBadge
                variant="upcoming"
                isPulsing
                label={t(
                  "dashboard.admin.next_rehearsal_badge",
                  "Next Rehearsal",
                )}
              />
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

                <div className="shrink-0">
                  <DualTimeDisplay
                    value={rehearsal.date_time}
                    timeZone={rehearsal.timezone}
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

            <div className="flex w-full items-center justify-between lg:w-auto lg:justify-end lg:gap-4">
              {hasAbsences ? (
                <Badge
                  variant="danger"
                  icon={<UserMinus size={12} aria-hidden="true" />}
                >
                  {t("dashboard.admin.absences", "Absences: {{count}}", {
                    count: rehearsal.absent_count,
                  })}
                </Badge>
              ) : (
                <Badge variant="success">
                  {t("dashboard.admin.perfect_attendance", "100% Attendance")}
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
