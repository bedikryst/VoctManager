import React from "react";
import { useTranslation } from "react-i18next";
import { Archive, Briefcase, CalendarDays } from "lucide-react";

import { Eyebrow } from "@/shared/ui/primitives/typography";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { PieceMaterialCard } from "./PieceMaterialCard";
import type { MaterialsDashboardGroup } from "../types/materials.dto";

interface ProjectMaterialGroupProps {
  group: MaterialsDashboardGroup;
}

export const ProjectMaterialGroup = ({
  group,
}: ProjectMaterialGroupProps): React.JSX.Element => {
  const { t } = useTranslation();
  const isArchived = group.project.status === "DONE";

  return (
    <div className={`space-y-4 ${isArchived ? "opacity-70" : "opacity-100"}`}>
      <div className="flex items-start justify-between gap-3 pb-4 border-b border-ethereal-marble">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`mt-0.5 shrink-0 p-2 rounded-lg ${
              isArchived ? "bg-ethereal-marble" : "bg-ethereal-gold/10"
            }`}
          >
            <Briefcase
              size={15}
              className={
                isArchived ? "text-ethereal-graphite" : "text-ethereal-gold"
              }
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0">
            <Eyebrow color={isArchived ? "muted" : "default"} className="block truncate">
              {t("materials.project.event", "Wydarzenie:")} {group.project.title}
            </Eyebrow>
            <div className="flex items-center gap-1.5 mt-1">
              <CalendarDays
                size={11}
                className="text-ethereal-graphite shrink-0"
                aria-hidden="true"
              />
              <Eyebrow color="muted">
                {formatLocalizedDate(group.project.date_time)}
              </Eyebrow>
            </div>
          </div>
        </div>

        {isArchived && (
          <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 bg-ethereal-marble/60 border border-ethereal-marble rounded-lg shadow-glass-solid">
            <Archive size={11} className="text-ethereal-graphite" aria-hidden="true" />
            <Eyebrow color="muted">
              {t("materials.project.archived_badge", "Archiwum")}
            </Eyebrow>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {group.program.map((item) => (
          <PieceMaterialCard
            key={item.piece.id}
            piece={item.piece}
            order={item.order}
            isEncored={item.is_encore}
            isArchived={isArchived}
          />
        ))}
      </div>
    </div>
  );
};
