/**
 * @file useTimelineRehearsalCard.ts
 * @description Encapsulates presence confirmation, status masking, and report form state for rehearsal cards.
 */

import { useEffect, useMemo, useState } from "react";
import type { AttendanceStatus } from "@/shared/types";
import { toZonedWallClock } from "@/shared/lib/time/timezone";
import type {
  AbsenceRangeControls,
  AbsenceRangePreview,
  TimelineEvent,
} from "../types/schedule.dto";

type ReportStatus = Extract<AttendanceStatus, "ABSENT" | "LATE">;

const EMPTY_PREVIEW: AbsenceRangePreview = {
  count: 0,
  inWindow: 0,
  rehearsalIds: [],
};

/** Midnight of this rehearsal's own day — where a "from now on I'm away" starts. */
const dayStart = (event: TimelineEvent): string => {
  const timezone = (event.rawObj as { timezone?: string })?.timezone;
  const local = toZonedWallClock(event.date_time, timezone);
  return local ? `${local.slice(0, 10)}T00:00` : "";
};

export const useTimelineRehearsalCard = (
  event: TimelineEvent,
  onSubmitReport: (
    eventId: string,
    projectId: string | number,
    status: AttendanceStatus,
    notes: string,
  ) => Promise<boolean>,
  onToggle: () => void,
  isExpanded: boolean,
  absenceRange?: AbsenceRangeControls,
) => {
  const [reportingMode, setReportingMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // The span is opened from one rehearsal, so it starts on that rehearsal's day
  // and the singer only has to say how far it reaches.
  const [rangeMode, setRangeMode] = useState(false);
  const [rangeFrom, setRangeFrom] = useState(() => dayStart(event));
  const [rangeTo, setRangeTo] = useState("");

  const currentMaskedStatus =
    event.status === "EXCUSED" ? "ABSENT" : event.status;

  const getDefaultReportStatus = (
    status: TimelineEvent["status"],
  ): ReportStatus => {
    if (status === "ABSENT" || status === "LATE") {
      return status;
    }

    return "ABSENT";
  };

  const [reportForm, setReportForm] = useState<{
    status: ReportStatus;
    notes: string;
  }>({
    status: getDefaultReportStatus(currentMaskedStatus),
    notes: event.excuse_note || "",
  });

  useEffect(() => {
    const maskedStatus = event.status === "EXCUSED" ? "ABSENT" : event.status;
    setReportForm({
      status: getDefaultReportStatus(maskedStatus),
      notes: event.excuse_note || "",
    });
  }, [event.status, event.excuse_note]);

  const isExcusedOrLate =
    currentMaskedStatus === "ABSENT" || currentMaskedStatus === "LATE";

  const handleConfirmPresence = async (eventClick: React.MouseEvent) => {
    eventClick.stopPropagation();
    setIsSubmitting(true);
    await onSubmitReport(
      String(event.rawObj.id),
      event.project_id,
      "PRESENT",
      // Confirming presence carries no excuse note — keep it out of the DB
      // rather than writing a hardcoded, non-localized sentence.
      "",
    );
    setIsSubmitting(false);
    setReportingMode(false);
  };

  const rangePreview = useMemo(
    () =>
      rangeMode && absenceRange
        ? absenceRange.resolve(rangeFrom, rangeTo)
        : EMPTY_PREVIEW,
    [rangeMode, absenceRange, rangeFrom, rangeTo],
  );

  const handleSubmitReport = async (formEvent: React.FormEvent) => {
    formEvent.preventDefault();
    setIsSubmitting(true);

    // A span carries no lateness: over three weeks "I'll be late" is not a
    // statement anyone can act on, so the range writes the absence itself.
    const success =
      rangeMode && absenceRange
        ? await absenceRange.submit(
            "ABSENT",
            reportForm.notes,
            rangeFrom,
            rangeTo,
          )
        : await onSubmitReport(
            String(event.rawObj.id),
            event.project_id,
            reportForm.status,
            reportForm.notes,
          );
    setIsSubmitting(false);

    if (success) {
      setReportingMode(false);
      setRangeMode(false);
    }
  };

  const enableReportingMode = (eventClick: React.MouseEvent) => {
    eventClick.stopPropagation();
    setReportingMode(true);

    if (isExpanded) {
      onToggle();
    }
  };

  return {
    reportingMode,
    setReportingMode,
    isSubmitting,
    currentMaskedStatus,
    reportForm,
    setReportForm,
    isExcusedOrLate,
    handleConfirmPresence,
    handleSubmitReport,
    enableReportingMode,
    range: absenceRange
      ? {
          isOn: rangeMode,
          setIsOn: setRangeMode,
          from: rangeFrom,
          setFrom: setRangeFrom,
          to: rangeTo,
          setTo: setRangeTo,
          preview: rangePreview,
        }
      : undefined,
  };
};

/** What the absence form needs to draw and drive the span half of itself. */
export type AbsenceRangeFormState = NonNullable<
  ReturnType<typeof useTimelineRehearsalCard>["range"]
>;
