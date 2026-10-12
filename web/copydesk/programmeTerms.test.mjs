// @ts-check
/**
 * @file programmeTerms.test.mjs
 * @description Part of `npm run test:copydesk`. The programme line's conventions — life dates,
 *  datings, scoring, attributions — are the half of the copy decision that is NOT on the desk
 *  (copydesk/contract.mjs `NOT_COPY`), so this is where they are held: the renderings themselves,
 *  and a walk over both corpora proving every value the site prints has an English and a French
 *  form. The build fails on an unknown term too; this says so without a build.
 * @architecture Astro islands 2026
 * @module copydesk/programmeTerms.test
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import YAML from "yaml";

import { attribution, dating, lifeDates, scoring } from "../src/lib/programmeTerms.ts";

const WEB = fileURLToPath(new URL("..", import.meta.url));

test("life dates: born, circa, a plain span", () => {
  assert.equal(lifeDates("ur. 1935", "Arvo Pärt", "en"), "b. 1935");
  assert.equal(lifeDates("ur. 1935", "Arvo Pärt", "fr"), "né en 1935");
  assert.equal(lifeDates("ur. 1982", "Caroline Shaw", "fr"), "née en 1982");
  assert.equal(lifeDates("ok. 1450–1521", "Josquin des Prez", "en"), "c. 1450–1521");
  assert.equal(lifeDates("1942–2019", "Jan Sandström", "fr"), "1942–2019");
  assert.equal(lifeDates("ur. 1935", "Arvo Pärt", "pl"), "ur. 1935");
});

test("datings: qualifiers, centuries, revisions and arrangers", () => {
  const cases = [
    ["ok. 1638", "c. 1638", "vers 1638"],
    ["ok. 1717–19", "c. 1717–19", "vers 1717–19"],
    ["przed 1717", "before 1717", "avant 1717"],
    ["XVI w.", "16th c.", "XVIe s."],
    ["pocz. XXI w.", "early 21st c.", "début du XXIe s."],
    ["1914 · rew. 1920 · oprac. Paul Drayton 2019", "1914 · rev. 1920 · arr. Paul Drayton 2019", "1914 · rév. 1920 · arr. Paul Drayton 2019"],
    ["XVI w. / aranż. B. Kay", "16th c. / arr. B. Kay", "XVIe s. / arr. B. Kay"],
    ["aranż. współczesna", "contemporary arr.", "arr. contemporain"],
    ["1622/23", "1622/23", "1622/23"],
    ["Llibre Vermell", "Llibre Vermell", "Llibre Vermell"],
  ];
  for (const [pl, en, fr] of cases) {
    assert.equal(dating(pl, "en"), en, pl);
    assert.equal(dating(pl, "fr"), fr, pl);
    assert.equal(dating(pl, "pl"), pl, pl);
  }
  assert.throws(() => dating("jesień 2025", "en"), /not a known term/u);
  // Polish is validated too, so the build fails on every page, not only the translated ones.
  assert.throws(() => dating("jesień 2025", "pl"), /not a known term/u);
});

test("scoring: voices pass, instruments are words", () => {
  assert.equal(scoring("skrzypce solo", "en"), "solo violin");
  assert.equal(scoring("skrzypce solo", "fr"), "violon seul");
  assert.equal(scoring("a 8 + wiolonczela", "fr"), "a 8 + violoncelle");
  assert.equal(scoring("a 9 · chór a 5 i soliści a 4", "en"), "a 9 · choir a 5 and soloists a 4");
  assert.equal(scoring("a 12 · SAATBB + SAATBB", "fr"), "a 12 · SAATBB + SAATBB");
  assert.throws(() => scoring("fortepian", "en"), /not a known term/u);
});

test("attributions and Polish spellings of foreign names", () => {
  assert.equal(attribution("Anonim / aranż. Brian Kay", "en"), "Anonymous / arr. Brian Kay");
  assert.equal(attribution("Anonim / tradycja Oksytanii", "fr"), "Anonyme / tradition occitane");
  assert.equal(attribution("Siergiej Rachmaninow", "en"), "Sergei Rachmaninoff");
  assert.equal(attribution("Rachmaninow, Siergiej", "fr"), "Rachmaninov, Sergueï");
  assert.equal(attribution("Henryk Mikołaj Górecki", "fr"), "Henryk Mikołaj Górecki");
  assert.equal(attribution("Siergiej Rachmaninow", "pl"), "Siergiej Rachmaninow");
});

/** House words that must never reach an English or French page. */
const POLISH_TERM = /\b(?:ur|ok|pocz|oprac|aranż|rew)\.|\bprzed\b| w\.$|skrzypce|organy|chór|wiolonczela|kwartet|Anonim|Siergiej/u;

test("every programme value in both corpora renders in English and French", async () => {
  const concerts = YAML.parse(await readFile(`${WEB}src/content/concerts.yaml`, "utf8"));
  const repertoire = YAML.parse(await readFile(`${WEB}src/content/repertoire.yaml`, "utf8"));
  /** @type {{ composer: string, years?: string, year?: string, voicing?: string }[]} */
  const lines = [];
  for (const concert of concerts) {
    lines.push(...(concert.program ?? []));
    if (concert.ritornello) lines.push(concert.ritornello);
  }
  for (const era of repertoire) {
    for (const entry of era.entries ?? []) {
      lines.push({ composer: entry.composer, years: entry.years });
      for (const work of entry.works ?? []) lines.push({ composer: entry.composer, year: work.year });
    }
  }
  assert.ok(lines.length > 100, "both corpora were read");
  for (const locale of /** @type {const} */ (["en", "fr"])) {
    for (const line of lines) {
      const printed = [
        attribution(line.composer, locale),
        line.years === undefined ? "" : lifeDates(line.years, line.composer, locale),
        line.year === undefined ? "" : dating(line.year, locale),
        line.voicing === undefined ? "" : scoring(line.voicing, locale),
      ].join(" | ");
      assert.doesNotMatch(printed, POLISH_TERM, `${locale}: ${printed}`);
    }
  }
});
