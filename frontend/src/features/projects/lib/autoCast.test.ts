/**
 * @file autoCast.test.ts
 * @description What the automatic fill may and may not write onto a board.
 *
 * The rule's whole value is that it does not guess, so the cases that matter
 * are the ones where it declines: a divided family, a voice type that sits in
 * two of them, a conductor, and — the reason this file exists — an
 * instrumentalist. The one split it does read is the baritone's: the upper
 * line of a B1/B2 bass divisi; the basses' split is left to their seats. A
 * player has no choral family, and before `resolveAutoSeat` decided them
 * first, they fell through to the TUTTI fallback: the fill would have written
 * a sung part for the organist on every a cappella motet that declares one.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/lib/autoCast.test
 */

import { describe, expect, it } from "vitest";

import type { VoiceLine, VoiceType } from "@/shared/types";
import { resolveAutoSeat, type LineUpMember } from "./autoCast";

const member = (overrides: Partial<LineUpMember> = {}): LineUpMember => ({
  participationId: "p1",
  voiceType: "SOP" as VoiceType,
  seat: null,
  status: "CON",
  ...overrides,
});

const player = (overrides: Partial<LineUpMember> = {}): LineUpMember =>
  member({ voiceType: "INS" as VoiceType, ...overrides });

const lines = (...values: string[]): readonly VoiceLine[] =>
  values as VoiceLine[];

describe("resolveAutoSeat — singers", () => {
  it("honours the line-up seat the piece declares", () => {
    expect(
      resolveAutoSeat(member({ seat: "S2" as VoiceLine }), lines("S1", "S2")),
    ).toBe("S2");
  });

  it("takes the family's only line", () => {
    expect(resolveAutoSeat(member(), lines("S1", "A1"))).toBe("S1");
  });

  it("declines a divided family the line-up did not split", () => {
    expect(resolveAutoSeat(member(), lines("S1", "S2"))).toBeNull();
  });

  it("falls back to TUTTI when nothing of their family is declared", () => {
    expect(resolveAutoSeat(member(), lines("TUTTI"))).toBe("TUTTI");
  });

  it("seats a mezzo on the mezzo line only where the arrangement writes one", () => {
    const mezzo = member({ voiceType: "MEZ" as VoiceType });
    expect(resolveAutoSeat(mezzo, lines("S1", "MS", "A1"))).toBe("MS");
    // An SATB piece: S2 or A1 is the conductor's call, not the rule's.
    expect(resolveAutoSeat(mezzo, lines("S1", "S2", "A1", "T1", "B1"))).toBeNull();
    expect(resolveAutoSeat(mezzo, lines())).toBeNull();
  });

  it("does not count the mezzo line as a second soprano", () => {
    expect(resolveAutoSeat(member(), lines("S1", "MS", "A1"))).toBe("S1");
  });

  it("seats a baritone by the line-up everywhere but a part written for him", () => {
    // The concert's line-up: baritones on B1, as the conductor sets them.
    const baritone = member({ voiceType: "BAR" as VoiceType, seat: "B1" as VoiceLine });
    expect(resolveAutoSeat(baritone, lines("T1", "T2", "B1", "B2"))).toBe("B1");
    expect(resolveAutoSeat(baritone, lines())).toBe("B1");
    // The one piece that writes a baritone part gets him there.
    expect(resolveAutoSeat(baritone, lines("T1", "BAR", "B1"))).toBe("BAR");
    const mezzo = member({ voiceType: "MEZ" as VoiceType, seat: "S2" as VoiceLine });
    expect(resolveAutoSeat(mezzo, lines("S1", "S2", "MS", "A1"))).toBe("MS");
  });

  it("honours a bass's seat where no part of his own is written", () => {
    const bass = member({ voiceType: "BAS" as VoiceType, seat: "B2" as VoiceLine });
    expect(resolveAutoSeat(bass, lines("T1", "BAR", "B1", "B2"))).toBe("B2");
  });

  it("sings a baritone as a bass where no baritone part is written", () => {
    const baritone = member({ voiceType: "BAR" as VoiceType });
    expect(resolveAutoSeat(baritone, lines("S1", "A1", "T1", "B1"))).toBe("B1");
    expect(resolveAutoSeat(baritone, lines())).toBe("B1");
    const seated = member({ voiceType: "BAS" as VoiceType, seat: "BAR" as VoiceLine });
    expect(resolveAutoSeat(seated, lines("S1", "A1", "T1", "B1"))).toBe("B1");
  });

  it("puts the baritone on the upper line of a B1/B2 split", () => {
    const bassLines = lines("S1", "A1", "T1", "B1", "B2");
    expect(resolveAutoSeat(member({ voiceType: "BAR" as VoiceType }), bassLines)).toBe("B1");
    const seated = member({ voiceType: "BAS" as VoiceType, seat: "BAR" as VoiceLine });
    expect(resolveAutoSeat(seated, bassLines)).toBe("B1");
  });

  it("leaves the basses' B1/B2 split to their seats", () => {
    // Four basses and no baritone: who sings the upper line is the conductor's call.
    const bass = member({ voiceType: "BAS" as VoiceType });
    expect(resolveAutoSeat(bass, lines("B1", "B2"))).toBeNull();
    const seated = member({ voiceType: "BAS" as VoiceType, seat: "B2" as VoiceLine });
    expect(resolveAutoSeat(seated, lines("B1", "B2"))).toBe("B2");
  });

  it("leaves a three-way bass divisi to the conductor", () => {
    const bassLines = lines("B1", "B2", "B3");
    expect(resolveAutoSeat(member({ voiceType: "BAR" as VoiceType }), bassLines)).toBeNull();
    expect(resolveAutoSeat(member({ voiceType: "BAS" as VoiceType }), bassLines)).toBeNull();
  });

  it("never places the conductor, not even on a unison piece", () => {
    const conductor = member({ voiceType: "DIR" as VoiceType });
    expect(resolveAutoSeat(conductor, lines("TUTTI"))).toBeNull();
    expect(resolveAutoSeat(conductor, lines())).toBeNull();
  });
});

describe("resolveAutoSeat — instrumentalists", () => {
  it("seats a player on the accompaniment line", () => {
    expect(resolveAutoSeat(player(), lines("S1", "A1", "ACC"))).toBe("ACC");
  });

  it("leaves a player unseated where the piece declares no accompaniment", () => {
    expect(resolveAutoSeat(player(), lines("S1", "A1"))).toBeNull();
  });

  it("never hands a player the sung TUTTI part", () => {
    expect(resolveAutoSeat(player(), lines("TUTTI"))).toBeNull();
  });

  it("does not seat a player on a piece with no divisi on record", () => {
    // Nothing declared means a plain four-part reading, which is four vocal
    // lines and no accompaniment — an organ part would be invented here.
    expect(resolveAutoSeat(player(), lines())).toBeNull();
  });

  it("still refuses a declined seat", () => {
    expect(resolveAutoSeat(player({ status: "DEC" }), lines("ACC"))).toBeNull();
  });
});
