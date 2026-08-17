/**
 * @file timezone.ts
 * @description Enterprise native timezone utilities.
 */

export const getAvailableTimezones = (): string[] => {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch (error) {
    return ["UTC", "Europe/Warsaw", "Europe/London", "America/New_York"];
  }
};

const WALL_CLOCK_PARTS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

/**
 * The `yyyy-MM-ddTHH:mm` an instant reads as on a given zone's clock — the same
 * wall-clock contract the panel's date fields speak, so a moment and a range can
 * be compared as plain strings.
 *
 * This is what lets "away until the 21st" mean the 21st at the venue rather than
 * in the browser's own zone. Built from `formatToParts` rather than a locale
 * whose short date happens to be ISO-shaped.
 */
export const toZonedWallClock = (value: Date, timeZone?: string): string => {
  if (Number.isNaN(value.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-GB", {
    ...WALL_CLOCK_PARTS,
    ...(timeZone ? { timeZone } : {}),
  }).formatToParts(value);

  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";

  // Some engines render midnight as hour 24 under `hour12: false`.
  const hour = read("hour") === "24" ? "00" : read("hour");

  return `${read("year")}-${read("month")}-${read("day")}T${hour}:${read("minute")}`;
};
