/**
 * @file SpotlightProjectCard.tsx
 * @description Domain wrapper for the cinematic ArtifactCard.
 * Maps project statistics into the Ethereal UI standard.
 * @architecture Enterprise SaaS 2026
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Calendar, Users, Music } from "lucide-react";
import { motion } from "framer-motion";

import {
  ArtifactCard,
  type ArtifactMetric,
} from "@/shared/ui/composites/ArtifactCard";
import { StatusBadge } from "@/shared/ui/primitives/StatusBadge";
import {
  Eyebrow,
  Unit,
  Emphasis,
  Text,
} from "@/shared/ui/primitives/typography";
import { LocationPreview } from "@/features/logistics/components/LocationPreview";

export interface ProjectStatsDto {
  castCount: number;
  piecesCount: number;
  rehearsalsRemaining: number;
}

export interface SpotlightProjectCardProps {
  project?: {
    id: string;
    title: string;
    conductor?: string;
    locationId?: string;
    locationFallbackName?: string;
    startDate?: string;
    status?: "active" | "upcoming" | "archived";
  };
  stats?: ProjectStatsDto;
}

const EtherealEasing = [0.16, 1, 0.3, 1] as const;

const fadeUpVariant = {
  hidden: { opacity: 0, y: 15, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 1.2, ease: EtherealEasing, delay: 0.4 },
  },
};

export function SpotlightProjectCard({
  project,
  stats,
}: SpotlightProjectCardProps): React.JSX.Element {
  const { t, i18n } = useTranslation();

  const formattedDate = useMemo(() => {
    if (!project?.startDate) return null;
    try {
      const date = new Date(project.startDate);
      return new Intl.DateTimeFormat(i18n.language, {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(date);
    } catch {
      return null;
    }
  }, [project?.startDate, i18n.language]);

  if (!project) {
    return (
      <ArtifactCard
        isLoading
        to="#"
        ariaLabel="Loading"
        title=""
        metrics={[]}
        statusBadgeSlot={null}
      />
    );
  }

  const projectStats = stats ?? {
    castCount: 0,
    piecesCount: 0,
    rehearsalsRemaining: 0,
  };
  const isActive = project.status === "active";

  const metrics: ArtifactMetric[] = [
    {
      id: "cast",
      label: t("dashboard.admin.spotlight.cast", "Obsada"),
      value: projectStats.castCount,
      unit: "voices",
      icon: <Users />,
    },
    {
      id: "program",
      label: t("dashboard.admin.spotlight.program", "Repertuar"),
      value: projectStats.piecesCount,
      unit: "scores",
      icon: <Music />,
    },
    {
      id: "remaining",
      label: t("dashboard.admin.spotlight.remaining", "Do Premiery"),
      value: projectStats.rehearsalsRemaining,
      unit: "rehearsals",
      icon: <Calendar />,
      accentColor: "gold",
    },
  ];

  const StatusBadgeSlot = (
    <StatusBadge
      variant={isActive ? "active" : "upcoming"}
      label={
        isActive
          ? t("dashboard.admin.spotlight.status_active", "W Produkcji")
          : t("dashboard.admin.spotlight.status_prep", "W Przygotowaniu")
      }
      isPulsing={isActive}
    />
  );

  const MetadataSlot = (
    <>
      <motion.div variants={fadeUpVariant} className="flex items-center gap-2">
        <Calendar size={13} strokeWidth={1.5} className="shrink-0 opacity-70" />
        <Eyebrow color="default" weight="medium">
          {formattedDate}
        </Eyebrow>
      </motion.div>
      <motion.div
        variants={fadeUpVariant}
        className="h-[2px] w-[2px] rounded-full bg-ethereal-incense/40"
      />
      <motion.div
        variants={fadeUpVariant}
        className="pointer-events-auto relative z-50"
      >
        <LocationPreview
          locationRef={project.locationId}
          fallback={project.locationFallbackName || "TBA"}
          variant="minimal"
          className="text-[10px] font-medium uppercase tracking-[0.25em] transition-colors duration-500 hover:text-ethereal-gold"
        />
      </motion.div>
    </>
  );

  const SubtitleSlot = project.conductor ? (
    <Emphasis size="2xl" color="muted">
      {t("common.conductor_prefix", "Maestro")}{" "}
      <Emphasis size="2xl" color="default" weight="bold">
        {project.conductor}
      </Emphasis>
    </Emphasis>
  ) : null;

  return (
    <ArtifactCard
      to={`/panel/projects`}
      ariaLabel={t(
        "dashboard.admin.aria_open_project",
        "Otwórz szczegóły dyrektywy: {{title}}",
        { title: project.title },
      )}
      statusBadgeSlot={StatusBadgeSlot}
      metadataSlot={MetadataSlot}
      title={project.title}
      subtitleSlot={SubtitleSlot}
      metrics={metrics}
    />
  );
}
