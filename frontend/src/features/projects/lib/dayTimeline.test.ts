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
 * about placement — normalisation of stored rows is the backend reader's job
 * and is asserted on its side.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/lib/dayTimeline.test
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { RunSheetItem } from "@/shared/types";
import { buildDayTimeline, buildProjectDayTimeline } from "./dayTimeline";

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
const point = (time: string, title: string): RunSheetItem => ({
  id: `${time}-${title}`,
  time,
  title,
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

    expect(entry).toEqual({ kind: "warmup", time: "18:00", endTime: "18:30" });
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
});
