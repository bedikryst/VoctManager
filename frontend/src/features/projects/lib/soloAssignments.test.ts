/**
 * @file soloAssignments.test.ts
 * @description The two layers of a piece's casting must not leak into each
 * other: the board's payload never carries a legacy solo (the server rejects a
 * SOLO seat outright, so one stray row would fail the whole save), and the solo
 * payload never carries a choral seat. Coverage is counted per position, so one
 * singer on three passages fills three and an open position stays a gap.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/lib/soloAssignments.test
 */

import { describe, expect, it } from "vitest";

import type {
  ParticipationStatus,
  PieceCasting,
  ProjectSoloAssignment,
  VoiceRequirement,
} from "@/shared/types";
import {
  boardCastings,
  choralRequirements,
  declaredSoloCount,
  soloCoverage,
  soloDraftsDiffer,
  soloPerformersByPiece,
  soloRowsFromServer,
  toSoloPayload,
  type SoloDraftRow,
} from "./soloAssignments";

const casting = (overrides: Partial<PieceCasting> = {}): PieceCasting => ({
  id: "c1",
  participation: "p1",
  piece: "piece",
  voice_line: "T1",
  gives_pitch: false,
  ...overrides,
});

const solo = (
  overrides: Partial<ProjectSoloAssignment> = {},
): ProjectSoloAssignment => ({
  id: "s1",
  project: "project",
  piece: "piece",
  position: 0,
  label: "Soprano at mark 7",
  score_reference: "",
  participation: "p1",
  notes: "",
  gives_pitch: false,
  reference_edition: null,
  artist_name: "Ada Singer",
  reference_needs_review: false,
  ...overrides,
});

const row = (overrides: Partial<SoloDraftRow> = {}): SoloDraftRow => ({
  key: "s1",
  id: "s1",
  label: "Solo",
  scoreReference: "",
  participation: "p1",
  notes: "",
  givesPitch: false,
  referenceNeedsReview: false,
  ...overrides,
});

const statuses: Record<string, ParticipationStatus> = {
  p1: "CON",
  p2: "DEC",
};
const statusOf = (id: string): ParticipationStatus | undefined => statuses[id];

describe("board isolation", () => {
  it("keeps a legacy solo off the board a singer also sings T1 on", () => {
    const rows = [
      casting({ id: "choir", voice_line: "T1" }),
      casting({ id: "legacy", voice_line: "SOLO" }),
    ];

    expect(boardCastings(rows).map((item) => item.id)).toEqual(["choir"]);
  });

  it("does not seat anyone against a declared solo count", () => {
    const requirements: VoiceRequirement[] = [
      { voice_line: "S1", quantity: 4 } as VoiceRequirement,
      { voice_line: "SOLO", quantity: 2 } as VoiceRequirement,
    ];

    expect(choralRequirements(requirements).map((r) => r.voice_line)).toEqual([
      "S1",
    ]);
    expect(declaredSoloCount(requirements)).toBe(2);
  });

  it("sends named positions only, in the order shown, keeping saved ids", () => {
    const payload = toSoloPayload([
      row({ key: "b", id: "b", label: " Second " }),
      row({ key: "temp-1", id: null, label: "New", participation: null }),
      row({ key: "a", id: "a", label: "First" }),
    ]);

    expect(payload).toEqual([
      expect.objectContaining({ id: "b", label: "Second", position: 0 }),
      expect.not.objectContaining({ id: expect.anything() }),
      expect.objectContaining({ id: "a", position: 2 }),
    ]);
    expect(payload[1]).toMatchObject({ participation: null, position: 1 });
    payload.forEach((entry) => expect(entry).not.toHaveProperty("voice_line"));
  });
});

describe("coverage per position", () => {
  it("counts one singer on two simultaneous solos twice and an open third as a gap", () => {
    const rows = [
      row({ key: "a", participation: "p1" }),
      row({ key: "b", participation: "p1" }),
      row({ key: "c", participation: null }),
    ];

    expect(soloCoverage(rows, 0, statusOf)).toEqual({
      filled: 2,
      total: 3,
      legacy: 0,
    });
  });

  it("treats a performer who declined as an open position", () => {
    expect(soloCoverage([row({ participation: "p2" })], 1, statusOf)).toEqual({
      filled: 0,
      total: 1,
      legacy: 1,
    });
  });

  it("names each performer once per piece across named and legacy solos", () => {
    const performers = soloPerformersByPiece(
      [
        solo({ id: "a" }),
        solo({ id: "b" }),
        solo({ id: "c", participation: null }),
      ],
      [casting({ voice_line: "SOLO", participation: "p3" })],
    );

    expect([...(performers.get("piece") ?? [])].sort()).toEqual(["p1", "p3"]);
  });
});

describe("draft comparison", () => {
  it("reads a reorder as a change and a server echo as none", () => {
    const saved = soloRowsFromServer([
      solo({ id: "a", position: 1 }),
      solo({ id: "b", position: 0 }),
    ]);

    expect(saved.map((item) => item.id)).toEqual(["b", "a"]);
    expect(soloDraftsDiffer(saved, saved)).toBe(false);
    expect(soloDraftsDiffer([...saved].reverse(), saved)).toBe(true);
  });
});
