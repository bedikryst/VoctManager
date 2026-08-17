/**
 * @file rehearsals.queries.test.tsx
 * @description Roll-call, tested as the write it is. The conductor marks the
 * choir on a tablet held in front of them, so the roster has to react on the tap
 * — which means the row on screen is optimistic and the record behind it may not
 * exist yet. The two failure modes that matter are a tap that shows as marked
 * but never reaches the server, and a bulk "the rest are here" that files a
 * second row beside somebody's existing one. Both are asserted here against the
 * requests actually sent.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/api
 */

import { describe, expect, it } from "vitest";
import { act, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";

import { renderHookWithPanel } from "@/test/harness";
import { server } from "@/test/server";
import type { Attendance } from "@/shared/types";

import {
  rehearsalKeys,
  useMarkMissingAttendancesPresent,
  useUpsertAttendanceRecord,
} from "./rehearsals.queries";

const REHEARSAL_ID = "reh-1";
const ATTENDANCES_URL = "*/api/attendances/";
const ATTENDANCE_URL = "*/api/attendances/:attendanceId/";

interface Captured {
  readonly method: string;
  readonly url: string;
  readonly body: unknown;
}

/** An attendance row already on the roster before the conductor touches it. */
const existingRow: Attendance = {
  id: "att-1",
  rehearsal: REHEARSAL_ID,
  participation: "part-1",
  status: "ABSENT",
  minutes_late: null,
  excuse_note: "",
};

const arrangeRollCall = (
  onWrite?: () => Promise<void>,
): { readonly writes: Captured[] } => {
  const writes: Captured[] = [];

  const record = async (request: Request): Promise<Response> => {
    const body = await request.clone().json();
    writes.push({
      method: request.method,
      url: new URL(request.url).pathname,
      body,
    });
    await onWrite?.();
    return HttpResponse.json({ id: "att-saved", ...(body as object) });
  };

  server.use(
    http.post(ATTENDANCES_URL, ({ request }) => record(request)),
    http.patch(ATTENDANCE_URL, ({ request }) => record(request)),
  );

  return { writes };
};

const readRoster = (
  queryClient: { getQueryData: <T>(key: readonly unknown[]) => T | undefined },
): Attendance[] =>
  queryClient.getQueryData<Attendance[]>(rehearsalKeys.attendances.all) ?? [];

describe("roll-call writes", () => {
  it("marks a chorister on the roster before the server answers, and sends one record", async () => {
    // Hold the response so the optimistic row is observable rather than raced.
    let release: () => void = () => {};
    const inFlight = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { writes } = arrangeRollCall(() => inFlight);

    const { result, queryClient } = renderHookWithPanel(() =>
      useUpsertAttendanceRecord(),
    );
    queryClient.setQueryData(rehearsalKeys.attendances.all, [existingRow]);

    let settled: Promise<unknown> = Promise.resolve();
    await act(async () => {
      settled = result.current.mutateAsync({
        data: {
          rehearsal: REHEARSAL_ID,
          participation: "part-2",
          status: "PRESENT",
          minutes_late: null,
          excuse_note: "",
        },
      });
    });

    // The tap is already on the roster while the request is still open.
    await waitFor(() => expect(readRoster(queryClient)).toHaveLength(2));
    const optimistic = readRoster(queryClient).find(
      (row) => row.participation === "part-2",
    );
    expect(optimistic?.status).toBe("PRESENT");
    expect(optimistic?.id.startsWith("optimistic-")).toBe(true);
    // The row that was already there is untouched.
    expect(
      readRoster(queryClient).find((row) => row.id === existingRow.id)?.status,
    ).toBe("ABSENT");

    release();
    await act(async () => {
      await settled;
    });

    expect(writes).toHaveLength(1);
    expect(writes[0].method).toBe("POST");
    expect(writes[0].url).toBe("/api/attendances/");
    expect(writes[0].body).toEqual({
      rehearsal: REHEARSAL_ID,
      participation: "part-2",
      status: "PRESENT",
      minutes_late: null,
      excuse_note: "",
    });
  });

  it("closes the roll-call with one write per singer, reusing rows that exist", async () => {
    const { writes } = arrangeRollCall();

    const { result, queryClient } = renderHookWithPanel(() =>
      useMarkMissingAttendancesPresent(),
    );
    queryClient.setQueryData(rehearsalKeys.attendances.all, [existingRow]);

    await act(async () => {
      await result.current.mutateAsync([
        // Already has a row — must be corrected, not duplicated.
        {
          attendanceId: existingRow.id,
          rehearsalId: REHEARSAL_ID,
          participationId: "part-1",
        },
        { rehearsalId: REHEARSAL_ID, participationId: "part-2" },
        { rehearsalId: REHEARSAL_ID, participationId: "part-3" },
      ]);
    });

    expect(writes).toHaveLength(3);
    expect(writes.filter((write) => write.method === "PATCH")).toEqual([
      {
        method: "PATCH",
        url: `/api/attendances/${existingRow.id}/`,
        body: {
          rehearsal: REHEARSAL_ID,
          participation: "part-1",
          status: "PRESENT",
          minutes_late: null,
          excuse_note: "",
        },
      },
    ]);
    expect(
      writes
        .filter((write) => write.method === "POST")
        .map((write) => (write.body as { participation: string }).participation)
        .sort(),
    ).toEqual(["part-2", "part-3"]);

    // Three singers, three rows — the pre-existing one flipped in place.
    const roster = readRoster(queryClient);
    expect(roster).toHaveLength(3);
    expect(roster.every((row) => row.status === "PRESENT")).toBe(true);
  });
});
