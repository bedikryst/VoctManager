/**
 * @file zip.test.mjs
 * @description Holds the two ZIP writers of /press to each other: `src/lib/zipStore.ts`, which the
 *  composer runs in a reader's browser, and `scripts/zip.mjs`, which cuts komplet. Stored, the
 *  same entries at the same date must come out as the same bytes — the browser's archive is then
 *  exactly as readable as the one `Expand-Archive` already opened.
 *
 *  Run from `web/`: `npm run test:zip`.
 * @architecture Astro islands 2026
 * @module scripts/zip.test
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { crc32 as zlibCrc32 } from "node:zlib";

import { crc32, zipStore } from "../src/lib/zipStore.ts";
import { makeZip } from "./zip.mjs";

const BOM = String.fromCharCode(0xfeff);
const text = (body) => new TextEncoder().encode(BOM + body.replace(/\n/g, "\r\n"));

/* The shapes the composer packs: a Polish text with a BOM, media bytes, a nested path, a name
   beyond ASCII, and an empty file. */
const ENTRIES = [
  { name: "PRZECZYTAJ.txt", data: text("Zdjęcia — zasady użycia\nfot. Kamila Grudzińska\n") },
  { name: "zdjecia/voctensemble-01-fot-voctensemble.jpg", data: new Uint8Array(randomBytes(200_000)) },
  { name: "pochwala-stworzenia/zapowiedz-500.txt", data: text("Pochwała Stworzenia\n") },
  { name: "logo/użycie.txt", data: text("Logotyp\n") },
  { name: "pusty.txt", data: new Uint8Array(0) },
];
const CUT_AT = new Date(2026, 8, 25, 23, 33, 11);

test("crc32 agrees with zlib", () => {
  for (const entry of ENTRIES) {
    assert.equal(crc32(entry.data), zlibCrc32(entry.data), entry.name);
  }
});

test("zipStore writes the bytes makeZip writes with every entry stored", () => {
  const ours = Buffer.concat(zipStore(ENTRIES, CUT_AT));
  const theirs = makeZip(
    ENTRIES.map((entry) => ({ name: entry.name, data: Buffer.from(entry.data), store: true })),
    CUT_AT,
  );
  assert.equal(ours.length, theirs.length);
  assert.ok(ours.equals(theirs), "the archives differ");
});

test("an empty selection is still a valid archive", () => {
  const ours = Buffer.concat(zipStore([], CUT_AT));
  assert.ok(ours.equals(makeZip([], CUT_AT)));
  assert.equal(ours.length, 22);
});
