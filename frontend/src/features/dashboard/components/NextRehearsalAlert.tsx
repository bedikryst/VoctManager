/**
 * @file NextRehearsalAlert.tsx
 * @description Clickable alert banner fixing DOM nesting rules and propagation.
 * Refactored to Enterprise SaaS 2026 standard: Strict Typing and complete i18n.
 * @architecture Enterprise SaaS 2026
 */
import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle, UserMinus, ArrowRight } from "lucide-react";

import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { DualTimeDisplay } from "@/shared/widgets/utility/DualTimeDisplay";
import { LocationPreview } from "../../logistics/components/LocationPreview";
import { Badge } from "@/shared/ui/primitives/Badge";
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
    <div
      onClick={() => navigate("/panel/rehearsals")}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate("/panel/rehearsals")}
      aria-label={t(
        "dashboard.admin.aria_open_rehearsal",
        "Otwórz szczegóły najbliższej próby",
      )}
      className={cn(
        "bg-white border-l-4 border-l-orange-500 border border-stone-200/60 shadow-sm rounded-xl p-3 sm:p-4",
        "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4",
        "group/alert transition-all cursor-pointer hover:shadow-md hover:border-orange-300 outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 relative z-50",
      )}
    >
      <div className="flex items-start sm:items-center gap-3 w-full">
        <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 mt-1 sm:mt-0 group-hover/alert:bg-orange-100 transition-colors">
          <AlertCircle size={16} aria-hidden="true" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600/90 mb-0.5">
            {t(
              "dashboard.admin.next_rehearsal_alert",
              "Najbliższa Próba • {{title}}",
              { title: rehearsal.projectTitle },
            )}
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-1">
            <p className="text-sm font-bold text-stone-800">
              {formatLocalizedDate(
                rehearsal.date_time,
                { weekday: "long", day: "numeric", month: "long" },
                undefined,
                rehearsal.timezone,
              )}
            </p>
            <DualTimeDisplay
              value={rehearsal.date_time}
              timeZone={rehearsal.timezone}
            />
            {rehearsal.location && (
              <div
                className="sm:border-l border-stone-200 sm:pl-4 flex items-center"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                role="presentation"
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

      <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-end">
        {hasAbsences ? (
          <Badge
            variant="danger"
            icon={<UserMinus size={12} aria-hidden="true" />}
          >
            {t("dashboard.admin.absences", "Braki: {{count}}", {
              count: rehearsal.absent_count,
            })}
          </Badge>
        ) : (
          <Badge variant="success">
            {t("dashboard.admin.perfect_attendance", "100% Frekwencji")}
          </Badge>
        )}
        <div className="p-2 text-stone-400 group-hover/alert:text-orange-600 bg-stone-50 group-hover/alert:bg-orange-50 transition-colors rounded-lg flex items-center justify-center">
          <ArrowRight
            size={16}
            className="transform group-hover/alert:translate-x-1 transition-transform"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}
