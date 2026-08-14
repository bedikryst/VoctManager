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
import { buildDayTimeline } from "./dayTimeline";

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
