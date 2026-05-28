/**
 * @file asciiSafe.ts
 * @description Strips Polish diacritics and other non-ASCII glyphs so the resulting
 * string survives the Polish 2D QR (KIR) standard, which rejects non-7-bit-ASCII bytes.
 * @architecture Enterprise SaaS 2026
 * @module features/landing/lib/asciiSafe
 */

const DIACRITIC_MAP: Readonly<Record<string, string>> = {
  ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z",
  Ą: "A", Ć: "C", Ę: "E", Ł: "L", Ń: "N", Ó: "O", Ś: "S", Ź: "Z", Ż: "Z",
  "·": "-", "–": "-", "—": "-",
  "“": '"', "”": '"', "„": '"',
  "’": "'", "‘": "'",
};

export function asciiSafe(input: string | null | undefined): string {
  return String(input ?? "")
    .replace(/./g, (ch) => DIACRITIC_MAP[ch] ?? ch)
    .replace(/[^\x20-\x7E]/g, "");
}
