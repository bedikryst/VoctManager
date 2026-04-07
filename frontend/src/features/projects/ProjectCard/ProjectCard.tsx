/**
 * @file ProjectCard.tsx
 * @description Main orchestrator component for the expandable Project Card.
 * Implements the "Container/Presenter" pattern with an Enterprise Bento-Box Layout.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectCard
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Briefcase, Music, Wrench } from "lucide-react";

import type { Project } from "../../../shared/types";
import { GlassCard } from "../../../shared/ui/GlassCard";
import { useUpdateProjectStatus } from "../api/project.queries";
import { useProjectData } from "../hooks/useProjectData";

import ProjectCardHeader from "./ProjectCardHeader";
import ProjectCardDetails from "./ProjectCardDetails";
import SpotifyWidget from "./SpotifyWidget";
import RunSheetWidget from "./RunSheetWidget";
import RehearsalsWidget from "./widgets/RehearsalsWidget";
import CastWidget from "./widgets/CastWidget";
import ProgramWidget from "./widgets/ProgramWidget";
import CrewWidget from "./widgets/CrewWidget";
import BudgetWidget from "./widgets/BudgetWidget";

const STYLE_DISABLED =
  "bg-stone-50/50 border-stone-200/60 rounded-2xl opacity-75 grayscale hover:grayscale-0 transition-all duration-300";

export interface ProjectCardProps {
  project: Project;
  index: number;
  onEdit: (tab?: string) => void;
  onDelete: () => void;
}

export default function ProjectCard({
  project,
  index,
  onEdit,
  onDelete,
}: ProjectCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const updateProjectStatusMutation = useUpdateProjectStatus();

  const isDone = project.status === "DONE";
  const shouldFetch = isExpanded || index < 3;

  useProjectData(shouldFetch ? String(project.id) : undefined);

  const toggleLifecycleStatus = async (
    event: React.MouseEvent<HTMLButtonElement>,
  ): Promise<void> => {
    event.stopPropagation();
    const newStatus = isDone ? "ACTIVE" : "DONE";
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.05,
        type: "spring",
        stiffness: 300,
        damping: 24,
      }}
      className={`relative group ${isDone ? STYLE_DISABLED : ""}`}
    >
      <GlassCard className="p-0 overflow-hidden transition-all duration-500 hover:shadow-[0_12px_24px_rgb(0,0,0,0.06)] hover:border-[#002395]/20 hover:-translate-y-0.5">
        {!isDone && (
          <div className="absolute -right-8 -top-8 text-[#002395] opacity-[0.02] pointer-events-none group-hover:scale-110 transition-transform duration-700">
            <Briefcase size={200} strokeWidth={1} aria-hidden="true" />
          </div>
        )}

        <ProjectCardHeader
          project={project}
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded(!isExpanded)}
          onStatusToggle={toggleLifecycleStatus}
          onEdit={() => onEdit("DETAILS")}
          onDelete={onDelete}
        />

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-stone-50/40 border-t border-white/60 overflow-hidden cursor-default relative z-0"
            >
              <div className="p-5 md:p-8 space-y-10">
                <div className="space-y-4">
                  <h4 className="flex items-center gap-2 text-[10px] font-bold antialiased uppercase tracking-widest text-[#002395]">
                    <Music size={14} aria-hidden="true" />
                    {t(
                      "projects.card.artistic_dashboard",
                      "Pulpit Artystyczny",
                    )}
                  </h4>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                      <RehearsalsWidget
                        project={project}
                        onEdit={() => onEdit("REHEARSALS")}
                      />
                    </div>
                    <div className="lg:col-span-1">
                      <ProgramWidget
                        project={project}
                        onEdit={() => onEdit("PROGRAM")}
                        onOpenMicroCast={() => onEdit("MICRO_CAST")}
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <CastWidget
                        project={project}
                        onEdit={() => onEdit("CAST")}
                      />
                    </div>
                    <div className="lg:col-span-1">
                      <SpotifyWidget
                        playlistUrl={project.spotify_playlist_url}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-6 border-t border-stone-200/50">
                  <h4 className="flex items-center gap-2 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500">
                    <Wrench size={14} aria-hidden="true" />
                    {t(
                      "projects.card.logistics_dashboard",
                      "Logistyka i Produkcja",
                    )}
                  </h4>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="flex flex-col h-full">
                      <RunSheetWidget
                        project={project}
                        onEdit={() => onEdit("DETAILS")}
                      />
                    </div>
                    <div className="flex flex-col h-full gap-6">
                      <ProjectCardDetails project={project} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
                    <div className="lg:col-span-2">
                      <BudgetWidget
                        project={project}
                        onEdit={() => onEdit("BUDGET")}
                      />
                    </div>
                    <div className="lg:col-span-1">
                      <CrewWidget
                        project={project}
                        onEdit={() => onEdit("CREW")}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
    </motion.div>
  );
}
