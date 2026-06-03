/**
 * @file ProjectHubLayout.tsx
 * @description Persistent shell for a single project. Loads the hydrated project
 * from the shared enrichment hook, renders the project-level action cluster
 * (exports, score PDF, lifecycle status, delete) and the sub-route tab nav, then
 * yields to the active work area through `<Outlet>`. Replaces the old slide-over
 * `ProjectEditorPanel` — every section is now a real, deep-linkable route.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/ProjectHubLayout
 */

import React, { Suspense, useCallback, useEffect, useState } from "react";
import {
  Navigate,
  Outlet,
  useBlocker,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlignLeft,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  FileText,
  MoreHorizontal,
  RotateCcw,
  Trash2,
} from "lucide-react";

import type { Project } from "@/shared/types";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { Button } from "@/shared/ui/primitives/Button";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Caption, Heading } from "@/shared/ui/primitives/typography";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { PdfViewerModal } from "@/shared/ui/composites/PdfViewerModal";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/shared/ui/composites/DropdownMenu";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { useUnsavedChangesWarning } from "@/shared/lib/dom/useUnsavedChangesWarning";

import { useEnrichedProject } from "./hooks/useEnrichedProjects";
import { useProjectCard } from "./ProjectCard/hooks/useProjectCard";
import { ProjectService } from "./api/project.service";
import { useDeleteProject, useUpdateProjectStatus } from "./api/project.queries";
import { projectKeys } from "./api/project.query-keys";
import {
  FAST_CHANGING_STALE_TIME,
  PROJECT_RELATION_STALE_TIME,
} from "./api/project.query-utils";
import { PROJECT_STATUS } from "./constants/projectDomain";
import { getArtistDisplayName } from "./lib/projectPresentation";
import { ProjectTabs } from "./components/ProjectTabs";

export interface ProjectHubContext {
  project: Project;
  /**
   * Lets a work-area route report unsaved edits up to the hub so it can guard
   * soft navigation (tab switch, back) and arm the hard-navigation prompt.
   */
  setDirty: (dirty: boolean) => void;
  /**
   * Opens the shared score-PDF viewer that lives in the hub shell, so the
   * Overview's Materials card can surface the partytura without duplicating
   * the modal. No-op when the project has no score uploaded.
   */
  openScore: () => void;
}

export default function ProjectHubLayout(): React.JSX.Element {
  const { id = "" } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const project = useEnrichedProject(id);

  const { downloadReport, isDownloading } = useProjectCard(id);
  const updateStatus = useUpdateProjectStatus();
  const deleteProject = useDeleteProject();

  const [isRunsheetOpen, setRunsheetOpen] = useState<boolean>(false);
  const [isScoreOpen, setScoreOpen] = useState<boolean>(false);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);

  // Unsaved-changes guard. A deferred-save work area (program, budget,
  // micro-casting, details) reports its dirty state through `setDirty`. The hub
  // then arms the native prompt for hard navigation (reload / tab close) and,
  // via the data router's `useBlocker`, intercepts ALL soft navigation away from
  // the current work area — tab switches, the back button AND the global sidebar
  // — behind one confirm dialog. Resetting on every pathname change keeps the
  // flag honest per route, independent of whether a tab clears it on unmount.
  const [isDirty, setDirty] = useState<boolean>(false);

  useUnsavedChangesWarning(isDirty);

  useEffect(() => {
    setDirty(false);
  }, [location.pathname]);

  // Warm every per-project query on entry (background prefetch, non-blocking) so
  // switching tabs is instant — no per-tab suspense flash. The Overview already
  // pulls most of these; this guarantees the rest (e.g. attendances, only used by
  // the matrix) are ready before that tab is ever opened.
  useEffect(() => {
    if (!id) return;
    void Promise.allSettled([
      queryClient.prefetchQuery({
        queryKey: projectKeys.participations.byProject(id),
        queryFn: () => ProjectService.getParticipationsByProject(id),
        staleTime: PROJECT_RELATION_STALE_TIME,
      }),
      queryClient.prefetchQuery({
        queryKey: projectKeys.rehearsals.byProject(id),
        queryFn: () => ProjectService.getRehearsalsByProject(id),
        staleTime: PROJECT_RELATION_STALE_TIME,
      }),
      queryClient.prefetchQuery({
        queryKey: projectKeys.crewAssignments.byProject(id),
        queryFn: () => ProjectService.getCrewAssignmentsByProject(id),
        staleTime: PROJECT_RELATION_STALE_TIME,
      }),
      queryClient.prefetchQuery({
        queryKey: projectKeys.program.byProject(id),
        queryFn: () => ProjectService.getProgramByProject(id),
        staleTime: FAST_CHANGING_STALE_TIME,
      }),
      queryClient.prefetchQuery({
        queryKey: projectKeys.pieceCastings.byProject(id),
        queryFn: () => ProjectService.getPieceCastingsByProject(id),
        staleTime: FAST_CHANGING_STALE_TIME,
      }),
      queryClient.prefetchQuery({
        queryKey: projectKeys.attendances.byProject(id),
        queryFn: () => ProjectService.getAttendancesByProject(id),
        staleTime: FAST_CHANGING_STALE_TIME,
      }),
    ]);
  }, [id, queryClient]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname,
  );

  const fetchRunsheetBlob = useCallback(async () => {
    const response = await ProjectService.downloadReport(
      id,
      "export_call_sheet",
    );
    return new Blob([response.data], { type: "application/pdf" });
  }, [id]);

  const fetchScorePdfBlob = useCallback(
    () => ProjectService.fetchScorePdfBlob(id),
    [id],
  );

  const handleStatusToggle = useCallback(async () => {
    if (!project) return;
    const isDone = project.status === PROJECT_STATUS.DONE;
    const nextStatus = isDone ? PROJECT_STATUS.ACTIVE : PROJECT_STATUS.DONE;
    const toastId = toast.loading(
      t("projects.card.updating_status", "Aktualizowanie statusu..."),
    );
    try {
      await updateStatus.mutateAsync({ id: project.id, status: nextStatus });
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
  }, [project, t, updateStatus]);

  const handleDelete = useCallback(async () => {
    const toastId = toast.loading(
      t("projects.toast.delete_loading", "Usuwanie projektu..."),
    );
    try {
      await deleteProject.mutateAsync(id);
      toast.success(
        t("projects.toast.delete_success", "Projekt usunięty pomyślnie"),
        { id: toastId },
      );
      navigate("/panel/projects");
    } catch {
      toast.error(t("projects.toast.delete_error_title", "Błąd usuwania"), {
        id: toastId,
        description: t(
          "projects.toast.delete_error_desc",
          "Sprawdź powiązania projektu w bazie. Projekt może mieć przypisane umowy lub obecności.",
        ),
      });
    } finally {
      setConfirmDelete(false);
    }
  }, [deleteProject, id, navigate, t]);

  if (!project) {
    return <Navigate to="/panel/projects" replace />;
  }

  const isDone = project.status === PROJECT_STATUS.DONE;
  const conductorName = getArtistDisplayName(
    project.conductor,
    project.conductor_name,
  );

  return (
    <PageTransition>
      <div className="relative mx-auto flex max-w-7xl flex-col gap-5 px-4 pb-24 pt-6 sm:px-0">
        <header className="flex flex-col gap-5">
          {/* Utility row — navigation + project-level actions. Labels collapse to
              icons as the viewport narrows so the cluster never overflows. */}
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/panel/projects")}
              leftIcon={<ArrowLeft size={14} aria-hidden="true" />}
              aria-label={t("projects.hub.back", "Wydarzenia")}
            >
              <span className="hidden sm:inline">
                {t("projects.hub.back", "Wydarzenia")}
              </span>
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleStatusToggle}
                leftIcon={
                  isDone ? (
                    <RotateCcw size={14} aria-hidden="true" />
                  ) : (
                    <CheckCircle2 size={14} aria-hidden="true" />
                  )
                }
                aria-label={
                  isDone
                    ? t("projects.actions.mark_active", "Oznacz jako aktywny")
                    : t("projects.actions.mark_done", "Zakończ projekt")
                }
              >
                <span className="hidden md:inline">
                  {isDone
                    ? t("projects.actions.mark_active", "Oznacz jako aktywny")
                    : t("projects.actions.mark_done", "Zakończ projekt")}
                </span>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    isLoading={isDownloading !== null}
                    leftIcon={<Download size={14} aria-hidden="true" />}
                    aria-label={t("projects.exports.menu", "Eksport")}
                  >
                    <span className="hidden items-center gap-1.5 sm:inline-flex">
                      {t("projects.exports.menu", "Eksport")}
                      <ChevronDown size={14} aria-hidden="true" />
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>
                    {t("projects.exports.preview_group", "Podgląd")}
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    icon={<Eye size={15} aria-hidden="true" />}
                    onSelect={() => setRunsheetOpen(true)}
                  >
                    {t(
                      "projects.exports.runsheet_title",
                      "Harmonogram (Runsheet)",
                    )}
                  </DropdownMenuItem>
                  {project.score_pdf && (
                    <DropdownMenuItem
                      icon={<FileText size={15} aria-hidden="true" />}
                      onSelect={() => setScoreOpen(true)}
                    >
                      {t("projects.exports.score_pdf", "Partytura (PDF)")}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>
                    {t("projects.exports.download_group", "Pobierz")}
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    icon={<FileText size={15} aria-hidden="true" />}
                    onSelect={() =>
                      downloadReport(
                        "export_call_sheet",
                        `CallSheet_${project.title}.pdf`,
                        "CALL_SHEET",
                      )
                    }
                  >
                    {t("projects.exports.call_sheet", "Call Sheet")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    icon={<Download size={15} aria-hidden="true" />}
                    onSelect={() =>
                      downloadReport(
                        "export_zaiks",
                        `ZAiKS_${project.title}.csv`,
                        "ZAIKS",
                      )
                    }
                  >
                    {t("projects.exports.zaiks", "ZAiKS (CSV)")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    icon={<AlignLeft size={15} aria-hidden="true" />}
                    onSelect={() =>
                      downloadReport(
                        "export_dtp",
                        `DTP_${project.title}.txt`,
                        "DTP",
                      )
                    }
                  >
                    {t("projects.exports.dtp", "Notka do DTP")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="icon"
                    size="icon"
                    aria-label={t("projects.hub.more_actions", "Więcej akcji")}
                  >
                    <MoreHorizontal size={16} aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem
                    destructive
                    icon={<Trash2 size={15} aria-hidden="true" />}
                    onSelect={() => setConfirmDelete(true)}
                  >
                    {t("projects.actions.delete_project", "Usuń projekt")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Identity row */}
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-2">
              <Badge variant={isDone ? "neutral" : "warning"}>
                {isDone
                  ? t("projects.badge_done", "Zrealizowano")
                  : t("projects.badge_active", "W przygotowaniu")}
              </Badge>
            </div>
            <Heading as="h1" size="3xl" weight="medium" className="truncate">
              {project.title}
            </Heading>
            <Caption color="muted" className="mt-1 block truncate">
              {project.date_time
                ? formatLocalizedDate(
                    project.date_time,
                    {
                      weekday: "short",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    },
                    undefined,
                    project.timezone,
                  )
                : t("projects.hub.no_date", "Termin nieustalony")}
              {conductorName ? ` · ${conductorName}` : ""}
            </Caption>
          </div>

          <ProjectTabs projectId={id} />
        </header>

        <Suspense
          fallback={
            <div className="flex min-h-105 items-center justify-center">
              <EtherealLoader fullHeight={false} />
            </div>
          }
        >
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="min-w-0"
          >
            <Outlet
              context={
                {
                  project,
                  setDirty,
                  openScore: () => setScoreOpen(true),
                } satisfies ProjectHubContext
              }
            />
          </motion.div>
        </Suspense>
      </div>

      <PdfViewerModal
        isOpen={isRunsheetOpen}
        title={t("projects.exports.runsheet_title", "Harmonogram (Runsheet)")}
        subtitle={project.title}
        fileName={`Runsheet_${project.title}.pdf`}
        fetchBlob={fetchRunsheetBlob}
        docKey={`runsheet-${project.id}`}
        fullView={{
          type: "project-call-sheet",
          id: project.id,
          hint: {
            title: t("projects.exports.runsheet_title", "Harmonogram (Runsheet)"),
            subtitle: project.title,
            fileName: `Runsheet_${project.title}.pdf`,
          },
        }}
        onClose={() => setRunsheetOpen(false)}
      />

      {project.score_pdf && (
        <PdfViewerModal
          isOpen={isScoreOpen}
          title={t("projects.card.score_pdf_modal_title", "Partytura Koncertu")}
          subtitle={project.title}
          fileName={`Score_${project.title.replace(/\s+/g, "_")}.pdf`}
          fetchBlob={fetchScorePdfBlob}
          docKey={`score-pdf-${project.id}`}
          fullView={{
            type: "project-score",
            id: project.id,
            hint: {
              title: t(
                "projects.card.score_pdf_modal_title",
                "Partytura Koncertu",
              ),
              subtitle: project.title,
              fileName: `Score_${project.title.replace(/\s+/g, "_")}.pdf`,
            },
          }}
          onClose={() => setScoreOpen(false)}
        />
      )}

      <ConfirmModal
        isOpen={blocker.state === "blocked"}
        isDestructive
        title={t(
          "projects.hub.unsaved_modal_title",
          "Masz niezapisane zmiany",
        )}
        description={t(
          "projects.hub.unsaved_modal_desc",
          "Opuszczenie tej sekcji odrzuci niezapisane zmiany. Czy chcesz kontynuować?",
        )}
        confirmText={t("common.actions.discard", "Odrzuć i wyjdź")}
        cancelText={t("common.actions.cancel", "Zostań")}
        onConfirm={() => {
          setDirty(false);
          blocker.proceed?.();
        }}
        onCancel={() => blocker.reset?.()}
      />

      <ConfirmModal
        isOpen={confirmDelete}
        isDestructive
        title={t("projects.dashboard.delete_modal_title", "Usunąć projekt?")}
        description={t(
          "projects.dashboard.delete_modal_desc",
          "Ta akcja jest nieodwracalna i usunie również powiązane próby, obsadę oraz przypisania ekipy.",
        )}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
        isLoading={deleteProject.isPending}
      />
    </PageTransition>
  );
}
