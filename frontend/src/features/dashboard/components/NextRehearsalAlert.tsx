/**
 * @file NextRehearsalAlert.tsx
 * @description The dashboard's next-rehearsal banner: when, where and for which
 * production, with three ways in. The card itself opens the rehearsals
 * workspace on that evening; "Plan" opens the evening's read-only page, where
 * the plan is read rather than edited; and the absence figure opens the names
 * behind it.
 *
 * The absence figure and its list are one group computed by one rule
 * (`useRehearsalAbsences`), scoped to this banner's own rehearsal — never the
 * server's raw `absent_count`, which also counts declined seats and singers the
 * evening no longer calls. It opens a list, not the attendance matrix: the
 * matrix is an entry tool where a tap changes a mark.
 * @architecture Enterprise SaaS 2026
 * @module panel/dashboard/components/NextRehearsalAlert
 */

import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ListOrdered, UserMinus } from "lucide-react";

import type { Rehearsal } from "@/shared/types";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { DualTimeDisplay } from "@/widgets/utility/DualTimeDisplay";
import { LocationPreview } from "../../logistics/components/LocationPreview";
import { resolveImminence } from "../../logistics/constants/eventImminence";
import { UpcomingAbsencesSheet } from "@/features/projects/ProjectCard/widgets/UpcomingAbsencesSheet";
import { useRehearsalAbsences } from "../hooks/useRehearsalAbsences";

import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Label, Heading } from "@/shared/ui/primitives/typography";
import { Divider } from "@/shared/ui/primitives/Divider";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { KineticActionCue } from "@/shared/ui/kinematics/KineticActionCue";
import { KineticGlow } from "@/shared/ui/kinematics/KineticGlow";
import { cn } from "@/shared/lib/utils";

export interface AdminNextRehearsalDto extends Rehearsal {
  projectTitle: string;
}

export interface NextRehearsalAlertProps {
  rehearsal: AdminNextRehearsalDto;
}

/**
 * Only the shortfall speaks. "100% frekwencji" on a rehearsal nobody has
 * answered yet was a claim about the future, and on a healthy ensemble it sat
 * on the card every single day. The button sits above the card's link overlay,
 * so a tap on it opens the names instead of the workspace.
 */
function RehearsalAbsencesButton({
  rehearsal,
}: NextRehearsalAlertProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const group = useRehearsalAbsences(rehearsal);

  // The sheet stays mounted while open, so an absence withdrawn meanwhile
  // leaves the sheet's own empty state rather than yanking it shut.
  if (!group && !isOpen) return null;
  const count = group?.absences.length ?? 0;

  return (
    <>
      {group && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-haspopup="dialog"
          aria-label={t(
            "dashboard.admin.absences_open_aria",
            "Pokaż, kto nie przyjdzie na próbę: {{count}}",
            { count },
          )}
          className="pointer-events-auto relative z-30 mr-auto rounded-chip outline-none transition-transform active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ethereal-gold/50"
        >
          <Badge
            variant="danger"
            className="hover:bg-ethereal-crimson/20"
            icon={<UserMinus size={12} aria-hidden="true" />}
          >
            {t("dashboard.admin.absences", "Nieobecni: {{count}}", { count })}
          </Badge>
        </button>
      )}

      <UpcomingAbsencesSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={t("dashboard.admin.absences_sheet_title", "Nieobecni na próbie")}
        projectTitle={rehearsal.projectTitle}
        groups={group ? [group] : []}
        onOpenRehearsal={(rehearsalId) => {
          setIsOpen(false);
          navigate(`/panel/rehearsals?rehearsal=${rehearsalId}`);
        }}
      />
    </>
  );
}

export function NextRehearsalAlert({
  rehearsal,
}: NextRehearsalAlertProps): React.JSX.Element {
  const { t } = useTranslation();
  // `pulse` is the panel's one "happening now" sweep, and this card is on screen
  // for the whole fortnight before a rehearsal. It is spent on the day itself —
  // gold, because the imminence taxonomy reserves crimson for an alarm.
  const isToday = resolveImminence(new Date(rehearsal.date_time)) === "TODAY";
  // A plan nobody has written has nothing to read; the card's own link leads to
  // the editor where it would be written.
  const hasPlan = (rehearsal.plan?.length ?? 0) > 0;
  const rehearsalId = String(rehearsal.id);

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
          to={`/panel/rehearsals?rehearsal=${rehearsalId}`}
          className="absolute inset-0 z-10 rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ethereal-gold/50"
          aria-label={t(
            "dashboard.admin.aria_open_rehearsal",
            "Open details for the upcoming rehearsal",
          )}
        />

        {/* MAIN CONTAINER: full width on mobile, a row from `lg` */}
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
              <RehearsalAbsencesButton rehearsal={rehearsal} />

              {hasPlan && (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  leftIcon={<ListOrdered size={13} aria-hidden="true" />}
                  className="pointer-events-auto relative z-30"
                >
                  <Link
                    to={`/panel/schedule/rehearsal/${rehearsalId}`}
                    aria-label={t(
                      "dashboard.admin.open_plan_aria",
                      "Przeczytaj plan próby",
                    )}
                  >
                    {t("dashboard.admin.open_plan", "Plan")}
                  </Link>
                </Button>
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
