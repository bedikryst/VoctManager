/**
 * @file voiceBar.test.ts
 * @description The voice bar always writes the whole list, keeps layers apart,
 * and never sends a row of an edition the piece no longer has.
 */

import { describe, expect, it } from "vitest";

import type { Piece } from "@/shared/types";
import type { VoiceRequirementDTO } from "../types/archive.dto";
import {
  addLine,
  removeLine,
  setQuantity,
  startEditionLayer,
  voiceLayout,
  voiceToken,
  writableRequirements,
} from "./voiceBar";

const ORDER = ["S1", "S2", "A1", "A2", "T1", "T2", "B1", "B2", "TUTTI"];
const shared = (voice_line: VoiceRequirementDTO["voice_line"], quantity: number): VoiceRequirementDTO =>
  ({ voice_line, quantity, edition: null });
const own = (edition: string, voice_line: VoiceRequirementDTO["voice_line"], quantity: number): VoiceRequirementDTO =>
  ({ voice_line, quantity, edition });

describe("writableRequirements", () => {
  it("drops the rows of a deleted edition and keeps every live layer", () => {
    const piece = {
      editions: [{ id: "carus" }],
      voice_requirements_read: [
        { voice_line: "S1", quantity: 6, edition: null },
        { voice_line: "T1", quantity: 4, edition: "carus" },
        { voice_line: "B1", quantity: 3, edition: "gone" },
      ],
    } as unknown as Pick<Piece, "editions" | "voice_requirements_read">;
    expect(writableRequirements(piece)).toEqual([shared("S1", 6), own("carus", "T1", 4)]);
  });
});

describe("voiceLayout", () => {
  it("is one unlabelled bar in score order below two editions", () => {
    const layout = voiceLayout([shared("B1", 3), shared("S1", 6)], ["only"], ORDER);
    expect(layout.labelled).toBe(false);
    expect(layout.layers).toEqual([{ editionId: null, lines: [shared("S1", 6), shared("B1", 3)], total: 9 }]);
    expect(layout.inheriting).toEqual([]);
  });

  it("labels the layers from two editions on and lists those that inherit", () => {
    const layout = voiceLayout([shared("S1", 6), own("b", "S1", 5)], ["a", "b", "c"], ORDER);
    expect(layout.labelled).toBe(true);
    expect(layout.layers.map((layer) => layer.editionId)).toEqual([null, "b"]);
    expect(layout.inheriting).toEqual(["a", "c"]);
  });

  it("shows an edition's own layer even when it is the piece's only edition", () => {
    const layout = voiceLayout([own("only", "T1", 4)], ["only"], ORDER);
    expect(layout.labelled).toBe(true);
    expect(layout.layers.map((layer) => [layer.editionId, layer.total])).toEqual([[null, 0], ["only", 4]]);
  });

  it("keeps a just-opened edition layer while it is still empty", () => {
    const layout = voiceLayout([], ["a", "b"], ORDER, new Set(["b"]));
    expect(layout.layers.map((layer) => layer.editionId)).toEqual([null, "b"]);
    expect(layout.inheriting).toEqual(["a"]);
  });
});

describe("voiceToken", () => {
  it("drops the index of an undivided family and keeps it on a divided one", () => {
    expect(voiceToken("A1", ["S1", "S2", "A1"])).toBe("A");
    expect(voiceToken("S2", ["S1", "S2", "A1"])).toBe("S2");
    expect(voiceToken("V1", ["V1"])).toBe("V");
  });

  it("leaves the intermediate parts and roles to their names", () => {
    expect(voiceToken("BAR", ["T1", "BAR", "B1"])).toBeNull();
    expect(voiceToken("TUTTI", ["TUTTI"])).toBeNull();
  });
});

describe("edits", () => {
  const list = [shared("S1", 6), own("b", "S1", 5)];

  it("touches only the addressed layer", () => {
    expect(setQuantity(list, "b", "S1", 7)).toEqual([shared("S1", 6), own("b", "S1", 7)]);
    expect(removeLine(list, null, "S1")).toEqual([own("b", "S1", 5)]);
    expect(addLine(list, "b", "T1")).toEqual([...list, own("b", "T1", 1)]);
  });

  it("never asks for fewer than one singer and never repeats a line in a layer", () => {
    expect(setQuantity(list, null, "S1", 0)).toEqual([shared("S1", 1), own("b", "S1", 5)]);
    expect(addLine(list, null, "S1")).toEqual(list);
  });

  it("starts an edition's own layer from the piece-wide lines", () => {
    expect(startEditionLayer([shared("S1", 6), shared("A1", 5)], "c")).toEqual([
      shared("S1", 6), shared("A1", 5), own("c", "S1", 6), own("c", "A1", 5),
    ]);
  });
});
