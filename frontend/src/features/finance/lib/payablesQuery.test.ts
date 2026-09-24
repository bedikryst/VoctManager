/**
 * @file payablesQuery.test.ts
 * @description Pins what Do zapłaty sends from its URL. The payables endpoint
 * answers an unexpected key with a 400, so a URL left over from the paid list,
 * or typed by hand, must never turn into a request the server refuses.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/lib/payablesQuery.test
 */

import { describe, expect, it } from "vitest";

import { payablesRequest, readPayablesFilters, withParam, withStatus } from "./payablesQuery";

const PROJECT = "7d0c3c52-4f1a-4a57-9f55-2c1f1f0f4e11";
const known = new Set([PROJECT]);
const read = (search: string) => readPayablesFilters(new URLSearchParams(search), known);

describe("readPayablesFilters + payablesRequest", () => {
  it("sends the status alone when nothing is filtered", () => {
    expect(payablesRequest(read(""), 50)).toEqual({ status: "unpaid", limit: 50, offset: 0 });
  });

  it("sends every filter the paid list understands, and the page as an offset", () => {
    const filters = read(
      `status=paid&project=${PROJECT}&kind=EXPENSE&paid_from=2026-09-01&paid_to=2026-09-30&ordering=-paid_on&page=3`,
    );
    expect(payablesRequest(filters, 50)).toEqual({
      status: "paid",
      project: PROJECT,
      kind: "EXPENSE",
      paid_from: "2026-09-01",
      paid_to: "2026-09-30",
      ordering: "-paid_on",
      limit: 50,
      offset: 100,
    });
  });

  it("drops the paid-only keys on the unpaid list", () => {
    const request = payablesRequest(read("paid_from=2026-09-01&paid_to=2026-09-30&ordering=paid_on"), 50);
    expect(request).toEqual({ status: "unpaid", limit: 50, offset: 0 });
  });

  it("drops values the server would refuse", () => {
    const request = payablesRequest(
      read("status=unknown&project=someone-else&kind=fee&ordering=created_at&page=-2"),
      50,
    );
    expect(request).toEqual({ status: "unpaid", limit: 50, offset: 0 });
  });

  it("keeps crossed bounds on screen but sends neither", () => {
    const filters = read("status=paid&paid_from=2026-09-30&paid_to=2026-09-01");
    expect(filters.rangeInverted).toBe(true);
    expect(filters.paidFrom).toBe("2026-09-30");
    expect(payablesRequest(filters, 50)).toEqual({ status: "paid", limit: 50, offset: 0 });
  });
});

describe("withParam / withStatus", () => {
  it("returns to the first page on a filter change, not on paging", () => {
    const current = new URLSearchParams("page=4&kind=FEE");
    expect(withParam(current, "kind", "EXPENSE").toString()).toBe("kind=EXPENSE");
    expect(withParam(current, "page", "5").toString()).toBe("page=5&kind=FEE");
    expect(withParam(current, "kind", null).toString()).toBe("");
  });

  it("leaves Zapłacone without the keys only it understands", () => {
    const current = new URLSearchParams(
      `status=paid&paid_from=2026-09-01&paid_to=2026-09-30&ordering=-paid_on&project=${PROJECT}&page=2`,
    );
    expect(withStatus(current, "unpaid").toString()).toBe(`project=${PROJECT}`);
  });

  it("keeps a sort both lists share", () => {
    const current = new URLSearchParams("status=paid&ordering=-amount");
    expect(withStatus(current, "unpaid").toString()).toBe("ordering=-amount");
    expect(withStatus(new URLSearchParams(), "paid").toString()).toBe("status=paid");
  });
});
