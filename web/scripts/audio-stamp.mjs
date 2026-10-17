/**
 * @file audio-stamp.mjs
 * @description Stamps every recording in `public/audio/` with a token of its own bytes and prints
 *  the literals `src/lib/audio.ts` should hold. The films' stamp (scripts/video-stamp.mjs) with the
 *  codec pairing taken out: a recording ships once, as AAC in MP4.
 *
 *  IDEMPOTENT. A token already on a name is stripped before the new one is computed, so running
 *  this twice over the same bytes is a no-op and re-running after a new mix renames once.
 *
 *  THE RENAME IS ONLY HALF. `audio.ts` carries the names as literals and the HOST carries the
 *  files; both have to match or the player 404s while every page renders correctly. The printed
 *  block goes into audio.ts, and `--verify` is what the host runs — it checks the bytes against the
 *  token already on each name and renames nothing.
 *
 *   node scripts/audio-stamp.mjs            stamp public/audio/, print the literals
 *   node scripts/audio-stamp.mjs --verify   confirm the names match the bytes, change nothing
 * @module scripts/audio-stamp
 */

import { createHash } from "node:crypto";
import { readdir, rename } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AUDIO_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "audio");
const TOKEN = /^[0-9a-f]{8}$/;

/** First 8 hex of the file's SHA-256, streamed. */
async function stamp(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex").slice(0, 8);
}

/** `pochwala-stworzenia-excerpts.4f1c09ab.m4a` → `{ key: "pochwala-stworzenia-excerpts", token: "4f1c09ab", ext: "m4a" }` */
function split(name) {
  const parts = name.split(".");
  const ext = parts.pop();
  const token = TOKEN.test(parts.at(-1) ?? "") ? parts.pop() : undefined;
  return { key: parts.join("."), token, ext };
}

const verify = process.argv.includes("--verify");
const files = (await readdir(AUDIO_DIR)).filter((f) => f.endsWith(".m4a")).sort();

if (files.length === 0) {
  console.error(`[audio-stamp] no .m4a in ${AUDIO_DIR}`);
  process.exit(1);
}

const named = [];
let mismatched = 0;

for (const file of files) {
  const { key, token, ext } = split(file);
  const actual = await stamp(path.join(AUDIO_DIR, file));
  const next = `${key}.${actual}.${ext}`;

  if (verify) {
    const ok = token === actual;
    if (!ok) mismatched += 1;
    console.log(`${ok ? "ok  " : "WRONG"} ${file}${ok ? "" : `  → bytes say ${actual}`}`);
  } else if (file !== next) {
    await rename(path.join(AUDIO_DIR, file), path.join(AUDIO_DIR, next));
    console.log(`${file} → ${next}`);
  } else {
    console.log(`${file} (already stamped)`);
  }
  named.push({ key, name: next });
}

if (verify) {
  if (mismatched > 0) {
    console.error(
      `\n[audio-stamp] ${mismatched} file(s) do not match the token on their name. The player ` +
        `will 404 until audio.ts and this directory agree.`,
    );
    process.exit(1);
  }
  console.log(`\n[audio-stamp] all ${files.length} recordings match their tokens.`);
  process.exit(0);
}

console.log("\n— src/lib/audio.ts, AUDIO_ASSETS —\n");
console.log(named.map(({ key, name }) => `  "${key}": audioUrl("${name}"),`).join("\n"));
