/**
 * @file calendar.ts
 * @description Warsaw civil time resolved to an instant, and the two things the site asks of it:
 *  a downloadable concert event (text escaped and folded by UTF-8 bytes so long Polish names
 *  cannot corrupt an import), and the moment an evening stops being "ahead".
 *
 *  THE ZONE IS NAMED, NEVER INHERITED. The production build runs in a UTC container, so a bare
 *  `new Date("2026-10-11T23:59:59")` there is two hours into the next Polish day. Every clock
 *  comparison against a corpus date goes through `warsawInstant`.
 * @module lib/calendar
 */

export interface CalendarEvent {
  readonly uid: string;
  readonly title: string;
  readonly date: string;
  readonly time: string;
  /** The slot end published by the organiser, never a duration inferred from the programme. */
  readonly endTime?: string;
  readonly location: string;
  readonly description: string;
  readonly url: string;
}

const utcStamp = (date: Date): string => date.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";

/** Resolve the corpus's local date and hour using the zone's actual daylight-saving rules. */
export function warsawInstant(date: string, time: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    throw new Error("[calendar] Expected an ISO date and HH:MM time.");
  }
  const wall = Date.parse(date + "T" + time + ":00Z");
  if (!Number.isFinite(wall)) throw new Error("[calendar] Invalid concert date.");
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  let instant = wall;
  for (let pass = 0; pass < 2; pass++) {
    const parts = new Map(
      formatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]),
    );
    const viewedAsUtc = Date.UTC(
      Number(parts.get("year")),
      Number(parts.get("month")) - 1,
      Number(parts.get("day")),
      Number(parts.get("hour")),
      Number(parts.get("minute")),
      Number(parts.get("second")),
    );
    instant = wall - (viewedAsUtc - instant);
  }
  if (formatter.format(new Date(instant)) !== date + " " + time + ":00") {
    throw new Error("[calendar] Concert time is not a valid Warsaw civil time.");
  }
  return new Date(instant);
}

export const warsawCalendarDate = (date: string, time: string): string =>
  utcStamp(warsawInstant(date, time));

/** The slice of an evening the "still ahead" rule reads — a corpus entry's data or a tour date. */
export interface EveningClock {
  readonly date: string;
  readonly time?: string | undefined;
  readonly endTime?: string | undefined;
}

/**
 * Whether an evening is still ahead of `now`: until the end of the organiser's slot where one is
 * published, else until the downbeat, else until the last minute of its day — all on Warsaw's
 * clock. `endTime` counts only beside a `time`, the rule `lib/eventSchema` folds it by.
 *
 * Read at build time by every surface that announces "the next concert", so a deploy after the
 * slot closes is what takes the announcement down — the same evening, not the next day.
 */
export const isEveningAhead = (evening: EveningClock, now: Date): boolean => {
  const closesAt = evening.time ? (evening.endTime ?? evening.time) : "23:59";
  return warsawInstant(evening.date, closesAt).getTime() >= now.getTime();
};

const escapeText = (value: string): string =>
  value
    .replaceAll("\\", "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,");

/** Each continuation begins with one space, counted in RFC 5545's 75-octet line limit. */
function foldLine(value: string): string {
  const encoder = new TextEncoder();
  const lines: string[] = [];
  let line = "";
  let bytes = 0;
  for (const character of value) {
    const size = encoder.encode(character).length;
    if (bytes + size > 75) {
      lines.push(line);
      line = " ";
      bytes = 1;
    }
    line += character;
    bytes += size;
  }
  lines.push(line);
  return lines.join("\r\n");
}

export function eventCalendar(event: CalendarEvent, stamp: Date = new Date()): string {
  const start = warsawCalendarDate(event.date, event.time);
  const end = event.endTime ? warsawCalendarDate(event.date, event.endTime) : undefined;
  if (end && end <= start) throw new Error("[calendar] Concert end must follow its start.");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VoctEnsemble//Concert invitation//PL",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    "UID:" + escapeText(event.uid),
    "DTSTAMP:" + utcStamp(stamp),
    "DTSTART:" + start,
    ...(end ? ["DTEND:" + end] : []),
    "SUMMARY:" + escapeText(event.title),
    "LOCATION:" + escapeText(event.location),
    "DESCRIPTION:" + escapeText(event.description),
    "URL:" + event.url,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
