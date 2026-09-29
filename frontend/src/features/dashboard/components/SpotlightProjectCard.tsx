/**
 * @file SpotlightProjectCard.tsx
 * @description Domain wrapper for the cinematic ArtifactCard: the next concert,
 * with its cast, programme and rehearsals left as the card's three figures.
 *
 * Once the project is published the cast figure is who has confirmed, out of the
 * whole cast, and a gold "N czeka" beside the status opens the invitations sheet
 * with those names and their contacts — the answer to "who hasn't confirmed" on
 * the dashboard itself. A draft has asked nobody yet, so it shows the size of
 * the cast and no pending figure: a shortfall nobody could have answered is not
 * one.
 * @architecture Enterprise SaaS 2026
 */

import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Calendar, Clock, Music, UserCheck, Users } from "lucide-react";
import { motion } from "framer-motion";

import {
  ArtifactCard,
  ARTIFACT_SLOT_REVEAL,
  type ArtifactMetric,
} from "@/shared/ui/composites/ArtifactCard";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Eyebrow, Emphasis } from "@/shared/ui/primitives/typography";
import { LocationPreview } from "@/features/logistics/components/LocationPreview";
import { ProjectInvitationsSheet } from "@/features/projects/components/ProjectInvitationsSheet";

export interface ProjectStatsDto {
  castConfirmed: number;
  castPending: number;
  castTotal: number;
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

/**
 * The card's floor, beside the ensemble card at `lg` where the two share a row.
 * Below it the card stacks alone, and a floor there is empty height pushing the
 * production pipeline down a phone screen.
 */
const CARD_FLOOR = "lg:min-h-[400px]";

export function SpotlightProjectCard({
  project,
  stats,
}: SpotlightProjectCardProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const [isInvitationsOpen, setIsInvitationsOpen] = useState(false);

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
        className={CARD_FLOOR}
      />
    );
  }

  const projectStats = stats ?? {
    castConfirmed: 0,
    castPending: 0,
    castTotal: 0,
    piecesCount: 0,
    rehearsalsRemaining: 0,
  };
  // ACTIVE is the published state: the invitations have gone out.
  const isActive = project.status === "active";
  const pendingCount = isActive ? projectStats.castPending : 0;

  const castMetric: ArtifactMetric = isActive
    ? {
        id: "cast",
        label: t("dashboard.admin.spotlight.confirmed", "Potwierdzeni"),
        value: projectStats.castConfirmed,
        unit: t("dashboard.admin.spotlight.unit_confirmed", "z {{total}}", {
          total: projectStats.castTotal,
        }),
        icon: <UserCheck />,
      }
    : {
        id: "cast",
        label: t("dashboard.admin.spotlight.cast", "Obsada"),
        value: projectStats.castTotal,
        unit: t("dashboard.admin.spotlight.unit_cast", "głosów"),
        icon: <Users />,
      };

  const metrics: ArtifactMetric[] = [
    castMetric,
    {
      id: "program",
      label: t("dashboard.admin.spotlight.program", "Repertuar"),
      value: projectStats.piecesCount,
      unit: t("dashboard.admin.spotlight.unit_program", "partytur"),
      icon: <Music />,
    },
    {
      id: "remaining",
      label: t("dashboard.admin.spotlight.remaining", "Do Premiery"),
      value: projectStats.rehearsalsRemaining,
      unit: t("dashboard.admin.spotlight.unit_remaining", "prób"),
      icon: <Calendar />,
      accentColor: "gold",
    },
  ];

  // No pulse and no sage: a production sits at ACTIVE for months, and a draft
  // that nothing has happened to yet is not a success — it is the quiet state.
  // The slot sits above the card's overlay link, so the pending figure is its
  // own button: it opens the names, the rest of the card opens the hub.
  const StatusBadgeSlot = (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={isActive ? "warning" : "neutral"}>
        {isActive
          ? t("dashboard.admin.spotlight.status_active", "W Produkcji")
          : t("dashboard.admin.spotlight.status_prep", "W Przygotowaniu")}
      </Badge>
      {pendingCount > 0 && (
        <button
          type="button"
          onClick={() => setIsInvitationsOpen(true)}
          aria-haspopup="dialog"
          aria-label={t(
            "dashboard.admin.spotlight.pending_aria",
            "Pokaż, kto jeszcze nie odpowiedział: {{count}}",
            { count: pendingCount },
          )}
          className="rounded-chip outline-none transition-transform active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ethereal-gold/50"
        >
          <Badge
            variant="warning"
            className="hover:bg-ethereal-gold/20"
            icon={<Clock size={11} aria-hidden="true" />}
          >
            {t("dashboard.admin.spotlight.pending", "{{count}} czeka", {
              count: pendingCount,
            })}
          </Badge>
        </button>
      )}
    </div>
  );

  const MetadataSlot = (
    <>
      <motion.div
        variants={ARTIFACT_SLOT_REVEAL}
        className="flex items-center gap-2"
      >
        <Calendar size={13} strokeWidth={1.5} className="shrink-0 opacity-70" />
        <Eyebrow color="default" weight="medium">
          {formattedDate}
        </Eyebrow>
      </motion.div>
      <motion.div
        variants={ARTIFACT_SLOT_REVEAL}
        className="h-[2px] w-[2px] rounded-full bg-ethereal-incense/40"
      />
      <motion.div
        variants={ARTIFACT_SLOT_REVEAL}
        className="pointer-events-auto relative z-50"
      >
        <LocationPreview
          locationRef={project.locationId}
          fallback={project.locationFallbackName || "TBA"}
          variant="minimal"
          className="text-overline-sm transition-colors duration-500 hover:text-ethereal-gold"
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
    <>
      <ArtifactCard
        to={`/panel/projects/${project.id}`}
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
        className={CARD_FLOOR}
      />
      <ProjectInvitationsSheet
        projectId={project.id}
        projectTitle={project.title}
        isOpen={isInvitationsOpen}
        onClose={() => setIsInvitationsOpen(false)}
      />
    </>
  );
}
