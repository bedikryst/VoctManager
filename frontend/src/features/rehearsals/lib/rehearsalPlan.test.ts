/**
 * @file rehearsalPlan.test.ts
 * @description Replays the server's golden cases for the plan rule
 * (`backend/roster/domain/rehearsal_plan_cases.json`) through the client
 * mirror. The fixture is read from the backend tree on purpose: one file, two
 * suites, so the count on an exclusion chip and the seats the server stops
 * calling cannot drift apart without one of the two suites failing.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/lib/rehearsalPlan.test
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  itemCallsSeat,
  planWindowForSeat,
  rowLines,
  type PlanRuleRow,
  type PlanRuleSeat,
} from "./rehearsalPlan";

interface FixtureSeat {
  readonly letters?: string;
  readonly instrumentalist?: boolean;
  readonly castings?: Readonly<Record<string, string>>;
}

interface FixtureRow {
  readonly piece?: string;
  readonly label?: string;
  readonly time?: string;
  readonly excluded?: readonly string[];
  readonly excludesInstrumentalists?: boolean;
}

interface FixtureWindow {
  readonly callsMe: boolean;
  readonly start?: string | null;
  readonly end?: string | null;
}

interface FixtureCase {
  readonly name: string;
  readonly rehearsal: {
    readonly start: string;
    readonly end: string | null;
    readonly callsInstrumentalists: boolean;
  };
  readonly rows: readonly FixtureRow[];
  readonly expected: Readonly<
    Record<string, { readonly calls: readonly boolean[]; readonly window: FixtureWindow | null }>
  >;
}

interface Fixture {
  readonly pieces: Readonly<Record<string, readonly string[]>>;
  readonly seats: Readonly<Record<string, FixtureSeat>>;
  readonly cases: readonly FixtureCase[];
}

const fixtureUrl = new URL(
  "../../../../../backend/roster/domain/rehearsal_plan_cases.json",
  import.meta.url,
);
const fixture = JSON.parse(readFileSync(fileURLToPath(fixtureUrl), "utf-8")) as Fixture;

const seatOf = (spec: FixtureSeat): PlanRuleSeat => ({
  sectionLetters: spec.letters ?? "",
  isInstrumentalist: spec.instrumentalist ?? false,
  castLines: new Map(Object.entries(spec.castings ?? {})),
});

const rowOf = (spec: FixtureRow): PlanRuleRow => {
  const piece = spec.piece ?? null;
  return {
    piece,
    startsAt: spec.time ?? null,
    lines: rowLines(piece === null ? [] : (fixture.pieces[piece] ?? [])),
    excludedLines: new Set(spec.excluded ?? []),
    excludesInstrumentalists: spec.excludesInstrumentalists ?? false,
  };
};

describe("rehearsal plan rule — golden cases shared with the server", () => {
  it.each(fixture.cases.map((testCase) => [testCase.name, testCase] as const))(
    "%s",
    (_name, testCase) => {
      const rows = testCase.rows.map(rowOf);
      for (const [seatKey, expected] of Object.entries(testCase.expected)) {
        const seatSpec = fixture.seats[seatKey];
        expect(seatSpec, `seat ${seatKey} is declared`).toBeDefined();
        if (!seatSpec) continue;
        const seat = seatOf(seatSpec);
        const calls = rows.map((row) =>
          itemCallsSeat(row, seat, testCase.rehearsal.callsInstrumentalists),
        );
        expect(calls, `${seatKey}: calls`).toEqual(expected.calls);

        const window = planWindowForSeat(rows, seat, testCase.rehearsal);
        if (expected.window === null) {
          expect(window, `${seatKey}: window`).toBeNull();
        } else {
          expect(window, `${seatKey}: window`).toEqual({
            callsMe: expected.window.callsMe,
            start: expected.window.start ?? null,
            end: expected.window.end ?? null,
          });
        }
      }
    },
  );
});
