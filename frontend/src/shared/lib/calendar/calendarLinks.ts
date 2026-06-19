/**
 * @file calendarLinks.ts
 * @description Client-side calendar export — a Google Calendar template URL and
 * an RFC-5545 .ics blob, generated in the browser so a chorister can drop a
 * single rehearsal/concert into their phone calendar without any backend round
 * trip. (The whole-season subscription lives in Settings → Calendar.)
 */

export interface CalendarEventInput {
  title: string;
  start: Date;
  /** Optional explicit end; defaults to start + DEFAULT_DURATION_MS. */
  end?: Date;
  description?: string;
  location?: string;
  /** Stable identifier for the VEVENT UID (e.g. the timeline event id). */
  uid: string;
}

// Neither rehearsals nor projects carry an end time, so assume a sensible block.
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

const pad = (value: number): string => String(value).padStart(2, "0");

/** UTC basic format required by both Google's `dates` param and ICS: YYYYMMDDTHHMMSSZ. */
const toUtcStamp = (date: Date): string =>
  `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
  `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;

const resolveEnd = (event: CalendarEventInput): Date =>
  event.end ?? new Date(event.start.getTime() + DEFAULT_DURATION_MS);

/** Escapes text per RFC 5545 (backslash, comma, semicolon, newline). */
const escapeIcsText = (value: string): string =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

export const buildGoogleCalendarUrl = (event: CalendarEventInput): string => {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toUtcStamp(event.start)}/${toUtcStamp(resolveEnd(event))}`,
  });
  if (event.description) params.set("details", event.description);
  if (event.location) params.set("location", event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

export const buildIcsContent = (event: CalendarEventInput): string => {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VoctManager//Schedule//PL",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${event.uid}@voctmanager`,
    `DTSTAMP:${toUtcStamp(new Date())}`,
    `DTSTART:${toUtcStamp(event.start)}`,
    `DTEND:${toUtcStamp(resolveEnd(event))}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
  ];
  if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
};

/** Triggers a browser download of a single-event .ics file. */
export const downloadIcs = (event: CalendarEventInput, filename: string): void => {
  const blob = new Blob([buildIcsContent(event)], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
