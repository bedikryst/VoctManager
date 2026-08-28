/**
 * @file useAdminDashboardData.ts
 * @description Encapsulates data fetching, telemetric aggregations, and scheduling logic.
 * Implements strict Adapter Pattern to map raw API domain to UI DTOs.
 * @architecture Enterprise SaaS 2026
 * @module panel/dashboard/hooks/useAdminDashboardData
 */

import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { rehearsalKeys } from "@/features/rehearsals/api/rehearsals.queries";
import { projectKeys } from "@/features/projects/api/project.queries";
import { artistKeys } from "@/features/artists/api/artist.queries";
import { archiveKeys } from "@/features/archive/api/archive.queries";
import { PROJECT_STATUS } from "@/features/projects/constants/projectDomain";
import { ArtistService } from "@/features/artists/api/artist.service";
import { ArchiveService } from "@/features/archive/api/archive.service";
import { ProjectService } from "@/features/projects/api/project.service";
import { RehearsalsService } from "@/features/rehearsals/api/rehearsals.service";
import type {
  Project,
  Artist,
  Rehearsal,
  Piece,
  LocationSnippet,
} from "@/shared/types";

// UI DTOs imports
import type { AdminTelemetryStatsDto } from "../components/TelemetryWidget";
import type { ProjectStatsDto } from "../components/SpotlightProjectCard";
import type {
  InvitationStatsDto,
  PipelineProjectDto,
} from "../components/ProductionPipeline";
import { parseConductorName } from "../utils/conductorParser";

// The pipeline is a focused triage list, not the full project archive — cap it
// and defer the long tail to the "Wszystkie projekty" link.
const PIPELINE_LIMIT = 6;

const EMPTY_PROJECTS: Project[] = [];
const EMPTY_REHEARSALS: EnrichedRehearsal[] = [];
const EMPTY_ARTISTS: Artist[] = [];
const EMPTY_PIECES: Piece[] = [];
const WORKSPACE_STALE_TIME = 1000 * 60 * 5;

const isLocationSnippet = (
  loc: LocationSnippet | null | undefined,
): loc is LocationSnippet => {
  return typeof loc === "object" && loc !== null && "id" in loc;
};

export interface EnrichedRehearsal extends Rehearsal {
  absent_count?: number;
  projectTitle?: string;
}

export const useAdminDashboardData = () => {
  const { t } = useTranslation();

  // Everything the dashboard actually LAYS OUT: the spotlight, the pipeline,
  // the roster balance, the next-rehearsal alert. The screen cannot be drawn
  // without these, so their pending state is the one that gates it.
  const { isLoading, isError, refetch, data } = useQueries({
    queries: [
      {
        queryKey: projectKeys.projects.all,
        queryFn: ProjectService.getAll,
        staleTime: WORKSPACE_STALE_TIME,
      },
      {
        queryKey: rehearsalKeys.rehearsals.all,
        queryFn: RehearsalsService.getRehearsals,
        staleTime: WORKSPACE_STALE_TIME,
      },
      {
        queryKey: artistKeys.artists.all,
        queryFn: ArtistService.getAll,
        staleTime: WORKSPACE_STALE_TIME,
      },
    ],
    combine: (results) => ({
      isLoading: results.some((q) => q.isPending || q.isLoading),
      isError: results.some((q) => q.isError),
      refetch: () => {
        results.forEach((q) => {
          void q.refetch();
        });
      },
      data: {
        projects: results[0].data ?? [],
        rehearsals: results[1].data ?? [],
        artists: results[2].data ?? [],
      },
    }),
  });

  // The archive, deliberately OUTSIDE that gate. It is the heaviest list the
  // panel serves — every piece with its tracks, movements, translations,
  // recordings, notes and editions — and the dashboard reads exactly one thing
  // off it: how many there are. Blocking the first paint on it made the whole
  // console wait on a payload that fills a single metric, which then arrives on
  // its own and reads as `null` until it does.
  // A restored offline snapshot settles this before the first render, so the
  // count is normally there in the opening frame; the placeholder is what a
  // genuinely cold archive fetch looks like. A failure leaves the metric blank
  // rather than replacing the console with an error — one number is not the
  // screen.
  const {
    data: pieces = EMPTY_PIECES,
    isPending: isArchivePending,
    refetch: refetchPieces,
  } = useQuery({
    queryKey: archiveKeys.pieces.all,
    queryFn: ArchiveService.getPieces,
    staleTime: WORKSPACE_STALE_TIME,
  });

  const {
    projects = EMPTY_PROJECTS,
    rehearsals = EMPTY_REHEARSALS,
    artists = EMPTY_ARTISTS,
  } = data;

  // 1. TELEMETRY AGGREGATION
  const adminStats: AdminTelemetryStatsDto = useMemo(() => {
    const activeProjects = projects.filter(
      (p) =>
        p.status === PROJECT_STATUS.ACTIVE ||
        p.status === PROJECT_STATUS.DRAFT,
    ).length;

    const totalPieces = isArchivePending ? null : pieces.length;
    const activeArtistsList = artists.filter((a) => a.is_active);

    const S = activeArtistsList.filter((a) =>
      a.voice_type?.startsWith("S"),
    ).length;
    const MEZ = activeArtistsList.filter((a) => a.voice_type === "MEZ").length;
    const A = activeArtistsList.filter((a) =>
      a.voice_type?.startsWith("A"),
    ).length;
    const CT = activeArtistsList.filter((a) => a.voice_type === "CT").length;
    const T = activeArtistsList.filter((a) =>
      a.voice_type?.startsWith("T"),
    ).length;
    const BAR = activeArtistsList.filter((a) => a.voice_type === "BAR").length;
    const B = activeArtistsList.filter((a) =>
      a.voice_type?.startsWith("B"),
    ).length;

    const satb = {
      S,
      MEZ,
      A,
      CT,
      T,
      BAR,
      B,
      Total: activeArtistsList.length,
    };

    return { activeProjects, totalPieces, satb };
  }, [projects, pieces, artists, isArchivePending]);

  // 2. INVITATION STATUS AGGREGATION (non-archived projects only). `projectCount`
  // is the denominator those three figures are summed over — the strip needs it
  // to state that its capped row list is narrower than its own header.
  const invitationStats: InvitationStatsDto = useMemo(() => {
    const nonArchivedProjects = projects.filter(
      (p) =>
        p.status !== PROJECT_STATUS.DONE &&
        p.status !== PROJECT_STATUS.CANCELLED,
    );
    return {
      projectCount: nonArchivedProjects.length,
      confirmed: nonArchivedProjects.reduce(
        (sum, p) => sum + (p.cast_confirmed ?? 0),
        0,
      ),
      pending: nonArchivedProjects.reduce(
        (sum, p) => sum + (p.cast_pending ?? 0),
        0,
      ),
      declined: nonArchivedProjects.reduce(
        (sum, p) => sum + (p.cast_declined ?? 0),
        0,
      ),
    };
  }, [projects]);

  // 2b. PRODUCTION PIPELINE — the next few live/upcoming productions with their
  // readiness, sorted by date. Powers the per-project triage that replaced the
  // aggregate invitations tile. Same non-archived set as the totals above, but
  // CAPPED — so the strip has to say when it is showing fewer than it counts,
  // or the header's census reads as the count of what is on screen.
  const pipelineProjects: PipelineProjectDto[] = useMemo(() => {
    const now = Date.now();
    // Only flag a missing score book once the concert is on the horizon — an
    // assembled book weeks early would be noise; a missing one days out is action.
    const IMMINENT_MS = 14 * 24 * 60 * 60 * 1000;
    return projects
      .filter(
        (p) =>
          p.status !== PROJECT_STATUS.DONE &&
          p.status !== PROJECT_STATUS.CANCELLED,
      )
      .sort((a, b) => {
        const ta = a.date_time ? new Date(a.date_time).getTime() : Infinity;
        const tb = b.date_time ? new Date(b.date_time).getTime() : Infinity;
        return ta - tb;
      })
      .slice(0, PIPELINE_LIMIT)
      .map((p) => {
        const dt = p.date_time ? new Date(p.date_time).getTime() : Infinity;
        const isImminent = dt >= now && dt - now <= IMMINENT_MS;
        return {
          id: String(p.id),
          title: p.title,
          dateTime: p.date_time,
          timezone: p.timezone,
          status: p.status,
          castConfirmed: p.cast_confirmed ?? 0,
          castPending: p.cast_pending ?? 0,
          castDeclined: p.cast_declined ?? 0,
          castTotal: p.cast_total ?? 0,
          rehearsalsUpcoming: p.rehearsals_upcoming ?? 0,
          piecesTotal: p.pieces_total ?? 0,
          scoreMissing: isImminent && !p.score_pdf,
        };
      });
  }, [projects]);

  // 3. SPOTLIGHT NEXT PROJECT
  const rawNextProject = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const upcoming = projects.filter((p) => {
      if (
        p.status === PROJECT_STATUS.DONE ||
        p.status === PROJECT_STATUS.CANCELLED
      )
        return false;
      if (!p.date_time) return false;

      const projDate = new Date(p.date_time);
      return !isNaN(projDate.getTime()) && projDate >= todayStart;
    });

    return (
      upcoming.sort(
        (a, b) =>
          new Date(a.date_time!).getTime() - new Date(b.date_time!).getTime(),
      )[0] ?? null
    );
  }, [projects]);

  const nextProject = useMemo(() => {
    if (!rawNextProject) return undefined;

    const loc = rawNextProject.location;

    return {
      id: String(rawNextProject.id),
      title: rawNextProject.title,
      conductor: parseConductorName(rawNextProject.conductor_name) || undefined,
      locationId: isLocationSnippet(loc) ? loc.id : undefined,
      locationFallbackName: isLocationSnippet(loc) ? loc.name : undefined,
      startDate: rawNextProject.date_time,
      status: rawNextProject.status?.toLowerCase() as
        | "active"
        | "upcoming"
        | "archived",
    };
  }, [rawNextProject]);

  // 4. SPOTLIGHT STATS
  const nextProjectStats: ProjectStatsDto | undefined = useMemo(() => {
    if (!rawNextProject) return undefined;

    return {
      rehearsalsRemaining: rawNextProject.rehearsals_upcoming ?? 0,
      castCount: rawNextProject.cast_total ?? 0,
      piecesCount: rawNextProject.pieces_total ?? 0,
    };
  }, [rawNextProject]);

  // 5. NEXT REHEARSAL ALERT
  const nextRehearsal = useMemo(() => {
    const now = new Date();
    // Rehearsal stays active up to 2 hours past its start time
    const threshold = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    const futureRehearsals = rehearsals
      .filter((r) => {
        if (!r.date_time) return false;
        const date = new Date(r.date_time);
        return !isNaN(date.getTime()) && date >= threshold;
      })
      .sort(
        (a, b) =>
          new Date(a.date_time!).getTime() - new Date(b.date_time!).getTime(),
      );

    if (futureRehearsals.length > 0) {
      const next = futureRehearsals[0];
      const project = projects.find(
        (p) => String(p.id) === String(next.project),
      );
      const location = isLocationSnippet(next.location)
        ? next.location
        : null;

      return {
        ...next,
        location,
        projectTitle:
          project?.title ||
          t("dashboard.admin.unknown_project", "Nieznany projekt"),
      };
    }
    return null;
  }, [rehearsals, projects, t]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 5) return t("dashboard.artist.greeting_night", "Dobrej nocy");
    if (hour < 12) return t("dashboard.artist.greeting_morning", "Dzień dobry");
    if (hour < 18)
      return t("dashboard.artist.greeting_afternoon", "Dobrego popołudnia");
    return t("dashboard.artist.greeting_evening", "Dobry wieczór");
  }, [t]);

  return {
    isLoading,
    isError,
    // The retry button reaches the archive too, even though its failure never
    // raises `isError` — otherwise a blank metric would have no way back.
    refetch: () => {
      refetch();
      void refetchPieces();
    },
    adminStats,
    invitationStats,
    pipelineProjects,
    nextProject,
    nextProjectStats,
    nextRehearsal,
    greeting,
  };
};
