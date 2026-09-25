/**
 * @file pressPack.ts
 * @description What the built press pack holds, read from its own index at build: the one place
 *  /press learns which files exist, how large they are, and what URL serves each.
 *
 *  THE PAGE LOOKS; IT IS NEVER TOLD. `scripts/press-pack.mjs` writes `public/press/index.json`
 *  beside the files it lists, and the page renders a file's controls only because this module
 *  found it there. The 2026-07 audit of /press found seven dead download links, all of them markup
 *  asserting a file instead of asking about one.
 *
 *  THREE STATES, AND ONLY ONE OF THEM IS AN ERROR:
 *  - no index — a fresh checkout, or a host the pack was never uploaded to. The page renders its
 *    texts and a "write to us" mailto in place of every download. Supported, not broken.
 *  - an index cut from other sources — its `kitHash` differs from the one this checkout computes
 *    (`computeKitHash` in lib/pressKit). The page's Kopiuj texts would then disagree with the
 *    files beside them, so THE BUILD FAILS and says what to do.
 *  - an index naming a file that is not there — a partial upload. The build fails as well.
 *
 *  EVERY URL CARRIES `?v=`, derived from the moment the pack was cut, so a regenerated ZIP or a
 *  re-cropped photo is never served from a cache that still holds the last one.
 *
 *  THE PACK IS NOT IN GIT (`web/.gitignore`): tens of megabytes of photographs, built where the
 *  originals are and uploaded to the build host by hand.
 * @architecture Astro islands 2026
 * @module lib/pressPack
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { computeKitHash, type PressFile, type PressIndex } from "./pressKit";

/** Inside `web/`, and inside `public/` so the build copies it verbatim to the served root. */
export const PACK_DIR = "public/press";

/** The URL path the pack is served under — `public/` is the served root. */
const PACK_URL_BASE = "/press";

export interface PressPack {
  readonly index: PressIndex;
  /** The URL a reader opens or downloads `file` from, cache-busted. */
  readonly href: (file: PressFile) => string;
}

/**
 * The pack on this host, or `undefined` when there is none. Throws when there is one and it is
 * stale or incomplete — see the header.
 *
 * `root` defaults to the process's working directory, which is `web/` for `astro build` and for
 * `astro dev` alike.
 */
export function readPressPack(root: string = process.cwd()): PressPack | undefined {
  const dir = join(root, PACK_DIR);
  let index: PressIndex;
  try {
    index = JSON.parse(readFileSync(join(dir, "index.json"), "utf8")) as PressIndex;
  } catch {
    return undefined;
  }

  const fix = "Run `npm run press:pack` in web/ and upload web/public/press/ to this host.";
  const expected = computeKitHash(root);
  if (index.kitHash !== expected) {
    throw new Error(
      `${PACK_DIR}/index.json was cut from other sources (kitHash ${index.kitHash}, this ` +
        `checkout computes ${expected}). ${fix}`,
    );
  }

  const missing = listedFiles(index).filter((file) => !existsSync(join(dir, file.path)));
  if (missing.length > 0) {
    throw new Error(
      `${PACK_DIR}/index.json lists files that are not on this host: ` +
        `${missing.map((file) => file.path).join(", ")}. ${fix}`,
    );
  }

  const version = Date.parse(index.generatedAt).toString(36);
  return {
    index,
    href: (file) => `${PACK_URL_BASE}/${encodeURI(file.path)}?v=${version}`,
  };
}

/** Every file the index names, in no particular order. */
function listedFiles(index: PressIndex): PressFile[] {
  const concert = index.concert;
  return [
    index.readme,
    index.invoice,
    index.archives.komplet,
    index.archives.zdjecia,
    ...index.photos.flatMap((photo) => [photo, photo.preview, photo.thumbs.w640, photo.thumbs.w1280]),
    ...index.logo,
    ...(concert
      ? [
          concert.release,
          concert.programme,
          concert.biograms,
          concert.announceShort,
          concert.announceLong,
          concert.post,
          concert.hashtags,
          concert.poster,
          ...(concert.posterPrint ? [concert.posterPrint] : []),
          ...concert.graphics.flatMap((graphic) => [graphic, graphic.thumb]),
        ]
      : []),
  ];
}

/**
 * A file size as a reader decides whether to download it on a train: kilobytes under one
 * megabyte, megabytes with one decimal below ten and none above. The number follows the locale's
 * decimal mark and the unit is the locale's own ("Mo" in French).
 */
export function formatBytes(
  bytes: number,
  htmlLang: string,
  units: { readonly kB: string; readonly MB: string },
): string {
  if (bytes < 1_000_000) {
    return `${Math.max(1, Math.round(bytes / 1000))} ${units.kB}`;
  }
  const mb = bytes / 1_000_000;
  const digits = mb < 10 ? 1 : 0;
  const value = new Intl.NumberFormat(htmlLang, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(mb);
  return `${value} ${units.MB}`;
}
