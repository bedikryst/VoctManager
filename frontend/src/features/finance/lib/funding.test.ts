/**
 * @file funding.test.ts
 * @description Which sources the panel offers a cost to must match what the
 * server accepts — money to a source of money, a volunteer's valuation to a
 * volunteer-work source, nothing to a gift in kind — or the charge sheet lists
 * costs the server then refuses as a whole. Also pins the signed differences a
 * source's remainder and the plan's gap print.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/lib/funding.test
 */

import { describe, expect, it } from "vitest";

import type {
  ExpenseRowDTO,
  FundingKind,
  LedgerRowDTO,
  ProjectFundingDTO,
} from "../types/finance.dto";
import { canAllocateRow, chargeableCosts, fundingsAccepting } from "./funding";
import { formatDifference, formatLedgerDifference, isNegativeAmount } from "./money";

const funding = (id: string, kind: FundingKind): ProjectFundingDTO => {
  const bringsMoney = kind !== "IN_KIND" && kind !== "VOLUNTEER_WORK";
  return {
    id,
    source: {
      id: `source-${id}`,
      kind,
      name: id,
      grantor: "",
      agreement_number: "",
      agreement_date: null,
      awarded_amount: null,
      status: "AWARDED",
      eligible_from: null,
      eligible_to: null,
      report_due_on: null,
      required_own_share_pct: null,
      admin_cost_cap_pct: null,
      line_tolerance_pct: null,
      document_note_template: "",
      note: "",
      brings_money: bringsMoney,
      figures: {
        project_count: 1,
        planned: "0.00",
        received: "0.00",
        line_allocated: "0.00",
        charged: "0.00",
        ceiling: null,
        remaining: null,
        over_awarded: false,
        own_share_plan_pct: null,
        own_share_actual_pct: null,
        own_share_below: false,
        admin_plan_pct: null,
        admin_actual_pct: null,
        admin_cap_exceeded: false,
      },
    },
    planned_amount: "0.00",
    received_amount: "0.00",
    line_allocated: "0.00",
    charged: "0.00",
    charged_count: 0,
    charge_limit: "0.00",
    brings_money: bringsMoney,
    over_plan_allocation: false,
    over_charge_limit: false,
    overallocated: false,
  };
};

const fee = (key: string, overrides: Partial<LedgerRowDTO> = {}): LedgerRowDTO => ({
  key,
  origin: "cast",
  participation_id: key,
  crew_assignment_id: null,
  cost_item_id: `item-${key}`,
  payee_name: key,
  payee_role: "",
  seat_status: "CON",
  billable: true,
  orphaned: false,
  counted: true,
  is_priced: true,
  is_paid: false,
  category: "PERSONNEL_ARTISTIC",
  budget_line_id: null,
  form: "DZIELO",
  default_form: "DZIELO",
  contract_amount: "400.00",
  employer_contributions: null,
  cost_amount: "400.00",
  in_kind_hours: null,
  in_kind_hourly_rate: null,
  in_kind_value: null,
  incurred_on: "2026-10-10",
  due_on: null,
  paid_on: null,
  paid_marked_at: null,
  document_number: "",
  document_date: null,
  vendor_nip: "",
  note: "",
  contract: null,
  allocations: [],
  allocated: "0.00",
  allocatable: "400.00",
  unallocated: "400.00",
  ...overrides,
});

const volunteer = fee("volunteer", {
  form: "VOLUNTEER",
  contract_amount: "0.00",
  cost_amount: "0.00",
  in_kind_value: "300.00",
  allocatable: "300.00",
  unallocated: "300.00",
});

const expense: ExpenseRowDTO = {
  id: "expense",
  category: "VENUE",
  budget_line_id: null,
  vendor_name: "Parafia",
  vendor_nip: "",
  document_type: "INVOICE",
  document_number: "",
  document_date: null,
  description: "",
  cost_amount: "1500.00",
  incurred_on: "2026-10-10",
  due_on: null,
  paid_on: null,
  paid_marked_at: null,
  is_paid: false,
  note: "",
  attachments: [],
  allocations: [],
  allocated: "0.00",
  unallocated: "1500.00",
};

const grant = funding("grant", "PUBLIC_GRANT");
const volunteerWork = funding("volunteers", "VOLUNTEER_WORK");
const gift = funding("church", "IN_KIND");

describe("fundingsAccepting", () => {
  it("offers money to money sources and a valuation to volunteer work only", () => {
    const all = [grant, volunteerWork, gift];
    expect(fundingsAccepting(all, { valuation: false }).map((f) => f.id)).toEqual(["grant"]);
    expect(fundingsAccepting(all, { valuation: true }).map((f) => f.id)).toEqual(["volunteers"]);
  });
});

describe("canAllocateRow", () => {
  it("needs something to split and a source that would take it", () => {
    expect(canAllocateRow(fee("a"), [grant])).toBe(true);
    expect(canAllocateRow(volunteer, [grant])).toBe(false);
    expect(canAllocateRow(volunteer, [volunteerWork])).toBe(true);
    expect(canAllocateRow(fee("unpriced", { cost_item_id: null }), [grant])).toBe(false);
  });

  it("keeps an uncounted fee reachable only while it still carries a split", () => {
    const orphan = fee("orphan", { counted: false, orphaned: true });
    expect(canAllocateRow(orphan, [grant])).toBe(false);
    expect(
      canAllocateRow({ ...orphan, allocations: [{ funding_id: "grant", amount: "400.00" }] }, [grant]),
    ).toBe(true);
  });
});

describe("chargeableCosts", () => {
  it("lists what each kind of source could still take", () => {
    const covered = fee("covered", { unallocated: "0.00", allocated: "400.00" });
    const ledger = [fee("a"), covered, volunteer];

    const toGrant = chargeableCosts(grant, ledger, [expense]);
    expect(toGrant.fees.map((row) => row.key)).toEqual(["a"]);
    expect(toGrant.expenses.map((row) => row.id)).toEqual(["expense"]);

    const toVolunteers = chargeableCosts(volunteerWork, ledger, [expense]);
    expect(toVolunteers.fees.map((row) => row.key)).toEqual(["volunteer"]);
    expect(toVolunteers.expenses).toEqual([]);

    expect(chargeableCosts(gift, ledger, [expense])).toEqual({ fees: [], expenses: [] });
  });
});

describe("signed differences", () => {
  it("prints a shortfall with the typographic minus", () => {
    expect(isNegativeAmount("-300.00")).toBe(true);
    expect(isNegativeAmount("300.00")).toBe(false);
    expect(isNegativeAmount("-0.00")).toBe(false);
    expect(formatDifference("-1500.00")).toBe("−1500");
    expect(formatLedgerDifference("-12.50")).toBe("−12,50");
    expect(formatLedgerDifference("12.50")).toBe("12,50");
  });
});
