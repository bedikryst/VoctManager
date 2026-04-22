/**
 * @file ProjectCardHeader.tsx
 * @description Renders the compact, scannable header for a project card.
 * Integrates dual-timezone presentation and high-level project telemetry.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectCard/ProjectCardHeader
 */

import React, { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  AlignLeft,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Edit2,
  FileText,
  MapPin,
  Trash2,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";

import { PROJECT_STATUS } from "../constants/projectDomain";
import type { Project } from "@/shared/types";
import { LocationPreview } from "@/features/logistics/components/LocationPreview";
import { useProjectCard } from "./hooks/useProjectCard";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { MetricBlock } from "@/shared/ui/composites/MetricBlock";
import { Button } from "@/shared/ui/primitives/Button";
import {
  Caption,
  Eyebrow,
  Heading,
  Text,
} from "@/shared/ui/primitives/typography";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { DualTimeDisplay } from "@/shared/widgets/utility/DualTimeDisplay";
import { getArtistDisplayName } from "../lib/projectPresentation";

interface ProjectCardDashboardData {
  rehearsalsTotal: number;
  rehearsalsUpcoming: number;
  castTotal: number;
  crewTotal: number;
}

interface ProjectCardHeaderProps {
  project: Project;
  isExpanded: boolean;
  dashboardData: ProjectCardDashboardData;
  onToggle: () => void;
  onStatusToggle: (event: React.MouseEvent<HTMLButtonElement>) => Promise<void>;
  onEdit: () => void;
  onDelete: () => void;
}

interface HeaderMetaCardProps {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

const HeaderMetaCard = ({
  label,
  icon,
  children,
  onClick,
}: HeaderMetaCardProps): React.JSX.Element => (
  <GlassCard
    variant="light"
    padding="sm"
    isHoverable={false}
    className="min-w-44 border-ethereal-incense/15"
    onClick={onClick}
  >
    <div className="mb-2 flex items-center gap-2 text-ethereal-incense/70">
      <div className="shrink-0 text-ethereal-gold" aria-hidden="true">
        {icon}
      </div>
      <Eyebrow color="muted">{label}</Eyebrow>
    </div>
    {children}
  </GlassCard>
);

export const ProjectCardHeader = ({
  project,
  isExpanded,
  dashboardData,
  onToggle,
  onStatusToggle,
  onEdit,
  onDelete,
}: ProjectCardHeaderProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { downloadReport, isDownloading } = useProjectCard(String(project.id));

  const isDone = project.status === PROJECT_STATUS.DONE;
  const conductorName = useMemo(
    () => getArtistDisplayName(project.conductor, project.conductor_name),
    [project.conductor, project.conductor_name],
  );

  const handleHeaderKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onToggle();
      }
    },
    [onToggle],
  );

  return (
    <div
      className="flex cursor-pointer flex-col gap-8 p-6 md:p-8 lg:flex-row lg:items-stretch lg:justify-between"
      onClick={onToggle}
      onKeyDown={handleHeaderKeyDown}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      aria-label={t(
        "projects.card.toggle",
        "Przełącz widok szczegółów projektu",
      )}
    >
      <div className="flex flex-1 flex-col justify-between">
        <div>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div
              className={`inline-flex items-center rounded-full border px-3 py-1.5 ${
                isDone
                  ? "border-ethereal-incense/20 bg-ethereal-parchment text-ethereal-graphite"
                  : "border-ethereal-gold/30 bg-ethereal-gold/10 text-ethereal-gold"
              }`}
            >
              <Eyebrow color="inherit">
                {isDone
                  ? t("projects.badge_done", "Zrealizowano")
                  : t("projects.badge_active", "W przygotowaniu")}
              </Eyebrow>
            </div>
            <Caption color="incense-muted">
              {t("projects.card.status_production", "Status Produkcji")}
            </Caption>
          </div>

          <Heading
            as="h2"
            size="4xl"
            weight="medium"
            className="mb-3 max-w-4xl leading-tight"
          >
            {project.title}
          </Heading>

          <Text color="graphite" className="mb-6 max-w-2xl">
            {project.description?.trim()
              ? project.description
              : t(
                  "projects.card.header_fallback_description",
                  "Scalony pulpit operacyjny dla harmonogramu, programu, obsady i produkcji.",
                )}
          </Text>

          <div className="mb-6 flex flex-wrap items-start gap-3">
            {project.date_time && (
              <HeaderMetaCard
                label={t("projects.details.date_title", "Termin")}
                icon={<Calendar size={14} aria-hidden="true" />}
              >
                <Text weight="medium">
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
                </Text>
              </HeaderMetaCard>
            )}

            {project.date_time && (
              <HeaderMetaCard
                label={t("projects.details.time_title", "Czas lokalny")}
                icon={<Clock size={14} aria-hidden="true" />}
              >
                <DualTimeDisplay
                  value={project.date_time}
                  timeZone={project.timezone}
                  icon={
                    <Clock
                      size={14}
                      className="text-ethereal-gold"
                      aria-hidden="true"
                    />
                  }
                  className="border-none bg-transparent p-0"
                  typography="sans"
                  size="sm"
                  weight="bold"
                  color="default"
                />
              </HeaderMetaCard>
            )}

            {project.location && (
              <HeaderMetaCard
                label={t("projects.details.location_title", "Miejsce")}
                icon={<MapPin size={14} aria-hidden="true" />}
                onClick={(event) => event.stopPropagation()}
              >
                <LocationPreview
                  locationRef={project.location}
                  variant="minimal"
                  className="max-w-60 justify-start"
                />
              </HeaderMetaCard>
            )}

            {conductorName && (
              <HeaderMetaCard
                label={t("projects.roles.maestro", "Maestro")}
                icon={<UserRound size={14} aria-hidden="true" />}
              >
                <Text weight="medium">{conductorName}</Text>
              </HeaderMetaCard>
            )}

            {project.call_time && (
              <HeaderMetaCard
                label={t("projects.call_time", "Call Time")}
                icon={<Clock size={14} aria-hidden="true" />}
              >
                <DualTimeDisplay
                  value={project.call_time}
                  timeZone={project.timezone}
                  icon={
                    <Clock
                      size={14}
                      className="text-ethereal-gold"
                      aria-hidden="true"
                    />
                  }
                  className="border-none bg-transparent p-0"
                  typography="sans"
                  size="sm"
                  weight="bold"
                  timeClassName="text-ethereal-gold"
                />
              </HeaderMetaCard>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-ethereal-incense/15 pt-6">
          <Button
            variant="outline"
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
            leftIcon={<Edit2 size={14} aria-hidden="true" />}
          >
            {t("projects.actions.manage", "Zarządzaj")}
          </Button>
          <Button
            variant="outline"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            leftIcon={<Trash2 size={14} aria-hidden="true" />}
            className="!border-ethereal-crimson/20 !text-ethereal-crimson hover:!border-ethereal-crimson/35 hover:!bg-ethereal-crimson-light/20"
          >
            {t("common.actions.delete", "Usuń")}
          </Button>
          <Button
            variant="outline"
            onClick={onStatusToggle}
            className="ml-auto"
          >
            {isDone
              ? t("projects.actions.mark_active", "Oznacz jako aktywny")
              : t("projects.actions.mark_done", "Zakończ projekt")}
          </Button>
        </div>
      </div>

      <GlassCard
        variant="light"
        padding="md"
        isHoverable={false}
        className="relative w-full flex-shrink-0 border-ethereal-incense/15 lg:w-80"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <Eyebrow color="muted">
              {t("projects.card.status_production", "Status Produkcji")}
            </Eyebrow>
            <Heading as="h3" size="xl" weight="medium" className="mt-2">
              {t("projects.card.snapshot", "Snapshot")}
            </Heading>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={isDownloading !== null}
              isLoading={isDownloading === "CALL_SHEET"}
              onClick={(event) => {
                event.stopPropagation();
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
              className="!border-transparent !p-1.5 shadow-none"
              title={t("projects.exports.call_sheet", "Pobierz Call Sheet")}
            />
            <Button
              variant="outline"
              disabled={isDownloading !== null}
              isLoading={isDownloading === "ZAIKS"}
              onClick={(event) => {
                event.stopPropagation();
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
              className="!border-transparent !p-1.5 shadow-none"
              title={t("projects.exports.zaiks", "Pobierz ZAiKS")}
            />
            <Button
              variant="outline"
              disabled={isDownloading !== null}
              isLoading={isDownloading === "DTP"}
              onClick={(event) => {
                event.stopPropagation();
                downloadReport("export_dtp", `DTP_${project.title}.txt`, "DTP");
              }}
              leftIcon={
                isDownloading !== "DTP" ? (
                  <AlignLeft size={10} aria-hidden="true" />
                ) : undefined
              }
              className="!border-transparent !p-1.5 shadow-none"
              title={t("projects.exports.dtp", "Pobierz notkę do DTP")}
            />
          </div>
        </div>

        <div className="space-y-5">
          <MetricBlock
            label={t("projects.rehearsals.title", "Próby")}
            value={`${dashboardData.rehearsalsTotal - dashboardData.rehearsalsUpcoming} / ${dashboardData.rehearsalsTotal}`}
            icon={<Clock aria-hidden="true" />}
            interactiveMode="glass"
          />
          <MetricBlock
            label={t("projects.cast.title", "Obsada")}
            value={dashboardData.castTotal}
            unit={t("common.people_short", "os.")}
            icon={<Users aria-hidden="true" />}
            interactiveMode="glass"
          />
          <MetricBlock
            label={t("projects.crew.title", "Ekipa")}
            value={dashboardData.crewTotal}
            unit={t("common.people_short", "os.")}
            icon={<Wrench aria-hidden="true" />}
            interactiveMode="glass"
          />
        </div>

        <div className="mt-6 flex items-center justify-center gap-2">
          <Caption
            color="gold"
            weight="bold"
            className="uppercase tracking-[0.18em]"
          >
            {isExpanded
              ? t("projects.card.collapse", "Zwiń panel")
              : t("projects.card.expand", "Rozwiń widgety")}
          </Caption>
          <div className="text-ethereal-gold" aria-hidden="true">
            {isExpanded ? (
              <ChevronUp size={16} aria-hidden="true" />
            ) : (
              <ChevronDown size={16} aria-hidden="true" />
            )}
          </div>
        </div>
      </GlassCard>
    </div>
  );
};
