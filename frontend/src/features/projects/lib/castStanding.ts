/**
 * @file castStanding.ts
 * @description Where each cast seat stands on the invitation — confirmed,
 * awaiting an answer, or declined — and the one rule every count on the cast
 * tab reads it through: the status filter's segments and rows, the section
 * headers and the balance rail. A segment's count is the rows it shows, and a
 * section header and the rail's figure for that section are the same number.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/lib/castStanding
 */

import type { ParticipationStatus } from "@/shared/types";

export type CastStanding = "confirmed" | "awaiting" | "declined";

export const castStandingOf = (status: ParticipationStatus): CastStanding => {
  if (status === "CON") return "confirmed";
  if (status === "DEC") return "declined";
  return "awaiting";
};

/** The cast tab's status segment. */
export type CastStatusFilter = "ALL" | "AWAITING" | "DECLINED";

export const CAST_STATUS_FILTERS: readonly CastStatusFilter[] = [
  "ALL",
  "AWAITING",
  "DECLINED",
];

/** Whether a seat is a row under this segment — and so part of its count. */
export const matchesCastStatusFilter = (
  status: ParticipationStatus,
  filter: CastStatusFilter,
): boolean => {
  if (filter === "AWAITING") return castStandingOf(status) === "awaiting";
  if (filter === "DECLINED") return castStandingOf(status) === "declined";
  return true;
};

export interface StandingTally {
  readonly confirmed: number;
  readonly awaiting: number;
  readonly declined: number;
}

export const tallyStanding = (
  seats: readonly { readonly status: ParticipationStatus }[],
): StandingTally => {
  let confirmed = 0;
  let awaiting = 0;
  let declined = 0;
  for (const seat of seats) {
    const standing = castStandingOf(seat.status);
    if (standing === "confirmed") confirmed += 1;
    else if (standing === "declined") declined += 1;
    else awaiting += 1;
  }
  return { confirmed, awaiting, declined };
};

/**
 * What a group's figure reads. Once the project is published the main figure
 * is who confirmed, and the unanswered invitations stand beside it. Before
 * publication nobody has been asked, so an invitation is not a doubt: every
 * seat that is not declined is the figure, and nothing stands beside it.
 * Declines never count — a singer who said no is not cover.
 */
export interface StandingFigures {
  readonly main: number;
  readonly awaiting: number;
}

export const standingFigures = (
  tally: StandingTally,
  answersShown: boolean,
): StandingFigures =>
  answersShown
    ? { main: tally.confirmed, awaiting: tally.awaiting }
    : { main: tally.confirmed + tally.awaiting, awaiting: 0 };
