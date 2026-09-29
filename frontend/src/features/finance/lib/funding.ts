/**
 * @file funding.ts
 * @description Which funding sources a cost can be charged to, from the
 * server's own rule: money goes to a source of money, and volunteer work —
 * which costs the foundation nothing — goes at its valuation to a
 * volunteer-work source. A gift in kind has no cost row to charge at all. The
 * panel offers only the sources the server would accept. It also tallies which
 * sources carry a ledger section, so Honoraria can say it without a menu.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/lib/funding
 */

import { isPositiveAmount } from "./money";
import type {
  ExpenseRowDTO,
  LedgerRowDTO,
  ProjectFundingDTO,
} from "../types/finance.dto";

export const fundingsAccepting = (
  fundings: readonly ProjectFundingDTO[],
  { valuation }: { readonly valuation: boolean },
): ProjectFundingDTO[] =>
  fundings.filter((funding) =>
    valuation ? funding.source.kind === "VOLUNTEER_WORK" : funding.brings_money,
  );

/** A volunteer's fee is charged at its valuation, never at its cost. */
export const isValuationRow = (row: LedgerRowDTO): boolean => row.form === "VOLUNTEER";

/**
 * A fee the sources can take: counted, with something to split — a cost, or
 * a volunteer's valuation — and at least one source that would accept it.
 * An uncounted fee still carrying a split can only be taken off it, so it
 * stays reachable while it has one.
 */
export const canAllocateRow = (
  row: LedgerRowDTO,
  fundings: readonly ProjectFundingDTO[],
): boolean => {
  if (row.cost_item_id === null) return false;
  if (!row.counted) return row.allocations.length > 0;
  return (
    isPositiveAmount(row.allocatable) &&
    fundingsAccepting(fundings, { valuation: isValuationRow(row) }).length > 0
  );
};

export const canAllocateExpense = (
  fundings: readonly ProjectFundingDTO[],
): boolean => fundingsAccepting(fundings, { valuation: false }).length > 0;

/**
 * Every counted cost that a funding could still take a share of: the kind
 * fits the source, and part of it is uncovered. Fees and expenses alike; a
 * gift in kind takes none.
 */
export const chargeableCosts = (
  funding: ProjectFundingDTO,
  ledger: readonly LedgerRowDTO[],
  expenses: readonly ExpenseRowDTO[],
): { readonly fees: LedgerRowDTO[]; readonly expenses: ExpenseRowDTO[] } => {
  const valuationSource = funding.source.kind === "VOLUNTEER_WORK";
  if (!funding.brings_money && !valuationSource) return { fees: [], expenses: [] };
  return {
    fees: ledger.filter(
      (row) =>
        row.cost_item_id !== null &&
        row.counted &&
        isValuationRow(row) === valuationSource &&
        isPositiveAmount(row.unallocated),
    ),
    expenses: funding.brings_money
      ? expenses.filter((expense) => isPositiveAmount(expense.unallocated))
      : [],
  };
};

/** A fee some funding of the project could still take a share of: the bulk charge's reach. */
export const canChargeRow = (
  row: LedgerRowDTO,
  fundings: readonly ProjectFundingDTO[],
): boolean => fundings.some((funding) => chargeableCosts(funding, [row], []).fees.length > 0);

export interface FundingTally {
  /** Each source the rows are charged to, with how many of them it carries, in the project's order. */
  readonly sources: readonly { readonly name: string; readonly count: number }[];
  /** Rows no source carries any part of. */
  readonly uncharged: number;
}

/**
 * Which sources carry a ledger section, counted by row: a fee split between
 * two sources counts for both. Only counted fees with something to split are
 * tallied, and a project without sources has nothing to tally.
 */
export const fundingTally = (
  rows: readonly LedgerRowDTO[],
  fundings: readonly ProjectFundingDTO[],
): FundingTally | null => {
  if (fundings.length === 0) return null;
  const tallied = rows.filter(
    (row) => row.cost_item_id !== null && row.counted && isPositiveAmount(row.allocatable),
  );
  if (tallied.length === 0) return null;
  const counts = new Map<string, number>();
  let uncharged = 0;
  for (const row of tallied) {
    if (row.allocations.length === 0) uncharged += 1;
    for (const allocation of row.allocations) {
      counts.set(allocation.funding_id, (counts.get(allocation.funding_id) ?? 0) + 1);
    }
  }
  return {
    sources: fundings.flatMap((funding) => {
      const count = counts.get(funding.id);
      return count ? [{ name: funding.source.name, count }] : [];
    }),
    uncharged,
  };
};
