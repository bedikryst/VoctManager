/**
 * @file horaeCanonicae.ts
 * @description Eight Benedictine canonical hours of the day, mapped to three-hour slices.
 * Used by the footer signal clock to label the current liturgical hour in Latin + Polish.
 * @architecture Enterprise SaaS 2026
 * @module features/landing/lib/horaeCanonicae
 */

export interface CanonicalHour {
  readonly from: number;
  readonly name: string;
  readonly poem: string;
}

export const HORAE_CANONICAE: readonly CanonicalHour[] = [
  { from: 0, name: "Matutinum", poem: "noc czuwa" },
  { from: 3, name: "Laudes", poem: "świt wstępuje" },
  { from: 6, name: "Prima", poem: "dzień się otwiera" },
  { from: 9, name: "Tertia", poem: "ranek dojrzewa" },
  { from: 12, name: "Sexta", poem: "południe gęstnieje" },
  { from: 15, name: "Nona", poem: "cień się wydłuża" },
  { from: 18, name: "Vesperae", poem: "światło opada" },
  { from: 21, name: "Completorium", poem: "noc się zamyka" },
];

const WARSAW_HOUR_FORMAT = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  hour12: false,
  timeZone: "Europe/Warsaw",
});

export function horaForWarsaw(date: Date): CanonicalHour {
  const hour = parseInt(WARSAW_HOUR_FORMAT.format(date), 10);
  return HORAE_CANONICAE[Math.floor(hour / 3)];
}
