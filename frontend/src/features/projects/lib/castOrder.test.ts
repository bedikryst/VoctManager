/**
 * @file castOrder.test.ts
 * @description The panel's half of a two-implementation contract. The cast is
 * ordered here for the tab and the divisi board, and again in
 * `backend/roster/cast_order.py` for the songbook, the call sheet and the DTP
 * export — so these cases mirror `backend/roster/test_cast_order.py`, and this
 * file fails the moment the two sides start reading the choir differently.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/lib/castOrder.test
 */

import { describe, expect, it } from "vitest";

import type { VoiceLine, VoiceType } from "@/shared/types";
import { byCastOrder, type CastOrderFacts } from "./castOrder";

const singer = (
  displayName: string,
  overrides: Partial<CastOrderFacts> = {},
): CastOrderFacts => ({
  displayName,
  voiceType: "SOP" as VoiceType,
  sectionRank: null,
  isSectionLeader: false,
  seat: "",
  ...overrides,
});

const order = (...cast: readonly CastOrderFacts[]): string[] =>
  [...cast].sort(byCastOrder).map((entry) => entry.displayName);

describe("byCastOrder", () => {
  it("reads an unarranged section alphabetically", () => {
    expect(order(singer("Cecylia"), singer("Antos"), singer("Borys"))).toEqual([
      "Antos",
      "Borys",
      "Cecylia",
    ]);
  });

  it("lets the arrangement decide", () => {
    expect(
      order(
        singer("Antos", { sectionRank: 1 }),
        singer("Borys", { sectionRank: 2 }),
        singer("Cecylia", { sectionRank: 0 }),
      ),
    ).toEqual(["Cecylia", "Antos", "Borys"]);
  });

  it("puts the arrangement above the section leader", () => {
    // The star still heads a section nobody has arranged — see below — but a
    // singer dragged above the leader has to stay there.
    expect(
      order(
        singer("Cecylia", { sectionRank: 1, isSectionLeader: true }),
        singer("Borys", { sectionRank: 0 }),
      ),
    ).toEqual(["Borys", "Cecylia"]);
  });

  it("still heads an unarranged section with its leader", () => {
    expect(
      order(singer("Antos"), singer("Cecylia", { isSectionLeader: true })),
    ).toEqual(["Cecylia", "Antos"]);
  });

  it("puts the arrangement above the line-up seat", () => {
    expect(
      order(
        singer("Cecylia", { sectionRank: 2, seat: "S1" as VoiceLine }),
        singer("Antos", { sectionRank: 0, seat: "S2" as VoiceLine }),
      ),
    ).toEqual(["Antos", "Cecylia"]);
  });

  it("sorts an unarranged singer after every arranged one", () => {
    expect(
      order(
        singer("Antos"),
        singer("Borys", { sectionRank: 1 }),
        singer("Cecylia", { sectionRank: 0 }),
      ),
    ).toEqual(["Cecylia", "Borys", "Antos"]);
  });

  it("keeps ranks of different sections from being compared", () => {
    expect(
      order(
        singer("Zeman", { voiceType: "ALT" as VoiceType, sectionRank: 0 }),
        singer("Antos", { sectionRank: 1 }),
      ),
    ).toEqual(["Antos", "Zeman"]);
  });
});
