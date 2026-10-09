/**
 * @file planPublication.test.ts
 * @description The rail's word for an evening's plan, before and after the
 * downbeat, against the stamps the rehearsal read carries.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/lib/planPublication.test
 */

import { describe, expect, it } from "vitest";

import type { Rehearsal, RehearsalPlanItem } from "@/shared/types";
import { isChangedSinceSend, planStateOf } from "./planPublication";

const ROW: RehearsalPlanItem = {
  id: "row-1",
  position: 0,
  piece: "lark",
  piece_title: "Lark",
  label: "",
  title: "Lark",
  note: "",
  starts_at: null,
  minutes: null,
  clock: "18:59",
  clock_derived: true,
  excluded_voice_lines: [],
  excludes_instrumentalists: false,
  is_reserve: false,
  is_break: false,
  done: null,
  done_at: null,
  skipped_at: null,
  updated_at: "2026-10-08T10:00:00Z",
};

const START = "2026-10-09T16:59:00Z";
const BEFORE = new Date("2026-10-09T10:00:00Z").getTime();
const AFTER = new Date("2026-10-09T20:00:00Z").getTime();

type Stamps = Pick<Rehearsal, "date_time" | "plan" | "plan_announced_at" | "plan_changed_at">;

const evening = (overrides: Partial<Stamps> = {}): Stamps => ({
  date_time: START,
  plan: [ROW],
  plan_announced_at: null,
  plan_changed_at: "2026-10-08T10:00:00Z",
  ...overrides,
});

describe("isChangedSinceSend", () => {
  it("is false for a plan never sent", () => {
    expect(isChangedSinceSend(null, "2026-10-08T10:00:00Z")).toBe(false);
  });

  it("compares the rows' last change with the send", () => {
    expect(isChangedSinceSend("2026-10-08T12:00:00Z", "2026-10-08T10:00:00Z")).toBe(false);
    expect(isChangedSinceSend("2026-10-08T12:00:00Z", "2026-10-08T13:00:00Z")).toBe(true);
  });
});

describe("planStateOf", () => {
  it("says 'none' for an evening without rows, before and after it", () => {
    expect(planStateOf(evening({ plan: [] }), BEFORE)).toBe("none");
    expect(planStateOf(evening({ plan: undefined }), AFTER)).toBe("none");
  });

  it("says 'draft' for saved rows nobody was sent", () => {
    expect(planStateOf(evening(), BEFORE)).toBe("draft");
  });

  it("says 'sent' while the rows are as they were sent", () => {
    expect(planStateOf(evening({ plan_announced_at: "2026-10-08T12:00:00Z" }), BEFORE)).toBe("sent");
  });

  it("says 'changed' for rows edited after the send", () => {
    expect(
      planStateOf(
        evening({
          plan_announced_at: "2026-10-08T12:00:00Z",
          plan_changed_at: "2026-10-08T13:00:00Z",
        }),
        BEFORE,
      ),
    ).toBe("changed");
  });

  it("does not call a ticked plan 'changed' once the evening has started", () => {
    expect(
      planStateOf(
        evening({
          plan_announced_at: "2026-10-08T12:00:00Z",
          plan_changed_at: "2026-10-09T19:30:00Z",
        }),
        AFTER,
      ),
    ).toBe("sent");
  });

  it("gives no word to a plan the downbeat made public without a send", () => {
    expect(planStateOf(evening(), AFTER)).toBeNull();
  });
});
