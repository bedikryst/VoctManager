/**
 * @file RunSheetWidget.tsx
 * @description Expandable widget displaying the chronological run-sheet (agenda) for the project.
 * Implements collocated UI state (`isOpen`) and uses `useMemo` for sorting the agenda array.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectCard/components/RunSheetWidget
 */

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ListOrdered, ChevronDown, ChevronUp } from "lucide-react";
import type { Project } from "@/shared/types";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { SectionHeader } from "@/shared/ui/composites/SectionHeader";
import { Text } from "@/shared/ui/primitives/typography";

interface RunSheetWidgetProps {
  project: Project;
  onEdit?: () => void;
}

export function RunSheetWidget({
  project,
  onEdit,
}: RunSheetWidgetProps): React.JSX.Element {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const sortedRunSheet = useMemo(() => {
    if (!project.run_sheet) return [];
    return [...project.run_sheet].sort((a, b) => a.time.localeCompare(b.time));
  }, [project.run_sheet]);

  const hasRunSheet = sortedRunSheet.length > 0;

  return (
    <GlassCard
      variant="solid"
      padding="none"
      isHoverable={false}
      className="overflow-hidden"
    >
      <div
        className="flex cursor-pointer items-center justify-between p-5 transition-colors hover:bg-ethereal-alabaster/45"
        onClick={() => setIsOpen(!isOpen)}
        role="button"
        aria-expanded={isOpen}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsOpen((previousState) => !previousState);
          }
        }}
      >
        <SectionHeader
          title={t("projects.run_sheet.title", "Harmonogram dnia koncertu")}
          icon={<ListOrdered size={16} aria-hidden="true" />}
          className="mb-0 pb-0"
        />
        <div className="flex items-center gap-4">
          {onEdit && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              {t("common.actions.edit", "Edytuj")}
            </Button>
          )}
          <div className="rounded-full bg-ethereal-incense/10 p-1.5 text-ethereal-graphite">
            {isOpen ? (
              <ChevronUp size={16} aria-hidden="true" />
            ) : (
              <ChevronDown size={16} aria-hidden="true" />
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="runsheet-widget-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-ethereal-incense/10"
          >
            <div className="bg-ethereal-alabaster/35 p-5">
              {hasRunSheet ? (
                <div className="relative ml-2 space-y-5 border-l-2 border-ethereal-incense/15 pl-5">
                  {sortedRunSheet.map((item, idx) => (
                    <div key={item.id || idx} className="relative">
                      <div
                        className="absolute -left-7 top-1 h-4 w-4 rounded-full border-4 border-ethereal-gold bg-ethereal-marble shadow-sm"
                        aria-hidden="true"
                      />
                      <div className="flex flex-col gap-1">
                        <Badge variant="brand" className="self-start">
                          {item.time}
                        </Badge>
                        <div>
                          <Text weight="medium">
                            {item.title}
                          </Text>
                          {item.description && (
                            <Text
                              color="graphite"
                              size="sm"
                              className="mt-1 italic"
                            >
                              {item.description}
                            </Text>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-ethereal-incense/20 bg-ethereal-marble/50 py-6 text-center">
                  <ListOrdered
                    size={24}
                    className="mx-auto mb-2 text-ethereal-incense/45"
                    aria-hidden="true"
                  />
                  <Text color="muted" size="sm">
                    {t(
                      "projects.run_sheet.empty",
                      "Brak harmonogramu dostępnego dla tego wydarzenia.",
                    )}
                  </Text>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}
