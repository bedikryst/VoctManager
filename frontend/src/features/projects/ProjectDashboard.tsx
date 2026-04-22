/**
 * @file ProjectDashboard.tsx
 * @description Master controller for the Project operations dashboard.
 * Keeps the page shell declarative and delegates data orchestration to feature hooks.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectDashboard
 */

import React, { memo, useDeferredValue, Suspense } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Layers, Plus } from "lucide-react";

import { useProjectDashboard } from "./hooks/useProjectDashboard";
import { ProjectCard } from "./ProjectCard/ProjectCard";
import { ProjectEditorPanel } from "./ProjectEditorPanel/ProjectEditorPanel";
import { DashboardFilterMenu } from "./components/DashboardFilterMenu";

import {
  StaggeredBentoContainer,
  StaggeredBentoItem,
} from "@/shared/ui/kinematics/StaggeredBentoGrid";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { Eyebrow } from "@/shared/ui/primitives/typography/Eyebrow";
import { Text } from "@/shared/ui/primitives/typography/Text";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import type { Project } from "@/shared/types";

const MemoizedProjectCard = memo(ProjectCard);

const DashboardGrid = ({
  filteredProjects,
  openPanel,
  setProjectToDelete,
}: {
  filteredProjects: Project[];
  openPanel: (project?: Project | null) => void;
  setProjectToDelete: (id: string | null) => void;
}) => {
  const { t } = useTranslation();
  const deferredProjects = useDeferredValue(filteredProjects);

  if (deferredProjects.length === 0) {
    return (
      <StaggeredBentoItem>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <GlassCard
            variant="light"
            padding="lg"
            isHoverable={false}
            className="flex flex-col items-center justify-center gap-4 text-center"
          >
            <div
              className="rounded-full border border-ethereal-incense/15 bg-ethereal-alabaster/70 p-4 text-ethereal-graphite/55"
              aria-hidden="true"
            >
              <Layers size={32} />
            </div>
            <div className="space-y-2">
              <Eyebrow color="muted">
                {t(
                  "projects.dashboard.empty_title",
                  "Brak projektów w tym widoku",
                )}
              </Eyebrow>
              <Text className="mx-auto max-w-md" color="graphite">
                {t(
                  "projects.dashboard.empty_desc",
                  "Rozpocznij planowanie nowego wydarzenia, korzystając z akcji tworzenia projektu.",
                )}
              </Text>
            </div>
            <Button
              variant="secondary"
              onClick={() => openPanel(null)}
              leftIcon={<Plus size={16} aria-hidden="true" />}
            >
              {t("projects.dashboard.btn_new_project", "Nowy Projekt")}
            </Button>
          </GlassCard>
        </motion.div>
      </StaggeredBentoItem>
    );
  }

  return (
    <>
      {deferredProjects.map((project, index) => (
        <StaggeredBentoItem key={project.id}>
          <MemoizedProjectCard
            project={project}
            index={index}
            onEdit={openPanel}
            onDelete={setProjectToDelete}
          />
        </StaggeredBentoItem>
      ))}
    </>
  );
};

export const ProjectDashboard = (): React.JSX.Element => {
  const { t } = useTranslation();
  const {
    filteredProjects, // wyciągnięto isLoading
    listFilter,
    setListFilter,
    isPanelOpen,
    activeTab,
    setActiveTab,
    editingProject,
    projectToDelete,
    setProjectToDelete,
    isDeleting,
    openPanel,
    closePanel,
    handleProjectPersisted,
    executeDelete,
  } = useProjectDashboard();

  return (
    <PageTransition>
      <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-24 sm:px-0">
        <PageHeader
          roleText={t("projects.dashboard.header_badge", "Centrum Dowodzenia")}
          title={t("projects.dashboard.header_title_1", "Wydarzenia i")}
          titleHighlight={t("projects.dashboard.header_title_2", "Produkcja")}
          rightContent={
            <Button
              variant="primary"
              onClick={() => openPanel(null)}
              leftIcon={<Plus size={16} aria-hidden="true" />}
            >
              {t("projects.dashboard.btn_new_project", "Nowy Projekt")}
            </Button>
          }
          size="dashboard"
        />

        <div className="md:hidden">
          <Button
            variant="primary"
            fullWidth
            onClick={() => openPanel(null)}
            leftIcon={<Plus size={16} aria-hidden="true" />}
          >
            {t("projects.dashboard.btn_new_project", "Nowy Projekt")}
          </Button>
        </div>

        <DashboardFilterMenu
          currentFilter={listFilter}
          onFilterChange={setListFilter}
        />

        <StaggeredBentoContainer className="grid grid-cols-1 gap-6">
          <Suspense
            fallback={
              <StaggeredBentoItem>
                <EtherealLoader className="h-64" />
              </StaggeredBentoItem>
            }
          >
            <DashboardGrid
              filteredProjects={filteredProjects}
              openPanel={openPanel}
              setProjectToDelete={setProjectToDelete}
            />
          </Suspense>
        </StaggeredBentoContainer>

        <ProjectEditorPanel
          isOpen={isPanelOpen}
          onClose={closePanel}
          project={editingProject}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onProjectPersisted={handleProjectPersisted}
        />

        <ConfirmModal
          isOpen={projectToDelete !== null}
          title={t("projects.dashboard.delete_modal_title", "Usunąć projekt?")}
          description={t(
            "projects.dashboard.delete_modal_desc",
            "Ta akcja jest nieodwracalna i usunie również powiązane próby, obsadę oraz przypisania ekipy.",
          )}
          onConfirm={executeDelete}
          onCancel={() => setProjectToDelete(null)}
          isLoading={isDeleting}
        />
      </div>
    </PageTransition>
  );
};
