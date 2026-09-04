/**
 * @file tempusLiturgicus.ts
 * @description Returns the liturgical season for a given date, with a Latin incipit
 *  characteristic for that season. Hard-coded for 2026 & 2027 (Easter 2026: 5 IV;
 *  Easter 2027: 28 III); later years fall back to "Tempus per annum". Promoted from
 *  `islands/landing/lib/` so static Astro components (subpage footers, silence moment)
 *  can read it without pulling a React island.
 *
 *  THE VERNACULAR TIER IS CHROME, NOT COPY, and it is complete in three languages for the reason
 *  §6r of the copy desk gives: five seasons is a closed table the calendar walks on its own, and a
 *  locale missing from one of them is a broken line in a footer that stands under EVERY page —
 *  not a paragraph waiting for review. `Record<Locale, …>` is what makes the compiler say so.
 * @architecture Astro islands 2026
 * @module lib/tempusLiturgicus
 */

import type { Locale } from "../i18n/config";

export interface Tempus {
  readonly lat: string;
  /**
   * The season under its Latin name, in the reader's own tongue.
   *
   * NOT `pl`, which is what this field was called while the footer printed one language: a key
   * named for a locale sitting under a foreign original is the copy desk's `*Pl` trap wearing a
   * nested-key hat (spec §7), and it read as "the Polish of this Latin" right up until a French
   * page needed the same slot. `gloss` is the name the concert corpus already settled on for
   * exactly this relation.
   */
  readonly gloss: Record<Locale, string>;
  /** Liturgical incipit characteristic for the season (Latin, single short phrase). */
  readonly incipit: string;
}

const PER_ANNUM: Tempus = {
  lat: "Tempus per annum",
  gloss: { pl: "okres zwykły", en: "ordinary time", fr: "temps ordinaire" },
  incipit: "Cantate Domino canticum novum",
};
const QUADR: Tempus = {
  lat: "Quadragesima",
  gloss: { pl: "wielki post", en: "Lent", fr: "carême" },
  incipit: "Memento, homo",
};
const PASCHA: Tempus = {
  lat: "Tempus Paschae",
  gloss: { pl: "okres wielkanocny", en: "Eastertide", fr: "temps pascal" },
  incipit: "Surrexit Dominus vere",
};
const ADVENTUS: Tempus = {
  lat: "Adventus",
  gloss: { pl: "adwent", en: "Advent", fr: "avent" },
  incipit: "Rorate caeli desuper",
};
const NATIVIT: Tempus = {
  lat: "Tempus Nativitatis",
  gloss: { pl: "okres narodzenia", en: "Christmastide", fr: "temps de Noël" },
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
