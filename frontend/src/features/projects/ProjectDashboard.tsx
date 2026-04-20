/**
 * @file ProjectDashboard.tsx
 * @description Master Controller for the Event & Production Management module.
 * Completely eliminates legacy Context API. Child components fetch their own data
 * instantly via React Query structural sharing.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectDashboard
 */

import React from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Plus, Briefcase, Layers } from "lucide-react";

import { useProjectDashboard } from "./hooks/useProjectDashboard";
import ProjectCard from "./ProjectCard/ProjectCard";
import ProjectEditorPanel from "./ProjectEditorPanel/ProjectEditorPanel";
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
import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";

const MemoizedProjectCard = React.memo(ProjectCard);

export default function ProjectDashboard(): React.JSX.Element {
  const { t } = useTranslation();
  const {
    isLoading,
    filteredProjects,
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
    executeDelete,
  } = useProjectDashboard();

  useBodyScrollLock(isPanelOpen || projectToDelete !== null);

  return (
    <PageTransition>
      <div className="space-y-6 relative cursor-default pb-24 max-w-6xl mx-auto px-4 sm:px-0">
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

        <DashboardFilterMenu
          currentFilter={listFilter}
          onFilterChange={setListFilter}
        />

        <StaggeredBentoContainer className="grid grid-cols-1 gap-6">
          {isLoading ? (
            <EtherealLoader className="h-64" />
          ) : filteredProjects.length > 0 ? (
            filteredProjects.map((project, idx) => (
              <StaggeredBentoItem key={project.id}>
                <MemoizedProjectCard
                  project={project}
                  index={idx}
                  onEdit={openPanel}
                  onDelete={setProjectToDelete}
                />
              </StaggeredBentoItem>
            ))
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <GlassCard className="p-16 flex flex-col items-center justify-center text-center">
                <Layers
                  size={48}
                  className="mb-4 text-ethereal-graphite opacity-50"
                  aria-hidden="true"
                />
                <Eyebrow color="muted" className="mb-2">
                  {t(
                    "projects.dashboard.empty_title",
                    "Brak projektów w tym widoku",
                  )}
                </Eyebrow>
                <Text className="max-w-sm">
                  {t(
                    "projects.dashboard.empty_desc",
                    'Rozpocznij planowanie nowego wydarzenia, klikając przycisk "Nowy Projekt" powyżej.',
                  )}
                </Text>
              </GlassCard>
            </motion.div>
          )}
        </StaggeredBentoContainer>

        <ProjectEditorPanel
          isOpen={isPanelOpen}
          onClose={closePanel}
          project={editingProject}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <ConfirmModal
          isOpen={!!projectToDelete}
          title={t("projects.dashboard.delete_modal_title", "Usunąć projekt?")}
          description={t(
            "projects.dashboard.delete_modal_desc",
            "Ta akcja jest nieodwracalna. Spowoduje usunięcie wszystkich powiązanych prób, przypisań ekipy i obsady dla tego projektu.",
          )}
          onConfirm={executeDelete}
          onCancel={() => setProjectToDelete(null)}
          isLoading={isDeleting}
        />
      </div>
    </PageTransition>
  );
}
