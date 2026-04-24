/**
 * @file ProjectCard.tsx
 * @description Main orchestrator component for the expandable Project Card.
 * Implements the "Container/Presenter" pattern with an enterprise dashboard layout.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectCard
 */

import React, { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Briefcase, Music, Wrench } from "lucide-react";
import { toast } from "sonner";

import type { Project } from "@/shared/types";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { SectionHeader } from "@/shared/ui/composites/SectionHeader";
import { useUpdateProjectStatus } from "../api/project.queries";
import { Suspense } from "react";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import {
  PROJECT_STATUS,
  PROJECT_TABS,
  type ProjectTabId,
} from "../constants/projectDomain";

import { ProjectCardHeader } from "./ProjectCardHeader";
import { ProjectCardDetails } from "./ProjectCardDetails";
import { SpotifyWidget } from "./widgets/SpotifyWidget";
import { RunSheetWidget } from "./widgets/RunSheetWidget";
import { RehearsalsWidget } from "./widgets/RehearsalsWidget";
import { CastWidget } from "./widgets/CastWidget";
import { ProgramWidget } from "./widgets/ProgramWidget";
import { CrewWidget } from "./widgets/CrewWidget";
import { BudgetWidget } from "./widgets/BudgetWidget";
import { isFutureProjectDate } from "../lib/projectPresentation";

const STYLE_DISABLED =
  "opacity-70 saturate-[0.8] grayscale-[0.2] transition-all duration-500";

export interface ProjectCardDashboardData {
  isLoading: boolean;
  rehearsalsTotal: number;
  rehearsalsUpcoming: number;
  castTotal: number;
  crewTotal: number;
}

export interface ProjectCardProps {
  project: Project;
  index: number;
  onEdit: (project: Project, tab: ProjectTabId) => void;
  onDelete: (projectId: string) => void;
}

export const ProjectCard = ({
  project,
  index,
  onEdit,
  onDelete,
}: ProjectCardProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const updateProjectStatusMutation = useUpdateProjectStatus();

  const isDone = project.status === PROJECT_STATUS.DONE;

  const dashboardData = useMemo<ProjectCardDashboardData>(() => {
    return {
      isLoading: false,
      rehearsalsTotal: project.rehearsals_total ?? 0,
      rehearsalsUpcoming: project.rehearsals_upcoming ?? 0,
      castTotal: project.cast_total ?? 0,
      crewTotal: project.crew_total ?? 0,
    };
  }, [
    project.rehearsals_total,
    project.rehearsals_upcoming,
    project.cast_total,
    project.crew_total,
  ]);

  const toggleLifecycleStatus = async (
    event: React.MouseEvent<HTMLButtonElement>,
  ): Promise<void> => {
    event.stopPropagation();
    const newStatus = isDone ? PROJECT_STATUS.ACTIVE : PROJECT_STATUS.DONE;
    const toastId = toast.loading(
      t("projects.card.updating_status", "Aktualizowanie statusu..."),
    );

    try {
      await updateProjectStatusMutation.mutateAsync({
        id: project.id,
        status: newStatus,
      });
      toast.success(
        isDone
          ? t(
              "projects.card.status_active",
              "Projekt oznaczony jako w przygotowaniu",
            )
          : t(
              "projects.card.status_done",
              "Projekt oznaczony jako zrealizowany",
            ),
        { id: toastId },
      );
    } catch {
      toast.error(t("common.errors.server_error", "Błąd serwera"), {
        id: toastId,
        description: t(
          "projects.card.status_update_failed",
          "Nie udało się zmienić statusu.",
        ),
      });
    }
  };

  const handleEditDetails = useCallback(
    () => onEdit(project, PROJECT_TABS.DETAILS),
    [onEdit, project],
  );
  const handleEditRehearsals = useCallback(
    () => onEdit(project, PROJECT_TABS.REHEARSALS),
    [onEdit, project],
  );
  const handleEditProgram = useCallback(
    () => onEdit(project, PROJECT_TABS.PROGRAM),
    [onEdit, project],
  );
  const handleEditMicroCast = useCallback(
    () => onEdit(project, PROJECT_TABS.MICRO_CAST),
    [onEdit, project],
  );
  const handleEditCast = useCallback(
    () => onEdit(project, PROJECT_TABS.CAST),
    [onEdit, project],
  );
  const handleEditBudget = useCallback(
    () => onEdit(project, PROJECT_TABS.BUDGET),
    [onEdit, project],
  );
  const handleEditCrew = useCallback(
    () => onEdit(project, PROJECT_TABS.CREW),
    [onEdit, project],
  );

  const handleDelete = useCallback(
    () => onDelete(String(project.id)),
    [onDelete, project.id],
  );

  const handleToggleExpanded = useCallback(() => {
    setIsExpanded((previousState) => !previousState);
  }, []);

  return (
    <GlassCard
      as={motion.div}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.05,
        type: "spring",
        stiffness: 300,
        damping: 24,
      }}
      className={`group ${isDone ? STYLE_DISABLED : ""}`}
      variant="light"
      padding="none"
    >
      {!isDone && (
        <div
          className="pointer-events-none absolute -right-8 -top-8 text-ethereal-gold opacity-[0.04] transition-transform duration-700 group-hover:scale-110"
          aria-hidden="true"
        >
          <Briefcase size={200} strokeWidth={1} />
        </div>
      )}

      <ProjectCardHeader
        project={project}
        isExpanded={isExpanded}
        dashboardData={dashboardData}
        onToggle={handleToggleExpanded}
        onStatusToggle={toggleLifecycleStatus}
        onEdit={handleEditDetails}
        onDelete={handleDelete}
      />

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key={`expanded-card-${project.id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="relative z-0 overflow-hidden border-t border-ethereal-incense/15 bg-ethereal-alabaster/40"
          >
            <Suspense
              fallback={
                <div className="flex min-h-[400px] items-center justify-center p-8">
                  <EtherealLoader />
                </div>
              }
            >
              <div className="space-y-10 p-6 md:p-8">
                <div className="space-y-4">
                  <SectionHeader
                    title={t(
                      "projects.card.artistic_dashboard",
                      "Pulpit Artystyczny",
                    )}
                    icon={<Music size={16} aria-hidden="true" />}
                    className="mb-0 pb-4"
                  />
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2">
                      <RehearsalsWidget
                        project={project}
                        onEdit={handleEditRehearsals}
                      />
                    </div>
                    <div className="lg:col-span-1">
                      <ProgramWidget
                        project={project}
                        onEdit={handleEditProgram}
                        onOpenMicroCast={handleEditMicroCast}
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <CastWidget project={project} onEdit={handleEditCast} />
                    </div>
                    <div className="lg:col-span-1">
                      <SpotifyWidget
                        playlistUrl={project.spotify_playlist_url}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 border-t border-ethereal-incense/15 pt-6">
                  <SectionHeader
                    title={t(
                      "projects.card.logistics_dashboard",
                      "Logistyka i Produkcja",
                    )}
                    icon={<Wrench size={16} aria-hidden="true" />}
                    className="mb-0 pb-4"
                  />

                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="flex h-full flex-col">
                      <RunSheetWidget
                        project={project}
                        onEdit={handleEditDetails}
                      />
                    </div>
                    <div className="flex h-full flex-col gap-6">
                      <ProjectCardDetails project={project} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 pt-4 lg:grid-cols-3">
                    <div className="lg:col-span-2">
                      <BudgetWidget
                        project={project}
                        onEdit={handleEditBudget}
                      />
                    </div>
                    <div className="lg:col-span-1">
                      <CrewWidget project={project} onEdit={handleEditCrew} />
                    </div>
                  </div>
                </div>
              </div>
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
};
