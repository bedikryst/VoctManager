/**
 * @file absenceWindow.ts
 * @description How long a rehearsal stays the chorister's own to answer for.
 * The server owns this rule (`roster/domain/attendance_window.py`); this mirrors
 * it for one purpose only — so the count a span states before it is sent is the
 * count the write comes back with. A client that counted evenings the server
 * will refuse would promise a fortnight and deliver a week.
 * @architecture Enterprise SaaS 2026
 * @module features/schedule/lib/absenceWindow
 */

import { toZonedWallClock } from "@/shared/lib/time/timezone";

/** The calendar day an instant falls on at the venue, as `yyyy-MM-dd`. */
const dayAtVenue = (value: Date, timeZone?: string): string =>
  toZonedWallClock(value, timeZone).slice(0, 10);

/**
 * True while the artist may still write this rehearsal's attendance themselves.
 *
 * The boundary is the rehearsal's own calendar day on the venue clock, so an
 * evening under way is still a report ("I'm running late", "I never made it")
 * and yesterday's is the roll call's record, which only a manager may rewrite.
 */
export const isOpenToSelfReport = (
  startsAt: Date,
  timeZone?: string,
  now: Date = new Date(),
): boolean => dayAtVenue(startsAt, timeZone) >= dayAtVenue(now, timeZone);
