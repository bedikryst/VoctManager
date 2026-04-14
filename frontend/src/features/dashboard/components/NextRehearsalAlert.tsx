/**
 * @file NextRehearsalAlert.tsx
 * @description Refined alert banner with strict spatial isolation.
 * Upgraded to Ethereal UI 2026: StatusBadge implementation, cinematic typography, and dynamic shaders.
 * @architecture Enterprise SaaS 2026
 * @module panel/dashboard/components/NextRehearsalAlert
 */

import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { UserMinus, ArrowRight } from "lucide-react";

import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { DualTimeDisplay } from "@/shared/widgets/utility/DualTimeDisplay";
import { LocationPreview } from "../../logistics/components/LocationPreview";
import { Badge } from "@/shared/ui/primitives/Badge";
import { StatusBadge } from "@/shared/ui/primitives/StatusBadge";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
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
          "border-ethereal-incense/30",
          "hover:border-ethereal-incense/60 hover:shadow-[0_16px_48px_rgba(166,146,121,0.15)]",
        )}
        backgroundElement={
          <div className="pointer-events-none absolute -left-32 top-0 h-[300px] w-[300px] -translate-y-1/2 rounded-full bg-gradient-to-r from-ethereal-sage/15 to-transparent blur-[80px] transition-transform duration-[1500ms] group-hover/alert:translate-x-16 group-hover/alert:scale-110" />
        }
      >
        <Link
          to="/panel/rehearsals"
          className="absolute inset-0 z-10 rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ethereal-gold/50"
          aria-label={t(
            "dashboard.admin.aria_open_rehearsal",
            "Otwórz szczegóły najbliższej próby",
          )}
        />

        <div className="pointer-events-none relative z-20 flex flex-col justify-between gap-6 p-5 sm:p-7 lg:flex-row lg:items-center">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <StatusBadge
                variant="upcoming"
                isPulsing
                label={t(
                  "dashboard.admin.next_rehearsal_badge",
                  "Najbliższa Próba",
                )}
              />
              <h3 className="font-serif text-xl font-medium tracking-tight text-ethereal-ink sm:text-2xl">
                {rehearsal.projectTitle}
              </h3>
            </div>

            {/* Data Row */}
            <div className="flex flex-col gap-y-2 gap-x-6 sm:flex-row sm:items-center">
              <time
                dateTime={rehearsal.date_time}
                className="shrink-0 font-serif text-sm font-bold tracking-wide text-ethereal-graphite"
              >
                {formatLocalizedDate(
                  rehearsal.date_time,
                  { weekday: "long", day: "numeric", month: "long" },
                  undefined,
                  rehearsal.timezone,
                )}
              </time>

              <div className="shrink-0 text-ethereal-ink">
                <DualTimeDisplay
                  value={rehearsal.date_time}
                  timeZone={rehearsal.timezone}
                  timeClassName="text-[15px] font-bold"
                />
              </div>

              {/* INTERACTIVE CHILD EXCEPTION (Z-30) */}
              {rehearsal.location && (
                <div className="pointer-events-auto relative z-30 flex items-center font-serif text-[15px] font-bold text-ethereal-ink transition-colors hover:text-ethereal-gold sm:border-l sm:border-ethereal-incense/20 sm:pl-6">
                  <LocationPreview
                    locationRef={rehearsal.location.id}
                    fallback={rehearsal.location.name}
                    variant="minimal"
                  />
                </div>
              )}
            </div>
          </div>

          {/* RIGHT SIDE: Micro-telemetry & Interaction Cue */}
          <div className="relative z-20 flex shrink-0 items-center justify-start gap-4 pt-4 lg:justify-end lg:border-l lg:border-ethereal-incense/10 lg:pl-8 lg:pt-0">
            <div className="flex items-center gap-4">
              {hasAbsences ? (
                <Badge
                  variant="danger"
                  icon={<UserMinus size={12} aria-hidden="true" />}
                >
                  {t("dashboard.admin.absences", "Nieobecności: {{count}}", {
                    count: rehearsal.absent_count,
                  })}
                </Badge>
              ) : (
                <Badge variant="success">
                  {t("dashboard.admin.perfect_attendance", "100% Obecności")}
                </Badge>
              )}

              {/* Kinetic Arrow */}
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-ethereal-incense/20 bg-white/5 text-ethereal-graphite shadow-sm backdrop-blur-sm transition-all duration-500 group-hover/alert:border-ethereal-gold/40 group-hover/alert:bg-white/30 group-hover/alert:text-ethereal-ink">
                <ArrowRight
                  size={16}
                  strokeWidth={1.5}
                  className="transform transition-transform duration-500 group-hover/alert:translate-x-1"
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
