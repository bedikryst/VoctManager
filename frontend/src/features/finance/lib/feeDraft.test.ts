/**
 * @file feeDraft.test.ts
 * @description The Honoraria draft against the server's own rules: the
 * standard rate's skip list, 0 ⇔ volunteer, the order in which a rate and a
 * per-person exception land, and totals in exact grosze. A preview that
 * disagrees with the save is the rail promising a cost the ledger then does
 * not show.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/lib/feeDraft.test
 */

import { describe, expect, it } from "vitest";

import type { LedgerRowDTO } from "../types/finance.dto";
import {
  buildFeeBatch,
  previewRow,
  reconcilePricing,
  summarizeDraft,
  withAmount,
  withForm,
} from "./feeDraft";

const row = (key: string, overrides: Partial<LedgerRowDTO> = {}): LedgerRowDTO => ({
  key,
  origin: "cast",
  participation_id: key,
  crew_assignment_id: null,
  cost_item_id: null,
  payee_name: `Osoba ${key}`,
  payee_role: "Sopran",
  seat_status: "CON",
  billable: true,
  orphaned: false,
  counted: false,
  is_priced: false,
  is_paid: false,
  category: "PERSONNEL_ARTISTIC",
  budget_line_id: null,
  form: "DZIELO",
  default_form: "DZIELO",
  contract_amount: null,
  employer_contributions: null,
  cost_amount: null,
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
  allocatable: "0.00",
  unallocated: "0.00",
  ...overrides,
});

const priced = (
  key: string,
  amount: string,
  overrides: Partial<LedgerRowDTO> = {},
): LedgerRowDTO =>
  row(key, {
    cost_item_id: `item-${key}`,
    contract_amount: amount,
    cost_amount: amount,
    counted: true,
    is_priced: true,
    ...overrides,
  });

describe("reconcilePricing", () => {
  it("keeps 0 and volunteer one fact, whichever of the two changed", () => {
    const dzielo = { form: "DZIELO" as const, grosze: 30000 };
    const volunteer = { form: "VOLUNTEER" as const, grosze: 0 };

    expect(reconcilePricing(dzielo, { grosze: 0 }, "DZIELO")).toEqual(volunteer);
    expect(reconcilePricing(dzielo, { form: "VOLUNTEER", grosze: 30000 }, "DZIELO")).toEqual(volunteer);
    expect(reconcilePricing(volunteer, { form: "ZLECENIE", grosze: 0 }, "DZIELO")).toEqual({
      form: "ZLECENIE",
      grosze: null,
    });
    expect(reconcilePricing(volunteer, { grosze: 25000 }, "ZLECENIE")).toEqual({
      form: "ZLECENIE",
      grosze: 25000,
    });
  });
});

describe("the standard rate", () => {
  const rows = [
    row("unpriced"),
    priced("priced", "300.00"),
    priced("paid", "500.00", { is_paid: true, paid_on: "2026-09-01" }),
    priced("volunteer", "0.00", { form: "VOLUNTEER", cost_amount: "0.00" }),
    priced("invoice", "900.00", { form: "INVOICE" }),
    priced("contracted", "300.00", {
      contract: {
        id: "c1",
        number: "UoD/1/2026",
        form: "DZIELO",
        amount: "300.00",
        status: "ISSUED",
        issued_at: "2026-09-01T10:00:00Z",
        signed_on: null,
        signed_copy_location: "",
        hours_confirmed: null,
      },
    }),
  ];

  it("reprices only what the server would, and the total follows", () => {
    const summary = summarizeDraft(rows, {}, { cast: "400" });

    // unpriced + priced take 400 each; paid 500, invoice 900, contracted 300
    // and the volunteer's 0 stand.
    expect(summary.committed).toBe(40000 * 2 + 50000 + 90000 + 30000);
    expect(summary.unpriced).toBe(0);
    expect(summary.pending).toBe(2);
  });

  it("lands before a per-person exception, which the batch sends after it", () => {
    const drafts = { priced: withAmount(undefined, "350") };
    const batch = buildFeeBatch(rows, drafts, { cast: "400" });

    expect(batch.standard_rate).toEqual({ cast: "400.00" });
    expect(batch.items).toEqual([
      { ref: { participation: "priced" }, contract_amount: "350.00" },
    ]);
    expect(previewRow(rows[1], drafts.priced, { cast: "400" }).next.grosze).toBe(35000);
  });

  it("of 0 turns every repriced row into volunteer work, at no cost", () => {
    const summary = summarizeDraft(rows, {}, { cast: "0" });

    expect(previewRow(rows[0], undefined, { cast: "0" }).next).toEqual({
      form: "VOLUNTEER",
      grosze: 0,
    });
    expect(summary.committed).toBe(50000 + 90000 + 30000);
  });
});

describe("row edits", () => {
  it("typing 0 is volunteer work, and the batch lets the server say so", () => {
    const rows = [priced("a", "300.00")];
    const drafts = { a: withAmount(undefined, "0") };

    expect(previewRow(rows[0], drafts.a, {}).next).toEqual({ form: "VOLUNTEER", grosze: 0 });
    expect(buildFeeBatch(rows, drafts, {}).items).toEqual([
      { ref: { participation: "a" }, contract_amount: "0.00" },
    ]);
  });

  it("choosing volunteer drops a typed amount; typing one leaves volunteer", () => {
    const chosen = withForm(withAmount(undefined, "300"), "VOLUNTEER");
    expect(chosen).toEqual({ form: "VOLUNTEER" });
    expect(withAmount(chosen, "250")).toEqual({ amount: "250" });
  });

  describe("a mandate with the office's contributions", () => {
    const crew = priced("c", "400.00", {
      origin: "crew",
      participation_id: null,
      crew_assignment_id: "c",
      category: "PERSONNEL_TECHNICAL",
      form: "ZLECENIE",
      default_form: "ZLECENIE",
      employer_contributions: "80.25",
      cost_amount: "480.25",
    });

    it("costs them on top while nothing changes it", () => {
      expect(summarizeDraft([crew], {}, {}).committed).toBe(48025);
    });

    it("drops them when repriced, as the server does, until they are reported again", () => {
      expect(summarizeDraft([crew], { c: withAmount(undefined, "500") }, {}).committed).toBe(50000);
      expect(summarizeDraft([crew], {}, { crew: "600" }).committed).toBe(60000);
    });

    it("drops them when it stops being a mandate", () => {
      expect(summarizeDraft([crew], { c: withForm(undefined, "DZIELO") }, {}).committed).toBe(40000);
    });
  });

  it("sums in exact grosze", () => {
    const rows = [row("a"), row("b"), row("c")];
    const drafts = {
      a: withAmount(undefined, "0.1"),
      b: withAmount(undefined, "0.2"),
      c: withAmount(undefined, "0,3"),
    };

    expect(summarizeDraft(rows, drafts, {}).committed).toBe(60);
  });

  it("never counts an unpaid fee whose seat left the cast", () => {
    const orphan = priced("o", "300.00", { billable: false, orphaned: true, counted: false });

    const summary = summarizeDraft([orphan, row("u")], {}, {});

    expect(summary.committed).toBe(0);
    expect(summary.unpriced).toBe(1);
  });

  it("holds back a typed amount that is not an amount", () => {
    const rows = [row("a"), row("b")];
    const drafts = { a: withAmount(undefined, "."), b: withAmount(undefined, "200") };

    const summary = summarizeDraft(rows, drafts, {});

    expect(summary.invalid).toBe(1);
    expect(buildFeeBatch(rows, drafts, {}).items).toEqual([
      { ref: { participation: "b" }, contract_amount: "200.00" },
    ]);
  });

  it("typing a figure back to what is stored leaves nothing to save", () => {
    const rows = [priced("a", "300.00")];
    const drafts = { a: withAmount(undefined, "300") };

    expect(previewRow(rows[0], drafts.a, {}).isPending).toBe(false);
    expect(buildFeeBatch(rows, drafts, {}).items).toEqual([]);
  });
});
