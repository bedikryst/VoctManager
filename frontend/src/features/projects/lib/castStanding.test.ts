/**
 * @file castStanding.test.ts
 * @description The cast tab's filter, section headers and balance rail all
 * count seats through `castStanding`; these cases pin the rule they share.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/lib/castStanding.test
 */

import { describe, expect, it } from "vitest";

import type { ParticipationStatus } from "@/shared/types";
import {
  CAST_STATUS_FILTERS,
  matchesCastStatusFilter,
  standingFigures,
  tallyStanding,
} from "./castStanding";

const seats = (
  ...statuses: readonly ParticipationStatus[]
): { status: ParticipationStatus }[] => statuses.map((status) => ({ status }));

describe("matchesCastStatusFilter", () => {
  const cast = seats("CON", "CON", "INV", "DEC", "INV");

  it("lets every seat through under ALL, declines included", () => {
    expect(
      cast.filter((seat) => matchesCastStatusFilter(seat.status, "ALL")),
    ).toHaveLength(5);
  });

  it("partitions the cast between the three standings", () => {
    const awaiting = cast.filter((seat) =>
      matchesCastStatusFilter(seat.status, "AWAITING"),
    );
    const declined = cast.filter((seat) =>
      matchesCastStatusFilter(seat.status, "DECLINED"),
    );
    const tally = tallyStanding(cast);

    expect(awaiting).toHaveLength(tally.awaiting);
    expect(declined).toHaveLength(tally.declined);
    expect(tally).toEqual({ confirmed: 2, awaiting: 2, declined: 1 });
  });

  it("offers the segments in reading order", () => {
    expect(CAST_STATUS_FILTERS).toEqual(["ALL", "AWAITING", "DECLINED"]);
  });
});

describe("standingFigures", () => {
  const tally = tallyStanding(seats("CON", "CON", "CON", "INV", "INV", "DEC"));

  it("leads with who confirmed once the project is published", () => {
    expect(standingFigures(tally, true)).toEqual({ main: 3, awaiting: 2 });
  });

  it("counts every seat not declined before publication", () => {
    expect(standingFigures(tally, false)).toEqual({ main: 5, awaiting: 0 });
  });

  it("never counts a decline as cover", () => {
    const declinedOnly = tallyStanding(seats("DEC", "DEC"));
    expect(standingFigures(declinedOnly, true)).toEqual({
      main: 0,
      awaiting: 0,
    });
    expect(standingFigures(declinedOnly, false)).toEqual({
      main: 0,
      awaiting: 0,
    });
  });
});
