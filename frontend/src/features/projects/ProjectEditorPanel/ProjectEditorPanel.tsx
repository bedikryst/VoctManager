/**
 * @file ProjectEditorPanel.tsx
 * @description Slide-over workspace for deep project editing based on custom framer-motion modal.
 * Guards tab navigation when local form state is dirty.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectEditorPanel
 */

import React, { useCallback, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Banknote,
  Briefcase,
  Calendar1,
  Grid,
  ListOrdered,
  MicVocal,
  Users,
  Wrench,
  X,
} from "lucide-react";

import type { Project } from "@/shared/types";
import { cn } from "@/shared/lib/utils";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";

import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import { useFocusTrap } from "@/shared/lib/dom/useFocusTrap";
import { useCloseWatcher } from "@/shared/lib/dom/useCloseWatcher";

import { projectKeys } from "../api/project.queries";
import { ProjectService } from "../api/project.service";

import {
  PROJECT_STATUS,
  PROJECT_TABS,
  type ProjectTabId,
} from "../constants/projectDomain";
import { DetailsTab } from "./tabs/DetailsTab";
import { MicroCastingTab } from "./tabs/MicroCastingTab";
import { RehearsalsTab } from "./tabs/RehearsalsTab";
import { CastTab } from "./tabs/CastTab";
import { ProgramTab } from "./tabs/ProgramTab";
import { CrewTab } from "./tabs/CrewTab";
import { BudgetTab } from "./tabs/BudgetTab";
import { AttendanceMatrixTab } from "./tabs/AttendanceMatrixTab";

interface TabDefinition {
  id: ProjectTabId;
  icon: React.ReactNode;
  labelKey: string;
}

const TAB_CONFIG: TabDefinition[] = [
  {
    id: PROJECT_TABS.DETAILS,
    icon: <Briefcase size={14} aria-hidden="true" />,
    labelKey: "projects.editor.tabs.details",
  },
  {
    id: PROJECT_TABS.REHEARSALS,
    icon: <Calendar1 size={14} aria-hidden="true" />,
    labelKey: "projects.editor.tabs.rehearsals",
  },
  {
    id: PROJECT_TABS.MATRIX,
    icon: <Grid size={14} aria-hidden="true" />,
    labelKey: "projects.editor.tabs.matrix",
  },
  {
    id: PROJECT_TABS.CAST,
    icon: <Users size={14} aria-hidden="true" />,
    labelKey: "projects.editor.tabs.cast",
  },
  {
    id: PROJECT_TABS.PROGRAM,
    icon: <ListOrdered size={14} aria-hidden="true" />,
    labelKey: "projects.editor.tabs.program",
  },
  {
    id: PROJECT_TABS.MICRO_CAST,
    icon: <MicVocal size={14} aria-hidden="true" />,
    labelKey: "projects.editor.tabs.micro_cast",
  },
  {
    id: PROJECT_TABS.CREW,
    icon: <Wrench size={14} aria-hidden="true" />,
    labelKey: "projects.editor.tabs.crew",
  },
  {
    id: PROJECT_TABS.BUDGET,
    icon: <Banknote size={14} aria-hidden="true" />,
    labelKey: "projects.editor.tabs.budget",
  },
];

const CLOSE_PANEL_SENTINEL = "CLOSE_PANEL" as const;
type PendingNavigationTarget =
  | ProjectTabId
  | typeof CLOSE_PANEL_SENTINEL
  | null;

interface ProjectEditorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  activeTab: ProjectTabId;
  onTabChange: (tabId: ProjectTabId) => void;
  onProjectPersisted?: (project: Project) => void;
}

export const ProjectEditorPanel = ({
  isOpen,
  onClose,
  project,
  activeTab,
  onTabChange,
  onProjectPersisted,
}: ProjectEditorPanelProps): React.ReactElement => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [pendingTabId, setPendingTabId] =
    useState<PendingNavigationTarget>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useBodyScrollLock(isOpen);
  useFocusTrap(containerRef, isOpen);

  const effectiveActiveTab = project ? activeTab : PROJECT_TABS.DETAILS;

  const handleTabPrefetch = useCallback(
    (tabId: ProjectTabId) => {
      if (!project?.id) return;

      switch (tabId) {
        case PROJECT_TABS.REHEARSALS:
          queryClient.prefetchQuery({
            queryKey: projectKeys.rehearsals.byProject(project.id),
            queryFn: () =>
              ProjectService.getRehearsalsByProject(project.id as string),
          });
          break;
        case PROJECT_TABS.CAST:
        case PROJECT_TABS.MATRIX:
          queryClient.prefetchQuery({
            queryKey: projectKeys.participations.byProject(project.id),
            queryFn: () =>
              ProjectService.getParticipationsByProject(project.id as string),
          });
          break;
        case PROJECT_TABS.CREW:
          queryClient.prefetchQuery({
            queryKey: projectKeys.crewAssignments.byProject(project.id),
            queryFn: () =>
              ProjectService.getCrewAssignmentsByProject(project.id as string),
          });
          queryClient.prefetchQuery({
            queryKey: projectKeys.dictionaries.collaborators,
            queryFn: ProjectService.getCollaboratorsDictionary,
          });
          break;
        case PROJECT_TABS.MICRO_CAST:
          queryClient.prefetchQuery({
            queryKey: projectKeys.pieceCastings.byProject(project.id),
            queryFn: () =>
              ProjectService.getPieceCastingsByProject(project.id as string),
          });
          queryClient.prefetchQuery({
            queryKey: projectKeys.dictionaries.pieces,
            queryFn: ProjectService.getPiecesDictionary,
          });
          break;
        case PROJECT_TABS.PROGRAM:
          queryClient.prefetchQuery({
            queryKey: projectKeys.program.byProject(project.id),
            queryFn: () =>
              ProjectService.getProgramByProject(project.id as string),
          });
          queryClient.prefetchQuery({
            queryKey: projectKeys.dictionaries.pieces,
            queryFn: ProjectService.getPiecesDictionary,
          });
          break;
      }
    },
    [project?.id, queryClient],
  );

  const handleCloseAttempt = useCallback(() => {
    if (hasUnsavedChanges) {
      setPendingTabId(CLOSE_PANEL_SENTINEL);
      return;
    }
    setHasUnsavedChanges(false);
    setPendingTabId(null);
    onClose();
  }, [hasUnsavedChanges, onClose]);

  useCloseWatcher(isOpen, handleCloseAttempt);

  const handleTabInteraction = useCallback(
    (targetTabId: ProjectTabId) => {
      if (effectiveActiveTab === targetTabId) {
        return;
      }

      if (hasUnsavedChanges) {
        setPendingTabId(targetTabId);
        return;
      }

      onTabChange(targetTabId);
    },
    [effectiveActiveTab, hasUnsavedChanges, onTabChange],
  );

  const handleTabKeyDown = useCallback(
    (
      event: React.KeyboardEvent<HTMLButtonElement>,
      currentTabId: ProjectTabId,
    ) => {
      const currentIndex = TAB_CONFIG.findIndex(
        (tab) => tab.id === currentTabId,
      );
      if (currentIndex < 0) {
        return;
      }

      const lastIndex = TAB_CONFIG.length - 1;
      const nextIndexByKey: Partial<Record<string, number>> = {
        ArrowRight: currentIndex === lastIndex ? 0 : currentIndex + 1,
        ArrowDown: currentIndex === lastIndex ? 0 : currentIndex + 1,
        ArrowLeft: currentIndex === 0 ? lastIndex : currentIndex - 1,
        ArrowUp: currentIndex === 0 ? lastIndex : currentIndex - 1,
        Home: 0,
        End: lastIndex,
      };
      const nextIndex = nextIndexByKey[event.key];

      if (nextIndex === undefined) {
        return;
      }

      event.preventDefault();
      const nextTab = TAB_CONFIG[nextIndex];
      handleTabInteraction(nextTab.id);

      if (!hasUnsavedChanges) {
        window.requestAnimationFrame(() => {
          document
            .getElementById(`project-editor-tab-${nextTab.id.toLowerCase()}`)
            ?.focus();
        });
      }
    },
    [handleTabInteraction, hasUnsavedChanges],
  );

  const confirmNavigation = useCallback(() => {
    setHasUnsavedChanges(false);

    if (pendingTabId === CLOSE_PANEL_SENTINEL) {
      setPendingTabId(null);
      onClose();
      return;
    }

    if (pendingTabId !== null) {
      onTabChange(pendingTabId);
      setPendingTabId(null);
    }
  }, [onClose, onTabChange, pendingTabId]);

  const cancelNavigation = useCallback(() => {
    setPendingTabId(null);
  }, []);

  const activeTabDefinition = useMemo(
    () => TAB_CONFIG.find((tab) => tab.id === effectiveActiveTab) ?? null,
    [effectiveActiveTab],
  );

  const renderActiveTab = useCallback(() => {
    switch (effectiveActiveTab) {
      case PROJECT_TABS.DETAILS:
        return (
          <DetailsTab
            project={project}
            onSuccess={(persistedProject) => {
              setHasUnsavedChanges(false);
              if (persistedProject) {
                onProjectPersisted?.(persistedProject);
              }
            }}
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
  }, [effectiveActiveTab, onProjectPersisted, project]);

  const panelNode = (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-[calc(var(--z-nav-sheet)-1)] bg-ethereal-ink/35 backdrop-blur-md"
              onClick={handleCloseAttempt}
              aria-hidden="true"
            />

            <motion.div
              ref={containerRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="project-editor-title"
              aria-describedby="project-editor-desc"
              initial={{ x: "100%", opacity: 0.6 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0.6 }}
              transition={{
                type: "spring",
                damping: 30,
                stiffness: 250,
                mass: 1.2,
              }}
              className="fixed top-0 bottom-0 right-0 z-(--z-nav-sheet) flex justify-end w-full max-w-[1600px] p-0 md:p-4 focus:outline-none"
            >
              <Heading as="h2" id="project-editor-title" className="sr-only">
                {project
                  ? project.title
                  : t("projects.editor.new_project_title")}
              </Heading>
              <Text id="project-editor-desc" className="sr-only">
                {project
                  ? t("projects.editor.workspace_description")
                  : t("projects.editor.create_description")}
              </Text>

              <GlassCard
                variant="solid"
                padding="none"
                isHoverable={false}
                className="h-full w-full rounded-none md:rounded-[2rem] border-ethereal-incense/20 flex flex-col shadow-glass-solid"
              >
                <div className="flex h-full flex-col">
                  <GlassCard
                    variant="light"
                    padding="none"
                    isHoverable={false}
                    className="relative flex-shrink-0 border-b border-glass-border px-6 pb-5 pt-8 md:px-10 z-[10] rounded-none md:rounded-t-[2rem]"
                  >
                    <div className="flex items-start justify-between gap-6">
                      <div className="max-w-4xl space-y-3">
                        <Eyebrow color="muted">
                          {project
                            ? t("projects.editor.workspace")
                            : t("projects.editor.new_project")}
                        </Eyebrow>
                        <div className="flex flex-wrap items-center gap-3">
                          <Heading as="h2" size="4xl" weight="medium">
                            {project
                              ? project.title
                              : t("projects.editor.new_project_title")}
                          </Heading>
                          {project?.status === PROJECT_STATUS.DONE && (
                            <div className="rounded-full border border-ethereal-incense/20 bg-ethereal-parchment px-3 py-1.5 text-ethereal-graphite">
                              <Eyebrow color="inherit">
                                {t("projects.editor.archive_badge")}
                              </Eyebrow>
                            </div>
                          )}
                        </div>
                        <Text color="muted" className="max-w-3xl">
                          {project
                            ? t("projects.editor.workspace_description")
                            : t("projects.editor.create_description")}
                        </Text>
                        {project && activeTabDefinition && (
                          <Text color="graphite" size="sm">
                            {t("projects.editor.active_tab")}:{" "}
                            {t(activeTabDefinition.labelKey)}
                          </Text>
                        )}
                      </div>

                      <Button
                        type="button"
                        variant="icon"
                        size="icon"
                        onClick={handleCloseAttempt}
                        aria-label={t(
                          "common.actions.close_panel",
                          "Zamknij panel (ESC)",
                        )}
                        className="shrink-0"
                      >
                        <X size={20} aria-hidden="true" />
                      </Button>
                    </div>

                    {project && (
                      <GlassCard
                        variant="ethereal"
                        padding="sm"
                        isHoverable={false}
                        className="mt-6 overflow-hidden rounded-[1rem] shadow-none border-glass-border"
                      >
                        <div
                          data-scroll-lock-ignore="true"
                          role="tablist"
                          aria-label={t("projects.editor.tabs_aria")}
                          className="flex gap-2 overflow-x-auto touch-pan-x overscroll-contain no-scrollbar ethereal-scroll"
                        >
                          {TAB_CONFIG.map((tab) => {
                            const isActive = activeTab === tab.id;

                            return (
                              <Button
                                key={tab.id}
                                id={`project-editor-tab-${tab.id.toLowerCase()}`}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                aria-controls={`project-editor-panel-${tab.id.toLowerCase()}`}
                                tabIndex={isActive ? 0 : -1}
                                variant={isActive ? "primary" : "ghost"}
                                size="sm"
                                onClick={() => handleTabInteraction(tab.id)}
                                onKeyDown={(event) =>
                                  handleTabKeyDown(event, tab.id)
                                }
                                onMouseEnter={() => handleTabPrefetch(tab.id)}
                                onFocus={() => handleTabPrefetch(tab.id)}
                                className={cn(
                                  "shrink-0",
                                  isActive && "shadow-sm",
                                )}
                                leftIcon={tab.icon}
                              >
                                {t(tab.labelKey)}
                              </Button>
                            );
                          })}
                        </div>
                      </GlassCard>
                    )}
                  </GlassCard>

                  <div
                    data-scroll-lock-ignore="true"
                    className=" flex flex-col flex-1 min-h-0 overflow-y-auto overflow-x-hidden touch-pan-y overscroll-contain bg-linear-to-b from-ethereal-marble/40 to-ethereal-alabaster/60 px-4 pt-4 md:px-10 ethereal-scroll"
                  >
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={effectiveActiveTab}
                        id={`project-editor-panel-${effectiveActiveTab.toLowerCase()}`}
                        role="tabpanel"
                        aria-labelledby={`project-editor-tab-${effectiveActiveTab.toLowerCase()}`}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="flex-col flex-1 min-h-0 w-full h-full"
                      >
                        {renderActiveTab()}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={pendingTabId !== null}
        title={t("projects.editor.unsaved_changes_title")}
        description={t("projects.editor.unsaved_changes_desc")}
        onConfirm={confirmNavigation}
        onCancel={cancelNavigation}
        confirmText={t("common.actions.discard", "Odrzuć zmiany")}
        cancelText={t("common.actions.cancel", "Anuluj")}
        isDestructive={false}
      />
    </>
  );

  return createPortal(panelNode, document.body);
};
