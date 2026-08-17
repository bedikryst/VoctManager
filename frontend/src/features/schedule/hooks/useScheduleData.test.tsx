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
import { toZonedWallClock } from "@/shared/lib/time/timezone";

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

const RANGE_URL = "*/api/attendances/range/";
const VENUE_TZ = "Europe/Warsaw";

const rehearsal = (
  id: string,
  dateTime: string,
  participationId: string | null,
): ScheduleDashboardItem => ({
  type: "REHEARSAL",
  participation_id: participationId,
  project_title: "Nieszpory Rachmaninowa",
  my_attendance: null,
  rehearsal: {
    id,
    project: "proj-1",
    date_time: dateTime,
    timezone: VENUE_TZ,
    is_mandatory: true,
    absent_count: 0,
  },
});

/**
 * A fortnight of the artist's schedule: three rehearsals inside the window, one
 * of which belongs to a project they only conduct (no participation, so no seat
 * to be marked absent from), plus one the day after the window closes.
 */
const spanDashboard = (): ScheduleDashboardItem[] => {
  return [
    rehearsal("reh-in-1", "2099-08-04T17:00:00Z", PARTICIPATION_ID),
    rehearsal("reh-in-2", "2099-08-11T17:00:00Z", PARTICIPATION_ID),
    // Conducted, not sung — the count must not claim it.
    rehearsal("reh-podium", "2099-08-12T17:00:00Z", null),
    // 00:30 on the 22nd in Warsaw is 22:30 on the 21st in UTC: inside the window
    // only if the clock the singer reads is ignored.
    rehearsal("reh-after", "2099-08-21T22:30:00Z", PARTICIPATION_ID),
  ];
};

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

describe("useScheduleData — absence over a range", () => {
  const WINDOW = ["2099-08-03T00:00", "2099-08-21T23:59"] as const;

  const arrangeSpan = (): { readonly writes: Captured[] } => {
    const writes: Captured[] = [];
    server.use(
      http.get(DASHBOARD_URL, () => HttpResponse.json(spanDashboard())),
      http.post(RANGE_URL, async ({ request }) => {
        writes.push({
          method: request.method,
          url: new URL(request.url).pathname,
          body: await request.clone().json(),
        });
        return HttpResponse.json({ updated: 2 });
      }),
    );
    return { writes };
  };

  it("counts only the rehearsals the artist holds a seat at, before anything is sent", async () => {
    arrangeSpan();
    const { result } = await mountSchedule();

    const preview = result.current.absenceRange.resolve(...WINDOW);

    // Four rehearsals fall in the window on the venue's clock — the conducted
    // one and the one starting after midnight local are not the artist's to
    // answer for.
    expect(preview.inWindow).toBe(3);
    expect(preview.count).toBe(2);
    expect([...preview.rehearsalIds]).toEqual(["reh-in-1", "reh-in-2"]);
  });

  it("sends the whole span as one wall-clock write", async () => {
    const { writes } = arrangeSpan();
    const { result } = await mountSchedule();

    let accepted = false;
    await act(async () => {
      accepted = await result.current.absenceRange.submit(
        "ABSENT",
        "Trzy tygodnie poza krajem.",
        ...WINDOW,
      );
    });

    expect(accepted).toBe(true);
    expect(writes).toHaveLength(1);
    expect(writes[0].method).toBe("POST");
    expect(writes[0].url).toBe("/api/attendances/range/");
    expect(writes[0].body).toEqual({
      artist: ARTIST_ID,
      starts_at: WINDOW[0],
      ends_at: WINDOW[1],
      status: "ABSENT",
      excuse_note: "Trzy tygodnie poza krajem.",
    });
  });

  it("promises only the rehearsals still ahead, not the ones already held", async () => {
    // Dates relative to the run, because the rule is about the clock: a fixture
    // in fixed dates would drift and end up asserting the opposite.
    const daysOut = (days: number): Date =>
      new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const venueDay = (days: number, clock: string): string =>
      `${toZonedWallClock(daysOut(days), VENUE_TZ).slice(0, 10)}T${clock}`;

    server.use(
      http.get(DASHBOARD_URL, () =>
        HttpResponse.json([
          rehearsal("reh-held", daysOut(-3).toISOString(), PARTICIPATION_ID),
          rehearsal("reh-ahead", daysOut(3).toISOString(), PARTICIPATION_ID),
        ]),
      ),
    );
    const { result } = await mountSchedule();

    const preview = result.current.absenceRange.resolve(
      venueDay(-5, "00:00"),
      venueDay(5, "23:59"),
    );

    // The span may honestly start in the past — it is the day you fell ill. The
    // server refuses to rewrite what the roll call already recorded, so counting
    // those here would promise a fortnight and deliver a week.
    expect(preview.inWindow).toBe(2);
    expect(preview.past).toBe(1);
    expect(preview.count).toBe(1);
    expect([...preview.rehearsalIds]).toEqual(["reh-ahead"]);
  });

  it("refuses a window holding none of the artist's rehearsals rather than posting an empty write", async () => {
    const { writes } = arrangeSpan();
    const { result } = await mountSchedule();

    let accepted = true;
    await act(async () => {
      accepted = await result.current.absenceRange.submit(
        "ABSENT",
        "Urlop.",
        "2099-09-01T00:00",
        "2099-09-30T23:59",
      );
    });

    expect(accepted).toBe(false);
    expect(writes).toHaveLength(0);
  });
});
