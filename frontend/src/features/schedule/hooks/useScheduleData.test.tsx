/**
 * @file useScheduleData.test.tsx
 * @description The chorister's RSVP, tested at the seam where it becomes a
 * record the conductor plans around. Getting this wrong does not throw — it
 * writes a confirmed presence against the wrong participation, or creates a
 * second attendance row beside the one the member meant to edit, and the roster
 * then reads as fact. So these tests assert the request itself: method, URL and
 * payload, plus that a refused write leaves no trace of a confirmation that
 * never happened.
 * @architecture Enterprise SaaS 2026
 * @module features/schedule/hooks
 */

import { describe, expect, it } from "vitest";
import { act, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";

import { TEST_ARTIST, renderHookWithPanel } from "@/test/harness";
import { server } from "@/test/server";
import type { Attendance } from "@/shared/types";

import { scheduleKeys } from "../api/schedule.queries";
import type {
  ScheduleAttendanceSnapshot,
  ScheduleDashboardItem,
} from "../types/schedule.dto";
import { useScheduleData } from "./useScheduleData";

const ARTIST_ID = TEST_ARTIST.artist_profile_id as string;
const REHEARSAL_ID = "reh-1";
const PARTICIPATION_ID = "part-9";
const ATTENDANCE_ID = "att-3";

const DASHBOARD_URL = "*/api/participations/schedule-dashboard/";
const ATTENDANCES_URL = "*/api/attendances/";
const ATTENDANCE_URL = "*/api/attendances/:attendanceId/";

const dashboard = (
  myAttendance: ScheduleAttendanceSnapshot | null,
): ScheduleDashboardItem[] => [
  {
    type: "REHEARSAL",
    participation_id: PARTICIPATION_ID,
    project_title: "Nieszpory Rachmaninowa",
    my_attendance: myAttendance,
    rehearsal: {
      id: REHEARSAL_ID,
      project: "proj-1",
      // Comfortably ahead of the four-hour past/upcoming threshold, so the
      // rehearsal stays a thing the chorister can still answer for.
      date_time: "2099-01-14T18:30:00Z",
      timezone: "Europe/Warsaw",
      is_mandatory: true,
      absent_count: 0,
    },
  },
];

interface Captured {
  readonly method: string;
  readonly url: string;
  readonly body: unknown;
}

/**
 * Seeds the dashboard read and records every attendance write. Both the create
 * and the edit route are stubbed in each test, so choosing the wrong one is a
 * failed assertion rather than an unhandled-request error.
 */
const arrangeSchedule = (
  myAttendance: ScheduleAttendanceSnapshot | null,
  outcome: "accept" | "reject" = "accept",
): { readonly writes: Captured[] } => {
  const writes: Captured[] = [];

  const record = async (request: Request): Promise<Response> => {
    writes.push({
      method: request.method,
      url: new URL(request.url).pathname,
      body: await request.clone().json(),
    });
    if (outcome === "reject") {
      return HttpResponse.json({ detail: "Nope." }, { status: 500 });
    }
    const saved: Attendance = {
      id: myAttendance?.id ?? "att-new",
      rehearsal: REHEARSAL_ID,
      participation: PARTICIPATION_ID,
      status: "PRESENT",
      excuse_note: "",
    };
    return HttpResponse.json(saved);
  };

  server.use(
    http.get(DASHBOARD_URL, () => HttpResponse.json(dashboard(myAttendance))),
    http.post(ATTENDANCES_URL, ({ request }) => record(request)),
    http.patch(ATTENDANCE_URL, ({ request }) => record(request)),
  );

  return { writes };
};

const mountSchedule = async () => {
  const harness = renderHookWithPanel(() => useScheduleData(ARTIST_ID), {
    user: TEST_ARTIST,
  });
  await waitFor(() => expect(harness.result.current.isLoading).toBe(false));
  return harness;
};

describe("useScheduleData — RSVP", () => {
  it("confirms presence as a new attendance carrying no invented excuse note", async () => {
    const { writes } = arrangeSchedule(null);
    const { result } = await mountSchedule();

    let accepted = false;
    await act(async () => {
      accepted = await result.current.handleAbsenceSubmit(
        REHEARSAL_ID,
        "proj-1",
        "PRESENT",
        "",
      );
    });

    expect(accepted).toBe(true);
    expect(writes).toHaveLength(1);
    expect(writes[0].method).toBe("POST");
    expect(writes[0].url).toBe("/api/attendances/");
    expect(writes[0].body).toEqual({
      rehearsal: REHEARSAL_ID,
      participation: PARTICIPATION_ID,
      status: "PRESENT",
      excuse_note: "",
    });
  });

  it("edits the existing report in place instead of filing a second one", async () => {
    const { writes } = arrangeSchedule({
      id: ATTENDANCE_ID,
      status: "PRESENT",
      excuse_note: "",
    });
    const { result } = await mountSchedule();

    await act(async () => {
      await result.current.handleAbsenceSubmit(
        REHEARSAL_ID,
        "proj-1",
        "ABSENT",
        "Wyjazd służbowy.",
      );
    });

    expect(writes).toHaveLength(1);
    expect(writes[0].method).toBe("PATCH");
    expect(writes[0].url).toBe(`/api/attendances/${ATTENDANCE_ID}/`);
    expect(writes[0].body).toEqual({
      rehearsal: REHEARSAL_ID,
      participation: PARTICIPATION_ID,
      status: "ABSENT",
      excuse_note: "Wyjazd służbowy.",
    });
  });

  it("leaves no confirmation behind when the server refuses the write", async () => {
    arrangeSchedule(null, "reject");
    const { result, queryClient } = await mountSchedule();

    let accepted = true;
    await act(async () => {
      accepted = await result.current.handleAbsenceSubmit(
        REHEARSAL_ID,
        "proj-1",
        "PRESENT",
        "",
      );
    });

    expect(accepted).toBe(false);
    await waitFor(() => {
      const cached = queryClient.getQueryData<ScheduleDashboardItem[]>(
        scheduleKeys.dashboard.byArtist(ARTIST_ID),
      );
      const item = cached?.[0];
      expect(item?.type === "REHEARSAL" ? item.my_attendance : undefined).toBe(
        null,
      );
    });
  });

  it("never writes an attendance for a rehearsal the artist is not cast in", async () => {
    const { writes } = arrangeSchedule(null);
    const { result } = await mountSchedule();

    let accepted = true;
    await act(async () => {
      accepted = await result.current.handleAbsenceSubmit(
        "reh-not-mine",
        "proj-1",
        "PRESENT",
        "",
      );
    });

    // No participation means no RSVP target; guessing one would mark somebody.
    expect(accepted).toBe(false);
    expect(writes).toHaveLength(0);
  });
});
