/**
 * @file finance.service.test.ts
 * @description Keeps finance endpoints that use `results` as a page payload
 * from being flattened by the shared HTTP client's ordinary list behaviour.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/api/finance.service.test
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();

vi.mock("@/shared/api/api", () => ({
  default: { get },
}));

import { FinanceService } from "./finance.service";

describe("FinanceService.getHistory", () => {
  beforeEach(() => {
    get.mockReset();
  });

  it("keeps the page envelope that powers the history infinite query", async () => {
    const page = { count: 1, limit: 20, offset: 0, results: [] };
    get.mockResolvedValue({ data: page });

    await expect(FinanceService.getHistory("project-1", 20, 0)).resolves.toEqual(page);

    expect(get).toHaveBeenCalledWith("/api/finance/projects/project-1/history/", {
      params: { limit: 20, offset: 0 },
      skipUnwrap: true,
    });
  });
});
