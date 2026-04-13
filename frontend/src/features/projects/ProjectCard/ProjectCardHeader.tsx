/**
 * @file ProjectCardHeader.tsx
 * @description Renders the compact, scannable header for a project card.
 * Integrates dual-timezone presentation layer for traveling artists.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectCard/ProjectCardHeader
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  MapPin,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Download,
  AlignLeft,
  Edit2,
  Trash2,
  Wrench,
  Users,
  Calendar,
} from "lucide-react";

import { PROJECT_STATUS } from "../constants/projectDomain";
import type { Project } from "@/shared/types";
import { useProjectData } from "../hooks/useProjectData";
import { useProjectCard } from "./hooks/useProjectCard";
import { Button } from "@/shared/ui/primitives/Button";

// Importujemy ustandaryzowane mechanizmy z shared
import { formatLocalizedDate } from "@/shared/lib/intl";
import { DualTimeDisplay } from "@/shared/widgets/utility/DualTimeDisplay";

interface ProjectCardHeaderProps {
  project: Project;
  isExpanded: boolean;
  onToggle: () => void;
  onStatusToggle: (e: React.MouseEvent<HTMLButtonElement>) => Promise<void>;
  onEdit: () => void;
  onDelete: () => void;
}

export default function ProjectCardHeader({
  project,
  isExpanded,
  onToggle,
  onStatusToggle,
  onEdit,
  onDelete,
}: ProjectCardHeaderProps): React.JSX.Element {
  const { t } = useTranslation();
  const { downloadReport, isDownloading } = useProjectCard(String(project.id));
  const { rehearsals, participations, crewAssignments, isLoading } =
    useProjectData(String(project.id));

  const isDone = project.status === PROJECT_STATUS.DONE;

  // Poprawiony standardowy link do Google Maps
  const googleMapsUrl = useMemo(() => {
    return project.location
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(project.location)}`
      : null;
  }, [project.location]);

  const stats = useMemo(() => {
    const now = new Date();
    const upcomingRehearsals = rehearsals.filter(
      (r) => r.date_time && new Date(r.date_time) > now,
    ).length;
    return {
      rehearsalsTotal: rehearsals.length,
      rehearsalsUpcoming: upcomingRehearsals,
      castTotal: participations.length,
      crewTotal: crewAssignments.length,
    };
  }, [rehearsals, participations, crewAssignments]);

  return (
    <div
      className="p-6 md:p-8 flex flex-col lg:flex-row gap-8 justify-between cursor-pointer"
      onClick={onToggle}
    >
      <div className="flex-1 flex flex-col justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span
              className={`px-3 py-1 rounded-lg text-[9px] font-bold antialiased uppercase tracking-widest border shadow-sm ${isDone ? "bg-stone-100 text-stone-600 border-stone-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}
            >
              {isDone
                ? t("projects.badge_done", "Zrealizowano")
                : t("projects.badge_active", "W przygotowaniu")}
            </span>
          </div>

          <h2
            className="text-2xl md:text-3xl font-bold text-stone-900 tracking-tight leading-tight mb-4 group-hover:text-brand transition-colors"
            style={{ fontFamily: "'Cormorant', serif" }}
          >
            {project.title}
          </h2>

          <div className="flex flex-wrap items-start gap-4 text-xs font-bold text-stone-500 uppercase tracking-widest mb-6">
            {/* SEKCJA CZASU I DATY */}
            {project.date_time && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 bg-stone-50/80 px-3 py-1.5 rounded-lg border border-stone-200/60 w-fit text-stone-600">
                  <Calendar
                    size={14}
                    className="text-brand/60"
                    aria-hidden="true"
                  />
                  {formatLocalizedDate(
                    project.date_time,
                    {
                      weekday: "short",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    },
                    undefined,
                    project.timezone,
                  )}
                </span>

                <DualTimeDisplay
                  value={project.date_time}
                  timeZone={project.timezone}
                  icon={
                    <Clock
                      size={14}
                      className="text-brand/60"
                      aria-hidden="true"
                    />
                  }
                  containerClassName="flex items-center gap-1.5 bg-stone-50/80 px-3 py-1.5 rounded-lg border border-stone-200/60 w-fit text-stone-700"
                  primaryTimeClassName="flex items-center gap-1.5"
                  localTimeClassName="text-[10px] text-stone-400 font-medium normal-case tracking-normal border-l border-stone-200/60 pl-2"
                />
              </div>
            )}

            {/* SEKCJA LOKALIZACJI */}
            {googleMapsUrl && (
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-stone-50/80 px-3 py-1.5 rounded-lg border border-stone-200/60 hover:bg-stone-100 transition-colors w-fit mt-1 lg:mt-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MapPin
                  size={14}
                  className="text-brand/60 flex-shrink-0"
                  aria-hidden="true"
                />
                <span className="underline decoration-stone-300 underline-offset-4 truncate max-w-[200px]">
                  {project.location}
                </span>
              </a>
            )}

            {/* SEKCJA CALL TIME */}
            {project.call_time && (
              <DualTimeDisplay
                value={project.call_time}
                timeZone={project.timezone}
                label={`${t("projects.call_time", "Call Time:")} `}
                icon={<Clock size={14} aria-hidden="true" />}
                containerClassName="flex items-center gap-1.5 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100 w-fit mt-1 lg:mt-0"
                primaryTimeClassName="flex items-center gap-1.5 text-orange-600 whitespace-nowrap"
                localTimeClassName="text-[10px] text-orange-500/70 font-medium normal-case tracking-normal border-l border-orange-200 pl-2"
              />
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-6 border-t border-stone-100">
          <Button
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            leftIcon={<Edit2 size={14} aria-hidden="true" />}
          >
            {t("projects.actions.manage", "Zarządzaj")}
          </Button>
          <Button
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            leftIcon={<Trash2 size={14} aria-hidden="true" />}
            className="!border-red-200 !text-red-600 hover:!bg-red-50 hover:!border-red-300"
          >
            {t("common.actions.delete", "Usuń")}
          </Button>
          <Button
            variant="outline"
            onClick={onStatusToggle}
            className="ml-auto !text-stone-500 hover:!bg-stone-100"
          >
            {isDone
              ? t("projects.actions.mark_active", "Oznacz jako Aktywny")
              : t("projects.actions.mark_done", "Zakończ projekt")}
          </Button>
        </div>
      </div>

      {/* PRAWA STRONA KARTY (Bez zmian) */}
      <div className="w-full lg:w-72 flex-shrink-0 bg-stone-50/50 rounded-2xl border border-stone-200/50 p-5 flex flex-col justify-center relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-32 h-32 bg-blue-100/50 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3 pointer-events-none"
          aria-hidden="true"
        ></div>

        <h4 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-4 border-b border-stone-200/60 pb-2 flex justify-between items-center">
          {t("projects.card.status_production", "Status Produkcji")}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={isDownloading !== null}
              isLoading={isDownloading === "CALL_SHEET"}
              onClick={(e) => {
                e.stopPropagation();
                downloadReport(
                  "export_call_sheet",
                  `CallSheet_${project.title}.pdf`,
                  "CALL_SHEET",
                );
              }}
              leftIcon={
                isDownloading !== "CALL_SHEET" ? (
                  <FileText size={10} aria-hidden="true" />
                ) : undefined
              }
              className="!p-1.5 border-transparent shadow-none"
              title={t("projects.exports.call_sheet", "Pobierz Call Sheet")}
            />
            <Button
              variant="outline"
              disabled={isDownloading !== null}
              isLoading={isDownloading === "ZAIKS"}
              onClick={(e) => {
                e.stopPropagation();
                downloadReport(
                  "export_zaiks",
                  `ZAiKS_${project.title}.csv`,
                  "ZAIKS",
                );
              }}
              leftIcon={
                isDownloading !== "ZAIKS" ? (
                  <Download size={10} aria-hidden="true" />
                ) : undefined
              }
              className="!p-1.5 border-transparent shadow-none"
              title={t("projects.exports.zaiks", "Pobierz ZAiKS")}
            />
            <Button
              variant="outline"
              disabled={isDownloading !== null}
              isLoading={isDownloading === "DTP"}
              onClick={(e) => {
                e.stopPropagation();
                downloadReport("export_dtp", `DTP_${project.title}.txt`, "DTP");
              }}
              leftIcon={
                isDownloading !== "DTP" ? (
                  <AlignLeft size={10} aria-hidden="true" />
                ) : undefined
              }
              className="!p-1.5 border-transparent shadow-none"
              title={t("projects.exports.dtp", "Pobierz notkę do DTP")}
            />
          </div>
        </h4>

        <div className="space-y-4">
          <div className="flex items-center justify-between group/stat">
            <span className="flex items-center gap-2 text-xs font-bold text-stone-600 group-hover/stat:text-brand transition-colors">
              <Clock
                size={14}
                className="text-stone-400 group-hover/stat:text-brand"
                aria-hidden="true"
              />{" "}
              {t("projects.rehearsals.title", "Próby")}
            </span>
            <span className="text-xs font-black text-stone-800 bg-white px-2 py-1 rounded-md border border-stone-200/80 shadow-sm">
              {isLoading
                ? "-"
                : `${stats.rehearsalsTotal - stats.rehearsalsUpcoming} / ${stats.rehearsalsTotal}`}
            </span>
          </div>

          <div className="flex items-center justify-between group/stat">
            <span className="flex items-center gap-2 text-xs font-bold text-stone-600 group-hover/stat:text-brand transition-colors">
              <Users
                size={14}
                className="text-stone-400 group-hover/stat:text-brand"
                aria-hidden="true"
              />{" "}
              {t("projects.cast.title", "Obsada")}
            </span>
            <span className="text-xs font-black text-stone-800 bg-white px-2 py-1 rounded-md border border-stone-200/80 shadow-sm">
              {isLoading ? "-" : stats.castTotal}{" "}
              {t("common.people_short", "os.")}
            </span>
          </div>

          <div className="flex items-center justify-between group/stat">
            <span className="flex items-center gap-2 text-xs font-bold text-stone-600 group-hover/stat:text-brand transition-colors">
              <Wrench
                size={14}
                className="text-stone-400 group-hover/stat:text-brand"
                aria-hidden="true"
              />{" "}
              {t("projects.crew.title", "Ekipa")}
            </span>
            <span className="text-xs font-black text-stone-800 bg-white px-2 py-1 rounded-md border border-stone-200/80 shadow-sm">
              {isLoading ? "-" : stats.crewTotal}{" "}
              {t("common.people_short", "os.")}
            </span>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-brand text-[10px] font-bold antialiased uppercase tracking-[0.15em]">
          {isExpanded
            ? t("projects.card.collapse", "Zwiń Panel")
            : t("projects.card.expand", "Rozwiń Widgety")}
          {isExpanded ? (
            <ChevronUp size={16} aria-hidden="true" />
          ) : (
            <ChevronDown size={16} aria-hidden="true" />
          )}
        </div>
      </div>
    </div>
  );
}
