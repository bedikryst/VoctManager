/**
 * @file excerpts.ts
 * @description Build-time props for one concert's excerpts player (`ExcerptsPlayer`): the reel's
 *  URL, its length, its chapters and the artwork the system's media controls show. Read by every
 *  page that prints the glyph (`components/ExcerptsGlyph.astro`), so the chapters a reel is cut
 *  into are named, and validated, in one place.
 *
 *  Each chapter is named by the work it points at, read from the FULL programme by its corpus index
 *  (the encore included, whatever a page seals as unsung — a recording of the evening exists only
 *  once the evening has been sung). The composer is reduced to the surname the catalogue knows
 *  (lib/litany), per name, because the encore's credit is two people. A chapter out of order or
 *  pointing past the programme fails the build: it would otherwise name the wrong work under the
 *  right sound, and look correct. A recording not yet uploaded to the host that builds the page
 *  yields `undefined`, and the page prints no glyph at all (lib/audio `hostedAudio`).
 * @module lib/excerpts
 */

import type { ImageMetadata } from "astro";
import { getImage } from "astro:assets";
import type { CollectionEntry } from "astro:content";
import { getCollection } from "astro:content";

import type { Locale } from "../i18n/config";
import type { ExcerptChapter } from "../islands/landing/excerpts/ExcerptsPlayer";
import { hostedAudio } from "./audio";
import { programmeSurnames } from "./litany";
import { programmeLine } from "./programmeLine";

export interface ConcertExcerpts {
  /** The hosted file's URL, the island's source and the no-script link's href. */
  readonly src: string;
  /** The reel's length in seconds, as the corpus states it. */
  readonly duration: number;
  readonly chapters: readonly ExcerptChapter[];
  /** A 512px webp of `artwork`, for the lock screen and the system's media controls. */
  readonly artwork: string;
}

/** The excerpts of one concert, or `undefined` when it has none or its file is not on this host. */
export async function concertExcerpts(
  entry: CollectionEntry<"concerts">,
  lang: Locale,
  artwork: ImageMetadata,
): Promise<ConcertExcerpts | undefined> {
  const c = entry.data;
  if (!c.excerpts) return undefined;
  const src = hostedAudio(c.excerpts.asset);
  if (!src) return undefined;
  const eras = await getCollection("repertoire");
  const surnameOf = (composer: string): string =>
    composer
      .split(/\s*\/\s*/)
      .map((part) => programmeSurnames([part], eras, lang)[0])
      .filter(Boolean)
      .join(" / ");
  const chapters = c.excerpts.chapters.map((chapter, i, all) => {
    const item = c.program[chapter.program];
    if (!item) {
      throw new Error(
        `[excerpts] ${entry.id}: chapter ${i} points at program[${chapter.program}], which does not exist.`,
      );
    }
    const before = all[i - 1];
    if ((i === 0 && chapter.at !== 0) || (before && chapter.at <= before.at)) {
      throw new Error(`[excerpts] ${entry.id}: chapters must start at 0 and rise; chapter ${i} is at ${chapter.at}s.`);
    }
    return {
      at: chapter.at,
      composer: surnameOf(item.composer),
      work: programmeLine(entry.id, chapter.program, item, lang).work,
    };
  });
  return {
    src,
    duration: c.excerpts.duration,
    chapters,
    artwork: (await getImage({ src: artwork, width: 512, format: "webp" })).src,
  };
}
