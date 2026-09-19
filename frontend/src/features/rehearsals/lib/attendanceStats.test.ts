/**
 * @file attendanceStats.test.ts
 * @description Who a rehearsal summons, on the client's side of the rule.
 *
 * `resolveInvited` is the panel's mirror of `Rehearsal.called_participations`
 * in `backend/roster/models.py`: an explicit list IS the call, an empty one
 * means the whole cast, and the whole cast excludes the players unless the
 * rehearsal calls them. The two implementations have to answer identically —
 * the grid, the tallies and the roll call read this one, and the schedule and
 * the notifications read the other.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/lib/attendanceStats.test
 */

import { describe, expect, it } from "vitest";

import type { Participation, Rehearsal, VoiceType } from "@/shared/types";
import { resolveInvited } from "./attendanceStats";

const seat = (id: string, voiceType: VoiceType): Participation =>
  ({
    id,
    artist: `artist-${id}`,
    project: "project-1",
    status: "CON",
    artist_voice_type: voiceType,
  }) as Participation;

const singer = seat("s1", "SOP" as VoiceType);
const bass = seat("s2", "BAS" as VoiceType);
const organist = seat("p1", "INS" as VoiceType);
const cast = [singer, bass, organist];

const rehearsal = (
  overrides: Partial<Pick<Rehearsal, "invited_participations" | "calls_instrumentalists">> = {},
): Pick<Rehearsal, "invited_participations" | "calls_instrumentalists"> => ({
  invited_participations: [],
  calls_instrumentalists: false,
  ...overrides,
});

const ids = (rows: Participation[]): string[] => rows.map((row) => String(row.id));

describe("resolveInvited", () => {
  it("calls the choir alone by default", () => {
    expect(ids(resolveInvited(rehearsal(), cast))).toEqual(["s1", "s2"]);
  });

  it("calls the players when the rehearsal says so", () => {
    expect(
      ids(resolveInvited(rehearsal({ calls_instrumentalists: true }), cast)),
    ).toEqual(["s1", "s2", "p1"]);
  });

  it("treats a named list as the call, flag or no flag", () => {
    expect(
      ids(resolveInvited(rehearsal({ invited_participations: ["p1"] }), cast)),
    ).toEqual(["p1"]);
  });

  it("leaves a cast without players untouched", () => {
    expect(ids(resolveInvited(rehearsal(), [singer, bass]))).toEqual(["s1", "s2"]);
  });

  it("keeps a seat whose voice type never arrived", () => {
    // A stale cache or a payload without the raw code must not silently drop
    // somebody from the roll call — an unknown voice is not a player.
    const unknown = { id: "u1", artist: "a", project: "p", status: "CON" } as Participation;
    expect(ids(resolveInvited(rehearsal(), [unknown]))).toEqual(["u1"]);
  });
});
