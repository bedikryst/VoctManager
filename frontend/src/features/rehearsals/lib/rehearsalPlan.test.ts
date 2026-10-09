/**
 * @file rehearsalPlan.test.ts
 * @description Replays the server's golden cases for the plan rule
 * (`backend/roster/domain/rehearsal_plan_cases.json`) through the client
 * mirror. The fixture is read from the backend tree on purpose: one file, two
 * suites, so the count on an exclusion chip and the seats the server stops
 * calling cannot drift apart without one of the two suites failing. The
 * lengths a row's clocks imply are client-only and tested here alone.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/lib/rehearsalPlan.test
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  effectiveClocks,
  itemCallsSeat,
  plannedMinutes,
  planWindowForSeat,
  rowLengths,
  rowLines,
  type PlanRuleRow,
  type PlanRuleSeat,
  type TimedRow,
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
  readonly minutes?: number;
  readonly excluded?: readonly string[];
  readonly excludesInstrumentalists?: boolean;
  readonly isBreak?: boolean;
  /** Carried for the record; the rule ignores it — see the fixture's `_doc`. */
  readonly isReserve?: boolean;
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
  /** Every row's effective clock; a clock on a row without `time` is derived. */
  readonly clocks?: readonly (string | null)[];
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
    minutes: spec.minutes ?? null,
    lines: rowLines(piece === null ? [] : (fixture.pieces[piece] ?? [])),
    excludedLines: new Set(spec.excluded ?? []),
    excludesInstrumentalists: spec.excludesInstrumentalists ?? false,
    isBreak: spec.isBreak ?? false,
  };
};

describe("rehearsal plan rule — golden cases shared with the server", () => {
  it.each(fixture.cases.map((testCase) => [testCase.name, testCase] as const))(
    "%s",
    (_name, testCase) => {
      const rows = testCase.rows.map(rowOf);
      if (testCase.clocks) {
        const clocks = effectiveClocks(rows, testCase.rehearsal.start);
        expect(clocks.map((entry) => entry.clock), "clocks").toEqual(testCase.clocks);
        expect(
          clocks.map((entry) => entry.derived),
          "derived",
        ).toEqual(
          testCase.clocks.map(
            (clock, index) => clock !== null && testCase.rows[index]?.time === undefined,
          ),
        );
      }
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

const timed = (startsAt: string | null, minutes: number | null = null): TimedRow => ({
  startsAt,
  minutes,
});

describe("rowLengths — a length the clocks imply", () => {
  it("fills the gap a row leaves to the next anchor, and the last row's to the end", () => {
    // 5.10 as it was meant: an odd start, a warm-up up to the first round clock.
    const lengths = rowLengths(
      [timed(null), timed("18:30", 20), timed(null)],
      "18:14",
      "20:00",
    );
    expect(lengths).toEqual([
      { minutes: 16, implied: true },
      { minutes: 20, implied: false },
      { minutes: 70, implied: true },
    ]);
  });

  it("makes a complete plan of clocks alone", () => {
    const rows = [timed("18:00"), timed("18:40"), timed("19:30")];
    const lengths = rowLengths(rows, "18:00", "20:00");
    expect(lengths.map((entry) => entry.minutes)).toEqual([40, 50, 30]);
    expect(plannedMinutes(lengths)).toBe(120);
  });

  it("implies nothing where no fixed clock follows", () => {
    expect(rowLengths([timed(null), timed(null), timed("19:00")], "18:00", null)).toEqual([
      { minutes: null, implied: false },
      { minutes: null, implied: false },
      { minutes: null, implied: false },
    ]);
  });

  it("implies nothing from a clock that runs backwards", () => {
    expect(rowLengths([timed("18:30"), timed("18:10", 10)], "18:00", "20:00")[0]).toEqual({
      minutes: null,
      implied: false,
    });
  });

  it("reads an evening that crosses midnight on its own axis", () => {
    expect(rowLengths([timed("23:30"), timed("00:15")], "23:00", "01:00")).toEqual([
      { minutes: 45, implied: true },
      { minutes: 45, implied: true },
    ]);
  });
});
