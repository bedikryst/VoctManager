/**
 * @file video-stamp.mjs
 * @description Stamps every film in `public/video/` with a token of its own bytes and prints the
 *  literals `src/lib/videos.ts` should hold.
 *
 *  WHY A TOKEN AT ALL. The films are deliberately outside the build (see lib/videos.ts), which
 *  also puts them outside the content-addressing Astro would have given them. Two things came
 *  back with the hash: a URL nobody can type from memory — the same obscurity `/_astro/` names
 *  had — and a name unique per encode, which is what lets nginx serve `/video/` as immutable
 *  for a year instead of re-validating a heavy file every week.
 *
 *  IDEMPOTENT. A token already on a name is stripped before the new one is computed, so running
 *  this twice over the same bytes is a no-op and re-running after a re-encode renames once.
 *
 *  THE RENAME IS ONLY HALF. `videos.ts` carries the names as literals and the HOST carries the
 *  files; both have to match or the players 404 while every page renders correctly. The printed
 *  block goes into videos.ts, and `--verify` is what the host runs — it checks the bytes against
 *  the token already on each name and renames nothing.
 *
 *   node scripts/video-stamp.mjs            stamp public/video/, print the literals
 *   node scripts/video-stamp.mjs --verify   confirm the names match the bytes, change nothing
 * @architecture Astro assets 2026
 * @module scripts/video-stamp
 */

import { createHash } from "node:crypto";
import { readdir, rename } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VIDEO_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "video");
const TOKEN = /^[0-9a-f]{8}$/;

/** First 8 hex of the file's SHA-256, streamed so a 300 MB film never lands in memory. */
async function stamp(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex").slice(0, 8);
}

/** `landing-modal.av1.21190d6c.mp4` → `{ base: "landing-modal.av1", token: "21190d6c" }` */
function split(name) {
  const parts = name.split(".");
  const ext = parts.pop();
  const token = TOKEN.test(parts.at(-1) ?? "") ? parts.pop() : undefined;
  return { base: parts.join("."), token, ext };
}

const verify = process.argv.includes("--verify");
const files = (await readdir(VIDEO_DIR)).filter((f) => f.endsWith(".mp4")).sort();

if (files.length === 0) {
  console.error(`[video-stamp] no .mp4 in ${VIDEO_DIR}`);
  process.exit(1);
}

const named = [];
let mismatched = 0;

for (const file of files) {
  const { base, token, ext } = split(file);
  const actual = await stamp(path.join(VIDEO_DIR, file));
  const next = `${base}.${actual}.${ext}`;

  if (verify) {
    const ok = token === actual;
    if (!ok) mismatched += 1;
    console.log(`${ok ? "ok  " : "WRONG"} ${file}${ok ? "" : `  → bytes say ${actual}`}`);
  } else if (file !== next) {
    await rename(path.join(VIDEO_DIR, file), path.join(VIDEO_DIR, next));
    console.log(`${file} → ${next}`);
  } else {
    console.log(`${file} (already stamped)`);
  }
  named.push({ base, name: next });
}

if (verify) {
  if (mismatched > 0) {
    console.error(
      `\n[video-stamp] ${mismatched} file(s) do not match the token on their name. The players ` +
        `will 404 until videos.ts and this directory agree.`,
    );
    process.exit(1);
  }
  console.log(`\n[video-stamp] all ${files.length} films match their tokens.`);
  process.exit(0);
}

console.log("\n— literals for src/lib/videos.ts —\n");
for (const { base, name } of named) console.log(`  "${base}" → videoUrl("${name}")`);
