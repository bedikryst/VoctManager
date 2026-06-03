/**
 * @file ProjectDashboard.tsx
 * @description Master controller for the Project operations list.
 * Renders projects as a dense, scannable row list (archive PieceRow model);
 * each row inline-edits its title and navigates to the project hub
 * (`/panel/projects/:id`) for all deep editing. No slide-over panel.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/ProjectDashboard
 */

import React, { memo, useDeferredValue, Suspense, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layers, Plus } from "lucide-react";

import { useProjectDashboard } from "./hooks/useProjectDashboard";
import { ProjectRow } from "./components/ProjectRow";
import { DashboardFilterMenu } from "./components/DashboardFilterMenu";

import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { Eyebrow } from "@/shared/ui/primitives/typography/Eyebrow";
import { Text } from "@/shared/ui/primitives/typography/Text";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import type { Project } from "@/shared/types";

const MemoizedProjectRow = memo(ProjectRow);

const DashboardList = ({
  filteredProjects,
  onNewProject,
  onDelete,
}: {
  filteredProjects: Project[];
  onNewProject: () => void;
  onDelete: (id: string) => void;
}) => {
  const { t } = useTranslation();
  const deferredProjects = useDeferredValue(filteredProjects);

  if (deferredProjects.length === 0) {
    return (
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
            onClick={onNewProject}
            leftIcon={<Plus size={16} aria-hidden="true" />}
          >
            {t("projects.dashboard.btn_new_project", "Nowy Projekt")}
          </Button>
        </GlassCard>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {deferredProjects.map((project) => (
        <MemoizedProjectRow
          key={project.id}
          project={project}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};

export const ProjectDashboard = (): React.JSX.Element => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    filteredProjects,
    listFilter,
    setListFilter,
    projectToDelete,
    setProjectToDelete,
    isDeleting,
    executeDelete,
  } = useProjectDashboard();

  const goToNewProject = useCallback(
    () => navigate("/panel/projects/new"),
    [navigate],
  );

  return (
    <PageTransition>
      <div className="relative mx-auto flex max-w-5xl flex-col gap-5 px-4 pb-24 pt-6 sm:px-0">
        <PageHeader
          size="standard"
          roleText={t("projects.dashboard.header_badge", "Centrum Dowodzenia")}
          title={t("projects.dashboard.header_title_1", "Wydarzenia i")}
          titleHighlight={t("projects.dashboard.header_title_2", "Produkcja")}
          rightContent={
            <Button
              variant="primary"
              onClick={goToNewProject}
              leftIcon={<Plus size={16} aria-hidden="true" />}
            >
              {t("projects.dashboard.btn_new_project", "Nowy Projekt")}
            </Button>
          }
        />

        <div className="md:hidden">
          <Button
            variant="primary"
            fullWidth
            onClick={goToNewProject}
            leftIcon={<Plus size={16} aria-hidden="true" />}
          >
            {t("projects.dashboard.btn_new_project", "Nowy Projekt")}
          </Button>
        </div>

        <DashboardFilterMenu
          currentFilter={listFilter}
          onFilterChange={setListFilter}
        />

        <Suspense fallback={<EtherealLoader className="h-64" />}>
          <DashboardList
            filteredProjects={filteredProjects}
            onNewProject={goToNewProject}
            onDelete={setProjectToDelete}
          />
        </Suspense>

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
