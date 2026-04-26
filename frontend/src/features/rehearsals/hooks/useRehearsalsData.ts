/**
 * @file useRehearsalsData.ts
 * @description Encapsulates relational mapping, navigation state, and KPI calculation for rehearsals.
 * @architecture Enterprise SaaS 2026
 */

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { Artist, Attendance } from "@/shared/types";
import {
  useMarkMissingAttendancesPresent,
  useRehearsalsWorkspaceData,
} from "../api/rehearsals.queries";
import type { ProjectTabType } from "../types/rehearsals.dto";
import type { LocationDto } from "../../logistics/types/logistics.dto";

export const useRehearsalsData = () => {
  const { t } = useTranslation();
  const [projectTab, setProjectTab] = useState<ProjectTabType>("ACTIVE");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [activeRehearsalId, setActiveRehearsalId] = useState<string | null>(
    null,
  );

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

  const activeProjects = useMemo(() => {
    return (projects || []).filter(
      (project) => project.status !== "DONE" && project.status !== "CANC",
    );
  }, [projects]);

  const archivedProjects = useMemo(() => {
    return (projects || []).filter(
      (project) => project.status === "DONE" || project.status === "CANC",
    );
  }, [projects]);

  const displayProjects =
    projectTab === "ACTIVE" ? activeProjects : archivedProjects;

  const locationMap = useMemo(() => {
    const map = new Map<string, LocationDto>();
    (locations || []).forEach((loc) => map.set(String(loc.id), loc));
    return map;
  }, [locations]);

  useEffect(() => {
    if (!selectedProjectId && displayProjects.length > 0) {
      setSelectedProjectId(String(displayProjects[0].id));
      return;
    }

    if (
      displayProjects.length > 0 &&
      !displayProjects.find(
        (project) => String(project.id) === selectedProjectId,
      )
    ) {
      setSelectedProjectId(String(displayProjects[0].id));
    }
  }, [displayProjects, selectedProjectId]);

  const artistMap = useMemo(() => {
    const map = new Map<string, Artist>();
    (artists || []).forEach((artist) => map.set(String(artist.id), artist));
    return map;
  }, [artists]);

  const projectRehearsals = useMemo(() => {
    if (!selectedProjectId) return [];

    return rehearsals
      .filter((rehearsal) => String(rehearsal.project) === selectedProjectId)
      .sort(
        (left, right) =>
          new Date(left.date_time).getTime() -
          new Date(right.date_time).getTime(),
      );
  }, [rehearsals, selectedProjectId]);

  const projectParticipations = useMemo(() => {
    if (!selectedProjectId) return [];

    return participations.filter(
      (participation) =>
        String(participation.project) === selectedProjectId &&
        participation.status !== "DEC",
    );
  }, [participations, selectedProjectId]);

  useEffect(() => {
    if (
      projectRehearsals.length > 0 &&
      (!activeRehearsalId ||
        !projectRehearsals.find(
          (rehearsal) => String(rehearsal.id) === activeRehearsalId,
        ))
    ) {
      setActiveRehearsalId(String(projectRehearsals[0].id));
      return;
    }

    if (projectRehearsals.length === 0) {
      setActiveRehearsalId(null);
    }
  }, [projectRehearsals, activeRehearsalId]);

  const activeRehearsal = useMemo(() => {
    return (
      projectRehearsals.find(
        (rehearsal) => String(rehearsal.id) === activeRehearsalId,
      ) || null
    );
  }, [projectRehearsals, activeRehearsalId]);

  const invitedParticipations = useMemo(() => {
    if (!activeRehearsal) return [];

    const invitedIds = activeRehearsal.invited_participations || [];
    const relevantParticipations =
      invitedIds.length > 0
        ? projectParticipations.filter((participation) =>
            invitedIds.includes(String(participation.id)),
          )
        : projectParticipations;

    return relevantParticipations.sort((left, right) => {
      const leftName = artistMap.get(String(left.artist))?.last_name || "";
      const rightName = artistMap.get(String(right.artist))?.last_name || "";
      return leftName.localeCompare(rightName);
    });
  }, [activeRehearsal, projectParticipations, artistMap]);

  const attendanceMap = useMemo(() => {
    const map = new Map<string, Attendance>();

    if (activeRehearsal) {
      attendances
        .filter(
          (attendance) =>
            String(attendance.rehearsal) === String(activeRehearsal.id),
        )
        .forEach((attendance) =>
          map.set(String(attendance.participation), attendance),
        );
    }

    return map;
  }, [attendances, activeRehearsal]);

  const stats = useMemo(() => {
    let present = 0,
      late = 0,
      absent = 0,
      none = 0,
      excused = 0;

    invitedParticipations.forEach((participation) => {
      const attendance = attendanceMap.get(String(participation.id));

      if (
        !attendance ||
        attendance.status === null ||
        attendance.status === undefined
      )
        none += 1;
      else if (attendance.status === "PRESENT") present += 1;
      else if (attendance.status === "LATE") late += 1;
      else if (attendance.status === "EXCUSED") excused += 1;
      else absent += 1;
    });

    const total = invitedParticipations.length;
    const completionRate = total > 0 ? ((total - none) / total) * 100 : 0;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    return {
      present,
      late,
      absent,
      excused,
      none,
      total,
      completionRate,
      rate,
    };
  }, [invitedParticipations, attendanceMap]);

  const handleMarkAllPresent = async (): Promise<void> => {
    if (!activeRehearsalId || invitedParticipations.length === 0) return;

    const toastId = toast.loading(
      t("rehearsals.toast.bulk_marking", "Zbiorcze zaznaczanie obecności..."),
    );

    try {
      const entries = invitedParticipations.flatMap((participation) => {
        const existingAttendance = attendanceMap.get(String(participation.id));

        if (
          !existingAttendance ||
          existingAttendance.status === null ||
          existingAttendance.status === undefined
        ) {
          return [
            {
              attendanceId: existingAttendance
                ? String(existingAttendance.id)
                : undefined,
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
      toast.error(t("rehearsals.toast.bulk_error_title", "Błąd systemu"), {
        id: toastId,
        description: t(
          "rehearsals.toast.bulk_error_desc",
          "Nie udało się zapisać masowej obecności.",
        ),
      });
    }
  };

  return {
    isLoading,
    isError,
    projectTab,
    setProjectTab,
    displayProjects,
    selectedProjectId,
    setSelectedProjectId,
    projectRehearsals,
    activeRehearsalId,
    setActiveRehearsalId,
    activeRehearsal,
    invitedParticipations,
    artistMap,
    attendanceMap,
    locationMap,
    stats,
    isMarkingAll: markMissingAttendanceMutation.isPending,
    handleMarkAllPresent,
  };
};
