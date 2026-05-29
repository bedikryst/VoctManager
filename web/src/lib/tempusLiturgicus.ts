/**
 * @file tempusLiturgicus.ts
 * @description Returns the liturgical season for a given date, with a Latin incipit
 *  characteristic for that season. Hard-coded for 2026 & 2027 (Easter 2026: 5 IV;
 *  Easter 2027: 28 III); later years fall back to "Tempus per annum". Promoted from
 *  `islands/landing/lib/` so static Astro components (subpage footers, silence moment)
 *  can read it without pulling a React island.
 * @architecture Astro islands 2026
 * @module lib/tempusLiturgicus
 */

export interface Tempus {
  readonly lat: string;
  readonly pl: string;
  /** Liturgical incipit characteristic for the season (Latin, single short phrase). */
  readonly incipit: string;
}

const PER_ANNUM: Tempus = {
  lat: "Tempus per annum",
  pl: "okres zwykły",
  incipit: "Cantate Domino canticum novum",
};
const QUADR: Tempus = {
  lat: "Quadragesima",
  pl: "wielki post",
  incipit: "Memento, homo",
};
const PASCHA: Tempus = {
  lat: "Tempus Paschae",
  pl: "okres wielkanocny",
  incipit: "Surrexit Dominus vere",
};
const ADVENTUS: Tempus = {
  lat: "Adventus",
  pl: "adwent",
  incipit: "Rorate caeli desuper",
};
const NATIVIT: Tempus = {
  lat: "Tempus Nativitatis",
  pl: "okres narodzenia",
  incipit: "Puer natus est nobis",
};

export function tempusForDate(date: Date): Tempus {
  const y = date.getFullYear();
  const md = (date.getMonth() + 1) * 100 + date.getDate();

  if (y === 2026) {
    if (md < 218) return PER_ANNUM;
    if (md < 405) return QUADR;
    if (md < 524) return PASCHA;
    if (md < 1129) return PER_ANNUM;
    if (md < 1225) return ADVENTUS;
    return NATIVIT;
  }
  if (y === 2027) {
    if (md < 111) return NATIVIT;
    if (md < 210) return PER_ANNUM;
    if (md < 328) return QUADR;
    if (md < 516) return PASCHA;
    if (md < 1128) return PER_ANNUM;
    if (md < 1225) return ADVENTUS;
    return NATIVIT;
  }
  return PER_ANNUM;
}
