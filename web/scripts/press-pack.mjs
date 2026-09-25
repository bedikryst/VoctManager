#!/usr/bin/env node
/**
 * @file press-pack.mjs
 * @description Builds `public/press/` — every file /press offers, the two ZIPs, and the
 *  `index.json` the page reads to know what exists.
 *
 *  WHAT IT MAKES:
 *   · press photographs, each cut to its ratio (16:9 or 4:5) with a 2400 px preview and two
 *     thumbnails (`press-pack/photos.mjs`, rows in `press-pack/manifest.yaml`);
 *   · the kit of the soonest upcoming concert that has one: the release, programme and biogram
 *     PDFs, the two announcements, the post and the hashtags as text files, the poster, the
 *     designer's print PDF where one is on this machine, and the poster mounted as 4:5, 9:16 and
 *     16:9 graphics;
 *   · the logotype, `PRZECZYTAJ.txt` (usage terms, every credit, the contact) and the invoicing
 *     sheet;
 *   · `voctensemble-press-komplet.zip` (all of it) and `voctensemble-press-zdjecia.zip` (the
 *     photographs and the readme).
 *
 *  ALMOST NOTHING HERE IS TYPED TWICE. The kit's texts come from `src/content/press-kits/`, the
 *  concert's facts and programme from `concerts.yaml`, the biograms and usage terms from
 *  `press.yaml`, the invoicing sheet from `src/data/foundation.ts`. The one hand-kept list is the
 *  photo manifest, because which frames the ensemble released cannot be derived.
 *
 *  IT REFUSES, NAMING WHAT IS MISSING, rather than ship a gap: no kit, a kit whose concert is not
 *  in the corpus or whose texts name another day, a concert without its poster, a photo row
 *  without a credit or a source, a source held for want of its photographer's consent. It only
 *  WARNS AND SKIPS a photo whose crop is under 1080 px on its short edge — a thumbnail sent by
 *  mistake — and an archive over 50 MB.
 *
 *  THE OUTPUT IS NOT IN GIT. `public/press/` is gitignored and uploaded to the build host by hand,
 *  as the photographs are. `index.json` carries `kitHash` (lib/pressKit), and the site refuses to
 *  build against a pack cut from sources other than the ones it holds.
 *
 *  Run from `web/`: `npm run press:pack`. The PDFs need Microsoft Edge (see press-pack/pdf.mjs).
 * @architecture Astro islands 2026
 * @module scripts/press-pack
 */
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";
import YAML from "yaml";

import { FOUNDATION } from "../src/data/foundation.ts";
import { PRESS_PAGE } from "../src/i18n/content/press.ts";
import { htmlToPlainText } from "../src/lib/plainText.ts";
import {
  PRESS_MANIFEST,
  announceText,
  computeKitHash,
  concertFacts,
  concertUrl,
  hashtagsText,
  kitProblems,
  latestKit,
  loadPressKits,
  postText,
} from "../src/lib/pressKit.ts";
import { posterOnGround } from "./press-pack/graphics.mjs";
import { renderPdfs } from "./press-pack/pdf.mjs";
import {
  biogramsBody,
  esc,
  pdfDocument,
  programmeBody,
  releaseBody,
} from "./press-pack/pdf/templates.mjs";
import { RATIOS, SHORT_EDGE_FLOOR, pressPhoto } from "./press-pack/photos.mjs";
import { makeZip } from "./zip.mjs";

const WEB_ROOT = fileURLToPath(new URL("..", import.meta.url));
const at = (...parts) => path.join(WEB_ROOT, ...parts);

const PHOTO_DIR = "press-pack/photos";
const HELD_DIR = "src/assets/photos/.held-no-consent";
const POSTER_DIR = "src/assets/photos";
/** `<concert-id>.pdf`, the designer's print-ready poster. Gitignored like the photographs. */
const POSTER_PRINT_DIR = "press-pack/posters";
const OUT_DIR = "public/press";
const ARCHIVES = {
  komplet: "voctensemble-press-komplet.zip",
  zdjecia: "voctensemble-press-zdjecia.zip",
};
/** Past this, mail servers start refusing the link's own reply. */
const SIZE_CEILING = 50 * 1_000_000;

/**
 * The poster graphics. 9:16 is the story; the sheet is inset so Instagram's own bars never cover
 * the title or the dateline, and the same inset keeps the other two from touching their edges.
 */
const GRAPHICS = [
  { format: "4x5", width: 1080, height: 1350 },
  { format: "9x16", width: 1080, height: 1920 },
  { format: "16x9", width: 1920, height: 1080 },
];
const GRAPHIC_INSET = 0.88;

/* Files in the pack are read by strangers on unknown machines: CRLF so Windows tools that still
   care are happy, and a BOM so a Polish diacritic cannot be mis-decoded by whatever opens a .txt
   by double-click. Neither would be right for a file in this repository; both are right here. */
const BOM = "﻿";
const textFile = (body) => Buffer.from(BOM + body.replace(/\r?\n/g, "\r\n"), "utf8");

const problems = [];
const warnings = [];
const notes = [];
const fail = (message) => problems.push(message);

// ── Sources ───────────────────────────────────────────────────────────────────────────────────

const readYaml = (relative) => YAML.parse(readFileSync(at(relative), "utf8"));

const manifest = readYaml(PRESS_MANIFEST) ?? {};
const copy = PRESS_PAGE.schema.parse(readYaml("src/content/pages/press.yaml"));
const concerts = readYaml("src/content/concerts.yaml");

let kits = [];
try {
  kits = loadPressKits(WEB_ROOT);
} catch (error) {
  fail(error.message);
}
if (kits.length === 0 && problems.length === 0) {
  fail("there is no press kit in src/content/press-kits/ — the page has nothing to lead with.");
}
for (const kit of kits) {
  for (const problem of kitProblems(kit, concerts.find((entry) => entry.id === kit.concert))) {
    fail(problem);
  }
}

/* The same rule the whole site uses for "the next concert" (lib/cycle), fed from raw YAML: a
   station is any evening not marked `cycle: false`. */
const stations = concerts.map((entry) => ({
  id: entry.id,
  data: { order: entry.order, cycle: entry.cycle ?? true, date: entry.date },
}));
const latest = latestKit(kits, stations);
const kit = latest?.kit;
const concert = kit && concerts.find((entry) => entry.id === kit.concert);
if (kits.length > 0 && !kit) {
  warnings.push("no kit's concert is still ahead, so the pack ships without a concert kit.");
}

/** `<stem>.<anything>` in a directory, or undefined. */
function findByStem(dir, stem) {
  try {
    return readdirSync(at(dir)).find((name) => name.slice(0, name.lastIndexOf(".")) === stem);
  } catch {
    return undefined;
  }
}

let posterFile;
if (concert) {
  const name = concert.poster && findByStem(POSTER_DIR, concert.poster);
  if (!name) {
    fail(
      `concert "${concert.id}" names poster "${concert.poster ?? "(none)"}", which is not in ` +
        `${POSTER_DIR} on this machine.`,
    );
  } else {
    posterFile = at(POSTER_DIR, name);
  }
}

// ── Photo rows ────────────────────────────────────────────────────────────────────────────────

const sha256 = (data) => createHash("sha256").update(data).digest("hex");

/* A frame withheld for want of its photographer's consent must not leave this machine under any
   name — so it is matched by content as well as by file name. */
const held = new Map();
try {
  for (const name of readdirSync(at(HELD_DIR))) {
    held.set(sha256(readFileSync(at(HELD_DIR, name))), name);
  }
} catch {
  // No held directory: nothing is withheld.
}

const rows = Array.isArray(manifest.photos) ? manifest.photos : [];
if (rows.length === 0) fail(`${PRESS_MANIFEST} lists no photos.`);
const seenIds = new Set();
for (const [index, row] of rows.entries()) {
  const label = row?.id ? `photo "${row.id}"` : `photo row ${index + 1}`;
  if (!row?.id) fail(`${label} has no id.`);
  else if (seenIds.has(row.id)) fail(`${label} is listed twice.`);
  else seenIds.add(row.id);
  if (!row?.credit) fail(`${label} has no credit — an editor cannot print a photo without one.`);
  if (!row?.caption) fail(`${label} has no caption.`);
  if (!(row?.ratio in RATIOS)) fail(`${label} has ratio ${JSON.stringify(row?.ratio)}; use "16:9" or "4:5".`);
  const focus = row?.focus;
  if (!Array.isArray(focus) || focus.length !== 2 || !focus.every((n) => n >= 0 && n <= 1)) {
    fail(`${label} needs focus: [x, y], each between 0 and 1.`);
  }
  if (!row?.source) {
    fail(`${label} has no source file.`);
    continue;
  }
  let bytes;
  try {
    bytes = readFileSync(at(PHOTO_DIR, row.source));
  } catch {
    fail(`${label}: "${row.source}" is not in ${PHOTO_DIR} on this machine.`);
    continue;
  }
  const heldAs = held.get(sha256(bytes));
  if (heldAs || [...held.values()].includes(row.source)) {
    fail(`${label}: "${row.source}" is held in ${HELD_DIR} (${heldAs ?? row.source}) until its photographer consents.`);
  }
}

if (problems.length > 0) {
  console.error("\nThe press pack cannot be built:\n");
  for (const problem of problems) console.error(`  ·  ${problem}`);
  console.error(
    `\nNothing in ${OUT_DIR} was touched. /press renders its "write to us" state where the pack ` +
      "is absent, which stays true until this builds.\n",
  );
  process.exit(1);
}

// ── Output ────────────────────────────────────────────────────────────────────────────────────

rmSync(at(OUT_DIR), { recursive: true, force: true });

/** Write one file under `public/press/` and describe it as `index.json` lists it. */
function emit(relative, data, dims) {
  const file = at(OUT_DIR, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, data);
  return { path: relative, bytes: data.length, ...(dims ?? {}) };
}

const dimsOf = (info) => ({ width: info.width, height: info.height });

/** Everything komplet carries, in the order it is listed; `store` for already-compressed media. */
const kompletEntries = [];
const photoEntries = [];
const pack = (relative, data, store) => kompletEntries.push({ name: relative, data, store });

// ── Photographs ───────────────────────────────────────────────────────────────────────────────

const photos = [];
for (const row of rows) {
  const result = await pressPhoto(at(PHOTO_DIR, row.source), row);
  if (result.skipped) {
    warnings.push(
      `photo "${row.id}" skipped: its ${row.ratio} crop is ${result.skipped.width}×` +
        `${result.skipped.height}, under ${SHORT_EDGE_FLOOR} px on the short edge. ` +
        `Replace ${PHOTO_DIR}/${row.source} with the original and run this again.`,
    );
    continue;
  }
  const printPath = `zdjecia/${row.id}.jpg`;
  const print = emit(printPath, result.print.data, dimsOf(result.print.info));
  const preview = emit(`zdjecia/podglad/${row.id}.jpg`, result.preview.data, dimsOf(result.preview.info));
  const [w640, w1280] = result.thumbs.map((thumb, i) =>
    emit(
      `zdjecia/miniatury/${row.id}-${[640, 1280][i]}.webp`,
      thumb.data,
      dimsOf(thumb.info),
    ),
  );
  pack(printPath, result.print.data, true);
  photoEntries.push({ name: printPath, data: result.print.data, store: true });
  photos.push({
    ...print,
    id: row.id,
    ratio: row.ratio,
    caption: row.caption,
    credit: row.credit,
    preview,
    thumbs: { w640, w1280 },
  });
}

// ── The concert kit ───────────────────────────────────────────────────────────────────────────

const shortBio = htmlToPlainText(copy.about.shortHtml);
let concertIndex;
let facts;
if (kit && concert) {
  const dir = kit.concert;
  const url = concertUrl(FOUNDATION.site, concert.id);
  facts = concertFacts(concert);
  const performers = [
    FOUNDATION.ensemble,
    ...(concert.credits ?? []).map((credit) => `${credit.name} — ${credit.role.toLowerCase()}`),
    ...kit.guests.map((guest) => `${guest.name} — ${guest.role}`),
  ];

  const texts = {
    announceShort: ["zapowiedz-500.txt", announceText(kit, "short")],
    announceLong: ["zapowiedz-1500.txt", announceText(kit, "long")],
    post: ["post.txt", postText(kit, url)],
    hashtags: ["hashtagi.txt", hashtagsText(kit)],
  };
  const textIndex = {};
  for (const [key, [name, body]] of Object.entries(texts)) {
    const data = textFile(`${body}\n`);
    textIndex[key] = emit(`${dir}/${name}`, data);
    pack(`${dir}/${name}`, data, false);
  }

  const posterJpg = await sharp(posterFile)
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  const poster = emit(`${dir}/plakat.jpg`, posterJpg.data, dimsOf(posterJpg.info));
  pack(`${dir}/plakat.jpg`, posterJpg.data, true);

  /* The designer's print file travels byte for byte: re-rendering it would be this script
     deciding a printer's colour and resolution. Optional, because only the designer can supply
     it — its absence is a note, not a refusal. */
  let posterPrint;
  try {
    const data = readFileSync(at(POSTER_PRINT_DIR, `${kit.concert}.pdf`));
    posterPrint = emit(`${dir}/plakat-do-druku.pdf`, data);
    pack(`${dir}/plakat-do-druku.pdf`, data, true);
  } catch {
    notes.push(`no print poster: drop the designer's PDF at ${POSTER_PRINT_DIR}/${kit.concert}.pdf.`);
  }

  const graphics = [];
  for (const graphic of GRAPHICS) {
    const name = `grafika-${graphic.format}.jpg`;
    const composed = await posterOnGround(posterFile, graphic, { inset: GRAPHIC_INSET });
    const jpg = await composed.jpeg({ quality: 90, mozjpeg: true }).toBuffer({ resolveWithObject: true });
    const thumb = await sharp(jpg.data)
      .resize({ width: 640 })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    graphics.push({
      ...emit(`${dir}/${name}`, jpg.data, dimsOf(jpg.info)),
      format: graphic.format,
      thumb: emit(`${dir}/miniatury/grafika-${graphic.format}-640.webp`, thumb.data, dimsOf(thumb.info)),
    });
    pack(`${dir}/${name}`, jpg.data, true);
  }

  /* Biograms: only the texts on record. The conductor and a guest without a `bio` are named in
     the run's notes, so the gap is visible and nothing is written to fill it. */
  const bios = [
    { name: FOUNDATION.ensemble, role: "zespół wokalny", html: copy.about.longHtml },
    ...kit.guests
      .filter((guest) => guest.bio)
      .map((guest) => ({ name: guest.name, role: guest.role, html: `<p>${esc(guest.bio)}</p>` })),
  ];
  for (const credit of concert.credits ?? []) {
    notes.push(`biogramy.pdf: no biogram on record for ${credit.name} (${credit.role.toLowerCase()}).`);
  }
  for (const guest of kit.guests.filter((entry) => !entry.bio)) {
    notes.push(`biogramy.pdf: no biogram on record for ${guest.name} (${guest.role}).`);
  }

  const footer = `Kontakt dla mediów: ${FOUNDATION.mail.press} · ${FOUNDATION.site.replace(/^https?:\/\//, "")}/press`;
  const pdfDoc = (title, body) =>
    pdfDocument({
      title,
      body,
      accent: concert.accent,
      footer,
      markSvg: readFileSync(at("public/voct-mark.svg"), "utf8"),
    });
  const pdfs = await renderPdfs([
    {
      name: "informacja-prasowa",
      html: pdfDoc(
        `${concert.title} — informacja prasowa`,
        releaseBody({ kit, facts, performers, about: shortBio, contact: FOUNDATION.mail.press, concertUrl: url }),
      ),
    },
    {
      name: "program",
      html: pdfDoc(`${concert.title} — program`, programmeBody({ concert, facts, performers })),
    },
    {
      name: "biogramy",
      html: pdfDoc(`${concert.title} — biogramy`, biogramsBody({ facts, entries: bios })),
    },
  ]);
  const pdfIndex = {};
  for (const [name, data] of pdfs) {
    pdfIndex[name] = emit(`${dir}/${name}.pdf`, data);
    pack(`${dir}/${name}.pdf`, data, true);
  }

  concertIndex = {
    id: kit.concert,
    release: pdfIndex["informacja-prasowa"],
    programme: pdfIndex.program,
    biograms: pdfIndex.biogramy,
    ...textIndex,
    poster,
    ...(posterPrint ? { posterPrint } : {}),
    graphics,
  };
}

// ── The logotype ──────────────────────────────────────────────────────────────────────────────

const markSvg = readFileSync(at("public/voct-mark.svg"), "utf8");
/* The vector master paints with `currentColor`, which the site fills from CSS. A raster has no
   cascade to inherit from, so each export states its own ink: the dark mark for a light ground,
   the paper mark for a dark one. Both stay transparent — a designer places them. */
const rasterise = async (hex) =>
  sharp(Buffer.from(markSvg.replace(/currentColor/g, hex)), { density: 600 })
    .resize({ height: 2000 })
    .png()
    .toBuffer({ resolveWithObject: true });
const logo = [];
for (const [name, data, store, dims] of [
  ["logo/voct-mark.svg", Buffer.from(markSvg, "utf8"), false],
  ...(await Promise.all(
    [
      ["logo/voct-mark-na-jasnym.png", "#161514"],
      ["logo/voct-mark-na-ciemnym.png", "#F4F1E9"],
    ].map(async ([name, hex]) => {
      const png = await rasterise(hex);
      return [name, png.data, true, dimsOf(png.info)];
    }),
  )),
  ["logo/UZYCIE.txt", textFile(`Logotyp — zasady użycia\n\n${copy.about.logoUsage}\n`), false],
]) {
  logo.push(emit(name, data, dims));
  pack(name, data, store);
}

// ── Readme and invoicing ──────────────────────────────────────────────────────────────────────

const rule = "—".repeat(64);
const heading = (title) => `${title}\n${rule}\n`;
const site = FOUNDATION.site;

const readmeTxt = [
  `${FOUNDATION.ensemble} — materiały dla mediów`,
  "",
  "",
  heading("Zdjęcia — zasady użycia"),
  copy.photos.usage,
  "",
  heading("Zdjęcia — podpisy"),
  ...photos.flatMap((photo) => [
    photo.path,
    `    ${photo.caption}`,
    `    fot. ${photo.credit}`,
    `    ${photo.width} × ${photo.height} px · ${photo.ratio}`,
    "",
  ]),
  ...(concert
    ? [
        heading(`Plakat i grafiki — ${concert.title}`),
        `${kit.concert}/plakat.jpg, ${kit.concert}/grafika-*.jpg` +
          (concertIndex?.posterPrint ? `, ${concertIndex.posterPrint.path}` : ""),
        ...(concert.posterCredit ? [`    projekt plakatu: ${concert.posterCredit}`] : []),
        "",
      ]
    : []),
  heading("Kontakt"),
  `Media     ${FOUNDATION.mail.press}`,
  `Serwis    ${site}/press`,
  "",
].join("\n");
const readmeData = textFile(readmeTxt);
const readme = emit("PRZECZYTAJ.txt", readmeData);

const invoiceData = textFile(
  [
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
    `Serwis      ${site}`,
    "",
  ].join("\n"),
);
const invoice = emit("dane-do-faktury.txt", invoiceData);

// ── Archives ──────────────────────────────────────────────────────────────────────────────────

const cutAt = new Date();
const komplet = makeZip(
  [
    { name: "PRZECZYTAJ.txt", data: readmeData },
    { name: "dane-do-faktury.txt", data: invoiceData },
    ...kompletEntries,
  ],
  cutAt,
);
const zdjecia = makeZip([{ name: "PRZECZYTAJ.txt", data: readmeData }, ...photoEntries], cutAt);
const archives = {
  komplet: emit(ARCHIVES.komplet, komplet),
  zdjecia: emit(ARCHIVES.zdjecia, zdjecia),
};
for (const archive of Object.values(archives)) {
  if (archive.bytes > SIZE_CEILING) {
    warnings.push(
      `${archive.path} is ${(archive.bytes / 1_000_000).toFixed(1)} MB, over the 50 MB ceiling.`,
    );
  }
}

// ── Index ─────────────────────────────────────────────────────────────────────────────────────

const index = {
  kitHash: computeKitHash(WEB_ROOT),
  generatedAt: cutAt.toISOString(),
  readme,
  invoice,
  archives,
  photos,
  logo,
  ...(concertIndex ? { concert: concertIndex } : {}),
};
emit("index.json", Buffer.from(`${JSON.stringify(index, null, 2)}\n`, "utf8"));

// ── Report ────────────────────────────────────────────────────────────────────────────────────

const mb = (bytes) => `${(bytes / 1_000_000).toFixed(1)} MB`;
console.log(`\n${OUT_DIR}/  ·  kitHash ${index.kitHash}`);
console.log(
  `  ${photos.length} zdjęć (${photos.filter((p) => p.ratio === "16:9").length} × 16:9, ` +
    `${photos.filter((p) => p.ratio === "4:5").length} × 4:5)` +
    (concertIndex ? `  ·  zestaw: ${concertIndex.id}` : "  ·  bez zestawu koncertu"),
);
console.log(`  ${ARCHIVES.komplet}  ${mb(archives.komplet.bytes)}  (${kompletEntries.length + 2} plików)`);
console.log(`  ${ARCHIVES.zdjecia}  ${mb(archives.zdjecia.bytes)}  (${photoEntries.length + 1} plików)`);
for (const warning of warnings) console.log(`  !  ${warning}`);
for (const note of notes) console.log(`  ·  ${note}`);
console.log(`\n${OUT_DIR}/ nie wchodzi do gita — wgraj go na hosta builda i przebuduj serwis.\n`);
