/**
 * @file musicalKey.test.ts
 * @description The key shown in each language's notation, and everything it
 * does not recognise shown as stored.
 * @module features/archive/piece-card/musicalKey.test
 */

import { describe, expect, it } from "vitest";

import { displayMusicalKey } from "./musicalKey";

describe("displayMusicalKey", () => {
  it("writes English analysis output in Polish notation", () => {
    expect(displayMusicalKey("C major", "pl")).toBe("C-dur");
    expect(displayMusicalKey("A minor", "pl")).toBe("a-moll");
    expect(displayMusicalKey("F# minor", "pl")).toBe("fis-moll");
    expect(displayMusicalKey("B-flat major", "pl")).toBe("B-dur");
    expect(displayMusicalKey("B minor", "pl")).toBe("h-moll");
    expect(displayMusicalKey("Eb major", "pl")).toBe("Es-dur");
    expect(displayMusicalKey("A flat major", "pl")).toBe("As-dur");
    expect(displayMusicalKey("D♭ major", "pl")).toBe("Des-dur");
  });

  it("reads German and Polish notation", () => {
    expect(displayMusicalKey("D-dur", "pl")).toBe("D-dur");
    expect(displayMusicalKey("h-moll", "en")).toBe("B minor");
    expect(displayMusicalKey("B-dur", "en")).toBe("B♭ major");
    expect(displayMusicalKey("Es-dur", "fr")).toBe("mi bémol majeur");
    expect(displayMusicalKey("cis-moll", "en")).toBe("C♯ minor");
  });

  it("reads French notation", () => {
    expect(displayMusicalKey("si bémol mineur", "pl")).toBe("b-moll");
    expect(displayMusicalKey("ré majeur", "en")).toBe("D major");
  });

  it("leaves anything else as stored", () => {
    expect(displayMusicalKey("D dorian", "pl")).toBe("D dorian");
    expect(displayMusicalKey("C", "pl")).toBe("C");
    expect(displayMusicalKey("Hes-dur", "pl")).toBe("Hes-dur");
    expect(displayMusicalKey("", "pl")).toBe("");
  });
});
