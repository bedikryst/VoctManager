#!/usr/bin/env node
/**
 * @file press-pack.mjs
 * @description Assembles `public/press/voctensemble-press-YYYY-MM.zip` — the one file an
 *  organiser downloads from /press.
 *
 *  FIVE OF THE EIGHT ITEMS ARE GENERATED, and that is the point of the script rather than a
 *  folder somebody zips by hand. The biograms come from the same YAML field the page prints, the
 *  credits from `concerts.yaml`, the invoicing sheet from `src/data/foundation.ts`, the
 *  programmes from the corpus, the recording links from the corpus and the page. None of them can
 *  drift from the site, because none of them is typed twice.
 *
 *  THE OTHER THREE COME FROM OUTSIDE AND ARE NAMED IN `press-pack/manifest.yaml`: which
 *  photographs the ensemble cleared, which technical rider is current, which evenings ship as
 *  sample programmes.
 *
 *  IT REFUSES RATHER THAN SHIPS A GAP. No rider, too few photographs, no portrait among them, a
 *  file that is not there — it prints what is missing and exits non-zero. That is the contract
 *  /press is written against: the page LOOKS for the archive and renders its honest "write to us"
 *  state when there is none, so a refusal here is a correct page there rather than a broken one.
 *
 *  THE PORTRAIT RULE IS NOT PEDANTRY. A poster is portrait. A programmer holding five landscape
 *  frames writes back and asks for one, which is the single most common reason they write back at
 *  all — and by then they have usually already set the poster with their own photograph.
 *
 *  Run from `web/`: `npm run press:pack`. The archive is gitignored and is uploaded to the build
 *  host by hand, the way `src/assets/photos/` is.
 * @architecture Astro islands 2026
 * @module scripts/press-pack
 */
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";
import YAML from "yaml";

import { FOUNDATION } from "../src/data/foundation.ts";
import { htmlToPlainText } from "../src/lib/plainText.ts";
import { PRESS_PAGE } from "../src/i18n/content/press.ts";
import { makeZip } from "./zip.mjs";

const WEB_ROOT = fileURLToPath(new URL("..", import.meta.url));
const at = (...parts) => path.join(WEB_ROOT, ...parts);

const MANIFEST = "press-pack/manifest.yaml";
const RIDER_DIR = "press-pack/assets";
const PHOTO_DIR = "src/assets/photos/.original-photos";
const OUT_DIR = "public/press";

/** 3–5 frames, the pack spec's own range (docs/web-board-feedback-2026-09.md §1). */
const MIN_PHOTOS = 3;
const MAX_PHOTOS = 5;
/** A short edge of 2000 px is ~17 cm at 300 dpi — a half-page in a programme book. */
const SHORT_EDGE_FLOOR = 2000;
/**
 * The long edge a frame is delivered at: 5000 px is 42 cm at 300 dpi, the long side of A3, which
 * is past anything a programme book or a poster proof needs.
 *
 * A CAMERA ORIGINAL IS NOT A PRESS PHOTOGRAPH. The two frames from *Wcielenie* are 8256 × 5504 and
 * 44 MB each; three of those put the archive at 71 MB, and the reader who has to download it is on
 * a deadline, sometimes on a phone. Delivering the raw file is not generosity, it is a 50 MB
 * archive nobody opens — so anything above this line is resampled once, here, by us, rather than
 * badly by whoever receives it.
 */
const PRINT_LONG_EDGE = 5000;
/** JPEG quality for that resample. High enough that a print house has nothing to say about it. */
const PRINT_QUALITY = 92;
/** The spec's ceiling. Past it, mail servers start refusing the link's own reply. */
const SIZE_CEILING = 50 * 1_000_000;

/* Files in the archive are read by strangers on unknown machines: CRLF so Windows tools that
   still care are happy, and a BOM so a Polish diacritic cannot be mis-decoded by whatever opens
   a .txt by double-click. Neither choice would be right for a file in this repository; both are
   right for a file we hand out. */
const BOM = "﻿";
const textFile = (body) => Buffer.from(BOM + body.replace(/\n/g, "\r\n"), "utf8");

const problems = [];
const warnings = [];
const fail = (message) => problems.push(message);
const warn = (message) => warnings.push(message);

// ── Sources ───────────────────────────────────────────────────────────────────────────────────

function readYaml(relative) {
  return YAML.parse(readFileSync(at(relative), "utf8"));
}

const manifest = readYaml(MANIFEST);
const copy = PRESS_PAGE.schema.parse(readYaml("src/content/pages/press.yaml"));
const concerts = readYaml("src/content/concerts.yaml");

/** Every photographer `concerts.yaml` records, by frame id. Frames with no name are the
    ensemble's own archive and say so rather than being left blank. */
const creditByFrame = new Map();
for (const concert of concerts) {
  for (const frame of concert.gallery ?? []) {
    if (frame.credit) creditByFrame.set(frame.img, frame.credit);
  }
}

// ── Validation ────────────────────────────────────────────────────────────────────────────────

const month = String(manifest.month ?? "");
if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
  fail(`manifest.month must be "YYYY-MM"; it is ${JSON.stringify(manifest.month)}.`);
}

/** `<id>.<anything>` inside the originals directory — the extension varies by frame. */
function findPhotoFile(id) {
  let names;
  try {
    names = readdirSync(at(PHOTO_DIR));
  } catch {
    return undefined;
  }
  return names.find((name) => name.slice(0, name.lastIndexOf(".")) === id);
}

const photoEntries = Array.isArray(manifest.photos) ? manifest.photos : [];
if (photoEntries.length < MIN_PHOTOS || photoEntries.length > MAX_PHOTOS) {
  fail(
    `manifest.photos holds ${photoEntries.length} frames; the pack takes ${MIN_PHOTOS}–${MAX_PHOTOS}.` +
      (photoEntries.length === 0 ? " Nothing has been cleared by the ensemble yet." : ""),
  );
}

const photos = [];
for (const entry of photoEntries) {
  const id = entry?.id;
  if (!id) {
    fail("a row of manifest.photos has no `id`.");
    continue;
  }
  const fileName = findPhotoFile(id);
  if (!fileName) {
    fail(`photo "${id}" is not in ${PHOTO_DIR} on this machine.`);
    continue;
  }
  const file = at(PHOTO_DIR, fileName);
  const meta = await sharp(file).metadata();
  /* EXIF orientation 5–8 means the stored pixels are rotated relative to what a viewer shows.
     Report — and decide portrait-versus-landscape on — what a designer will actually see. */
  const turned = (meta.orientation ?? 1) >= 5;
  const storedWidth = meta.width ?? 0;
  const storedHeight = meta.height ?? 0;
  let width = turned ? storedHeight : storedWidth;
  let height = turned ? storedWidth : storedHeight;

  let deliveredName = fileName;
  let data;
  if (Math.max(width, height) > PRINT_LONG_EDGE) {
    const out = await sharp(file)
      // Applies the EXIF orientation, so the delivered file needs no flag to be read right.
      .rotate()
      .resize({
        width: PRINT_LONG_EDGE,
        height: PRINT_LONG_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: PRINT_QUALITY, mozjpeg: true })
      // Keeps the colour profile; without it a wide-gamut frame prints flat.
      .withMetadata()
      .toBuffer({ resolveWithObject: true });
    data = out.data;
    width = out.info.width;
    height = out.info.height;
    deliveredName = `${id}.jpg`;
  } else {
    // Already within the delivery size: hand over the original bytes rather than re-encoding a
    // JPEG into a JPEG for nothing.
    data = readFileSync(file);
  }

  const shortEdge = Math.min(width, height);
  if (shortEdge < SHORT_EDGE_FLOOR) {
    warn(
      `photo "${id}" is ${width}×${height}; its short edge is under ${SHORT_EDGE_FLOOR} px, ` +
        "so it cannot be printed much larger than a postcard at 300 dpi.",
    );
  }

  photos.push({
    id,
    fileName: deliveredName,
    data,
    width,
    height,
    portrait: height > width,
    credit: entry.credit ?? creditByFrame.get(id) ?? null,
  });
}

if (photos.length > 0 && !photos.some((photo) => photo.portrait)) {
  fail(
    "every cleared photograph is landscape. A poster is portrait, and a designer who has none " +
      "will crop one badly or use their own — ask the ensemble for a portrait frame.",
  );
}

const riderName = String(manifest.rider ?? "");
let riderFile;
if (!riderName) {
  fail(
    `manifest.rider is empty — the one-page technical rider has not arrived. Nothing may be ` +
      "estimated into it: every number the old /press printed was invented and was deleted.",
  );
} else {
  riderFile = at(RIDER_DIR, riderName);
  try {
    readFileSync(riderFile);
  } catch {
    fail(`manifest.rider names "${riderName}", which is not in ${RIDER_DIR}.`);
  }
}

const programmeIds = Array.isArray(manifest.programmes) ? manifest.programmes : [];
const programmes = [];
for (const id of programmeIds) {
  const concert = concerts.find((entry) => entry.id === id);
  if (!concert) {
    fail(`manifest.programmes names "${id}", which is not a concert in the corpus.`);
    continue;
  }
  const works = concert.program ?? [];
  if (!works.some((work) => work.duration)) {
    warn(`programme "${id}" carries no durations — it ships as a running order without times.`);
  }
  programmes.push(concert);
}

if (problems.length > 0) {
  console.error("\nThe press pack cannot be built yet:\n");
  for (const problem of problems) console.error(`  ·  ${problem}`);
  if (warnings.length > 0) {
    console.error("\nAlso worth knowing:\n");
    for (const note of warnings) console.error(`  ·  ${note}`);
  }
  console.error(
    `\n/press renders its "write to us" state while ${OUT_DIR} is empty, which is true. ` +
      "Fill in press-pack/manifest.yaml and run this again.\n",
  );
  process.exit(1);
}

// ── The generated documents ───────────────────────────────────────────────────────────────────

const rule = "—".repeat(64);
/* Ends with ONE blank line, so a caller follows it straight with its first paragraph rather than
   remembering to separate them. */
const heading = (title) => `${title}\n${rule}\n`;
/** A concert's `dateLabel` is a LocalizedText map, not a string — the pack is Polish. */
const pl = (value) => (typeof value === "string" ? value : (value?.pl ?? ""));

/** cm at 300 dpi, which is the unit a designer lays a page out in. */
const printSize = (px) => (px / 300) * 2.54;

const BIOS = [
  { file: "biogram-krotki.txt", label: "Biogram krótki", html: copy.bio.shortHtml },
  { file: "biogram-sredni.txt", label: "Biogram średni", html: copy.bio.mediumHtml },
  { file: "biogram-pelny.txt", label: "Biogram pełny", html: copy.bio.longHtml },
].map((bio) => {
  const text = htmlToPlainText(bio.html);
  return { ...bio, text, body: `${heading(`${bio.label} · ${text.length} znaków`)}\n${text}\n` };
});

const creditsTxt = [
  heading("Zdjęcia — podpisy i rozmiary"),
  copy.pack.photoUsage,
  "",
  ...photos.map((photo) => {
    const who = photo.credit ? `fot. ${photo.credit}` : "fot. archiwum VoctEnsemble";
    const cm = `${printSize(photo.width).toFixed(1)} × ${printSize(photo.height).toFixed(1)} cm przy 300 dpi`;
    return [
      `${photo.fileName}`,
      `    ${who}`,
      `    ${photo.width} × ${photo.height} px  ·  ${cm}`,
      `    ${photo.portrait ? "pion" : "poziom"}`,
      "",
    ].join("\n");
  }),
].join("\n");

const invoiceTxt = [
  // No lede: the heading already says what `facts.legalLede` says, and the readme carries the
  // sentence about who signs.
  heading("Dane do umowy i do faktury"),
  `Nazwa       ${FOUNDATION.name}`,
  `Adres       ${FOUNDATION.addressLine}`,
  `KRS         ${FOUNDATION.registry.krs}`,
  `NIP         ${FOUNDATION.registry.nip}`,
  `REGON       ${FOUNDATION.registry.regon}`,
  "",
  `Konto PLN   ${FOUNDATION.accounts.pln.display}`,
  `Konto EUR   ${FOUNDATION.accounts.eur.display}`,
  "",
  `Kontakt     ${FOUNDATION.mail.booking}`,
  `Serwis      ${FOUNDATION.site}`,
  "",
].join("\n");

const programmeFiles = programmes.map((concert) => {
  const lines = [heading(`${concert.title} — program`)];
  const when = pl(concert.dateLabel) || concert.date || "";
  if (when || concert.venue) lines.push([when, concert.venue].filter(Boolean).join("  ·  "), "");
  if (concert.programArc) lines.push(htmlToPlainText(concert.programArc), "");
  for (const work of concert.program ?? []) {
    const who = [work.composer, work.years ? `(${work.years})` : ""].filter(Boolean).join(" ");
    const what = [work.work, work.movement ? `— ${work.movement}` : ""].filter(Boolean).join(" ");
    const tail = [work.voicing, work.duration].filter(Boolean).join("  ·  ");
    lines.push(`${who}`, `    ${what}${tail ? `  ·  ${tail}` : ""}`, "");
  }
  return { file: `program-${concert.id}.txt`, body: lines.join("\n") };
});

/* The corpus's per-concert `links[]` and the page's "Pisali o nas" cards overlap almost entirely —
   the Bobola broadcast and the Gość / KAI pieces are in both. One list, keyed by URL, first
   mention wins: a reader who opens the same page twice looking for a second source has been
   misled by a list that counted one thing as two. */
const recordingSeen = new Set();
const recordingLine = (href, title, where) => {
  if (recordingSeen.has(href)) return [];
  recordingSeen.add(href);
  return [title, `    ${where}`, `    ${href}`, ""];
};

const recordingsTxt = [
  heading("Nagrania i publikacje"),
  `Kanał YouTube        https://www.youtube.com/@VoctEnsemble-nb7gh`,
  `Serwis               ${FOUNDATION.site}`,
  `Archiwum fotografii  ${FOUNDATION.site}/obrazy`,
  "",
  ...copy.press.items.flatMap((item) => recordingLine(item.href, item.title, item.outlet)),
  ...concerts.flatMap((concert) =>
    (concert.links ?? []).flatMap((link) =>
      // The corpus writes its link labels with a trailing arrow for the page that renders them.
      recordingLine(link.href, link.label.replace(/\s*↗$/u, ""), concert.title),
    ),
  ),
].join("\n");

const logoUsageTxt = [heading("Logotyp — zasady użycia"), copy.pack.logoUsage, ""].join("\n");

const readmeTxt = [
  heading(`${FOUNDATION.ensemble} — pakiet prasowy ${month}`),
  copy.pack.ledeReady,
  "",
  copy.pack.contentsIntro,
  ...copy.pack.items.map((item) => `  ·  ${item.text}`),
  "",
  copy.facts.legalLede,
  "",
  `Kontakt   ${FOUNDATION.mail.booking}`,
  `Serwis    ${FOUNDATION.site}/press`,
  "",
].join("\n");

// ── The logotype ──────────────────────────────────────────────────────────────────────────────

const markSvg = readFileSync(at("public/voct-mark.svg"), "utf8");
/* The vector master paints with `currentColor`, which the site fills from CSS. A raster has no
   cascade to inherit from, so each export states its own ink: the dark mark is for a light
   ground and the paper mark for a dark one. Both stay transparent — a designer places them. */
const rasterise = async (hex) =>
  sharp(Buffer.from(markSvg.replace(/currentColor/g, hex)), { density: 600 })
    .resize({ height: 2000 })
    .png()
    .toBuffer();
const markOnLight = await rasterise("#161514");
const markOnDark = await rasterise("#F4F1E9");

// ── The archive ───────────────────────────────────────────────────────────────────────────────

const entries = [
  { name: "PRZECZYTAJ.txt", data: textFile(readmeTxt) },
  ...BIOS.map((bio) => ({ name: bio.file, data: textFile(bio.body) })),
  { name: "dane-do-faktury.txt", data: textFile(invoiceTxt) },
  { name: "credits.txt", data: textFile(creditsTxt) },
  { name: "nagrania.txt", data: textFile(recordingsTxt) },
  ...programmeFiles.map((programme) => ({
    name: programme.file,
    data: textFile(programme.body),
  })),
  { name: "logo/voct-mark.svg", data: Buffer.from(markSvg, "utf8") },
  { name: "logo/voct-mark-na-jasnym.png", data: markOnLight, store: true },
  { name: "logo/voct-mark-na-ciemnym.png", data: markOnDark, store: true },
  { name: "logo/UZYCIE.txt", data: textFile(logoUsageTxt) },
  { name: `rider/${riderName}`, data: readFileSync(riderFile), store: true },
  // Already-compressed pixels: deflating them spends time to save nothing.
  ...photos.map((photo) => ({
    name: `zdjecia/${photo.fileName}`,
    data: photo.data,
    store: true,
  })),
];

const archive = makeZip(entries, new Date());
if (archive.length > SIZE_CEILING) {
  warn(
    `the archive is ${(archive.length / 1_000_000).toFixed(1)} MB, over the 50 MB the spec sets. ` +
      "Drop a frame or ask for smaller originals.",
  );
}

mkdirSync(at(OUT_DIR), { recursive: true });
const outName = `voctensemble-press-${month}.zip`;
writeFileSync(at(OUT_DIR, outName), archive);

console.log(`\n${OUT_DIR}/${outName}`);
console.log(`  ${entries.length} plików  ·  ${(archive.length / 1_000_000).toFixed(1)} MB`);
console.log(
  `  ${photos.length} zdjęć (${photos.filter((p) => p.portrait).length} w pionie)  ·  ` +
    `${programmes.length} program(y)  ·  rider: ${riderName}`,
);
for (const note of warnings) console.log(`  !  ${note}`);
console.log(
  "\nArchiwum nie wchodzi do gita — wgraj je na hosta builda do public/press/ i przebuduj.\n",
);
