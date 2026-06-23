/**
 * @file useRehearsalsData.ts
 * @description Workspace brain for the Centrum Obecności: relational joins,
 * navigation state, per-rehearsal tallies and the cross-project "pulse" that
 * surfaces the next/live rehearsal and the conductor's outstanding roll-calls.
 * All maths is delegated to ../lib/attendanceStats so every surface agrees.
 * @architecture Enterprise SaaS 2026
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { toastApiError } from "@/shared/api/errors";
import { useTranslation } from "react-i18next";
import type {
  Artist,
  Attendance,
  Participation,
  Project,
  Rehearsal,
} from "@/shared/types";
import {
  useMarkMissingAttendancesPresent,
  useRehearsalsWorkspaceData,
} from "../api/rehearsals.queries";
import type { ProjectTabType } from "../types/rehearsals.dto";
import type { LocationDto } from "../../logistics/types/logistics.dto";
import {
  buildAttendanceIndex,
  EMPTY_TALLY,
  groupByVoice,
  isPast,
  isRehearsalLive,
  isToday,
  resolveInvited,
  tallyAttendance,
  type AttendanceTally,
  type VoiceGroup,
} from "../lib/attendanceStats";

export type RehearsalView = "ROLL_CALL" | "RELIABILITY";

interface PaginatedResponse<T> {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results: T[];
}

function extractData<T>(data: T[] | PaginatedResponse<T> | unknown): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === "object" && data !== null && "results" in data) {
    const paginated = data as PaginatedResponse<T>;
    if (Array.isArray(paginated.results)) return paginated.results;
  }
  return [];
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface NextRehearsal {
  rehearsal: Rehearsal;
  project: Project;
  isLive: boolean;
}

export interface RehearsalPulse {
  next: NextRehearsal | null;
  todayCount: number;
  weekCount: number;
  /** Past rehearsals (active projects) still carrying unrecorded singers. */
  unmarkedCount: number;
  /** Realised attendance across past active rehearsals (present+late / recorded); null until any history exists. */
  overallRate: number | null;
}

export const useRehearsalsData = () => {
  const { t } = useTranslation();
  const [view, setView] = useState<RehearsalView>("ROLL_CALL");
  const [projectTab, setProjectTab] = useState<ProjectTabType>("ACTIVE");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [activeRehearsalId, setActiveRehearsalId] = useState<string | null>(
    null,
  );
  const [isRollCall, setIsRollCall] = useState(false);
  const [showOnlyUnmarked, setShowOnlyUnmarked] = useState(false);

  const {
    projects = [],
    rehearsals = [],
    participations = [],
    attendances = [],
    artists = [],
    locations = [],
    isLoading,
    isError,
  } = useRehearsalsWorkspaceData() || {};

  const markMissingAttendanceMutation = useMarkMissingAttendancesPresent();

  const safeProjects = extractData<Project>(projects);
  const safeRehearsals = extractData<Rehearsal>(rehearsals);
  const safeParticipations = extractData<Participation>(participations);
  const safeAttendances = extractData<Attendance>(attendances);

  const activeProjects = useMemo(
    () =>
      safeProjects.filter(
        (project) => project.status !== "DONE" && project.status !== "CANC",
      ),
    [safeProjects],
  );

  const archivedProjects = useMemo(
    () =>
      safeProjects.filter(
        (project) => project.status === "DONE" || project.status === "CANC",
      ),
    [safeProjects],
  );

  const displayProjects =
    projectTab === "ACTIVE" ? activeProjects : archivedProjects;

  const projectMap = useMemo(() => {
    const map = new Map<string, Project>();
    safeProjects.forEach((project) => map.set(String(project.id), project));
    return map;
  }, [safeProjects]);

  const locationMap = useMemo(() => {
    const map = new Map<string, LocationDto>();
    (locations || []).forEach((loc) => map.set(String(loc.id), loc));
    return map;
  }, [locations]);

  const artistMap = useMemo(() => {
    const map = new Map<string, Artist>();
    (artists || []).forEach((artist) => map.set(String(artist.id), artist));
    return map;
  }, [artists]);

  /** rehearsalId → participationId → Attendance, indexed once. */
  const attendanceIndex = useMemo(
    () => buildAttendanceIndex(safeAttendances),
    [safeAttendances],
  );

  /** projectId → participations still in play (declined pruned). */
  const participationsByProject = useMemo(() => {
    const map = new Map<string, Participation[]>();
    safeParticipations.forEach((participation) => {
      if (participation.status === "DEC") return;
      const key = String(participation.project);
      const bucket = map.get(key);
      if (bucket) bucket.push(participation);
      else map.set(key, [participation]);
    });
    return map;
  }, [safeParticipations]);

  /* ── Auto-select a project when the tab content changes ──────────────── */
  useEffect(() => {
    if (!selectedProjectId && displayProjects.length > 0) {
      setSelectedProjectId(String(displayProjects[0].id));
      return;
    }
    if (
      displayProjects.length > 0 &&
      !displayProjects.find((p) => String(p.id) === selectedProjectId)
    ) {
      setSelectedProjectId(String(displayProjects[0].id));
    }
  }, [displayProjects, selectedProjectId]);

  const selectedProject = selectedProjectId
    ? (projectMap.get(selectedProjectId) ?? null)
    : null;

  const projectRehearsals = useMemo(() => {
    if (!selectedProjectId) return [];
    return safeRehearsals
      .filter((rehearsal) => String(rehearsal.project) === selectedProjectId)
      .sort(
        (a, b) =>
          new Date(a.date_time).getTime() - new Date(b.date_time).getTime(),
      );
  }, [safeRehearsals, selectedProjectId]);

  const projectParticipations = useMemo(
    () => participationsByProject.get(selectedProjectId) ?? [],
    [participationsByProject, selectedProjectId],
  );

  /* ── Auto-select a rehearsal within the project ──────────────────────── */
  useEffect(() => {
    if (
      projectRehearsals.length > 0 &&
      (!activeRehearsalId ||
        !projectRehearsals.find((r) => String(r.id) === activeRehearsalId))
    ) {
      // Prefer a live/next rehearsal over the chronologically first one.
      const now = Date.now();
      const live = projectRehearsals.find((r) =>
        isRehearsalLive(r.date_time, now),
      );
      const upcoming = projectRehearsals.find(
        (r) => new Date(r.date_time).getTime() >= now,
      );
      const target = live ?? upcoming ?? projectRehearsals[0];
      setActiveRehearsalId(String(target.id));
      return;
    }
    if (projectRehearsals.length === 0) setActiveRehearsalId(null);
  }, [projectRehearsals, activeRehearsalId]);

  const activeRehearsal = useMemo(
    () =>
      projectRehearsals.find((r) => String(r.id) === activeRehearsalId) ?? null,
    [projectRehearsals, activeRehearsalId],
  );

  const invitedParticipations = useMemo(() => {
    if (!activeRehearsal) return [];
    return resolveInvited(activeRehearsal, projectParticipations)
      .slice()
      .sort((a, b) => {
        const left = artistMap.get(String(a.artist))?.last_name ?? "";
        const right = artistMap.get(String(b.artist))?.last_name ?? "";
        return left.localeCompare(right);
      });
  }, [activeRehearsal, projectParticipations, artistMap]);

  const attendanceMap = useMemo(
    () =>
      activeRehearsal
        ? (attendanceIndex.get(String(activeRehearsal.id)) ??
          new Map<string, Attendance>())
        : new Map<string, Attendance>(),
    [attendanceIndex, activeRehearsal],
  );

  const voiceGroups: VoiceGroup[] = useMemo(
    () => groupByVoice(invitedParticipations, artistMap),
    [invitedParticipations, artistMap],
  );

  const stats: AttendanceTally = useMemo(
    () =>
      invitedParticipations.length === 0
        ? EMPTY_TALLY
        : tallyAttendance(invitedParticipations, (id) =>
            attendanceMap.get(id),
          ),
    [invitedParticipations, attendanceMap],
  );

  /** Per-rehearsal tallies for the rail completion rings. */
  const rehearsalTallies = useMemo(() => {
    const map = new Map<string, AttendanceTally>();
    projectRehearsals.forEach((rehearsal) => {
      const invited = resolveInvited(rehearsal, projectParticipations);
      const records = attendanceIndex.get(String(rehearsal.id));
      map.set(
        String(rehearsal.id),
        tallyAttendance(invited, (id) => records?.get(id)),
      );
    });
    return map;
  }, [projectRehearsals, projectParticipations, attendanceIndex]);

  /* ── Cross-project pulse ─────────────────────────────────────────────── */
  const pulse: RehearsalPulse = useMemo(() => {
    const now = Date.now();
    const activeIds = new Set(activeProjects.map((p) => String(p.id)));
    const activeRehearsals = safeRehearsals.filter((r) =>
      activeIds.has(String(r.project)),
    );

    const live = activeRehearsals
      .filter((r) => isRehearsalLive(r.date_time, now))
      .sort(
        (a, b) =>
          new Date(a.date_time).getTime() - new Date(b.date_time).getTime(),
      )[0];

    const upcoming = activeRehearsals
      .filter((r) => new Date(r.date_time).getTime() >= now)
      .sort(
        (a, b) =>
          new Date(a.date_time).getTime() - new Date(b.date_time).getTime(),
      )[0];

    const chosen = live ?? upcoming ?? null;
    let next: NextRehearsal | null = null;
    if (chosen) {
      const project = projectMap.get(String(chosen.project));
      if (project)
        next = {
          rehearsal: chosen,
          project,
          isLive: isRehearsalLive(chosen.date_time, now),
        };
    }

    let todayCount = 0;
    let weekCount = 0;
    let unmarkedCount = 0;
    let realisedNumerator = 0;
    let realisedDenominator = 0;

    activeRehearsals.forEach((rehearsal) => {
      const start = new Date(rehearsal.date_time).getTime();
      if (isToday(rehearsal.date_time)) todayCount += 1;
      if (start >= now && start <= now + WEEK_MS) weekCount += 1;

      const invited = resolveInvited(
        rehearsal,
        participationsByProject.get(String(rehearsal.project)) ?? [],
      );
      if (invited.length === 0) return;
      const records = attendanceIndex.get(String(rehearsal.id));
      const tally = tallyAttendance(invited, (id) => records?.get(id));

      if (isPast(rehearsal.date_time, now)) {
        if (tally.none > 0) unmarkedCount += 1;
        // Realised attendance is measured against *recorded* singers only —
        // unmarked rows are missing data, not absences, so they never drag
        // the headline rate down (matches useRehearsalAnalytics).
        realisedNumerator += tally.present + tally.late;
        realisedDenominator += tally.marked;
      }
    });

    return {
      next,
      todayCount,
      weekCount,
      unmarkedCount,
      overallRate:
        realisedDenominator > 0
          ? Math.round((realisedNumerator / realisedDenominator) * 100)
          : null,
    };
  }, [
    activeProjects,
    safeRehearsals,
    projectMap,
    participationsByProject,
    attendanceIndex,
  ]);

  /* ── Navigation: jump straight to a rehearsal from the pulse ─────────── */
  const goToRehearsal = useCallback(
    (projectId: string | number, rehearsalId: string | number) => {
      const project = projectMap.get(String(projectId));
      const tab: ProjectTabType =
        project && (project.status === "DONE" || project.status === "CANC")
          ? "ARCHIVE"
          : "ACTIVE";
      setProjectTab(tab);
      setSelectedProjectId(String(projectId));
      setActiveRehearsalId(String(rehearsalId));
      setView("ROLL_CALL");
      setShowOnlyUnmarked(false);
    },
    [projectMap],
  );

  const handleMarkAllPresent = async (): Promise<void> => {
    if (!activeRehearsalId || invitedParticipations.length === 0) return;

    const toastId = toast.loading(
      t("rehearsals.toast.bulk_marking", "Zbiorcze zaznaczanie obecności..."),
    );

    try {
      const entries = invitedParticipations.flatMap((participation) => {
        const existing = attendanceMap.get(String(participation.id));
        if (!existing || !existing.status) {
          return [
            {
              attendanceId: existing ? String(existing.id) : undefined,
              rehearsalId: String(activeRehearsalId),
              participationId: String(participation.id),
            },
          ];
        }
        return [];
      });

      if (entries.length === 0) {
        toast.dismiss(toastId);
        return;
      }

      await markMissingAttendanceMutation.mutateAsync(entries);
      toast.success(
        t("rehearsals.toast.bulk_success", "Uzupełniono luki jako 'Obecny'."),
        { id: toastId },
      );
    } catch (error) {
      toastApiError(error, t, {
        id: toastId,
        fallbackDescription: t(
          "rehearsals.toast.bulk_error_desc",
          "Nie udało się zapisać masowej obecności.",
        ),
      });
    }
  };

  return {
    isLoading,
    isError,
    // view
    view,
    setView,
    isRollCall,
    setIsRollCall,
    showOnlyUnmarked,
    setShowOnlyUnmarked,
    // project context
    projectTab,
    setProjectTab,
    displayProjects,
    selectedProjectId,
    setSelectedProjectId,
    selectedProject,
    // rehearsal context
    projectRehearsals,
    rehearsalTallies,
    activeRehearsalId,
    setActiveRehearsalId,
    activeRehearsal,
    // roster
    invitedParticipations,
    voiceGroups,
    projectParticipations,
    artistMap,
    attendanceMap,
    attendanceIndex,
    locationMap,
    stats,
    // pulse + nav
    pulse,
    goToRehearsal,
    // actions
    isMarkingAll: markMissingAttendanceMutation.isPending,
    handleMarkAllPresent,
  };
};
