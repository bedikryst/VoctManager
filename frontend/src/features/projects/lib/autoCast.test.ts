/**
 * @file autoCast.test.ts
 * @description What the automatic fill may and may not write onto a board.
 *
 * The rule's whole value is that it does not guess, so the cases that matter
 * are the ones where it declines: a divided family, a voice type that sits in
 * two of them, and — the reason this file exists — an instrumentalist. A
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
