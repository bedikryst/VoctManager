/**
 * @file zaproszenie.ics.ts
 * @description Downloadable calendar entry for the public invitation, generated from the evening
 *  the invitation names: its concert's next performance laid over the corpus row (lib/cycle).
 *  A local file opens in the guest's calendar without a third-party integration.
 * @module pages/zaproszenie-calendar
 */

import type { APIRoute } from "astro";
import { getEntry } from "astro:content";
import { fill } from "../i18n/content/koncert";
import { INVITATION_CONCERT_ID, ZAPROSZENIE, frameTemplate } from "../i18n/content/zaproszenie";
import { SITE } from "../i18n/config";
import { eventCalendar } from "../lib/calendar";
import { currentPerformance } from "../lib/cycle";

/** A clause the page sets mid-line ("w ramach cyklu…"), opening a sentence in the note. */
const sentence = (text: string): string => `${text.charAt(0).toLocaleUpperCase("pl")}${text.slice(1)}.`;

export const GET: APIRoute = async () => {
  const entry = await getEntry("concerts", INVITATION_CONCERT_ID);
  if (!entry) throw new Error(`[invitation calendar] No concert "${INVITATION_CONCERT_ID}" in the corpus.`);
  const concert = currentPerformance(entry).data;
  if (!concert.date || !concert.time) {
    throw new Error("[invitation calendar] Concert needs a date and time.");
  }
  const { inside } = ZAPROSZENIE;
  const content = eventCalendar({
    // One event per evening: an entry saved for an earlier night of the programme is not
    // overwritten by this one.
    uid: `${INVITATION_CONCERT_ID}-${concert.date}@voctensemble.com`,
    title: concert.title + " · VoctEnsemble",
    date: concert.date,
    time: concert.time,
    endTime: concert.endTime,
    location: [concert.venue, concert.venueNote, concert.address].filter(Boolean).join(", "),
    description: [
      ZAPROSZENIE.actions.calendarDescription,
      concert.admission === "free" ? ZAPROSZENIE.meta.free : "",
      concert.venueNote ? `${concert.venueNote}.` : "",
      concert.festival ? sentence(fill(frameTemplate(concert.festival), { name: concert.festival.name })) : "",
      concert.organizer ? `${fill(inside.organizer, { name: concert.organizer })}.` : "",
    ].filter(Boolean).join(" "),
    url: SITE + "/koncerty/" + INVITATION_CONCERT_ID,
  });
  return new Response(content, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="pochwala-stworzenia.ics"',
    },
  });
};
