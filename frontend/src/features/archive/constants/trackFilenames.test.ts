/**
 * @file trackFilenames.test.ts
 * @description The filename → voice reading behind the multi-file drop.
 * Guards the two clauses that fail quietly: `(mp3)` is Tutti, and a family
 * letter on a divided family is NOT guessed.
 * @module features/archive/constants/trackFilenames.test
 */

import { describe, expect, it } from "vitest";

import {
  parseTrackFilename,
  resolveVoiceFromPrefix,
} from "@/features/archive/constants/trackFilenames";

const DICTIONARY: ReadonlySet<string> = new Set([
  "S1", "S2", "S3", "A1", "A2", "A3", "T1", "T2", "T3", "B1", "B2", "B3",
  "V1", "V2", "V3", "V4", "SOLO", "TUTTI", "ACC", "BACK", "PRON", "VP",
]);

describe("parseTrackFilename", () => {
  it("splits the bracketed prefix from the title and drops the extension", () => {
    expect(parseTrackFilename("(A1) Locus iste.mp3")).toEqual({
      prefix: "A1",
      title: "Locus iste",
    });
    expect(parseTrackFilename("[b] Locus iste.MP3")).toEqual({
      prefix: "B",
      title: "Locus iste",
    });
  });

  it("returns no prefix for a plain name", () => {
    expect(parseTrackFilename("Locus iste.mp3")).toEqual({
      prefix: null,
      title: "Locus iste",
    });
  });
});

describe("resolveVoiceFromPrefix", () => {
  it("reads (mp3) as Tutti", () => {
    expect(resolveVoiceFromPrefix("MP3", [], DICTIONARY)).toEqual({
      kind: "resolved",
      code: "TUTTI",
    });
  });

  it("takes a full code as is", () => {
    expect(resolveVoiceFromPrefix("A2", ["S1", "A1"], DICTIONARY)).toEqual({
      kind: "resolved",
      code: "A2",
    });
  });

  it("reads a family letter as the piece's single line of that family", () => {
    expect(
      resolveVoiceFromPrefix("B", ["S1", "S2", "A1", "T1", "B2"], DICTIONARY),
    ).toEqual({ kind: "resolved", code: "B2" });
  });

  it("falls back to the four-voice reading when the piece declares nothing", () => {
    expect(resolveVoiceFromPrefix("T", [], DICTIONARY)).toEqual({
      kind: "resolved",
      code: "T1",
    });
  });

  it("refuses to guess on a divided family", () => {
    expect(
      resolveVoiceFromPrefix("S", ["S1", "S2", "A1"], DICTIONARY),
    ).toEqual({ kind: "ambiguous", family: "S", candidates: ["S1", "S2"] });
  });

  it("is unknown for anything else", () => {
    expect(resolveVoiceFromPrefix("DEMO", [], DICTIONARY)).toEqual({
      kind: "unknown",
    });
    expect(resolveVoiceFromPrefix(null, [], DICTIONARY)).toEqual({
      kind: "unknown",
    });
  });
});
