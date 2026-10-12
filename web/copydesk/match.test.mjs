// @ts-check
/**
 * @file match.test.mjs
 * @description `npm run test:comment-mode` — the comment mode's matcher on real rows of the corpus,
 *  against markup shaped the way the build prints it. Page text goes through `typoFor()`, the
 *  build's own typography pass, so a hard space, a narrow French space or a word joiner in a year
 *  range is exactly what the live page holds.
 *
 *  The cases are the ones the matcher exists for: a field split by `<br>`, an `HTML` field with
 *  inline markup, build-filled `{placeholder}` slots, one word shared by six concerts, French
 *  guillemets, a year range, an untranslated row printing its Polish, and several fields composed
 *  into one line.
 * @module copydesk/match.test
 */

import assert from "node:assert/strict";
import test from "node:test";

import { typoFor } from "../src/lib/typo.ts";
import { compileCorpus, findOccurrences, isOnPage, readPage } from "../src/comment-mode/match.ts";
import { readHtmlText } from "./htmlText.mjs";
import { scopeOf } from "./segment.mjs";

const WORD_JOINER = String.fromCharCode(0x2060);
const NBSP = String.fromCharCode(0xa0);

/**
 * A site-index row as the mode receives it.
 *
 * @param {string} key
 * @param {string} value
 * @param {{ kind?: string, fallback?: string }} [options]
 */
function row(key, value, { kind = "TEXT", fallback = "" } = {}) {
  return { key, scope: scopeOf(key), kind, value, fallback_value: fallback };
}

/**
 * Match `body` against `rows` the way the mode does on a page owned by `ownScope`.
 *
 * @param {string} body
 * @param {ReturnType<typeof row>[]} rows
 * @param {string | null} ownScope
 */
function match(body, rows, ownScope) {
  const { nodes } = readHtmlText(`<!doctype html><html><head><title>x</title></head><body>${body}</body></html>`);
  const page = readPage(nodes);
  const occurrences = findOccurrences(compileCorpus(rows), page, { ownScope });
  /** The original text an occurrence covers, read back through its Range points. */
  const textOf = (/** @type {(typeof occurrences)[number]} */ occurrence) => {
    const { start, end } = occurrence;
    if (start.node === end.node) return nodes[start.node].text.slice(start.offset, end.offset);
    let text = nodes[start.node].text.slice(start.offset);
    for (let n = start.node + 1; n < end.node; n++) text += nodes[n].text;
    return text + nodes[end.node].text.slice(0, end.offset);
  };
  const found = occurrences.map((occurrence) => ({
    text: textOf(occurrence),
    keys: occurrence.candidates.map((field) => field.key),
  }));
  return { found, page, nodes };
}

const pl = typoFor("pl");
const en = typoFor("en");
const fr = typoFor("fr");

test("the rite title is two fields on either side of a <br>", () => {
  const rows = [
    row("page.landing.rite.kicker", "VoctEnsemble · zespół wokalny · Kraków"),
    row("page.landing.rite.title1", "Ta strona"),
    row("page.landing.rite.title2", "może śpiewać."),
  ];
  const body =
    `<div class="threshold-kicker micro">${pl("VoctEnsemble · zespół wokalny · Kraków")}</div>` +
    `<p class="threshold-title" id="threshold-title">${pl("Ta strona")}<br/>${pl("może śpiewać.")}</p>`;
  const { found } = match(body, rows, "page.landing");
  assert.deepEqual(
    found.map((f) => f.keys),
    [["page.landing.rite.kicker"], ["page.landing.rite.title1"], ["page.landing.rite.title2"]],
  );
  assert.equal(found[2].text, "może śpiewać.");
});

test("an HTML field matches across its inline markup, and its two .line spans stay two fields", () => {
  const rows = [
    row("page.kontakt.hero.title1", "Napisz"),
    row("page.kontakt.hero.title2Html", "do <em>nas.</em>", { kind: "HTML" }),
    row(
      "page.landing.hero.strapHtml",
      'Koncert jako próg: wchodzi się z ulicy, wychodzi się cichszym. Cykl Koncertów Duchowych prowadzi <a href="#dyrygent">Florent de Bazelaire</a>.',
      { kind: "HTML" },
    ),
  ];
  const kontakt = match(
    `<h1><span class="line">Napisz</span> <span class="line">do <em>nas.</em></span></h1>`,
    rows,
    "page.kontakt",
  );
  assert.deepEqual(kontakt.found, [
    { text: "Napisz", keys: ["page.kontakt.hero.title1"] },
    { text: "do nas.", keys: ["page.kontakt.hero.title2Html"] },
  ]);

  const strap = pl("Koncert jako próg: wchodzi się z ulicy, wychodzi się cichszym. Cykl Koncertów Duchowych prowadzi ");
  const landing = match(
    `<p class="hero-strap">${strap}<a href="#dyrygent">Florent&nbsp;de&nbsp;Bazelaire</a>.</p>`,
    rows,
    "page.landing",
  );
  assert.deepEqual(
    landing.found.map((f) => f.keys),
    [["page.landing.hero.strapHtml"]],
  );
  assert.ok(landing.found[0].text.endsWith(`Florent${NBSP}de${NBSP}Bazelaire.`));
});

test("build-filled {placeholder} slots match whatever the build put in them, on their own page", () => {
  const rows = [
    row("page.fundacja.realisation.budgetAmount", "ok. {amount} zł"),
    row("page.fundacja.realisation.budgetAsOf", "stan na {date}"),
  ];
  const body =
    `<dd><span class="rm-figure">${pl("ok. 28 000 zł")}</span> ` +
    `<span class="rm-asof">${pl("stan na 24 września 2026")}</span></dd>`;
  const { found } = match(body, rows, "page.fundacja");
  assert.deepEqual(
    found.map((f) => f.keys),
    [["page.fundacja.realisation.budgetAmount"], ["page.fundacja.realisation.budgetAsOf"]],
  );
  assert.equal(found[1].text, pl("stan na 24 września 2026"));

  // Elsewhere a slot could hold anything, so it is not looked for.
  assert.deepEqual(match(body, rows, "page.mecenat").found, []);
});

test("a slot takes the shortest stretch, and a literal match outranks a slotted one", () => {
  const festival = [
    row("page.fundacja.realisation.festival", "the {name} festival"),
    row("page.fundacja.realisation.festivalFinale", "the closing concert of the {name} festival"),
  ];
  const finale = match(
    `<dd>${en("the closing concert of the Fenomen Człowieka festival")}</dd>`,
    festival,
    "page.fundacja",
  );
  assert.deepEqual(
    finale.found.map((f) => f.keys),
    [["page.fundacja.realisation.festivalFinale"]],
  );

  const mecenat = [
    row("page.mecenat.eyebrow", "Mecenat · VoctFoundation"),
    row("page.mecenat.contact.role", "{function} VoctFoundation"),
  ];
  const { found } = match(
    `<p class="mc-eyebrow">${pl("Mecenat · VoctFoundation")}</p>` +
      `<p class="mc-name">Anna Marcisz</p><p class="mc-role">${pl("wiceprezes zarządu VoctFoundation")}</p>` +
      `<p class="mc-logo">VoctFoundation</p>`,
    mecenat,
    "page.mecenat",
  );
  assert.deepEqual(found, [
    { text: pl("Mecenat · VoctFoundation"), keys: ["page.mecenat.eyebrow"] },
    { text: pl("wiceprezes zarządu VoctFoundation"), keys: ["page.mecenat.contact.role"] },
  ]);
});

test("'Dyrygent' is the page's own concert on its page, and elsewhere a word a tap only explains", () => {
  const concerts = ["9-kart", "aeternam", "hymn-poleglym", "pochwala-stworzenia", "wcielenie", "wolanie-gor"];
  const rows = concerts.map((id) => row(`concert.${id}.credits.0.role`, "Dyrygent"));
  const credits =
    `<dl aria-label="Obsada"><div class="kd-credit"> <dt>Dyrygent</dt> <dd>Florent de Bazelaire</dd> </div></dl>`;

  assert.deepEqual(match(credits, rows, "concert.aeternam").found, [
    { text: "Dyrygent", keys: ["concert.aeternam.credits.0.role"] },
  ]);
  // Six fields hold the word and none is the landing's own: no guess is offered.
  assert.deepEqual(match(credits, rows, "page.landing").found, [{ text: "Dyrygent", keys: [] }]);
  // Lowercased by the template (`lib/realisations.ts`), it is still found, and still only explained.
  assert.deepEqual(match(`<li>${pl("Florent de Bazelaire, dyrygent")}</li>`, rows, "page.fundacja").found, [
    { text: "dyrygent", keys: [] },
  ]);
});

test("a shared word from the chrome is explained; a shared phrase still opens a chooser", () => {
  const rows = [
    row("concert.aeternam.pullQuote.attribution", "VoctEnsemble"),
    row("page.press.about.eyebrow", "VoctEnsemble"),
    row("concert.wolanie-gor.about.place", "Dworek Gościnny · Szczawnica"),
    row("page.landing.register.entries.wolanie-gor.place", "Dworek Gościnny · Szczawnica"),
  ];
  const body =
    `<a class="brand">VoctEnsemble</a>` + `<span class="ribbon-place">${pl("Dworek Gościnny · Szczawnica")}</span>`;
  const { found } = match(body, rows, "page.fundacja");
  assert.deepEqual(found, [
    { text: "VoctEnsemble", keys: [] },
    {
      text: pl("Dworek Gościnny · Szczawnica"),
      keys: ["concert.wolanie-gor.about.place", "page.landing.register.entries.wolanie-gor.place"],
    },
  ]);
  // A single field holding the word is a match like any other.
  assert.deepEqual(match(body, rows.slice(0, 1), "page.fundacja").found[0].keys, [
    "concert.aeternam.pullQuote.attribution",
  ]);
});

test("a field inside another field's span is that span, and still found where it stands alone", () => {
  const prologue =
    "Pierwszy czerwca 2024, Dworek Gościnny w Szczawnicy. Jedyny wieczór tego cyklu poza kościołem. " +
    "Program o wołaniu gór zabrzmiał w górach: za oknami Pieniny. Dwanaście głosów, skrzypce Radu " +
    "Ropotana, dwie części i przerwa.";
  const rows = [row("concert.wolanie-gor.prologue", prologue), row("concert.wolanie-gor.facts.1", "Pieniny")];
  const { found, page } = match(
    `<p class="kd-prologue">${pl(prologue)}</p><ul class="kd-facts"><li>Pieniny</li></ul>`,
    rows,
    "concert.wolanie-gor",
  );
  assert.deepEqual(
    found.map((f) => f.keys),
    [["concert.wolanie-gor.prologue"], ["concert.wolanie-gor.facts.1"]],
  );
  assert.equal(isOnPage(page, rows[1]), true);
  // Never mid-word.
  assert.deepEqual(match("<p>Pieninyland</p>", rows, "concert.wolanie-gor").found, []);
});

test("a foreign span made entirely of the page's own fields does not swallow them", () => {
  const rows = [
    row("page.koncerty.intro.title1", "Spiritual"),
    row("page.koncerty.intro.title2Html", "<em>Concerts.</em>", { kind: "HTML" }),
    row("page.landing.hero.concertsLink", "Spiritual Concerts"),
  ];
  const heading =
    `<h1> <span class="line"><span class="reveal ink-press">Spiritual</span></span> ` +
    `<span class="line"><span class="reveal ink-press" data-d="1"><em>Concerts.</em></span></span></h1>`;
  assert.deepEqual(match(heading, rows, "page.koncerty").found, [
    { text: "Spiritual", keys: ["page.koncerty.intro.title1"] },
    { text: "Concerts.", keys: ["page.koncerty.intro.title2Html"] },
  ]);
  // On the landing the link is the page's own field, and the koncerty pair is foreign.
  assert.deepEqual(match(`<a class="hero-link">Spiritual Concerts</a>`, rows, "page.landing").found, [
    { text: "Spiritual Concerts", keys: ["page.landing.hero.concertsLink"] },
  ]);
});

test("French guillemets and the space before a colon are typography, not text", () => {
  const value =
    "Au Temple, Siméon prend l'Enfant dans ses bras : « mes yeux ont vu ton salut ». La promesse du début de la soirée s'accomplit.";
  const printed = fr(value);
  assert.ok(printed.includes(`«${NBSP}mes`) && printed.includes(`bras${NBSP}:`));
  const rows = [row("concert.wcielenie.movements.impletio.line", value)];
  const { found } = match(`<p class="mv-line">${printed}</p>`, rows, "concert.wcielenie");
  assert.deepEqual(found, [{ text: printed, keys: ["concert.wcielenie.movements.impletio.line"] }]);
});

test("a year range with a word joiner matches its plain value", () => {
  const value = "animacja wizualna · wybrane koncerty 2024–2025";
  const printed = pl(value);
  assert.ok(printed.includes(`2024–${WORD_JOINER}2025`));
  const rows = [row("page.kolofon.gratia.items.kuzma.role", value)];
  const { found } = match(`<dd class="gratia-role">${printed}</dd>`, rows, "page.kolofon");
  assert.deepEqual(found, [{ text: printed, keys: ["page.kolofon.gratia.items.kuzma.role"] }]);
});

test("an untranslated EN field matches the Polish its page prints", () => {
  const polish = "Kościół Wszystkich Świętych w Warszawie";
  const rows = [
    row("page.landing.register.entries.pochwala-stworzenia.place", "", { fallback: polish }),
    row("page.landing.register.entries.pochwala-stworzenia.tag", "", { fallback: "Finał festiwalu „Fenomen Człowieka”" }),
  ];
  const { found } = match(`<span class="register-place">${en(polish)}</span>`, rows, "page.landing");
  assert.deepEqual(found, [{ text: polish, keys: ["page.landing.register.entries.pochwala-stworzenia.place"] }]);
});

test("the hero dateline holds two fields and a date, each found where it sits", () => {
  const rows = [
    row("page.landing.hero.announceLabel", "Najbliższy koncert"),
    row("concert.pochwala-stworzenia.title", "Pochwała Stworzenia"),
  ];
  const body =
    `<a class="hero-announce intro-stage" href="/koncerty/pochwala-stworzenia">` +
    `<span class="hero-announce-text">${pl("Najbliższy koncert — ")}<strong>Pochwała Stworzenia</strong>` +
    `<span class="hero-announce-when">${pl("11 października")}</span></span></a>`;
  const { found } = match(body, rows, "page.landing");
  assert.deepEqual(found, [
    { text: "Najbliższy koncert", keys: ["page.landing.hero.announceLabel"] },
    { text: "Pochwała Stworzenia", keys: ["concert.pochwala-stworzenia.title"] },
  ]);
});

test("values under three literal characters are never matched", () => {
  const rows = [row("page.fundacja.realisation.sheet.where", "Où"), row("page.fundacja.realisation.budgetAsOf", "au {date}")];
  const corpus = compileCorpus(rows);
  assert.deepEqual(corpus.patterns, []);
  assert.equal(corpus.skipped.length, 2);
});

test("a word or two of another scope inside a longer text node is not that field", () => {
  const rows = [row("page.press.head.nav.contact", "kontakt"), row("page.o-nas.letter.stanzas.II.label", "in silence")];
  const address = `<p><a href="mailto:kontakt@voctensemble.com">kontakt@voctensemble.com</a></p>`;
  const sentence = `<p>The evening ends in silence and in light.</p>`;
  assert.deepEqual(match(address + sentence, rows, "page.landing").found, []);
  // Printed whole, up to punctuation, it is the field.
  assert.deepEqual(match(`<a>kontakt ↗</a>`, rows, "page.landing").found, [
    { text: "kontakt", keys: ["page.press.head.nav.contact"] },
  ]);
  // On its own page the field is found wherever it stands.
  assert.deepEqual(match(sentence, rows, "page.o-nas").found, [
    { text: "in silence", keys: ["page.o-nas.letter.stanzas.II.label"] },
  ]);
});

test("chrome marked data-desk=none is never read as a field", () => {
  const rows = [row("page.landing.support.writeCta", "Write to us")];
  const body =
    `<p><a href="/kontakt">Write to us</a></p>` +
    `<footer data-desk="none"><div><a href="/kontakt">write to us</a></div><div>x</div></footer><p>after</p>`;
  const { found, nodes } = match(body, rows, "page.landing");
  assert.deepEqual(found, [{ text: "Write to us", keys: ["page.landing.support.writeCta"] }]);
  assert.deepEqual(
    nodes.map((n) => [n.text, n.breakBefore]),
    [["Write to us", true], ["after", true]],
  );
  const doc = readHtmlText(`<html><body>${body}</body></html>`);
  assert.ok(doc.outside.some((text) => text.includes("write to us")));
});

test("the text reader keeps to the body's prose and sets the rest apart", () => {
  const html =
    `<!doctype html><html lang="fr" class="x"><head><title>Titre</title>` +
    `<meta name="description" content="Une description"><script type="application/ld+json">{"name":"Fondation"}</script></head>` +
    `<body class="page-404"><p>Avant <em>milieu</em>après</p><script>var x = "<p>code</p>";</script>` +
    `<style>p{}</style><template><p>modèle</p></template><noscript><p>sans script</p></noscript>` +
    `<astro-island props="{&quot;copy&quot;:[0,{&quot;title&quot;:[0,&quot;Merci.&quot;]}]}"><span>île</span></astro-island>` +
    `<img alt="Une image"><div>Bloc&nbsp;suivant</div></body></html>`;
  const doc = readHtmlText(html);
  assert.equal(doc.lang, "fr");
  assert.equal(doc.bodyClass, "page-404");
  assert.deepEqual(
    doc.nodes.map((n) => [n.text, n.breakBefore]),
    [["Avant ", true], ["milieu", false], ["après", false], ["île", true], [`Bloc${NBSP}suivant`, true]],
  );
  for (const text of ["Titre", "Une description", "Fondation", "sans script", "Une image"]) {
    assert.ok(doc.hidden.includes(text), text);
  }
  assert.ok(doc.scripted.includes("Merci."));
});
