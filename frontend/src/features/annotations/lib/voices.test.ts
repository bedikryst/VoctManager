/**
 * @file voices.test.ts
 * @description The client's reading of a mark's voices, held to the server's
 * (`archive/annotation_voices.py`): SATB order, tutti spelled one way, and a
 * reader with no section addressed by everything.
 * @module features/annotations/lib
 */

import { describe, expect, it } from "vitest";

import {
  addressesSections,
  canonicalVoices,
  isAddressedTo,
  layerTakesVoices,
  reachesSections,
  sameVoices,
  toggleVoice,
} from "./voices";

describe("canonicalVoices", () => {
  it("orders, dedupes and drops what is not a section", () => {
    expect(canonicalVoices(["T", "S", "T", "S1", 3])).toEqual(["S", "T"]);
  });

  it("reads all four sections, and nothing at all, as tutti", () => {
    expect(canonicalVoices(["B", "T", "A", "S"])).toEqual([]);
    expect(canonicalVoices(undefined)).toEqual([]);
  });
});

describe("addressesSections", () => {
  it("reaches a reader whose letters share a section with the mark", () => {
    expect(addressesSections(["T"], "TB")).toBe(true);
    expect(addressesSections(["T"], "S")).toBe(false);
  });

  it("reaches everyone with a tutti mark, and a reader with no section with any", () => {
    expect(addressesSections([], "S")).toBe(true);
    expect(addressesSections(["T"], "")).toBe(true);
  });
});

describe("isAddressedTo", () => {
  it("always shows the reader their own marks", () => {
    const own = { layer_name: "shared", voices: ["T"], created_by: "me" };
    expect(isAddressedTo(own, "S", "me")).toBe(true);
    expect(isAddressedTo(own, "S", "someone-else")).toBe(false);
  });
});

describe("reachesSections", () => {
  it("filters the choir's layer by voice, and reads a leader cue's voice as a label", () => {
    expect(reachesSections({ layer_name: "shared", voices: ["T"] }, "S")).toBe(false);
    expect(reachesSections({ layer_name: "leader", voices: ["T"] }, "S")).toBe(true);
  });
});

describe("toggleVoice", () => {
  it("adds and removes one section, and four sections become tutti", () => {
    expect(toggleVoice([], "T")).toEqual(["T"]);
    expect(toggleVoice(["S", "T"], "S")).toEqual(["T"]);
    expect(toggleVoice(["S", "A", "T"], "B")).toEqual([]);
  });
});

describe("layerTakesVoices / sameVoices", () => {
  it("offers voices on the choir's and the leader's layers only", () => {
    expect(layerTakesVoices("shared")).toBe(true);
    expect(layerTakesVoices("leader")).toBe(true);
    expect(layerTakesVoices("personal")).toBe(false);
    expect(layerTakesVoices("conductor")).toBe(false);
  });

  it("compares audiences, not spellings", () => {
    expect(sameVoices(["T", "S"], ["S", "T"])).toBe(true);
    expect(sameVoices(undefined, ["S", "A", "T", "B"])).toBe(true);
    expect(sameVoices(["S"], [])).toBe(false);
  });
});
