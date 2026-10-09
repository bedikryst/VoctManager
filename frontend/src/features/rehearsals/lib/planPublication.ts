/**
 * @file planPublication.ts
 * @description Where an evening's plan stands with the choir, read off the
 * stamps every rehearsal read carries — so the rail can say it for each
 * evening without the plan's own read, and agree with the band's caption
 * (`usePlanPublication`) about what "changed since the send" means.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/lib/planPublication
 */

import type { Rehearsal } from "@/shared/types";

/**
 * Any row created, edited, moved or deleted after the last send. A deletion
 * leaves no surviving row to carry a newer stamp, so the rehearsal's own
 * `plan_changed_at` is what is compared.
 */
export const isChangedSinceSend = (
  announcedAt: string | null,
  changedAt: string | null,
): boolean =>
  announcedAt !== null &&
  changedAt !== null &&
  new Date(changedAt).getTime() > new Date(announcedAt).getTime();

/** bez planu / szkic / wysłany / zmieniony. */
export type PlanState = "none" | "draft" | "sent" | "changed";

/**
 * One evening's plan as the rail names it. From the downbeat the plan is the
 * evening's record: a tick after the evening bumps `plan_changed_at`, so
 * "changed" is never said of an evening that has started, and a plan that
 * was never sent became public at the downbeat — neither a draft nor sent,
 * so it gets no word at all (null).
 */
export const planStateOf = (
  rehearsal: Pick<Rehearsal, "date_time" | "plan" | "plan_announced_at" | "plan_changed_at">,
  nowMs: number,
): PlanState | null => {
  if ((rehearsal.plan?.length ?? 0) === 0) return "none";
  const hasStarted = new Date(rehearsal.date_time).getTime() <= nowMs;
  const announcedAt = rehearsal.plan_announced_at ?? null;
  if (announcedAt === null) return hasStarted ? null : "draft";
  if (!hasStarted && isChangedSinceSend(announcedAt, rehearsal.plan_changed_at ?? null)) {
    return "changed";
  }
  return "sent";
};
