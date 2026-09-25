/**
 * @file templates.mjs
 * @description The three press PDFs as HTML documents: the release, the programme and the
 *  biograms. `pdf.mjs` prints them; `press.css` beside this file sets them.
 *
 *  EVERY FACT IS PASSED IN, NONE IS WRITTEN HERE. The release's words come from the kit, the
 *  concert's facts from `concertFacts` (lib/pressKit), the programme from `concerts.yaml`, the
 *  biograms from `press.yaml` and the kit's guests. These functions only lay them out, so a PDF
 *  cannot say something the page does not.
 *
 *  Text is escaped; the three fields that are HTML by contract are not — a work title's one
 *  `<em>` (content.config) and the biogram HTML the page itself renders.
 * @architecture Astro islands 2026
 * @module scripts/press-pack/pdf/templates
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const FONTS = new URL("../../../public/fonts/", import.meta.url);
const CSS = readFileSync(`${HERE}press.css`, "utf8");

export const esc = (text) =>
  String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** A CSS string literal, for `content:` in a margin box. */
const cssString = (text) => `"${String(text).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/* The subsets and ranges `src/styles/base.css` declares, so a PDF sets exactly the glyphs the site
   does. Polish lives in latin-ext; the quotes and dashes in latin. */
const LATIN =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const LATIN_EXT =
  "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF";

const FACES = [
  ["Cormorant Garamond", "normal", "300 700", "CormorantGaramond-Variable"],
  ["Cormorant Garamond", "italic", "300 700", "CormorantGaramond-Italic-Variable"],
  ["IBM Plex Sans", "normal", "100 700", "IBMPlexSans-Variable"],
  ["IBM Plex Mono", "normal", "400", "IBMPlexMono-400"],
];

const fontFaces = FACES.flatMap(([family, style, weight, stem]) =>
  [
    [LATIN, `${stem}.latin.woff2`],
    [LATIN_EXT, `${stem}.latin-ext.woff2`],
  ].map(
    ([range, file]) =>
      `@font-face{font-family:"${family}";font-style:${style};font-weight:${weight};` +
      `src:url("${new URL(file, FONTS).href}") format("woff2");unicode-range:${range};}`,
  ),
).join("\n");

/** The mark as a data URL at header size. The master paints with `currentColor`; print is ink. */
function markDataUrl(markSvg) {
  const svg = markSvg
    .replace(/currentColor/g, "#1d1b19")
    .replace("<svg ", '<svg width="16" height="40" ');
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

/**
 * A whole printable document.
 * @param {{ title: string, body: string, accent?: string, footer: string, markSvg: string }} doc
 */
export function pdfDocument({ title, body, accent, footer, markSvg }) {
  return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>
${fontFaces}
${CSS}
@page {
  @top-left { content: url("${markDataUrl(markSvg)}"); vertical-align: bottom; padding-bottom: 4mm; }
  @bottom-left { content: ${cssString(footer)}; }
}
${accent ? `:root { --accent: ${accent}; }` : ""}
</style>
</head>
<body>
${body}
</body>
</html>`;
}

/** `[label, value]` rows; a row with no value is left out rather than printed empty. */
const factRows = (rows) =>
  `<dl class="facts">${rows
    .filter(([, value]) => value)
    .map(([label, value]) => `<dt>${esc(label)}</dt><dd>${value}</dd>`)
    .join("")}</dl>`;

/**
 * The release. The quote follows the first paragraph, which is the one it speaks to — the same
 * order `releaseText` pastes.
 */
export function releaseBody({ kit, facts, performers, about, contact, concertUrl }) {
  const { release } = kit;
  const [first, ...rest] = release.body;
  const quote = release.quote
    ? `<blockquote><p>„${esc(release.quote.text)}”</p><footer>${esc(release.quote.author)}, ${esc(release.quote.role)}</footer></blockquote>`
    : "";
  return `
<p class="kicker">Informacja prasowa</p>
<h1>${esc(release.title)}</h1>
<p class="lead">${esc(release.lead)}</p>
${factRows([
  ["Kiedy", esc(facts.dateline)],
  ["Gdzie", [facts.venue, facts.address].filter(Boolean).map(esc).join("<br>")],
  ["Festiwal", facts.festival && esc(facts.festival.replace(/^Festiwal\s+/, ""))],
  ["Wstęp", facts.admission && esc(facts.admission.replace(/^Wstęp\s+/, ""))],
  ["Wykonawcy", performers.map(esc).join("<br>")],
  ["Obsada", esc(kit.forces)],
  ["Kompozytorzy", esc(facts.composers.join(", "))],
  ["Strona", esc(concertUrl)],
])}
<p>${esc(first)}</p>
${quote}
${rest.map((paragraph) => `<p>${esc(paragraph)}</p>`).join("\n")}
<h2>O zespole</h2>
<p>${esc(about)}</p>
<h2>Kontakt dla mediów</h2>
<p>${esc(contact)}</p>`;
}

/**
 * The programme: the numbered works without the encore, and the returning Pärt stated once, with
 * no count and no places — the conductor has moved both, and a printed programme cannot follow.
 */
export function programmeBody({ concert, facts, performers }) {
  const works = (concert.program ?? []).filter((work) => !work.bis);
  const mirror = concert.ritornello
    ? `<p class="mirror"><span class="work">${esc(concert.ritornello.work)}</span>` +
      `${concert.ritornello.year ? ` (${esc(concert.ritornello.year)})` : ""} · ` +
      `${esc(concert.ritornello.composer)}` +
      `${concert.ritornello.years ? ` (${esc(concert.ritornello.years)})` : ""}` +
      `<br><span class="muted">powraca między grupami utworów</span></p>`
    : "";
  return `
<p class="kicker">Program koncertu</p>
<h1>${esc(facts.title)}</h1>
<p class="dateline">${[facts.dateline, facts.venue].filter(Boolean).map(esc).join(" · ")}</p>
<ul class="performers">${performers.map((line) => `<li>${esc(line)}</li>`).join("")}</ul>
${concert.programLede ? `<h2>${esc(concert.programLede)}</h2>` : "<h2>Program</h2>"}
<ol class="works">${works
    .map(
      (work) => `<li><div>
  <div class="work">${work.work}${work.year ? ` <span class="muted">(${esc(work.year)})</span>` : ""}</div>
  <div class="who">${esc(work.composer ?? "")}${work.years ? ` <span class="muted">(${esc(work.years)})</span>` : ""}${work.voicing ? ` <span class="muted">· ${esc(work.voicing)}</span>` : ""}</div>
</div></li>`,
    )
    .join("\n")}</ol>
${mirror}
${concert.programArc ? `<h2>O programie</h2><p>${esc(concert.programArc)}</p>` : ""}`;
}

/**
 * The biograms on record. `entries` are `{ name, role, html }`; the ensemble's is the page's own
 * HTML and a guest's is plain text wrapped here.
 */
export function biogramsBody({ facts, entries }) {
  return `
<p class="kicker">${esc(facts.title)} · biogramy</p>
<h1>Biogramy</h1>
${entries
  .map(
    (entry) =>
      `<section class="bio"><h3>${esc(entry.name)}</h3><p class="role">${esc(entry.role)}</p>${entry.html}</section>`,
  )
  .join("\n")}`;
}
