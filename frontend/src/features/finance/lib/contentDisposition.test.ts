/**
 * @file contentDisposition.test.ts
 * @description Pins the saved name of a download whose name has Polish
 * letters: without the RFC 5987 decode, "Łukasz Żółć" is saved as
 * `utf-8Umowa-…%C5%81ukasz….pdf`.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/lib/contentDisposition.test
 */

import { describe, expect, it } from "vitest";

import { filenameFromDisposition } from "./contentDisposition";

describe("filenameFromDisposition", () => {
  it("decodes the RFC 5987 name Django sends for Polish letters", () => {
    expect(
      filenameFromDisposition(
        "attachment; filename*=utf-8''Umowa-UoD-1-2026-%C5%81ukasz_%C5%BB%C3%B3%C5%82%C4%87.pdf",
        "umowa.pdf",
      ),
    ).toBe("Umowa-UoD-1-2026-Łukasz_Żółć.pdf");
  });

  it("prefers the encoded name over a plain one sent beside it", () => {
    expect(
      filenameFromDisposition(
        "attachment; filename=\"Pochwala.pdf\"; filename*=UTF-8''Pochwa%C5%82a.pdf",
        "raport.pdf",
      ),
    ).toBe("Pochwała.pdf");
  });

  it("reads a plain name, quoted or not", () => {
    expect(filenameFromDisposition('attachment; filename="Kosztorys.csv"', "x.csv")).toBe(
      "Kosztorys.csv",
    );
    expect(filenameFromDisposition("attachment; filename=Kosztorys.csv", "x.csv")).toBe(
      "Kosztorys.csv",
    );
  });

  it("falls back to the caller's name", () => {
    expect(filenameFromDisposition(undefined, "raport.pdf")).toBe("raport.pdf");
    expect(filenameFromDisposition("attachment", "raport.pdf")).toBe("raport.pdf");
    expect(filenameFromDisposition("attachment; filename*=utf-8''%E0%A4%A", "raport.pdf")).toBe(
      "raport.pdf",
    );
  });
});
