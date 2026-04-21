/**
 * @file ProjectEditorPanel.tsx
 * @description Slide-over workspace for deep project editing.
 * Guards tab navigation when local form state is dirty and keeps the panel aligned with shared UI primitives.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectEditorPanel
 */

import React, {
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
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
import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";

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

interface ProjectEditorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  activeTab: ProjectTabId;
  onTabChange: (tabId: ProjectTabId) => void;
  onProjectPersisted?: (project: Project) => void;
}

const CLOSE_PANEL_SENTINEL = "CLOSE_PANEL" as const;
type PendingNavigationTarget = ProjectTabId | typeof CLOSE_PANEL_SENTINEL | null;

const FOCUSABLE_PANEL_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export const ProjectEditorPanel = ({
  isOpen,
  onClose,
  project,
  activeTab,
  onTabChange,
  onProjectPersisted,
}: ProjectEditorPanelProps): React.ReactPortal | null => {
  const { t } = useTranslation();
  const panelTitleId = useId();
  const panelDescriptionId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [pendingTabId, setPendingTabId] =
    useState<PendingNavigationTarget>(null);

  useBodyScrollLock(isOpen);

  useEffect(() => {
    setMounted(true);
  }, []);

  const effectiveActiveTab = project ? activeTab : PROJECT_TABS.DETAILS;

  const handleCloseAttempt = useCallback(() => {
    if (hasUnsavedChanges) {
      setPendingTabId(CLOSE_PANEL_SENTINEL);
      return;
    }

    onClose();
  }, [hasUnsavedChanges, onClose]);

  const handleEscape = useEffectEvent(() => {
    handleCloseAttempt();
  });

  useEffect(() => {
    if (!isOpen) {
      const previouslyFocusedElement = previouslyFocusedElementRef.current;
      if (previouslyFocusedElement?.isConnected) {
        previouslyFocusedElement.focus();
      }
      previouslyFocusedElementRef.current = null;
      return;
    }

    const activeElement = document.activeElement;
    previouslyFocusedElementRef.current =
      activeElement instanceof HTMLElement ? activeElement : null;

    window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleEscape();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const panelElement = panelRef.current;
      if (!panelElement) {
        return;
      }

      const focusableElements = Array.from(
        panelElement.querySelectorAll<HTMLElement>(FOCUSABLE_PANEL_SELECTOR),
      ).filter(
        (element) => element.offsetParent !== null && element.tabIndex >= 0,
      );

      if (focusableElements.length === 0) {
        event.preventDefault();
        closeButtonRef.current?.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
        return;
      }

      if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleEscape, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setHasUnsavedChanges(false);
      setPendingTabId(null);
    }
  }, [isOpen]);

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
    (event: React.KeyboardEvent<HTMLButtonElement>, currentTabId: ProjectTabId) => {
      const currentIndex = TAB_CONFIG.findIndex((tab) => tab.id === currentTabId);
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

  if (!mounted) {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          key="editor-panel-root"
          className="fixed inset-0 z-(--z-nav-sheet) flex justify-end"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={handleCloseAttempt}
            className="absolute inset-0 bg-ethereal-ink/35 backdrop-blur-md"
            aria-hidden="true"
          />

          <motion.div
            ref={panelRef}
            initial={{ x: "100%", opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0.6 }}
            transition={{
              type: "spring",
              damping: 30,
              stiffness: 250,
              mass: 1.2,
            }}
            className="relative h-full w-full md:w-[90vw] lg:w-[85vw] max-w-[1600px] p-0 md:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby={panelTitleId}
            aria-describedby={panelDescriptionId}
          >
            <GlassCard
              variant="solid"
              padding="none"
              isHoverable={false}
              className="flex h-full w-full flex-col overflow-hidden rounded-none md:rounded-[2rem] border-ethereal-incense/20"
            >
              <div className="relative flex-shrink-0 border-b border-ethereal-incense/10 bg-ethereal-marble/90 px-6 pb-5 pt-8 backdrop-blur-2xl md:px-10">
                <div className="flex items-start justify-between gap-6">
                  <div className="max-w-4xl space-y-3">
                    <Eyebrow color="muted">
                      {project
                        ? t("projects.editor.workspace")
                        : t("projects.editor.new_project")}
                    </Eyebrow>
                    <div className="flex flex-wrap items-center gap-3">
                      <Heading
                        as="h2"
                        id={panelTitleId}
                        size="4xl"
                        weight="medium"
                      >
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
                    <Text
                      id={panelDescriptionId}
                      color="muted"
                      className="max-w-3xl"
                    >
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
                    ref={closeButtonRef}
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
                    variant="light"
                    padding="sm"
                    isHoverable={false}
                    className="mt-6 overflow-hidden"
                  >
                    <div
                      data-scroll-lock-ignore="true"
                      role="tablist"
                      aria-label={t("projects.editor.tabs_aria")}
                      className="flex gap-2 overflow-x-auto no-scrollbar"
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
                            onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
                            className={cn("shrink-0", isActive && "shadow-sm")}
                            leftIcon={tab.icon}
                          >
                            {t(tab.labelKey)}
                          </Button>
                        );
                      })}
                    </div>
                  </GlassCard>
                )}
              </div>

              <div
                data-scroll-lock-ignore="true"
                className="ethereal-scroll flex-1 overflow-y-auto overflow-x-hidden bg-gradient-to-b from-ethereal-marble/40 to-ethereal-alabaster/60 px-4 pb-10 pt-4 md:px-10"
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
                    className="w-full"
                  >
                    {renderActiveTab()}
                  </motion.div>
                </AnimatePresence>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      )}

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
    </AnimatePresence>,
    document.body,
  );
};
