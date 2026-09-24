/**
 * @file portfolio.test.ts
 * @description Pins the finance overview's client-only derivations: what has
 * costs, what requires a board decision, and which live agreements are near a
 * deadline.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/lib/portfolio.test
 */

import { describe, expect, it } from "vitest";

import type { FundingSourceDTO, ProjectRollupDTO } from "../types/finance.dto";
import { hasCosts, projectsRequiringWork, sourceDeadlines } from "./portfolio";

const project = (overrides: Partial<ProjectRollupDTO> = {}): ProjectRollupDTO =>
  ({
    project: { id: "project-1", title: "Projekt", date_time: "2026-10-01T18:00:00Z", timezone: "Europe/Warsaw", status: "ACTIVE" },
    budget_status: "PLANNING",
    summary: { rows: 0, committed: "0.00" },
    warning_counts: { work: 0, problem: 0 },
    ...overrides,
  }) as ProjectRollupDTO;

const source = (overrides: Partial<FundingSourceDTO> = {}): FundingSourceDTO =>
  ({
    id: "source-1",
    name: "Grant",
    status: "AWARDED",
    report_due_on: null,
    eligible_to: null,
    ...overrides,
  }) as FundingSourceDTO;

describe("hasCosts", () => {
  it("counts an unpriced fee row as financial work", () => {
    expect(hasCosts(project({ summary: { rows: 1, committed: "0.00" } }))).toBe(true);
  });

  it("counts a persisted expense even when it has no fee row", () => {
    expect(hasCosts(project({ summary: { rows: 0, committed: "125.00" } }))).toBe(true);
  });
});

describe("projectsRequiringWork", () => {
  it("keeps only projects whose warning projection is non-empty", () => {
    const work = project({ project: { ...project().project, id: "work" }, warning_counts: { work: 2, problem: 0 } });
    const problem = project({ project: { ...project().project, id: "problem" }, warning_counts: { work: 0, problem: 1 } });

    expect(projectsRequiringWork([project(), work, problem])).toEqual([work, problem]);
  });
});

describe("sourceDeadlines", () => {
  const now = new Date("2026-09-24T12:00:00Z");

  it("returns report and eligibility dates inside the next 60 days in date order", () => {
    const later = source({ id: "later", report_due_on: "2026-11-23" });
    const soon = source({ id: "soon", eligible_to: "2026-09-24", report_due_on: "2026-10-01" });

    expect(sourceDeadlines([later, soon], now)).toMatchObject([
      { source: { id: "soon" }, date: "2026-09-24", kind: "eligibility" },
      { source: { id: "soon" }, date: "2026-10-01", kind: "report" },
      { source: { id: "later" }, date: "2026-11-23", kind: "report" },
    ]);
  });

  it("leaves past, distant, settled and rejected agreements out", () => {
    expect(
      sourceDeadlines(
        [
          source({ report_due_on: "2026-09-23" }),
          source({ report_due_on: "2026-11-24" }),
          source({ status: "SETTLED", report_due_on: "2026-10-01" }),
          source({ status: "REJECTED", eligible_to: "2026-10-01" }),
        ],
        now,
      ),
    ).toEqual([]);
  });
});
