import React, { Suspense, useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Briefcase, Music, Wrench } from "lucide-react";
import { toast } from "sonner";

import type { Project } from "@/shared/types";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { useUpdateProjectStatus } from "../api/project.queries";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import {
  StaggeredBentoContainer,
  StaggeredBentoItem,
} from "@/shared/ui/kinematics/StaggeredBentoGrid";
import { Heading } from "@/shared/ui/primitives/typography";
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

interface DashboardSectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  className?: string;
}

const DashboardSection = ({
  icon,
  title,
  children,
  className,
}: DashboardSectionProps): React.JSX.Element => (
  <div className={className}>
    <div className="mb-5 flex items-center gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ethereal-gold/10 text-ethereal-gold">
        {icon}
      </div>
      <Heading as="h3" size="lg" weight="medium">
        {title}
      </Heading>
    </div>
    {children}
  </div>
);

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
      glow
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
            className="relative z-0 border-t border-ethereal-incense/10 overflow-hidden"
          >
            <Suspense
              fallback={
                <div className="flex min-h-100 items-center justify-center p-8">
                  <EtherealLoader />
                </div>
              }
            >
              <div className="p-6 md:p-8">
                <DashboardSection
                  icon={<Music size={14} aria-hidden="true" />}
                  title={t(
                    "projects.card.artistic_dashboard",
                    "Pulpit Artystyczny",
                  )}
                  className="mb-10"
                >
                  <StaggeredBentoContainer className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                    <StaggeredBentoItem className="lg:col-span-2">
                      <RehearsalsWidget
                        project={project}
                        onEdit={handleEditRehearsals}
                      />
                    </StaggeredBentoItem>
                    <StaggeredBentoItem className="lg:col-span-1">
                      <ProgramWidget
                        project={project}
                        onEdit={handleEditProgram}
                        onOpenMicroCast={handleEditMicroCast}
                      />
                    </StaggeredBentoItem>
                    <StaggeredBentoItem className="lg:col-span-2">
                      <CastWidget project={project} onEdit={handleEditCast} />
                    </StaggeredBentoItem>
                    <StaggeredBentoItem className="lg:col-span-1">
                      <SpotifyWidget
                        playlistUrl={project.spotify_playlist_url}
                      />
                    </StaggeredBentoItem>
                  </StaggeredBentoContainer>
                </DashboardSection>

                <DashboardSection
                  icon={<Wrench size={14} aria-hidden="true" />}
                  title={t(
                    "projects.card.logistics_dashboard",
                    "Logistyka i Produkcja",
                  )}
                  className="border-t border-ethereal-incense/15 pt-8"
                >
                  <StaggeredBentoContainer className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    <StaggeredBentoItem className="flex h-full flex-col">
                      <RunSheetWidget
                        project={project}
                        onEdit={handleEditDetails}
                      />
                    </StaggeredBentoItem>
                    <StaggeredBentoItem className="flex h-full flex-col">
                      <ProjectCardDetails project={project} />
                    </StaggeredBentoItem>
                  </StaggeredBentoContainer>

                  <StaggeredBentoContainer className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
                    <StaggeredBentoItem className="lg:col-span-2">
                      <BudgetWidget
                        project={project}
                        onEdit={handleEditBudget}
                      />
                    </StaggeredBentoItem>
                    <StaggeredBentoItem className="lg:col-span-1">
                      <CrewWidget project={project} onEdit={handleEditCrew} />
                    </StaggeredBentoItem>
                  </StaggeredBentoContainer>
                </DashboardSection>
              </div>
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
};
