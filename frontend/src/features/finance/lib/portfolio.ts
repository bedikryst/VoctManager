/**
 * @file portfolio.ts
 * @description Derivations over the foundation's finance overview that more
 * than one surface of the workspace must agree on.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/lib/portfolio
 */

import type { FundingSourceDTO, IsoDate, ProjectRollupDTO } from "../types/finance.dto";
import { isPositiveAmount } from "./money";

const DAY_MS = 86_400_000;

export type SourceDeadlineKind = "report" | "eligibility";

export interface SourceDeadline {
  readonly source: FundingSourceDTO;
  readonly date: IsoDate;
  readonly kind: SourceDeadlineKind;
}

/**
 * Whether a project has anything on its books: a fee row (priced or not — an
 * unpriced one is work still to do) or a counted cost. Projekty lists these by
 * default, and the workspace nav counts exactly these, so the number beside
 * the section is the number of rows it opens on.
 */
export const hasCosts = (rollup: ProjectRollupDTO): boolean =>
  rollup.summary.rows > 0 || isPositiveAmount(rollup.summary.committed);

/** Projects whose budget projection reports work or a concrete problem. */
export const projectsRequiringWork = (
  projects: readonly ProjectRollupDTO[],
): readonly ProjectRollupDTO[] =>
  projects.filter(({ warning_counts: warnings }) => warnings.work + warnings.problem > 0);

const dayStamp = (date: Date): number => Math.floor(date.getTime() / DAY_MS) * DAY_MS;

const isInWindow = (date: IsoDate | null, today: number, days: number): date is IsoDate => {
  if (date === null) return false;
  const target = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(target) && target >= today && target <= today + days * DAY_MS;
};

/**
 * Dates that still ask something of the foundation. A settled or rejected
 * agreement has no forthcoming financial work, even if its old deadline is
 * still stored on the source.
 */
export const sourceDeadlines = (
  sources: readonly FundingSourceDTO[],
  now: Date,
  days = 60,
): readonly SourceDeadline[] => {
  const today = dayStamp(now);
  return sources
    .flatMap((source) => {
      if (source.status === "SETTLED" || source.status === "REJECTED") return [];
      const deadlines: SourceDeadline[] = [];
      if (isInWindow(source.report_due_on, today, days)) {
        deadlines.push({ source, date: source.report_due_on, kind: "report" });
      }
      if (isInWindow(source.eligible_to, today, days)) {
        deadlines.push({ source, date: source.eligible_to, kind: "eligibility" });
      }
      return deadlines;
    })
    .sort((left, right) => left.date.localeCompare(right.date));
};
