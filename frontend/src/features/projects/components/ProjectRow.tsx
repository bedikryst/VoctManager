/**
 * @file ProjectRow.tsx
 * @description Compact, click-to-open project row — the dense list primitive
 * that replaced the half-screen ProjectCard. Mirrors the archive PieceRow:
 *   1. Glance — title, status, date/conductor/location, production stats.
 *   2. Quick fix — inline-edit the title in place (optimistic PATCH, no nav).
 *   3. Open — click the row body → project hub (`/panel/projects/:id`).
 * Lifecycle status toggle + delete live as inline actions; deep editing and
 * exports live in the hub.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/components/ProjectRow
 */

import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  MapPin,
  RotateCcw,
  Trash2,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";

import type { Project } from "@/shared/types";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { InlineEditable } from "@/shared/ui/primitives/InlineEditable";
import { formatLocalizedDate } from "@/shared/lib/time/intl";

import { useUpdateProject, useUpdateProjectStatus } from "../api/project.queries";
import { PROJECT_STATUS } from "../constants/projectDomain";
import {
  getArtistDisplayName,
  getLocationLabel,
} from "../lib/projectPresentation";

interface ProjectRowProps {
  readonly project: Project;
  readonly onDelete: (projectId: string) => void;
}

interface StatChipProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
}

const StatChip = ({ icon, value, label }: StatChipProps): React.JSX.Element => (
  <Caption color="muted" className="inline-flex items-center gap-1 tabular-nums">
    <span className="text-ethereal-incense/50" aria-hidden="true">
      {icon}
    </span>
    <Text as="span" size="xs" weight="medium" className="text-ethereal-ink">
      {value}
    </Text>
    {label}
  </Caption>
);

export const ProjectRow = ({
  project,
  onDelete,
}: ProjectRowProps): React.JSX.Element => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const updateProject = useUpdateProject();
  const updateStatus = useUpdateProjectStatus();

  const isDone = project.status === PROJECT_STATUS.DONE;
  const conductorName = getArtistDisplayName(
    project.conductor,
    project.conductor_name,
  );
  const locationLabel = getLocationLabel(project.location);

  const rehearsalsTotal = project.rehearsals_total ?? 0;
  const rehearsalsDone = rehearsalsTotal - (project.rehearsals_upcoming ?? 0);
  const castTotal = project.cast_total ?? 0;
  const crewTotal = project.crew_total ?? 0;

  const open = useCallback(
    () => navigate(`/panel/projects/${project.id}`),
    [navigate, project.id],
  );

  const patchTitle = useCallback(
    (next: string) =>
      updateProject.mutateAsync({
        id: String(project.id),
        data: { title: next },
      }),
    [updateProject, project.id],
  );

  const toggleStatus = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
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
    },
    [isDone, project.id, t, updateStatus],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      }}
      aria-label={t("projects.card.open", "Otwórz projekt {{title}}", {
        title: project.title,
      })}
      className={cn(
        "group flex w-full cursor-pointer items-center gap-3 rounded-2xl border bg-ethereal-alabaster px-4 py-3 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 focus-visible:ring-inset",
        "border-ethereal-ink/8 hover:border-ethereal-gold/30 hover:bg-ethereal-parchment/40",
        isDone && "opacity-65 saturate-[0.85]",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span onClick={(event) => event.stopPropagation()}>
            <InlineEditable
              value={project.title}
              onSave={patchTitle}
              ariaLabel={t("projects.row.edit_title", "Tytuł projektu")}
              variant="title"
              placeholder={t("projects.row.title_placeholder", "Tytuł")}
              validate={(next) =>
                next.trim()
                  ? null
                  : t("projects.row.title_required", "Tytuł jest wymagany")
              }
            />
          </span>
          <Badge variant={isDone ? "neutral" : "warning"} className="shrink-0">
            {isDone
              ? t("projects.badge_done", "Zrealizowano")
              : t("projects.badge_active", "W przygotowaniu")}
          </Badge>
        </div>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {project.date_time && (
            <Caption color="muted" className="inline-flex items-center gap-1">
              <Calendar size={11} aria-hidden="true" />
              {formatLocalizedDate(
                project.date_time,
                { day: "numeric", month: "short", year: "numeric" },
                undefined,
                project.timezone,
              )}
            </Caption>
          )}
          {conductorName && (
            <Caption color="muted" className="inline-flex items-center gap-1">
              <UserRound size={11} aria-hidden="true" />
              {conductorName}
            </Caption>
          )}
          {locationLabel && (
            <Caption
              color="muted"
              className="inline-flex max-w-48 items-center gap-1 truncate"
            >
              <MapPin size={11} aria-hidden="true" />
              <span className="truncate">{locationLabel}</span>
            </Caption>
          )}
        </div>
      </div>

      {/* Production stats — desktop only */}
      <div className="hidden shrink-0 items-center gap-4 md:flex">
        <StatChip
          icon={<Clock size={12} />}
          value={`${rehearsalsDone}/${rehearsalsTotal}`}
          label={t("projects.rehearsals.title_short", "prób")}
        />
        <StatChip
          icon={<Users size={12} />}
          value={castTotal}
          label={t("projects.cast.title_short", "artystów")}
        />
        <StatChip
          icon={<Wrench size={12} />}
          value={crewTotal}
          label={t("projects.crew.title_short", "tech")}
        />
      </div>

      {/* State + actions */}
      <div className="flex shrink-0 items-center gap-1">
        {project.score_pdf && (
          <span
            className="hidden items-center gap-1 rounded-md border border-ethereal-amethyst/30 bg-ethereal-amethyst/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-ethereal-amethyst sm:inline-flex"
            title={t("projects.exports.open_score_pdf", "Otwórz Partyturę (PDF)")}
          >
            <FileText size={10} aria-hidden="true" />
            PDF
          </span>
        )}

        <Button
          variant="icon"
          size="icon"
          onClick={toggleStatus}
          title={
            isDone
              ? t("projects.actions.mark_active", "Oznacz jako aktywny")
              : t("projects.actions.mark_done", "Zakończ projekt")
          }
          aria-label={
            isDone
              ? t("projects.actions.mark_active", "Oznacz jako aktywny")
              : t("projects.actions.mark_done", "Zakończ projekt")
          }
          className="h-8 w-8 text-ethereal-graphite/70 hover:text-ethereal-sage"
        >
          {isDone ? (
            <RotateCcw size={14} aria-hidden="true" />
          ) : (
            <CheckCircle2 size={14} aria-hidden="true" />
          )}
        </Button>

        <Button
          variant="icon"
          size="icon"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(String(project.id));
          }}
          aria-label={t("projects.row.delete_aria", "Usuń projekt {{title}}", {
            title: project.title,
          })}
          className="h-8 w-8 text-ethereal-graphite/40 transition-colors hover:bg-ethereal-crimson/10 hover:text-ethereal-crimson"
        >
          <Trash2 size={13} aria-hidden="true" />
        </Button>

        <ChevronRight
          size={16}
          aria-hidden="true"
          className="shrink-0 text-ethereal-graphite/50 transition-transform group-hover:translate-x-0.5 group-hover:text-ethereal-gold"
        />
      </div>
    </div>
  );
};
