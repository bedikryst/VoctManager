/**
 * @file litany.ts
 * @description The landing plate's names, derived from the `repertoire` collection: each era
 *  reduced to SURNAMES alone, each surname carrying the evenings it sounded at. The catalogue
 *  itself — forenames, life dates, every work — is /koncerty#repertuar; this is its index, so the
 *  plate carries the one field an inscription carries and links to the book for the rest.
 *
 *  DERIVED, never a second list. A composer reaches the landing by being catalogued, which is
 *  the only way the plate can stay true as concerts are added: a hand-kept copy would drift
 *  from the catalogue silently, and the drift would be invisible (both surfaces look right in
 *  isolation).
 *
 *  THE JOIN IS THE LONGEST SURNAME A PROGRAMME ENDS WITH, and the superlative is load-bearing
 *  rather than defensive. The two files name the same people differently — the catalogue writes
 *  "Nazwisko, Imię" and a programme writes the name as it was printed ("Arvo Pärt", "J. S. Bach",
 *  "Giovanni P. da Palestrina") — so there is no shared key to join on. The catalogue holds BOTH
 *  "Williams, John" and "Vaughan Williams, Ralph": a substring test credits the Hymn to the Fallen
 *  to both men, and a last-token test credits it to the wrong one. Taking the longest catalogue
 *  surname the printed name ends with separates them, and it needs no hand-kept table.
 *
 *  Surnames are compared as written, folding case and whitespace and nothing else. Two names in
 *  this catalogue differ only by diacritic away from colliding, so a fold would trade a rare miss
 *  for a rare wrong answer. The cost is that a programme misspelling a diacritic simply fails to
 *  match, and the plate then prints the catalogue fallback for that name rather than an evening —
 *  quiet, so check a new programme's spelling against the catalogue rather than against the page.
 * @architecture Astro islands 2026
 * @module lib/litany
 */
import type { CollectionEntry } from "astro:content";

/** One name on the plate: what is inscribed, and where the page can say it sounded. */
export interface LitanyName {
  /** Surname, as the plate prints it. */
  readonly surname: string;
  /** Evenings that sang it, in the register's own order — empty for a catalogued composer none
   *  of those programmes records. */
  readonly at: readonly string[];
}

export interface LitanyBand {
  id: string;
  /** Era name — the catalogue's own, e.g. "Renesans". */
  title: string;
  /** Era span — the catalogue's own, e.g. "XV–XVI w.". */
  span: string;
  /** Names, in catalogue order. */
  names: LitanyName[];
}

/** An evening the page is willing to name, with the composers its programme lists. */
export interface LitanyEvening {
  readonly title: string;
  readonly composers: readonly string[];
}

/**
 * Where the surname alone loses the identity the name is read by. Keyed on the catalogue's
 * exact string, so a rename there surfaces as a missing override rather than a silent revert.
 */
const SHORT_FORMS: Record<string, string> = {
  // Read under the Latin byname on every concert leaf the ensemble has printed; "Handl" alone
  // names someone the audience has not heard of.
  "Handl, Jacob (Gallus)": "Handl (Gallus)",
};

/**
 * Entries that are not names. The plate's unit is a name, and an attribution like
 * "Anonim / tradycyjne" is the absence of one — set in a row of surnames it reads as a
 * composer called Anonim. The works behind it (Llibre Vermell, tradycja oksytańska,
 * polifonia korsykańska) are real and stay in the catalogue, which is where the plate's foot
 * sends the reader. Matched rather than keyed on the `tradycja` era, so a future named
 * composer in that era appears on its own and an anonymous entry elsewhere is caught.
 */
const ANONYMOUS = /^anonim/i;

function surname(composer: string): string {
  const short = SHORT_FORMS[composer];
  if (short) return short;
  const comma = composer.indexOf(",");
  return comma === -1 ? composer.trim() : composer.slice(0, comma).trim();
}

/** Case and whitespace only — see the header on why the diacritics stay. */
function key(name: string): string {
  return name.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Catalogue surname → the evenings whose programmes end a name with it. Built once for the whole
 * plate, because the walk is over the programmes and the answer is wanted per name.
 */
function sungAt(surnames: readonly string[], evenings: readonly LitanyEvening[]): Map<string, string[]> {
  const bySurname = new Map<string, string>();
  for (const name of surnames) {
    const folded = key(name);
    const clash = bySurname.get(folded);
    // Two catalogue entries reducing to one surname would make the join a coin toss, and the
    // wrong answer would look exactly like the right one. Fail the build instead: the fix is a
    // SHORT_FORMS entry telling the two apart, the way the Latin byname already tells Handl.
    if (clash) {
      throw new Error(
        `[litany] "${clash}" and "${name}" reduce to one surname, so no programme can be` +
          ` attributed to either. Give one of them a SHORT_FORMS entry.`,
      );
    }
    bySurname.set(folded, name);
  }

  const sung = new Map<string, string[]>(surnames.map((name) => [name, []]));
  for (const evening of evenings) {
    for (const composer of evening.composers) {
      const tokens = composer.trim().split(/\s+/);
      // Longest suffix first: "Ralph Vaughan Williams" must reach "Vaughan Williams" before it
      // reaches "Williams".
      for (let start = 0; start < tokens.length; start += 1) {
        const hit = bySurname.get(key(tokens.slice(start).join(" ")));
        if (!hit) continue;
        const at = sung.get(hit);
        // A composer with two works in one evening sounded at ONE evening.
        if (at && !at.includes(evening.title)) at.push(evening.title);
        break;
      }
    }
  }
  return sung;
}

/**
 * Eras in catalogue order, each carrying its named composers. An era left with no names after
 * the anonymous filter is dropped: a ruled head over an empty measure is the void the plate
 * exists to fill.
 */
export function litanyBands(
  eras: CollectionEntry<"repertoire">[],
  evenings: readonly LitanyEvening[],
): LitanyBand[] {
  const ordered = eras.slice().sort((a, b) => a.data.order - b.data.order);
  const surnames = ordered.flatMap((era) =>
    era.data.entries
      .filter((entry) => !ANONYMOUS.test(entry.composer))
      .map((entry) => surname(entry.composer)),
  );
  const sung = sungAt(surnames, evenings);

  return ordered
    .map((era) => ({
      id: era.id,
      title: era.data.title,
      span: era.data.span,
      names: era.data.entries
        .filter((entry) => !ANONYMOUS.test(entry.composer))
        .map((entry) => {
          const name = surname(entry.composer);
          return { surname: name, at: sung.get(name) ?? [] };
        }),
    }))
    .filter((band) => band.names.length > 0);
}
