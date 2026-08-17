/**
 * @file useScheduleData.ts
 * @description Builds the artist timeline from the server-joined schedule
 * dashboard (projects + invited rehearsals, each pre-joined with the artist's
 * participation and attendance). The former four-collection client-side join is
 * gone — this is now a thin map into view-ready `TimelineEvent`s plus paging,
 * attendance stats and the RSVP submit.
 * @architecture Enterprise SaaS 2026
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { toastApiError } from "@/shared/api/errors";
import { useTranslation } from "react-i18next";
import type { AttendanceStatus, Project } from "@/shared/types";
import { toZonedWallClock } from "@/shared/lib/time/timezone";
import {
  useReportAbsenceRange,
  useScheduleDashboard,
  useUpsertScheduleAttendance,
} from "../api/schedule.queries";
import type {
  AbsenceRangeControls,
  AbsenceRangePreview,
  AbsenceRangeStatus,
  ScheduleAttendanceStats,
  ScheduleViewMode,
  TimelineEvent,
} from "../types/schedule.dto";

// History can span years; render it in pages so a long-serving chorister never
// pays for hundreds of animated cards on a single scroll.
const PAST_PAGE_SIZE = 30;

export const useScheduleData = (artistId?: string | number) => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ScheduleViewMode>("UPCOMING");
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [pastLimit, setPastLimit] = useState(PAST_PAGE_SIZE);

  // A fresh dive into history always starts from the most recent page.
  useEffect(() => {
    if (viewMode === "PAST") setPastLimit(PAST_PAGE_SIZE);
  }, [viewMode]);

  const { data = [], isLoading } = useScheduleDashboard(artistId);
  const attendanceMutation = useUpsertScheduleAttendance();
  const rangeMutation = useReportAbsenceRange();

  const timelineEvents = useMemo<TimelineEvent[]>(() => {
    if (!artistId || isLoading) return [];

    const events: TimelineEvent[] = [];

    for (const item of data) {
      if (item.type === "PROJECT") {
        const proj: Project = item.project;
        // The server already drops cancelled projects; guard anyway.
        if (proj.status === "CANC") continue;
        events.push({
          id: `PROJ-${proj.id}`,
          type: "PROJECT",
          rawObj: proj,
          date_time: new Date(proj.date_time),
          title: proj.title,
          location: proj.location,
          call_time: proj.call_time,
          run_sheet: proj.run_sheet,
          description: proj.description,
          status: null,
          project_id: proj.id,
          participationId: item.participation_id ?? undefined,
        });
      } else {
        const reh = item.rehearsal;
        events.push({
          id: `REH-${reh.id}`,
          type: "REHEARSAL",
          rawObj: reh,
          date_time: new Date(reh.date_time),
          // No "Próba:" prefix here — the PRÓBA badge already says it. The
          // rehearsal label is re-added only for the calendar export.
          title: item.project_title || t("schedule.event.generic_event", "Wydarzenie"),
          location: reh.location,
          focus: reh.focus,
          is_mandatory: reh.is_mandatory,
          status: item.my_attendance?.status ?? null,
          excuse_note: item.my_attendance?.excuse_note ?? null,
          absences: reh.absent_count || 0,
          project_id: reh.project,
          participationId: item.participation_id ?? undefined,
          attendanceId: item.my_attendance?.id,
        });
      }
    }

    return events;
  }, [artistId, isLoading, data, t]);

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

  // The chorister's own attendance mirror — computed over every past rehearsal
  // they were invited to (not just the windowed/visible page).
  const attendanceStats = useMemo<ScheduleAttendanceStats>(() => {
    const nowMs = Date.now();
    const pastRehearsals = timelineEvents
      .filter(
        (event) =>
          event.type === "REHEARSAL" && event.date_time.getTime() < nowMs,
      )
      .sort((left, right) => right.date_time.getTime() - left.date_time.getTime());

    let present = 0;
    let late = 0;
    let absent = 0;
    let excused = 0;
    for (const event of pastRehearsals) {
      if (event.status === "PRESENT") present += 1;
      else if (event.status === "LATE") late += 1;
      else if (event.status === "ABSENT") absent += 1;
      else if (event.status === "EXCUSED") excused += 1;
    }

    const accountable = present + late + absent;
    const rate =
      accountable > 0
        ? Math.round(((present + late) / accountable) * 100)
        : null;

    // Streak walks from the most recent rehearsal; an absence breaks it, while
    // an excused or not-yet-marked rehearsal is treated as neutral (skipped).
    let streak = 0;
    for (const event of pastRehearsals) {
      if (event.status === "PRESENT" || event.status === "LATE") streak += 1;
      else if (event.status === "EXCUSED" || event.status == null) continue;
      else break;
    }

    return {
      present,
      late,
      absent,
      excused,
      total: pastRehearsals.length,
      accountable,
      rate,
      streak,
    };
  }, [timelineEvents]);

  // PAST is windowed; UPCOMING shows everything (the season ahead is finite).
  const visibleEvents = useMemo(
    () =>
      viewMode === "PAST" ? filteredEvents.slice(0, pastLimit) : filteredEvents,
    [filteredEvents, viewMode, pastLimit],
  );
  const hasMorePast =
    viewMode === "PAST" && filteredEvents.length > visibleEvents.length;
  const loadMorePast = () => setPastLimit((prev) => prev + PAST_PAGE_SIZE);

  const handleAbsenceSubmit = async (
    eventId: string,
    _projectId: string | number,
    status: AttendanceStatus,
    notes: string,
  ) => {
    const toastId = toast.loading(
      t("schedule.toast.submitting", "Wysyłanie zgłoszenia..."),
    );

    try {
      // The dashboard already carries this artist's participation + existing
      // attendance for the rehearsal — no client-side join needed.
      const item = data.find(
        (entry) =>
          entry.type === "REHEARSAL" &&
          String(entry.rehearsal.id) === String(eventId),
      );
      const participationId =
        item?.type === "REHEARSAL" ? item.participation_id : null;
      const existingAttendanceId =
        item?.type === "REHEARSAL" ? item.my_attendance?.id : undefined;

      if (!participationId) {
        throw new Error("Artist participation is missing.");
      }

      await attendanceMutation.mutateAsync({
        existingAttendanceId,
        payload: {
          rehearsal: eventId,
          participation: participationId,
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
      toastApiError(error, t, {
        id: toastId,
        fallbackDescription: t(
          "schedule.toast.submit_error_desc",
          "Nie udało się zapisać zgłoszenia.",
        ),
      });
      return false;
    }
  };

  /**
   * What a span of days would actually touch, answered from the dashboard the
   * chorister already has — the same set of rehearsals the server resolves the
   * write against, so the number stated before submitting is the number written.
   *
   * A conductor's rehearsals carry no participation and are skipped: there is no
   * seat there to mark absent from.
   */
  const resolveAbsenceRange = useCallback(
    (from: string, to: string): AbsenceRangePreview => {
      if (!from || !to || from > to) {
        return { count: 0, inWindow: 0, rehearsalIds: [] };
      }

      const rehearsalIds: string[] = [];
      let inWindow = 0;

      for (const item of data) {
        if (item.type !== "REHEARSAL") continue;
        const startsAt = new Date(item.rehearsal.date_time);
        if (Number.isNaN(startsAt.getTime())) continue;

        const local = toZonedWallClock(startsAt, item.rehearsal.timezone);
        if (local < from || local > to) continue;

        inWindow += 1;
        if (item.participation_id) {
          rehearsalIds.push(String(item.rehearsal.id));
        }
      }

      return { count: rehearsalIds.length, inWindow, rehearsalIds };
    },
    [data],
  );

  const handleAbsenceRangeSubmit = async (
    status: AbsenceRangeStatus,
    notes: string,
    from: string,
    to: string,
  ): Promise<boolean> => {
    if (!artistId) return false;

    const preview = resolveAbsenceRange(from, to);
    if (preview.count === 0) {
      toast.error(
        t(
          "schedule.rehearsal.range.preview_empty",
          "W tym zakresie nie ma żadnej Twojej próby.",
        ),
      );
      return false;
    }

    const toastId = toast.loading(
      t("schedule.toast.submitting", "Wysyłanie zgłoszenia..."),
    );

    try {
      const result = await rangeMutation.mutateAsync({
        artist: artistId,
        starts_at: from,
        ends_at: to,
        status,
        excuse_note: notes,
      });

      toast.success(
        t(
          "schedule.rehearsal.range.success_toast",
          "Zgłoszono nieobecność na {{count}} próbach.",
          { count: result.updated },
        ),
        { id: toastId },
      );
      return true;
    } catch (error) {
      toastApiError(error, t, {
        id: toastId,
        fallbackDescription: t(
          "schedule.toast.submit_error_desc",
          "Nie udało się zapisać zgłoszenia.",
        ),
      });
      return false;
    }
  };

  const absenceRange: AbsenceRangeControls = {
    resolve: resolveAbsenceRange,
    submit: handleAbsenceRangeSubmit,
  };

  return {
    isLoading,
    viewMode,
    setViewMode,
    expandedEventId,
    setExpandedEventId,
    filteredEvents,
    visibleEvents,
    hasMorePast,
    loadMorePast,
    attendanceStats,
    handleAbsenceSubmit,
    absenceRange,
    artistId,
  };
};
