/**
 * @file money.test.ts
 * @description Pins the grosze parser the draft preview sums on. The failure it
 * prevents is silent: a float sum prints a grosz nobody paid, or a lenient
 * parse turns a half-typed amount into a price nobody meant.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/lib/money.test
 */

import { describe, expect, it } from "vitest";

import {
  formatLedgerGrosze,
  fromGrosze,
  lineTotalGrosze,
  sanitizeAmountInput,
  toAmountInput,
  toGrosze,
} from "./money";

describe("lineTotalGrosze", () => {
  it("multiplies quantity by unit cost and rounds half up to the grosz", () => {
    expect(lineTotalGrosze("8", "412.50")).toBe(330000n);
    expect(lineTotalGrosze("2.5", "0.03")).toBe(8n);
    expect(lineTotalGrosze("0.5", "0.01")).toBe(1n);
  });

  it("stays exact where a float would not", () => {
    expect(lineTotalGrosze("999999.99", "99999999.99")).toBe(9999999899000000n);
  });

  it("refuses a factor that is not an amount", () => {
    expect(lineTotalGrosze("", "10")).toBeNull();
    expect(lineTotalGrosze("2", "abc")).toBeNull();
  });
});

describe("toGrosze", () => {
  it("reads the API's decimal strings exactly", () => {
    expect(toGrosze("1250.00")).toBe(125000);
    expect(toGrosze("400.50")).toBe(40050);
    expect(toGrosze("0.01")).toBe(1);
    expect(toGrosze("0.00")).toBe(0);
  });

  it("reads what a Polish keyboard types", () => {
    expect(toGrosze("400,5")).toBe(40050);
    expect(toGrosze("1 250,05")).toBe(125005);
    expect(toGrosze("400.")).toBe(40000);
    expect(toGrosze("7")).toBe(700);
  });

  it("refuses anything that is not an amount instead of guessing", () => {
    expect(toGrosze("")).toBeNull();
    expect(toGrosze("   ")).toBeNull();
    expect(toGrosze(".")).toBeNull();
    expect(toGrosze("1.999")).toBeNull();
    expect(toGrosze("-5")).toBeNull();
    expect(toGrosze("12a")).toBeNull();
    expect(toGrosze(null)).toBeNull();
    expect(toGrosze(undefined)).toBeNull();
  });

  it("sums without the float drift a decimal addition carries", () => {
    const total = [toGrosze("0.10"), toGrosze("0.20")].reduce<number>(
      (sum, value) => sum + (value ?? 0),
      0,
    );
    expect(total).toBe(30);
    expect(fromGrosze(total)).toBe("0.30");
  });
});

describe("fromGrosze", () => {
  it("writes the API's decimal string", () => {
    expect(fromGrosze(40050)).toBe("400.50");
    expect(fromGrosze(125000)).toBe("1250.00");
    expect(fromGrosze(5)).toBe("0.05");
    expect(fromGrosze(0)).toBe("0.00");
  });
});

describe("presentation", () => {
  it("prints Polish figures whatever the interface language", () => {
    expect(formatLedgerGrosze(40050)).toBe("400,50");
  });

  it("shows a stored amount in a field without trailing zeros", () => {
    expect(toAmountInput("1250.00")).toBe("1250");
    expect(toAmountInput("400.50")).toBe("400.5");
    expect(toAmountInput("400.05")).toBe("400.05");
    expect(toAmountInput(null)).toBe("");
  });

  it("keeps a typed amount to digits, one separator and two decimals", () => {
    expect(sanitizeAmountInput("400,505")).toBe("400.50");
    expect(sanitizeAmountInput("1 250 zł")).toBe("1250");
  });
});
