/**
 * @file ProjectEditorPanel.tsx
 * @description Slide-over modal orchestrator for deep project editing and logistics.
 * Implements guarded tab navigation to prevent accidental data loss of dirty forms.
 * Provides a fluid tab routing system utilizing AnimatePresence for cinematic cross-fades.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectEditorPanel
 */

import React, { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Briefcase,
  Calendar1,
  Grid,
  Users,
  ListOrdered,
  MicVocal,
  Wrench,
  Banknote,
} from "lucide-react";

import type { Project } from "../../../shared/types";

import DetailsTab from "./tabs/DetailsTab";
import MicroCastingTab from "./tabs/MicroCastingTab";
import RehearsalsTab from "./tabs/RehearsalsTab";
import CastTab from "./tabs/CastTab";
import ProgramTab from "./tabs/ProgramTab";
import CrewTab from "./tabs/CrewTab";
import BudgetTab from "./tabs/BudgetTab";
import AttendanceMatrixTab from "./tabs/AttendanceMatrixTab";

import { PROJECT_TABS, ProjectTabId } from "../constants/projectDomain";
import ConfirmModal from "../../../shared/ui/ConfirmModal";

interface TabDefinition {
  id: ProjectTabId;
  icon: React.ReactNode;
  labelKey: string;
}

const TAB_CONFIG: TabDefinition[] = [
  {
    id: PROJECT_TABS.DETAILS,
    icon: <Briefcase size={14} aria-hidden="true" />,
    labelKey: "projects.tabs.details",
  },
  {
    id: PROJECT_TABS.REHEARSALS,
    icon: <Calendar1 size={14} aria-hidden="true" />,
    labelKey: "projects.tabs.rehearsals",
  },
  {
    id: PROJECT_TABS.MATRIX,
    icon: <Grid size={14} aria-hidden="true" />,
    labelKey: "projects.tabs.matrix",
  },
  {
    id: PROJECT_TABS.CAST,
    icon: <Users size={14} aria-hidden="true" />,
    labelKey: "projects.tabs.cast",
  },
  {
    id: PROJECT_TABS.PROGRAM,
    icon: <ListOrdered size={14} aria-hidden="true" />,
    labelKey: "projects.tabs.program",
  },
  {
    id: PROJECT_TABS.MICRO_CAST,
    icon: <MicVocal size={14} aria-hidden="true" />,
    labelKey: "projects.tabs.micro_cast",
  },
  {
    id: PROJECT_TABS.CREW,
    icon: <Wrench size={14} aria-hidden="true" />,
    labelKey: "projects.tabs.crew",
  },
  {
    id: PROJECT_TABS.BUDGET,
    icon: <Banknote size={14} aria-hidden="true" />,
    labelKey: "projects.tabs.budget",
  },
];

interface ProjectEditorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export default function ProjectEditorPanel({
  isOpen,
  onClose,
  project,
  activeTab,
  onTabChange,
}: ProjectEditorPanelProps): React.ReactPortal | null {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState<boolean>(false);

  // Guarded Navigation State
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [pendingTabId, setPendingTabId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Keyboard accessibility and guarded close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleCloseAttempt();
      }
    };
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, hasUnsavedChanges]);

  // Reset dirty state when panel closes
  useEffect(() => {
    if (!isOpen) {
      setHasUnsavedChanges(false);
      setPendingTabId(null);
    }
  }, [isOpen]);

  const handleTabInteraction = (targetTabId: string) => {
    if (activeTab === targetTabId) return;

    if (hasUnsavedChanges) {
      setPendingTabId(targetTabId);
    } else {
      onTabChange(targetTabId);
    }
  };

  const handleCloseAttempt = () => {
    if (hasUnsavedChanges) {
      setPendingTabId("CLOSE_PANEL");
    } else {
      onClose();
    }
  };

  const confirmNavigation = () => {
    setHasUnsavedChanges(false);
    if (pendingTabId === "CLOSE_PANEL") {
      setPendingTabId(null);
      onClose();
    } else if (pendingTabId) {
      onTabChange(pendingTabId);
      setPendingTabId(null);
    }
  };

  const cancelNavigation = () => {
    setPendingTabId(null);
  };

  const renderActiveTab = useCallback(() => {
    // Restrict access to other tabs if creating a new project
    if (!project && activeTab !== PROJECT_TABS.DETAILS) {
      return null;
    }

    switch (activeTab) {
      case PROJECT_TABS.DETAILS:
        return (
          <DetailsTab
            project={project}
            onSuccess={() => setHasUnsavedChanges(false)}
            onDirtyStateChange={setHasUnsavedChanges}
          />
        );
      case PROJECT_TABS.REHEARSALS:
        return project ? <RehearsalsTab projectId={project.id} /> : null;
      case PROJECT_TABS.MATRIX:
        return project ? <AttendanceMatrixTab projectId={project.id} /> : null;
      case PROJECT_TABS.CAST:
        return project ? <CastTab projectId={project.id} /> : null;
      case PROJECT_TABS.PROGRAM:
        return project ? (
          <ProgramTab
            projectId={project.id}
            onDirtyStateChange={setHasUnsavedChanges}
          />
        ) : null;
      case PROJECT_TABS.MICRO_CAST:
        return project ? <MicroCastingTab projectId={project.id} /> : null;
      case PROJECT_TABS.CREW:
        return project ? <CrewTab projectId={project.id} /> : null;
      case PROJECT_TABS.BUDGET:
        return project ? (
          <BudgetTab
            projectId={project.id}
            onDirtyStateChange={setHasUnsavedChanges}
          />
        ) : null;
      default:
        return null;
    }
  }, [activeTab, project]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={handleCloseAttempt}
            className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
            aria-hidden="true"
          />
          <motion.div
            initial={{ x: "100%", opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0.5 }}
            transition={{
              type: "spring",
              damping: 30,
              stiffness: 250,
              mass: 1.5,
            }}
            className="relative w-full md:w-[90vw] lg:w-[85vw] max-w-[1600px] h-full bg-[#f8f7f4] shadow-[-20px_0_50px_rgba(0,0,0,0.15)] flex flex-col border-l border-white/60 overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="panel-title"
          >
            <div className="flex-shrink-0 bg-[#f8f7f4]/95 backdrop-blur-2xl z-20 px-6 md:px-10 pt-8 pb-4">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                  <h3
                    id="panel-title"
                    className="font-serif text-3xl md:text-4xl font-bold text-stone-900 tracking-tight"
                  >
                    {project
                      ? project.title
                      : t(
                          "projects.editor.new_project",
                          "Kreator Nowego Wydarzenia",
                        )}
                  </h3>
                  {project?.status === "DONE" && (
                    <span className="px-2.5 py-1 bg-stone-200/50 text-stone-600 text-[9px] uppercase tracking-widest font-bold antialiased rounded-md border border-stone-200">
                      {t("projects.editor.archive_badge", "Archiwum")}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleCloseAttempt}
                  className="text-stone-400 hover:text-stone-900 bg-white hover:bg-stone-100 border border-stone-200/60 shadow-sm transition-all p-3 rounded-2xl active:scale-95 group"
                  aria-label={t(
                    "common.actions.close_panel",
                    "Zamknij panel (ESC)",
                  )}
                >
                  <X
                    size={20}
                    className="group-hover:rotate-90 transition-transform duration-300"
                    aria-hidden="true"
                  />
                </button>
              </div>

              {project && (
                <div className="relative">
                  <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-[#f8f7f4] to-transparent pointer-events-none z-10" />
                  <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#f8f7f4] to-transparent pointer-events-none z-10" />
                  <div className="flex overflow-x-auto scrollbar-hide gap-2 p-1.5 bg-stone-200/40 border border-stone-200/60 rounded-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
                    {TAB_CONFIG.map((tab) => {
                      const isActive = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => handleTabInteraction(tab.id)}
                          className={`flex items-center gap-2 px-5 py-2.5 text-[9px] font-bold antialiased uppercase tracking-widest rounded-xl transition-all whitespace-nowrap flex-shrink-0 ${
                            isActive
                              ? "bg-white text-[#002395] shadow-sm border border-white"
                              : "text-stone-500 hover:text-stone-800 hover:bg-white/40 border border-transparent"
                          }`}
                        >
                          {tab.icon} {t(tab.labelKey)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden relative scrollbar-hide bg-gradient-to-b from-transparent to-stone-50/50">
              <div className="p-4 md:px-10 md:pb-10 pt-2 min-h-full">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="w-full"
                  >
                    {renderActiveTab()}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Unsaved Changes Guard Modal */}
      <ConfirmModal
        isOpen={pendingTabId !== null}
        title={t("projects.editor.unsaved_changes_title", "Niezapisane zmiany")}
        description={t(
          "projects.editor.unsaved_changes_desc",
          "Masz niezapisane zmiany w tej zakładce. Czy na pewno chcesz opuścić ten widok? Niezapisane dane zostaną utracone.",
        )}
        onConfirm={confirmNavigation}
        onCancel={cancelNavigation}
        confirmText={t("common.actions.discard", "Odrzuć zmiany")}
        cancelText={t("common.actions.cancel", "Anuluj")}
        isDestructive={false}
      />
    </AnimatePresence>,
    document.body,
  );
}
