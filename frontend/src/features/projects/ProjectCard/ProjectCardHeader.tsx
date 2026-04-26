import React, { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  AlignLeft,
  Calendar,
  ChevronDown,
  Clock,
  Download,
  Edit2,
  Eye,
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
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Heading, Text } from "@/shared/ui/primitives/typography";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { DualTimeDisplay } from "@/shared/widgets/utility/DualTimeDisplay";
import { getArtistDisplayName } from "../lib/projectPresentation";
import { PdfViewerModal } from "@/shared/ui/composites/PdfViewerModal";
import { ProjectService } from "../api/project.service";

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

interface MetaItemProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  stopPropagation?: boolean;
}

const MetaItem = ({
  icon,
  label,
  children,
  stopPropagation,
}: MetaItemProps): React.JSX.Element => (
  <div
    className="flex items-start gap-2.5"
    onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
  >
    <div className="mt-0.5 shrink-0 text-ethereal-gold" aria-hidden="true">
      {icon}
    </div>
    <div className="min-w-0">
      <Caption color="muted" className="mb-0.5 block">
        {label}
      </Caption>
      {children}
    </div>
  </div>
);

interface StatChipProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
}

const StatChip = ({ icon, value, label }: StatChipProps): React.JSX.Element => (
  <div className="flex items-center gap-1.5">
    <span className="text-ethereal-incense/40" aria-hidden="true">
      {icon}
    </span>
    <Text as="span" size="sm" weight="medium">
      {value}
    </Text>
    <Caption color="muted">{label}</Caption>
  </div>
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
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  const fetchRunsheetBlob = useCallback(async () => {
    const response = await ProjectService.downloadReport(
      String(project.id),
      "export_call_sheet",
    );
    return new Blob([response.data], { type: "application/pdf" });
  }, [project.id]);

  const isDone = project.status === PROJECT_STATUS.DONE;
  const conductorName = useMemo(
    () => getArtistDisplayName(project.conductor, project.conductor_name),
    [project.conductor, project.conductor_name],
  );

  const hasMetadata = Boolean(
    project.date_time || project.location || conductorName || project.call_time,
  );

  const rehearsalsDone =
    dashboardData.rehearsalsTotal - dashboardData.rehearsalsUpcoming;

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
      className="cursor-pointer p-6 md:p-8"
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
      {/* ── 1. Identity ── */}
      <div className="mb-6">
        <Badge variant={isDone ? "neutral" : "warning"} className="mb-5">
          {isDone
            ? t("projects.badge_done", "Zrealizowano")
            : t("projects.badge_active", "W przygotowaniu")}
        </Badge>

        <Heading
          as="h2"
          size="4xl"
          weight="medium"
          className="mb-2 max-w-4xl leading-tight"
        >
          {project.title}
        </Heading>

        {project.description?.trim() && (
          <Text color="graphite" className="mt-2 max-w-2xl">
            {project.description}
          </Text>
        )}
      </div>

      {/* ── 2. Event metadata — inline, no nested cards ── */}
      {hasMetadata && (
        <div className="mb-6 flex flex-wrap items-start gap-x-8 gap-y-4 border-t border-ethereal-incense/10 pt-5">
          {project.date_time && (
            <MetaItem
              icon={<Calendar size={14} />}
              label={t("projects.details.date_title", "Termin")}
            >
              <Text size="sm" weight="medium">
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
            </MetaItem>
          )}

          {project.date_time && (
            <MetaItem
              icon={<Clock size={14} />}
              label={t("projects.details.time_title", "Czas lokalny")}
            >
              <DualTimeDisplay
                value={project.date_time}
                timeZone={project.timezone}
                className="border-none bg-transparent p-0"
                typography="sans"
                size="sm"
                weight="medium"
                color="default"
              />
            </MetaItem>
          )}

          {project.location && (
            <MetaItem
              icon={<MapPin size={14} />}
              label={t("projects.details.location_title", "Miejsce")}
              stopPropagation
            >
              <LocationPreview
                locationRef={project.location}
                variant="minimal"
                className="max-w-64 justify-start"
              />
            </MetaItem>
          )}

          {conductorName && (
            <MetaItem
              icon={<UserRound size={14} />}
              label={t("projects.roles.maestro", "Maestro")}
            >
              <Text size="sm" weight="medium">
                {conductorName}
              </Text>
            </MetaItem>
          )}

          {project.call_time && (
            <MetaItem
              icon={<Clock size={14} />}
              label={t("projects.call_time", "Call Time")}
            >
              <DualTimeDisplay
                value={project.call_time}
                timeZone={project.timezone}
                className="border-none bg-transparent p-0"
                typography="sans"
                size="sm"
                weight="medium"
                timeClassName="text-ethereal-gold"
              />
            </MetaItem>
          )}
        </div>
      )}

      {/* ── 3. Footer bar: stats · actions · expand ── */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-t border-ethereal-incense/10 pt-5">
        {/* Production stats */}
        <div className="flex flex-wrap items-center gap-5">
          <StatChip
            icon={<Clock size={13} />}
            value={`${rehearsalsDone}/${dashboardData.rehearsalsTotal}`}
            label={t("projects.rehearsals.title_short", "prób")}
          />
          <StatChip
            icon={<Users size={13} />}
            value={dashboardData.castTotal}
            label={t("projects.cast.title_short", "artystów")}
          />
          <StatChip
            icon={<Wrench size={13} />}
            value={dashboardData.crewTotal}
            label={t("projects.crew.title_short", "tech")}
          />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Export buttons */}
          <div className="flex items-center gap-0.5 border-r border-ethereal-incense/15 pr-3">
            <Button
              variant="ghost"
              size="sm"
              className="p-1.5"
              onClick={(event) => {
                event.stopPropagation();
                setIsPdfModalOpen(true);
              }}
              leftIcon={<Eye size={13} aria-hidden="true" />}
              title={t("projects.exports.open_runsheet", "Otwórz Harmonogram")}
            />
            <Button
              variant="ghost"
              size="sm"
              className="p-1.5"
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
                  <FileText size={13} aria-hidden="true" />
                ) : undefined
              }
              title={t("projects.exports.call_sheet", "Pobierz Call Sheet")}
            />
            <Button
              variant="ghost"
              size="sm"
              className="p-1.5"
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
                  <Download size={13} aria-hidden="true" />
                ) : undefined
              }
              title={t("projects.exports.zaiks", "Pobierz ZAiKS")}
            />
            <Button
              variant="ghost"
              size="sm"
              className="p-1.5"
              disabled={isDownloading !== null}
              isLoading={isDownloading === "DTP"}
              onClick={(event) => {
                event.stopPropagation();
                downloadReport("export_dtp", `DTP_${project.title}.txt`, "DTP");
              }}
              leftIcon={
                isDownloading !== "DTP" ? (
                  <AlignLeft size={13} aria-hidden="true" />
                ) : undefined
              }
              title={t("projects.exports.dtp", "Pobierz notkę do DTP")}
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
            leftIcon={<Edit2 size={13} aria-hidden="true" />}
          >
            {t("projects.actions.manage", "Zarządzaj")}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            leftIcon={<Trash2 size={13} aria-hidden="true" />}
            className="!border-ethereal-crimson/20 !text-ethereal-crimson hover:!border-ethereal-crimson/30 hover:!bg-ethereal-crimson/5"
          >
            {t("common.actions.delete", "Usuń")}
          </Button>

          <Button variant="outline" size="sm" onClick={onStatusToggle}>
            {isDone
              ? t("projects.actions.mark_active", "Oznacz jako aktywny")
              : t("projects.actions.mark_done", "Zakończ projekt")}
          </Button>

          {/* Expand trigger */}
          <div className="ml-1 flex items-center gap-1.5 border-l border-ethereal-incense/15 pl-3">
            <Caption
              color="gold"
              weight="bold"
              className="uppercase tracking-[0.16em]"
            >
              {isExpanded
                ? t("projects.card.collapse", "Zwiń")
                : t("projects.card.expand", "Rozwiń")}
            </Caption>
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="text-ethereal-gold"
              aria-hidden="true"
            >
              <ChevronDown size={14} />
            </motion.div>
          </div>
        </div>
      </div>

      <PdfViewerModal
        isOpen={isPdfModalOpen}
        title={t("projects.exports.runsheet_title", "Harmonogram (Runsheet)")}
        subtitle={project.title}
        fileName={`Runsheet_${project.title}.pdf`}
        fetchBlob={fetchRunsheetBlob}
        docKey={`runsheet-${project.id}`}
        onClose={() => setIsPdfModalOpen(false)}
      />
    </div>
  );
};
