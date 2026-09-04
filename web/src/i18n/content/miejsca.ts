/**
 * @file miejsca.ts
 * @description What each building this ensemble has sung in is CALLED, in all three locales. Two
 *  surfaces print it as a heading — a gallery run's head on /koncerty/[id] and the plate's
 *  inscription on /obrazy — and both read it through `placeName`.
 *
 *  WHY A TYPED RECORD AND NOT THE COPY DESK, the same test §6r sets and `repertuar.ts` passes: a
 *  venue's name is a label standing over a run of photographs, one line long, and a run whose head
 *  is missing in French is a broken page rather than one waiting for review. `concerts.yaml`'s
 *  `venue` is not copy and says so in the desk's own not-copy table — it is `schema.org`
 *  `Place.name`, the identity the JSON-LD asserts — so the name a READER meets cannot be stored
 *  there in three languages without making one field mean two things.
 *
 *  WHAT THIS FIXES, because it was shipping wrong: `galleryRuns` took a locale and used it for the
 *  rehearsal's name alone, so every foreign concert page printed its run heads in Polish. An
 *  English reader met "Sacred Heart Basilica, Kraków" in the dateline and "Bazylika NSPJ, Kraków"
 *  three screens down over the photographs of that same evening — one building under two names
 *  inside one document, which is the failure the desk's own translation rule exists to prevent.
 *
 *  THE RENDERINGS ARE THE SITE'S OWN, not fresh ones: `concert.*.metaPlace` in the overlays names
 *  four of these, the 9-kart gallery alt text names Łódź's cathedral and Rybnik's basilica, and
 *  `page.koncerty.coda.lede` names Niedzica's church. A reader who follows a link must not meet the
 *  same building under a second name.
 *
 *  KEYED BY THE POLISH STRING exactly as `concerts.yaml` writes it, so the corpus stays the single
 *  source and a typo there fails the build rather than falling through. The lookup THROWS on a
 *  place nobody has named — an unnamed venue would otherwise print Polish on a French page in
 *  silence, and only the build can say so. Adding a concert with photographs therefore means naming
 *  its room here, in three languages, which is the price of the guarantee.
 * @architecture Astro islands 2026
 * @module i18n/content/miejsca
 */

import type { Locale } from "../config";

/**
 * Keyed by `venue` as `concerts.yaml` holds it — including `gallery[].venue`, which is what a
 * touring evening's runs are named by. The Polish column is the identity map: it exists so the
 * three readings stand in one table, and so a place missing from it fails in Polish too.
 *
 * Szczawnica's manor keeps its Polish name in every locale, which is a decision rather than an
 * omission: `Dworek Gościnny` is the building's own name and the overlays already publish it
 * untranslated in both foreign datelines.
 */
const PLACES: Record<Locale, Readonly<Record<string, string>>> = {
  pl: {
    "Bazylika NSPJ, Kraków": "Bazylika NSPJ, Kraków",
    "Bazylika Mariacka, Kraków": "Bazylika Mariacka, Kraków",
    "Bazylika św. Antoniego, Rybnik": "Bazylika św. Antoniego, Rybnik",
    "Archikatedra, Łódź": "Archikatedra, Łódź",
    "Dworek Gościnny, Szczawnica": "Dworek Gościnny, Szczawnica",
    "Kościół św. Maksymiliana Kolbego, Mistrzejowice":
      "Kościół św. Maksymiliana Kolbego, Mistrzejowice",
    "Kościół św. Bartłomieja, Niedzica": "Kościół św. Bartłomieja, Niedzica",
  },
  en: {
    "Bazylika NSPJ, Kraków": "Sacred Heart Basilica, Kraków",
    "Bazylika Mariacka, Kraków": "St Mary's Basilica, Kraków",
    "Bazylika św. Antoniego, Rybnik": "St Anthony's Basilica, Rybnik",
    "Archikatedra, Łódź": "Łódź Cathedral",
    "Dworek Gościnny, Szczawnica": "Dworek Gościnny, Szczawnica",
    "Kościół św. Maksymiliana Kolbego, Mistrzejowice":
      "St Maximilian Kolbe's Church, Mistrzejowice",
    "Kościół św. Bartłomieja, Niedzica": "St Bartholomew's Church, Niedzica",
  },
  // French hyphenates a dedication and translates the city: Sainte-Marie, Cracovie — both as the
  // concert overlays already publish them.
  fr: {
    "Bazylika NSPJ, Kraków": "Basilique du Sacré-Cœur, Cracovie",
    "Bazylika Mariacka, Kraków": "Basilique Sainte-Marie, Cracovie",
    "Bazylika św. Antoniego, Rybnik": "Basilique Saint-Antoine, Rybnik",
    "Archikatedra, Łódź": "Cathédrale de Łódź",
    "Dworek Gościnny, Szczawnica": "Dworek Gościnny, Szczawnica",
    "Kościół św. Maksymiliana Kolbego, Mistrzejowice":
      "Église Saint-Maximilien-Kolbe, Mistrzejowice",
    "Kościół św. Bartłomieja, Niedzica": "Église Saint-Barthélemy, Niedzica",
  },
};

/** This venue's name in `locale`. Throws on a place nobody has named. */
export function placeName(venue: string, locale: Locale): string {
  const name = PLACES[locale][venue];
  if (!name) {
    throw new Error(
      `[miejsca] venue "${venue}" has no name in ${locale} — add it to src/i18n/content/miejsca.ts.`,
    );
  }
  return name;
}
