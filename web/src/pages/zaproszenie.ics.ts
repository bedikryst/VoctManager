/**
 * @file zaproszenie.ics.ts
 * @description Downloadable calendar entry for the public invitation, generated from its concert
 *  corpus entry. A local file opens in the guest's calendar without a third-party integration.
 * @module pages/zaproszenie-calendar
 */

import type { APIRoute } from "astro";
import { getEntry } from "astro:content";
import { INVITATION_CONCERT_ID, ZAPROSZENIE } from "../i18n/content/zaproszenie";
import { SITE } from "../i18n/config";
import { eventCalendar } from "../lib/calendar";

export const GET: APIRoute = async () => {
  const entry = await getEntry("concerts", INVITATION_CONCERT_ID);
  if (!entry?.data.date || !entry.data.time) {
    throw new Error("[invitation calendar] Concert needs a date and time.");
  }
  const concert = entry.data;
  const content = eventCalendar({
    uid: INVITATION_CONCERT_ID + "@voctensemble.com",
    title: concert.title + " · VoctEnsemble",
    date: entry.data.date,
    time: entry.data.time,
    endTime: concert.endTime,
    location: [concert.venue, concert.venueNote, concert.address].filter(Boolean).join(", "),
    description: ZAPROSZENIE.actions.calendarDescription,
    url: SITE + "/koncerty/" + INVITATION_CONCERT_ID,
  });
  return new Response(content, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="pochwala-stworzenia.ics"',
    },
  });
};
