/**
 * @file pieceDuration.ts
 * @description Editable clock notation for a piece duration stored in seconds.
 */

type DurationEdit =
  | { valid: true; seconds: number | null }
  | { valid: false };

// PostgreSQL's positive integer column is the upper bound of the stored value.
const MAX_SECONDS = 2_147_483_647;

export function pieceDuration(value: number | null | undefined): string;
export function pieceDuration(value: string): DurationEdit;
export function pieceDuration(value: string | number | null | undefined): string | DurationEdit {
  if (typeof value !== "string") {
    if (!value) return "";
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor(value / 60) % 60;
    const seconds = String(value % 60).padStart(2, "0");
    return hours
      ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
      : `${minutes}:${seconds}`;
  }

  const input = value.trim();
  if (!input) return { valid: true, seconds: null };
  if (!/^\d+(?::[0-5]\d){0,2}$/.test(input)) return { valid: false };

  const parts = input.split(":").map(Number);
  const seconds = parts.length === 1
    ? parts[0] * 60
    : parts.reduce((total, part) => total * 60 + part, 0);
  if (seconds > MAX_SECONDS) return { valid: false };
  return { valid: true, seconds: seconds || null };
}
