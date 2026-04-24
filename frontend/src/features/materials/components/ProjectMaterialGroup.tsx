import React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Briefcase, Clock } from "lucide-react";

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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="space-y-5"
    >
      <div
        className={`flex items-center gap-3 border-b border-ethereal-marble pb-3 ml-2 transition-opacity ${
          isArchived ? "opacity-70" : "opacity-100"
        }`}
      >
        <Briefcase
          size={18}
          className={
            isArchived ? "text-ethereal-graphite" : "text-ethereal-gold"
          }
          aria-hidden="true"
        />
        <div>
          <Eyebrow color={isArchived ? "muted" : "default"}>
            {t("materials.project.event", "Wydarzenie:")} {group.project.title}
          </Eyebrow>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex items-center gap-1">
              <Clock
                size={10}
                aria-hidden="true"
                className="text-ethereal-graphite"
              />
              <Eyebrow color="muted">
                {formatLocalizedDate(group.project.date_time)}
              </Eyebrow>
            </div>
            {isArchived && (
              <Eyebrow
                color="muted"
                className="bg-ethereal-marble px-2 py-0.5 rounded shadow-glass-solid"
              >
                {t(
                  "materials.project.archived_badge",
                  "Projekt Zarchiwizowany",
                )}
              </Eyebrow>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
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
    </motion.div>
  );
};
