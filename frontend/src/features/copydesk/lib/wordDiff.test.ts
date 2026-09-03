/**
 * @file wordDiff.test.ts
 * @description The proof the reviewer's screen rests on: a diff that cannot
 * reconstruct both of the texts it was built from is showing somebody a change
 * that was never proposed.
 * @module features/copydesk/lib/wordDiff.test
 */

import { describe, expect, it } from "vitest";

import { wordDiff, type DiffPart } from "./wordDiff";

const rebuild = (parts: readonly DiffPart[], kind: "removed" | "added"): string =>
  parts
    .filter((part) => part.kind === "same" || part.kind === kind)
    .map((part) => part.text)
    .join("");

describe("wordDiff", () => {
  it("reconstructs both sides of every diff it produces", () => {
    const pairs: readonly (readonly [string, string])[] = [
      ["Kontemplacja wcielenia", "Kontemplacja Wcielenia"],
      ["", "Pierwsze tłumaczenie tego pola."],
      ["Stary akapit, cały do wymiany.", ""],
      [
        "Chór śpiewa w bazylice\nNajświętszego Serca.",
        "Chór śpiewa w krakowskiej bazylice\nNajświętszego Serca Pana Jezusa.",
      ],
      ["Zupełnie inny tekst", "Nic wspólnego z poprzednim"],
    ];

    for (const [before, after] of pairs) {
      const { parts } = wordDiff(before, after);
      expect(rebuild(parts, "removed")).toBe(before);
      expect(rebuild(parts, "added")).toBe(after);
    }
  });

  it("marks only the words that moved", () => {
    const { parts } = wordDiff(
      "Program prowadzi przez siedem wieków muzyki.",
      "Program prowadzi przez pięć wieków muzyki.",
    );
    expect(parts.filter((part) => part.kind === "removed")).toEqual([
      { kind: "removed", text: "siedem" },
    ]);
    expect(parts.filter((part) => part.kind === "added")).toEqual([
      { kind: "added", text: "pięć" },
    ]);
  });

  it("reports an untouched value as wholly kept", () => {
    // A proposal that carries only a comment leaves the value alone, and the
    // surface tells it apart from a rewrite by exactly this.
    const diff = wordDiff("Ten sam tekst.", "Ten sam tekst.");
    expect(diff.kept).toBe(1);
    expect(diff.parts.every((part) => part.kind === "same")).toBe(true);
  });

  it("separates a light edit from a replacement", () => {
    const light = wordDiff(
      "Wieczór wypełniony muzyką dawną i współczesną.",
      "Wieczór wypełniony muzyką dawną oraz współczesną.",
    );
    const replacement = wordDiff(
      "Wieczór wypełniony muzyką dawną i współczesną.",
      "Zupełnie nowe zdanie o czymś zupełnie innym.",
    );
    expect(light.kept).toBeGreaterThan(0.7);
    expect(replacement.kept).toBeLessThan(0.3);
  });

  it("treats a first translation as wholly new", () => {
    const { parts, kept } = wordDiff("", "The evening opens in silence.");
    expect(parts).toEqual([{ kind: "added", text: "The evening opens in silence." }]);
    expect(kept).toBe(0);
  });
});
