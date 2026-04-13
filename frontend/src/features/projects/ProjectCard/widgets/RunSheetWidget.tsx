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

interface RunSheetWidgetProps {
  project: Project;
  onEdit?: () => void;
}

export default function RunSheetWidget({
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
    <div className="bg-white border border-stone-200/80 rounded-2xl shadow-sm overflow-hidden">
      <div
        className="flex items-center justify-between p-5 cursor-pointer hover:bg-stone-50/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        role="button"
        aria-expanded={isOpen}
      >
        <h4 className="flex items-center gap-2.5 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500">
          <ListOrdered size={16} className="text-brand" aria-hidden="true" />{" "}
          {t("projects.run_sheet.title", "Harmonogram dnia koncertu")}
        </h4>
        <div className="flex items-center gap-4">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="text-[10px] uppercase font-bold antialiased tracking-widest text-brand hover:underline"
            >
              {t("common.actions.edit", "Edytuj")}
            </button>
          )}
          <div className="text-stone-400 bg-stone-100 p-1.5 rounded-full">
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
            className="border-t border-stone-100"
          >
            <div className="p-5 bg-stone-50/30">
              {hasRunSheet ? (
                <div className="relative pl-5 border-l-2 border-stone-200 space-y-5 ml-2">
                  {sortedRunSheet.map((item, idx) => (
                    <div key={item.id || idx} className="relative">
                      <div
                        className="absolute -left-[27px] top-1 w-4 h-4 bg-white border-[3px] border-brand rounded-full shadow-sm"
                        aria-hidden="true"
                      />
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold antialiased text-brand bg-blue-50 self-start px-2 py-0.5 rounded-md border border-blue-100/50">
                          {item.time}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-stone-800">
                            {item.title}
                          </p>
                          {item.description && (
                            <p className="text-xs text-stone-500 italic mt-1 leading-relaxed">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 bg-white/50 rounded-xl border border-dashed border-stone-200">
                  <ListOrdered
                    size={24}
                    className="mx-auto mb-2 text-stone-300"
                    aria-hidden="true"
                  />
                  <p className="text-xs text-stone-400 font-medium">
                    {t(
                      "projects.run_sheet.empty",
                      "Brak harmonogramu dostępnego dla tego wydarzenia.",
                    )}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
