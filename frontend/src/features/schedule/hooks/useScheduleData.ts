/**
 * @file useScheduleData.ts
 * @description Encapsulates timeline aggregation and attendance reporting for the artist schedule.
 * @architecture Enterprise SaaS 2026
 */

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { AttendanceStatus } from "../../../shared/types";
import {
  useScheduleContextData,
  useUpsertScheduleAttendance,
} from "../api/schedule.queries";
import type { ScheduleViewMode, TimelineEvent } from "../types/schedule.dto";

export const useScheduleData = (artistId?: string | number) => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ScheduleViewMode>("UPCOMING");
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const { rehearsals, projects, participations, attendances, isLoading } =
    useScheduleContextData(artistId);
  const attendanceMutation = useUpsertScheduleAttendance();

  const timelineEvents = useMemo<TimelineEvent[]>(() => {
    if (!artistId || isLoading) return [];

    const events: TimelineEvent[] = [];
    const activeParticipations = participations.filter(
      (participation) => participation.status !== "DEC",
    );

    rehearsals.forEach((rehearsal) => {
      const myParticipation = activeParticipations.find(
        (participation) =>
          String(participation.project) === String(rehearsal.project),
      );

      if (!myParticipation) return;

      const isInvited =
        !rehearsal.invited_participations ||
        rehearsal.invited_participations.length === 0 ||
        rehearsal.invited_participations.includes(String(myParticipation.id));

      if (isInvited) {
        const project = projects.find(
          (candidate) => String(candidate.id) === String(rehearsal.project),
        );
        const myAttendance = attendances.find(
          (attendance) =>
            String(attendance.rehearsal) === String(rehearsal.id) &&
            String(attendance.participation) === String(myParticipation.id),
        );

        events.push({
          id: `REH-${rehearsal.id}`,
          type: "REHEARSAL",
          rawObj: rehearsal,
          date_time: new Date(rehearsal.date_time),
          title: `${t("schedule.event.rehearsal_prefix", "Próba:")} ${project?.title || t("schedule.event.generic_event", "Wydarzenie")}`,
          location: rehearsal.location,
          focus: rehearsal.focus,
          is_mandatory: rehearsal.is_mandatory,
          status: myAttendance?.status || null,
          excuse_note: myAttendance?.excuse_note || null,
          absences: rehearsal.absent_count || 0,
          project_id: rehearsal.project,
        });
      }
    });

    projects.forEach((project) => {
      const isParticipating = activeParticipations.some(
        (participation) => String(participation.project) === String(project.id),
      );

      if (isParticipating && project.status !== "CANC") {
        events.push({
          id: `PROJ-${project.id}`,
          type: "PROJECT",
          rawObj: project,
          date_time: new Date(project.date_time),
          title: project.title,
          location: project.location,
          call_time: project.call_time,
          run_sheet: project.run_sheet,
          description: project.description,
          status: null,
          project_id: project.id,
        });
      }
    });

    return events;
  }, [
    artistId,
    isLoading,
    rehearsals,
    projects,
    participations,
    attendances,
    t,
  ]);

  const filteredEvents = useMemo(() => {
    const threshold = new Date(Date.now() - 4 * 60 * 60 * 1000);

    return timelineEvents
      .filter((event) => !isNaN(event.date_time.getTime()))
      .filter((event) =>
        viewMode === "UPCOMING"
          ? event.date_time >= threshold
          : event.date_time < threshold,
      )
      .sort((left, right) =>
        viewMode === "UPCOMING"
          ? left.date_time.getTime() - right.date_time.getTime()
          : right.date_time.getTime() - left.date_time.getTime(),
      );
  }, [timelineEvents, viewMode]);

  const handleAbsenceSubmit = async (
    eventId: string,
    projectId: string | number,
    status: AttendanceStatus,
    notes: string,
  ) => {
    const toastId = toast.loading(
      t("schedule.toast.submitting", "Wysyłanie zgłoszenia..."),
    );

    try {
      const myParticipation = participations.find(
        (participation) => String(participation.project) === String(projectId),
      );

      if (!myParticipation) {
        throw new Error("Artist participation is missing.");
      }

      const existingAttendance = attendances.find(
        (attendance) =>
          String(attendance.rehearsal) === String(eventId) &&
          String(attendance.participation) === String(myParticipation.id),
      );

      await attendanceMutation.mutateAsync({
        existingAttendanceId: existingAttendance?.id,
        payload: {
          rehearsal: eventId,
          participation: myParticipation.id,
          status,
          excuse_note: notes,
        },
      });

      toast.success(
        t("schedule.toast.submit_success", "Zgłoszenie zostało zapisane."),
        { id: toastId },
      );
      return true;
    } catch (error) {
      toast.error(t("schedule.toast.submit_error_title", "Błąd zapisu"), {
        id: toastId,
        description: t(
          "schedule.toast.submit_error_desc",
          "Nie udało się zapisać zgłoszenia.",
        ),
      });
      return false;
    }
  };

  return {
    isLoading,
    viewMode,
    setViewMode,
    expandedEventId,
    setExpandedEventId,
    filteredEvents,
    handleAbsenceSubmit,
    artistId,
  };
};
