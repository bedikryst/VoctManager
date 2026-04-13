/**
 * @file NextRehearsalAlert.tsx
 * @description Refined alert banner with strict spatial isolation and overflow management.
 * Ensures LocationPreview tooltips maintain total visibility across the dashboard hierarchy.
 * @module panel/dashboard/components/NextRehearsalAlert
 */

import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle, UserMinus, ArrowRight } from "lucide-react";

import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { DualTimeDisplay } from "@/shared/widgets/utility/DualTimeDisplay";
import { LocationPreview } from "../../logistics/components/LocationPreview";
import { Badge } from "@/shared/ui/primitives/Badge";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { cn } from "@/shared/lib/utils";

export interface AdminNextRehearsalDto {
  date_time: string;
  timezone: string;
  location?: string | object;
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
  const navigate = useNavigate();
  const hasAbsences = (rehearsal.absent_count || 0) > 0;

  return (
    <GlassCard
      variant="ethereal"
      padding="none" // Padding managed internally for tighter control
      onClick={() => navigate("/panel/rehearsals")}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate("/panel/rehearsals")}
      aria-label={t(
        "dashboard.admin.aria_open_rehearsal",
        "Open next rehearsal details",
      )}
      /* * CRITICAL: Using relative z-[60] to ensure the popover floats above EVERYTHING else.
       * overflow-visible is mandatory for the absolute positioned tooltips.
       */
      className={cn(
        "group/alert relative z-[60] overflow-visible cursor-pointer transition-all duration-500",
        "border-ethereal-incense/30 bg-gradient-to-r from-ethereal-incense/10 via-transparent to-transparent",
        "hover:border-ethereal-incense/60 hover:shadow-[0_12px_40px_rgba(166,146,121,0.2)]",
        "outline-none focus-visible:ring-1 focus-visible:ring-ethereal-gold/50",
      )}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] items-center gap-6 p-4 overflow-visible">
        {/* LEFT SECTION: Icon and Core Data */}
        <div className="flex items-center gap-4 overflow-visible">
          <div className="relative flex items-center justify-center shrink-0 ml-1">
            <div
              className="w-2.5 h-2.5 rounded-full bg-ethereal-incense z-10"
              aria-hidden="true"
            />
            <div
              className="absolute w-2.5 h-2.5 rounded-full bg-ethereal-incense animate-ping opacity-60"
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0 flex-1 overflow-visible">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-ethereal-incense mb-1 flex items-center gap-2">
              <AlertCircle size={14} strokeWidth={1.5} aria-hidden="true" />
              <span className="truncate">
                {t(
                  "dashboard.admin.next_rehearsal_alert",
                  "Next Rehearsal • {{title}}",
                  { title: rehearsal.projectTitle },
                )}
              </span>
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center gap-x-6 gap-y-2 overflow-visible">
              <p className="text-sm font-bold text-ethereal-ink font-serif tracking-wide shrink-0">
                {formatLocalizedDate(
                  rehearsal.date_time,
                  { weekday: "long", day: "numeric", month: "long" },
                  undefined,
                  rehearsal.timezone,
                )}
              </p>

              <div className="shrink-0">
                <DualTimeDisplay
                  value={rehearsal.date_time}
                  timeZone={rehearsal.timezone}
                />
              </div>

              {rehearsal.location && (
                <div
                  className="sm:border-l border-ethereal-incense/20 sm:pl-6 flex items-center overflow-visible"
                  onClick={(e) => e.stopPropagation()}
                >
                  <LocationPreview
                    locationRef={rehearsal.location}
                    fallback={t("common.tba", "TBA")}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT SECTION: Status Badges and Call to Action */}
        <div className="flex items-center gap-4 shrink-0 justify-end md:border-l border-ethereal-incense/10 md:pl-6">
          <div className="flex items-center gap-3">
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

            <div className="w-9 h-9 rounded-full border border-ethereal-incense/20 flex items-center justify-center text-ethereal-graphite group-hover/alert:border-ethereal-incense group-hover/alert:text-ethereal-incense group-hover/alert:bg-white/50 transition-all duration-500 shadow-sm">
              <ArrowRight
                size={14}
                strokeWidth={1.5}
                className="transform group-hover/alert:translate-x-0.5 transition-transform duration-500"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
