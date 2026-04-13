/**
 * @file NextRehearsalAlert.tsx
 * @description Clickable alert banner fixing DOM nesting rules and propagation.
 */
import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle, UserMinus, ArrowRight } from "lucide-react";

import { formatLocalizedDate } from "@/shared/lib/intl";
import { DualTimeDisplay } from "@/shared/widgets/layout/DualTimeDisplay";
import { LocationPreview } from "../../logistics/components/LocationPreview";
import { Badge } from "@/shared/ui/primitives/Badge";
import { cn } from "@/shared/lib/utils";

export function NextRehearsalAlert({ rehearsal }: { rehearsal: any }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const hasAbsences = (rehearsal.absent_count || 0) > 0;

  return (
    <div
      onClick={() => navigate("/panel/rehearsals")}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate("/panel/rehearsals")}
      className={cn(
        "bg-white border-l-4 border-l-orange-500 border border-stone-200/60 shadow-sm rounded-xl p-3 sm:p-4",
        "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4",
        "group/alert transition-all cursor-pointer hover:shadow-md hover:border-orange-300 outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 relative z-50",
      )}
    >
      <div className="flex items-start sm:items-center gap-3 w-full">
        <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 mt-1 sm:mt-0 group-hover/alert:bg-orange-100 transition-colors">
          <AlertCircle size={16} />
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
              containerClassName="flex items-center gap-1.5"
              primaryTimeClassName="text-[11px] font-bold text-stone-500"
              localTimeClassName="text-[10px] text-orange-600/80 font-bold"
            />
            {rehearsal.location && (
              /* Blokujemy propagację kliknięcia w LocationPreview, aby dymek nie wywoływał navigate() */
              <div
                className="sm:border-l border-stone-200 sm:pl-4 flex items-center"
                onClick={(e) => e.stopPropagation()}
              >
                <LocationPreview
                  locationRef={rehearsal.location}
                  fallback="TBA"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-end">
        {hasAbsences ? (
          <Badge variant="danger" icon={<UserMinus size={12} />}>
            {t("dashboard.admin.absences", "Braki: {{count}}", {
              count: rehearsal.absent_count,
            })}
          </Badge>
        ) : (
          <Badge variant="success">100% Frekwencji</Badge>
        )}
        <div className="p-2 text-stone-400 group-hover/alert:text-orange-600 bg-stone-50 group-hover/alert:bg-orange-50 transition-colors rounded-lg flex items-center justify-center">
          <ArrowRight
            size={16}
            className="transform group-hover/alert:translate-x-1 transition-transform"
          />
        </div>
      </div>
    </div>
  );
}
