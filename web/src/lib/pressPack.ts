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
 *  THE COMPOSER READS THE SAME INDEX. `basketManifest` projects it into the JSON the page hands
 *  `scripts/press-basket.ts`, so the archive a reader builds from ticked boxes takes its paths,
 *  sizes and URLs from the file the generator wrote, exactly as the page's own links do.
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

// ── The composer's manifest ───────────────────────────────────────────────────────────────────

/** One file the composer can put in an archive: its path there, its size, and where to fetch it. */
export interface BasketFile {
  /** The path inside `public/press/`, which is also its path inside komplet. */
  readonly path: string;
  readonly bytes: number;
  readonly href: string;
}

/** What the composer prints about a selection, resolved at build in the page's locale. */
export interface BasketText {
  readonly htmlLang: string;
  readonly units: { readonly kB: string; readonly MB: string };
  /** Entry `n − 1` is the bar's line for `n` ticked boxes; one entry per box on the page. */
  readonly counts: readonly string[];
  /**
   * The fetch under way; `{percent}` is the share of the selection's bytes that has arrived, as
   * the locale writes a percentage. Bytes rather than files: one print poster outweighs every
   * text in the kit together.
   */
  readonly preparing: string;
  readonly failed: string;
}

/**
 * Everything `scripts/press-basket.ts` knows, serialised into the page. A checkbox carries only
 * its KEY into `items`: which files it stands for, how large they are and where they live come
 * from the index, never from markup that could drift from it.
 */
export interface BasketManifest {
  /** When the pack was cut. Every entry of a composed archive carries it, as komplet's do. */
  readonly cutAt: string;
  /** In every composed archive, first: the usage terms and every credit travel with any file. */
  readonly readme: BasketFile;
  /** Served as it is when every box is ticked, rather than rebuilt in the browser. */
  readonly komplet: BasketFile;
  readonly items: Readonly<Record<string, readonly BasketFile[]>>;
  readonly text: BasketText;
}

/** The composer's manifest for the checkboxes a page renders, keyed as the page keys them. */
export function basketManifest(
  pack: PressPack,
  items: Readonly<Record<string, readonly PressFile[]>>,
  text: BasketText,
): BasketManifest {
  const file = (entry: PressFile): BasketFile => ({
    path: entry.path,
    bytes: entry.bytes,
    href: pack.href(entry),
  });
  return {
    cutAt: pack.index.generatedAt,
    readme: file(pack.index.readme),
    komplet: file(pack.index.archives.komplet),
    items: Object.fromEntries(
      Object.entries(items).map(([key, files]) => [key, files.map(file)]),
    ),
    text,
  };
}
