/**
 * @file dayTimeline.test.ts
 * @description The panel's half of a two-implementation contract. The concert
 * day is merged here for the live editor and again in
 * `backend/roster/domain/day_timeline.py` for the printed sheet — two languages,
 * one day — so both suites replay the same fixture and this file fails the
 * moment the panel starts ordering a day differently from the PDF.
 *
 * The fixture is deliberately narrower than either implementation: its points
 * are already in order and its times are zero-padded. The merge does not sort
 * (a row being typed must not jump), so "the two agree" is only a statement
 * about placement. The order itself — day, then minute, an unreadable time
 * last within its day — is `point_sort_key` on the backend and
 * `compareRunSheetItems` here, and the suites below mirror the backend's own
 * cases for it (`TripPlanDomainTests`).
 * @architecture Enterprise SaaS 2026
 * @module features/projects/lib/dayTimeline.test
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { RunSheetItem } from "@/shared/types";
import {
  buildDayTimeline,
  buildProjectDayTimeline,
  groupDayTimeline,
  isMultiDayTimeline,
  planDayDate,
  readDayOffset,
  sortRunSheet,
  suggestRunSheetMoment,
} from "./dayTimeline";

interface TimelineCase {
  readonly name: string;
  readonly concertTime: string | null;
  readonly callTime: string | null;
  readonly points: readonly RunSheetItem[];
  readonly expected: readonly string[];
}

const fixtureUrl = new URL(
  "../../../../../backend/roster/domain/day_timeline_cases.json",
  import.meta.url,
);
const { cases } = JSON.parse(
  readFileSync(fileURLToPath(fixtureUrl), "utf-8"),
) as { readonly cases: readonly TimelineCase[] };

describe("buildDayTimeline · shared fixture with the backend", () => {
  it.each(cases.map((testCase) => [testCase.name, testCase] as const))(
    "%s",
    (_name, testCase) => {
      const entries = buildDayTimeline({
        runSheet: testCase.points,
        callTime: testCase.callTime,
        concertTime: testCase.concertTime,
      });

      expect(
        entries.map((entry) =>
          entry.kind === "point" ? entry.item.title : entry.kind,
        ),
      ).toEqual([...testCase.expected]);
    },
  );

  it("covers every case in the fixture", () => {
    expect(cases.length).toBeGreaterThan(0);
  });
});

/**
 * The typed windows are the panel's own half of the axis: the printed sheet
 * builds them into run-sheet points before the shared merge runs, so the fixture
 * above cannot carry them. What these pin is that both sides still place them
 * the same way — in clock order among the points, and behind a point sharing
 * their minute, which is where the backend's stable sort leaves them.
 */
const point = (time: string, title: string, day?: number): RunSheetItem => ({
  id: `${time}-${title}`,
  time,
  title,
  ...(day !== undefined ? { day } : {}),
});

const placement = (entries: ReturnType<typeof buildDayTimeline>): string[] =>
  entries.map((entry) =>
    entry.kind === "point" ? entry.item.title : entry.kind,
  );

describe("buildDayTimeline · the two typed windows", () => {
  it("places a window in clock order among the points", () => {
    const entries = buildDayTimeline({
      runSheet: [point("17:10", "wnoszenie"), point("19:30", "antrakt")],
      callTime: "2026-07-12T17:00",
      concertTime: "2026-07-12T19:00",
      warmupStart: "18:00",
      soundcheckStart: "18:40",
    });

    expect(placement(entries)).toEqual([
      "call",
      "wnoszenie",
      "warmup",
      "soundcheck",
      "concert",
      "antrakt",
    ]);
  });

  it("leaves a point sharing its minute ahead of it", () => {
    const entries = buildDayTimeline({
      runSheet: [point("18:00", "zbiórka w zakrystii")],
      warmupStart: "18:00",
    });

    expect(placement(entries)).toEqual(["zbiórka w zakrystii", "warmup"]);
  });

  it("carries the closing hour as a qualifier, not a second entry", () => {
    const [entry] = buildDayTimeline({
      runSheet: [],
      warmupStart: "18:00:00",
      warmupEnd: "18:30:00",
    });

    expect(entry).toEqual({
      kind: "warmup",
      time: "18:00",
      endTime: "18:30",
      dayOffset: 0,
    });
  });

  it("drops a closing hour with no window to close", () => {
    expect(
      buildDayTimeline({ runSheet: [], soundcheckEnd: "19:00" }),
    ).toEqual([]);
  });
});

describe("buildProjectDayTimeline", () => {
  it("sorts a stored day on the clock and reads it in the venue's zone", () => {
    const entries = buildProjectDayTimeline({
      // Lexically "9:00" follows "12:00"; the field is unvalidated JSON and
      // still holds rows written before the current time control.
      run_sheet: [point("12:00", "próba"), point("9:00", "wnoszenie")],
      call_time: "2026-07-12T15:00:00Z",
      date_time: "2026-07-12T17:00:00Z",
      timezone: "Europe/Warsaw",
      warmup_start: "16:00:00",
      warmup_end: null,
      soundcheck_start: null,
      soundcheck_end: null,
    });

    expect(placement(entries)).toEqual([
      "wnoszenie",
      "próba",
      "warmup",
      "call",
      "concert",
    ]);
  });

  it("sorts a trip by day before clock and places its windows on their day", () => {
    const entries = buildProjectDayTimeline({
      run_sheet: [
        point("09:00", "śniadanie"),
        point("14:00", "wyjazd", -1),
        point("16:00", "powrót"),
      ],
      call_time: "2026-10-11T10:30:00Z",
      date_time: "2026-10-11T11:30:00Z",
      timezone: "Europe/Warsaw",
      warmup_start: "19:00:00",
      warmup_end: null,
      warmup_day: -1,
      soundcheck_start: "19:15:00",
      soundcheck_end: "22:00:00",
      soundcheck_day: -1,
    });

    expect(placement(entries)).toEqual([
      "wyjazd",
      "warmup",
      "soundcheck",
      "śniadanie",
      "call",
      "concert",
      "powrót",
    ]);
  });
});

describe("the plan's days", () => {
  it("reads a stored day the way the backend does", () => {
    expect(readDayOffset(-1)).toBe(-1);
    expect(readDayOffset(3)).toBe(3);
    expect(readDayOffset(-3)).toBe(-3);
    // Out of range, not whole, a stray boolean or a string: concert day,
    // never an error — the reader degrades, only the write refuses.
    expect(readDayOffset(4)).toBe(0);
    expect(readDayOffset(-4)).toBe(0);
    expect(readDayOffset(0.5)).toBe(0);
    expect(readDayOffset(true)).toBe(0);
    expect(readDayOffset("-1")).toBe(0);
    expect(readDayOffset(undefined)).toBe(0);
    expect(readDayOffset(null)).toBe(0);
  });

  it("orders by day, an unreadable time last within its own day", () => {
    const sorted = sortRunSheet([
      point("09:00", "śniadanie"),
      point("", "bez godziny", -1),
      point("20:00", "kolacja", -1),
      point("08:00", "powrót", 1),
      point("9:30", "próba"),
      point("14:00", "wyjazd", -1),
    ]);

    expect(sorted.map((item) => item.title)).toEqual([
      "wyjazd",
      "kolacja",
      "bez godziny",
      "śniadanie",
      "próba",
      "powrót",
    ]);
  });

  it("places a point the evening before against a call that evening", () => {
    const entries = buildDayTimeline({
      runSheet: [point("18:00", "wyjazd", -1), point("20:00", "kolacja", -1)],
      callTime: "2026-10-10T19:00",
      concertTime: "2026-10-11T13:30",
    });

    expect(placement(entries)).toEqual(["wyjazd", "call", "kolacja", "concert"]);
    expect(entries.map((entry) => entry.dayOffset)).toEqual([-1, -1, -1, 0]);
  });

  it("groups a trip by day without splitting one", () => {
    const entries = buildDayTimeline({
      runSheet: [
        point("14:00", "wyjazd", -1),
        point("", "bez godziny"),
        point("09:00", "śniadanie"),
      ],
      callTime: "2026-10-10T21:00",
      concertTime: "2026-10-11T13:30",
      warmupStart: "19:00",
      warmupDay: -1,
    });

    expect(
      groupDayTimeline(entries).map((group) => [
        group.dayOffset,
        placement([...group.entries]),
      ]),
    ).toEqual([
      [-1, ["wyjazd", "warmup", "call"]],
      [0, ["bez godziny", "śniadanie", "concert"]],
    ]);
  });

  it("calls a plan multi-day when any entry leaves concert day", () => {
    const oneDay = buildDayTimeline({
      runSheet: [point("18:00", "rozśpiewanie")],
      callTime: "2026-10-11T17:00",
      concertTime: "2026-10-11T19:00",
    });
    // The call alone is enough: there is no switch for a trip.
    const callTheEveningBefore = buildDayTimeline({
      runSheet: [],
      callTime: "2026-10-10T19:00",
      concertTime: "2026-10-11T11:00",
    });
    const windowTheEveningBefore = buildDayTimeline({
      runSheet: [],
      concertTime: "2026-10-11T11:00",
      soundcheckStart: "19:00",
      soundcheckDay: -1,
    });

    expect(isMultiDayTimeline(oneDay)).toBe(false);
    expect(isMultiDayTimeline(callTheEveningBefore)).toBe(true);
    expect(isMultiDayTimeline(windowTheEveningBefore)).toBe(true);
  });

  it("dates a day from the concert's calendar date, across a DST change", () => {
    // Summer time ends in Warsaw on 2026-10-25; the day before is still the
    // 24th, whatever the offset of either instant.
    expect(planDayDate("2026-10-25T19:00", -1)?.toISOString()).toBe(
      "2026-10-24T00:00:00.000Z",
    );
    expect(planDayDate("2026-10-25T19:00", 1)?.toISOString()).toBe(
      "2026-10-26T00:00:00.000Z",
    );
    expect(planDayDate("", -1)).toBeNull();
  });
});

describe("suggestRunSheetMoment", () => {
  it("continues after the latest point, on its day", () => {
    expect(
      suggestRunSheetMoment({
        runSheet: [point("20:00", "kolacja", -1), point("", "bez godziny", 1)],
        concertTime: "2026-10-11T13:30",
      }),
    ).toEqual({ day: -1, time: "20:30" });

    expect(
      suggestRunSheetMoment({
        runSheet: [point("20:00", "kolacja", -1), point("09:00", "śniadanie")],
      }),
    ).toEqual({ day: 0, time: "09:30" });
  });

  it("seeds an empty plan from the call, on the call's day", () => {
    expect(
      suggestRunSheetMoment({
        runSheet: [],
        callTime: "2026-10-10T19:00",
        concertTime: "2026-10-11T13:30",
      }),
    ).toEqual({ day: -1, time: "19:15" });

    expect(
      suggestRunSheetMoment({ runSheet: [], concertTime: "2026-10-11T13:30" }),
    ).toEqual({ day: 0, time: "12:30" });
  });
});
