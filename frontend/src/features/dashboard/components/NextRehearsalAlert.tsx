/**
 * @file NextRehearsalAlert.tsx
 * @description Refined alert banner with strict spatial isolation.
 * Implements the Pseudo-Overlay Link pattern for pristine A11y compliance.
 * @module panel/dashboard/components/NextRehearsalAlert
 */

import React from "react";
import { Link } from "react-router-dom";
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
  // ZMIANA: Usunięto 'object'. Używamy bezpiecznego rekordu.
  location?: string | Record<string, unknown>;
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
          "group/alert relative z-[60] transition-all duration-500",
          "border-ethereal-incense/30",
          "hover:border-ethereal-incense/60 hover:shadow-[0_12px_40px_rgba(166,146,121,0.2)]",
        )}
      >
        {/*
          THE PSEUDO-OVERLAY LINK (A11y 2026 Standard)
          Ten niewidzialny link rozciąga się na całą kartę. Screen readery widzą go jako poprawną nawigację.
          Można na niego najechać i kliknąć.
        */}
        <Link
          to="/panel/rehearsals"
          className="absolute inset-0 z-10 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ethereal-gold/50 rounded-[inherit]"
          aria-label={t(
            "dashboard.admin.aria_open_rehearsal",
            "Otwórz szczegóły najbliższej próby",
          )}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] items-center gap-6 p-4">
          <div className="flex items-center gap-4 pl-4">
            <div className="relative flex items-center justify-center shrink-0">
              <div className="w-2 h-2 rounded-full bg-ethereal-sage z-10 shadow-[0_0_8px_rgba(143,154,138,0.6)]" />
              <div className="absolute w-4 h-4 rounded-full bg-ethereal-sage/30 animate-pulse" />
            </div>

            <div className="min-w-0 flex-1">
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

              <div className="flex flex-col sm:flex-row sm:items-center gap-x-6 gap-y-2">
                <p className="text-sm font-bold text-ethereal-ink font-serif tracking-wide shrink-0">
                  {formatLocalizedDate(
                    rehearsal.date_time,
                    { weekday: "long", day: "numeric", month: "long" },
                    undefined,
                    rehearsal.timezone,
                  )}
                </p>

                <div className="shrink-0 ">
                  <DualTimeDisplay
                    value={rehearsal.date_time}
                    timeZone={rehearsal.timezone}
                    timeClassName="text-[15px] font-bold"
                  />
                </div>

                {rehearsal.location && (
                  <div className="relative z-100 pointer-events-auto sm:border-l border-ethereal-incense/20 sm:pl-6 flex items-center">
                    <LocationPreview
                      locationRef={rehearsal.location}
                      fallback={t("common.tba", "TBA")}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0 justify-end md:border-l border-ethereal-incense/10 md:pl-6 pointer-events-none relative z-20">
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

              <div className="w-9 h-9 rounded-full border border-ethereal-incense/20 flex items-center justify-center text-ethereal-graphite group-hover/alert:border-ethereal-incense group-hover/alert:text-ethereal-incense group-hover/alert:bg-white/50 transition-all duration-500 shadow-sm pointer-events-none">
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
    </article>
  );
}
