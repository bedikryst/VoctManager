/**
 * @file pressKit.ts
 * @description A concert's press kit — the texts an editor or a social-media manager pastes — and
 *  every string built from it. One module, because the page's Kopiuj buttons and the files in the
 *  pack (`scripts/press-pack.mjs`) must write the SAME characters: a limit measured on one and
 *  honoured by the other would be a limit on nothing.
 *
 *  THE KIT HOLDS ONLY WHAT CANNOT BE DERIVED. The release, the announcements, the post, the
 *  hashtags, the guests and the biograms are copy, one YAML per concert in `src/content/press-kits/`.
 *  The concert's facts — its title, day, hour, place, festival, door, composers and conductor — are
 *  read from `concerts.yaml` through `concertFacts` and `performers`, never retyped. The kit's own
 *  prose does have to name the day and the hour, so `kitProblems` checks that every dated text
 *  still names the corpus's: move the concert and the build fails until the copy follows.
 *
 *  AN ANNOUNCEMENT'S LENGTH IS MEASURED, NOT LIMITED. The approved texts run past the round
 *  measures editors' forms ask for, and they ship as approved, so the page states what each one IS:
 *  its exact count, and that count rounded to fifty as the row's name. Both are measured on the
 *  exact string Kopiuj writes — `announceText`, newlines included, counted in code points — because
 *  a form counts what was pasted, not what the YAML looked like.
 *
 *  IMPORTED BY BARE NODE as well as by Astro, so every relative import carries its `.ts` extension
 *  and type-only imports say `import type`: Node strips types, it does not resolve specifiers.
 * @architecture Astro islands 2026
 * @module lib/pressKit
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "astro/zod";
import YAML from "yaml";

import { FOUNDATION } from "../data/foundation.ts";
import { upcomingStation, type CycleStation } from "./cycle.ts";
import { dayMonth, longDate, weekdayName } from "./dates.ts";

/** Inside `web/`. One `<concert-id>.yaml` per kit. */
export const PRESS_KITS_DIR = "src/content/press-kits";
/** The photographs' manifest — half of what `kitHash` covers. */
export const PRESS_MANIFEST = "press-pack/manifest.yaml";
const CONCERTS_FILE = "src/content/concerts.yaml";
const PRESS_COPY_FILE = "src/content/pages/press.yaml";
const MARK_FILE = "public/voct-mark.svg";

/**
 * The `press.yaml` fields the pack prints: the short biogram closes a release whose kit has no
 * `release.about` (and the page's "Kopiuj tekst" of it), the long one is the ensemble's entry in
 * `biogramy.pdf`, the two usage texts are the readme and the logo's note. Add a field here the day
 * the generator starts printing it.
 */
const PACK_COPY_FIELDS = [
  ["about", "shortHtml"],
  ["about", "longHtml"],
  ["about", "logoUsage"],
  ["photos", "usage"],
] as const;

/** Code points, so "ł" and "—" count as the one character an editor's form counts them as. */
export const charCount = (text: string): number => [...text].length;

/** "ok. 550": the length in characters with spaces, to the nearest fifty. */
export const roundedLength = (text: string): number => Math.round(charCount(text) / 50) * 50;

/**
 * Paragraphs as one pasteable string: each trimmed, a blank line between them. Line breaks INSIDE a
 * paragraph are kept — a YAML `|-` block is how a text states its lines (a dateline, an address).
 */
export const joinParagraphs = (paragraphs: readonly string[]): string =>
  paragraphs.map((paragraph) => paragraph.trim()).join("\n\n");

const hashtag = z
  .string()
  .regex(/^#[\p{L}\p{N}_]+$/u, "a hashtag is # followed by letters, digits or underscores");

const paragraphList = z.array(z.string().min(1)).min(1);

/** A block of prose under an optional heading. */
const sectionSchema = z.object({ heading: z.string().min(1).optional(), body: paragraphList });

const announcementSchema = z.object({
  /** One paragraph, for listings and calendars. */
  short: z.string().min(1),
  /** For a column's announcement. A block may state its own lines (a dateline, an address). */
  long: paragraphList,
});

const biogramSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  body: paragraphList,
});

const pressKitSchema = z.object({
  /** An `id` in `concerts.yaml`. */
  concert: z.string().min(1),
  /** "12 głosów · skrzypce · organy" — the corpus records no voice count, so the kit states it. */
  forces: z.string().min(1),
  /** The concert card's paragraph on /press. Absent, the corpus's `essence` stands in. */
  lede: z.string().min(1).optional(),
  /** Who presents the evening and within what, as the release's fact block names them. */
  frame: z.object({ organizers: z.string().min(1), within: z.string().min(1) }).optional(),
  release: z.object({
    title: z.string().min(1),
    subtitle: z.string().min(1).optional(),
    lead: z.string().min(1),
    sections: z.array(sectionSchema).min(1),
    /** After the practical block. Absent, the page's short biogram closes the release. */
    about: z.array(sectionSchema).optional(),
    /** The person an editor writes to; the address is the foundation's press mail. */
    contact: z.object({ name: z.string().min(1), role: z.string().min(1) }).optional(),
  }),
  announce: announcementSchema.extend({ en: announcementSchema.optional() }),
  social: z.object({
    post: paragraphList,
    hashtags: z.array(hashtag).min(1),
  }),
  /** Performers beyond the ensemble and the corpus's `credits` — the evening's instrumentalists. */
  guests: z.array(z.object({ name: z.string().min(1), role: z.string().min(1) })).default([]),
  /**
   * `biogramy.pdf` after the ensemble, in order. The Polish half always opens with the ensemble's
   * full biogram from the page (`press.yaml`), so `pl` holds the evening's people only; `en`, where
   * present, holds the ensemble too, since the page has no English. The run notes every performer
   * without a Polish biogram.
   */
  biograms: z.object({ pl: z.array(biogramSchema).min(1), en: z.array(biogramSchema).optional() }).optional(),
});

export type PressKit = z.infer<typeof pressKitSchema> & {
  /** The file's stem — by convention the concert id. */
  readonly id: string;
};

export type Announcement = z.infer<typeof announcementSchema>;
export type AnnounceMeasure = "short" | "long";

/**
 * One measure of an announcement exactly as Kopiuj writes it — `kit.announce` for the Polish,
 * `kit.announce.en` for the English.
 */
export const announceText = (announcement: Announcement, measure: AnnounceMeasure): string =>
  measure === "short" ? announcement.short.trim() : joinParagraphs(announcement.long);

/** The post, ending on the concert's own address so a pasted post always links somewhere true. */
export const postText = (kit: PressKit, concertUrl: string): string =>
  `${joinParagraphs(kit.social.post)}\n\n${concertUrl}`;

export const hashtagsText = (kit: PressKit): string => kit.social.hashtags.join(" ");

/** Every kit in `src/content/press-kits/`, parsed and validated. Throws on the first invalid file, naming it. */
export function loadPressKits(root: string = process.cwd()): PressKit[] {
  const dir = join(root, PRESS_KITS_DIR);
  let names: string[];
  try {
    names = readdirSync(dir).filter((name) => name.endsWith(".yaml")).sort();
  } catch {
    return [];
  }
  return names.map((name) => {
    const id = name.slice(0, -".yaml".length);
    const parsed = pressKitSchema.safeParse(YAML.parse(readFileSync(join(dir, name), "utf8")));
    if (!parsed.success) {
      throw new Error(`${PRESS_KITS_DIR}/${name}: ${z.prettifyError(parsed.error)}`);
    }
    return { ...parsed.data, id };
  });
}

// ── The concert, read from the corpus ─────────────────────────────────────────────────────────

/**
 * The slice of a `concerts.yaml` entry a kit reads. Structural, so the generator can hand it a
 * YAML-parsed row and the page a collection entry's `data`.
 */
export interface KitConcert {
  readonly title: string;
  readonly date?: string | undefined;
  readonly time?: string | undefined;
  readonly venue?: string | undefined;
  readonly venueNote?: string | undefined;
  readonly address?: string | undefined;
  readonly admission?: "free" | "paid" | undefined;
  readonly festival?: { readonly name: string; readonly url?: string | undefined } | undefined;
  readonly facebookEvent?: string | undefined;
  readonly credits?: readonly { readonly role: string; readonly name: string }[] | undefined;
  readonly essence?: string | undefined;
  readonly invitation?: string | undefined;
  readonly posterCredit?: string | undefined;
  readonly ritornello?: { readonly composer: string } | undefined;
  readonly program?:
    | readonly { readonly composer?: string | undefined; readonly bis?: boolean | undefined }[]
    | undefined;
}

export interface ConcertFacts {
  readonly title: string;
  /** "niedziela, 11 października 2026 — 13:30". */
  readonly dateline: string;
  /** "Kościół Wszystkich Świętych, Warszawa · kościół górny". */
  readonly venue: string;
  readonly address?: string | undefined;
  /** "Festiwal „Fenomen Człowieka”". */
  readonly festival?: string | undefined;
  /** "Wstęp wolny", or absent where the corpus states no free door. */
  readonly admission?: string | undefined;
  readonly lede?: string | undefined;
  /**
   * In programme order, the ritornello's composer last. THE BIS IS NOT HERE: an encore is the
   * ensemble's to give or not, and a press text that lists it has promised it.
   */
  readonly composers: readonly string[];
}

export function concertFacts(concert: KitConcert): ConcertFacts {
  const when = concert.date
    ? `${weekdayName(concert.date, "pl")}, ${longDate(concert.date, "pl")}`
    : "";
  const dateline = [when, concert.time].filter(Boolean).join(" — ");
  const venue = [concert.venue, concert.venueNote?.toLowerCase()].filter(Boolean).join(" · ");
  const composers = [
    ...(concert.program ?? []).filter((work) => !work.bis).map((work) => work.composer),
    concert.ritornello?.composer,
  ].filter((name): name is string => Boolean(name));
  return {
    title: concert.title,
    dateline,
    venue,
    address: concert.address,
    festival: concert.festival ? `Festiwal „${concert.festival.name}”` : undefined,
    admission: concert.admission === "free" ? "Wstęp wolny" : undefined,
    // `essence` before `invitation`: the landing's invitation greets the creatures "jak
    // rodzeństwo", the horizontal kinship the press texts are barred from (the kit's header).
    lede: concert.essence ?? concert.invitation,
    composers: [...new Set(composers)],
  };
}

/** One performer of the evening, as a release's fact block and a biogram name them. */
export interface Performer {
  readonly name: string;
  readonly role: string;
}

/**
 * Who performs, in the order every text names them: the ensemble, the corpus's `credits` (the
 * conductor), then the kit's guests. Roles are lower-case, as they read after a dash.
 */
export function performers(kit: PressKit, concert: KitConcert): Performer[] {
  return [
    { name: FOUNDATION.ensemble, role: "zespół wokalny" },
    ...(concert.credits ?? []).map((credit) => ({ name: credit.name, role: credit.role.toLowerCase() })),
    ...kit.guests,
  ];
}

/**
 * The concert card's lineup: everyone who sings and plays on one line, then each credit (the
 * conductor) on its own — "VoctEnsemble · Radu Ropotan · …" over "Florent de Bazelaire — dyrygent".
 * A pasted fact block sets `kit.forces` above it.
 */
export function lineupLines(kit: PressKit, concert: KitConcert): string[] {
  return [
    [FOUNDATION.ensemble, ...kit.guests.map((guest) => guest.name)].join(" · "),
    ...(concert.credits ?? []).map((credit) => `${credit.name} — ${credit.role.toLowerCase()}`),
  ];
}

/**
 * The concert card's Kopiuj: the fact block as plain lines, ending on the concert's address where
 * one is given. `lede: false` drops the paragraph for a text that has already told the evening in
 * its own words; `lineup` (the forces over `lineupLines`) follows the composers.
 */
export function factsText(
  facts: ConcertFacts,
  concertUrl: string | undefined,
  { lede = true, lineup = [] }: { lede?: boolean; lineup?: readonly string[] } = {},
): string {
  const door = [facts.festival, facts.admission?.toLowerCase()].filter(Boolean).join(" · ");
  return [
    facts.title,
    facts.dateline,
    facts.venue,
    facts.address,
    door ? door.charAt(0).toUpperCase() + door.slice(1) : undefined,
    "",
    lede ? facts.lede : undefined,
    "",
    facts.composers.length > 0 ? `Kompozytorzy: ${facts.composers.join(", ")}` : undefined,
    "",
    ...lineup,
    "",
    concertUrl,
  ]
    .filter((line): line is string => line !== undefined)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** A section as pasted text: its heading on the first line of its first paragraph. */
const sectionParagraphs = (section: z.infer<typeof sectionSchema>): string[] =>
  section.heading
    ? [`${section.heading}\n${section.body[0]?.trim() ?? ""}`, ...section.body.slice(1)]
    : section.body;

/**
 * Where a reader of the release goes next: the concert's page, this press page, the festival and
 * the event on Facebook — each only where the corpus has it.
 */
export function releaseLinks(concert: KitConcert, site: string, concertId: string): string[] {
  return [
    concertUrl(site, concertId),
    `${site}/press`,
    concert.festival?.url,
    concert.facebookEvent,
  ].filter((link): link is string => Boolean(link));
}

/**
 * The release as one pasteable text: headline and subtitle, lead, the sections, the practical
 * block (the facts, the lineup and the frame) and the links, who the ensemble is, and the press
 * contact. The PDF sets the same parts, with the facts as a table under the lead. `about` is the
 * page's short biogram, used only where the kit has no `release.about`; `mail` is the press
 * address. Both are passed in because they live in the page copy and the foundation's data.
 */
export function releaseText(
  kit: PressKit,
  facts: ConcertFacts,
  {
    about,
    mail,
    lineup,
    links,
  }: { about: string; mail: string; lineup: readonly string[]; links: readonly string[] },
): string {
  const { release } = kit;
  const practical = [
    factsText(facts, undefined, { lede: false, lineup }),
    ...(kit.frame
      ? [`Organizatorzy: ${kit.frame.organizers}`, `W ramach: ${kit.frame.within}`]
      : []),
  ].join("\n");
  const contact = release.contact
    ? `${release.contact.name}, ${release.contact.role}, ${mail}`
    : mail;
  return joinParagraphs([
    [release.title, release.subtitle].filter(Boolean).join("\n"),
    release.lead,
    ...release.sections.flatMap(sectionParagraphs),
    `Informacje praktyczne\n${practical}`,
    `Więcej informacji\n${links.join("\n")}`,
    ...(release.about ? release.about.flatMap(sectionParagraphs) : [`O zespole\n${about}`]),
    `Kontakt dla mediów: ${contact}`,
  ]);
}

/**
 * What in the kit's prose no longer matches the corpus. Every text that names the day must name
 * THIS day and hour, in the form a sentence uses ("11 października", "13:30"); a kit whose concert
 * moved fails here rather than handing an editor last week's date.
 */
export function kitProblems(kit: PressKit, concert: KitConcert | undefined): string[] {
  if (!concert) return [`kit "${kit.id}" names concert "${kit.concert}", which is not in the corpus.`];
  const problems: string[] = [];
  if (!concert.date || !concert.time) {
    problems.push(`concert "${kit.concert}" has no date or time in the corpus.`);
    return problems;
  }
  const day = dayMonth(concert.date, "pl");
  const dated: [string, string, string[]][] = [
    ["release.lead", kit.release.lead, [day, concert.time]],
    ["announce.short", announceText(kit.announce, "short"), [day, concert.time]],
    ["announce.long", announceText(kit.announce, "long"), [day, concert.time]],
    ["social.post", joinParagraphs(kit.social.post), [day, concert.time]],
  ];
  // English writes the hour its own way ("1.30 pm"), so only the day is held to the corpus.
  if (kit.announce.en) {
    const dayEn = dayMonth(concert.date, "en");
    dated.push(
      ["announce.en.short", announceText(kit.announce.en, "short"), [dayEn]],
      ["announce.en.long", announceText(kit.announce.en, "long"), [dayEn]],
    );
  }
  for (const [field, text, tokens] of dated) {
    for (const token of tokens) {
      // Non-breaking spaces are how a typeset copy of this text would carry "11 października".
      if (!text.replace(/ /g, " ").includes(token)) {
        problems.push(`kit "${kit.id}" ${field} does not name "${token}", the corpus's date/time.`);
      }
    }
  }
  return problems;
}

/**
 * The kit the page leads with: the one whose concert is the soonest still ahead, by the same rule
 * `upcomingStation` applies to the whole site — read at build, so the deploy after the concert is
 * what takes it down.
 */
export function latestKit<S extends CycleStation>(
  kits: readonly PressKit[],
  stations: readonly S[],
  now: Date = new Date(),
): { kit: PressKit; station: S } | undefined {
  const withKit = stations.filter((station) => kits.some((kit) => kit.concert === station.id));
  const station = upcomingStation(withKit, now);
  const kit = station && kits.find((entry) => entry.concert === station.id);
  return station && kit ? { kit, station } : undefined;
}

/** `https://voctensemble.com/koncerty/<id>` — the concert page every pasted text points at. */
export const concertUrl = (site: string, concertId: string): string =>
  `${site}/koncerty/${concertId}`;

// ── Freshness ─────────────────────────────────────────────────────────────────────────────────

/**
 * A fingerprint of everything in git that the built pack prints: every kit file, the photo
 * manifest, the corpus rows of the concerts those kits name, the page-copy fields the pack
 * carries (`PACK_COPY_FIELDS`), the foundation's data and the mark. The generator writes it into
 * `index.json`; the page recomputes it and refuses to build against a pack cut from other sources.
 *
 * The corpus and the page copy are hashed per field, not as files, so an edit to another evening
 * or to a section lede does not demand a rebuild and an upload of a pack it cannot have changed.
 */
export function computeKitHash(root: string = process.cwd()): string {
  const hash = createHash("sha256");
  const kitsDir = join(root, PRESS_KITS_DIR);
  let kitNames: string[] = [];
  try {
    kitNames = readdirSync(kitsDir).filter((name) => name.endsWith(".yaml")).sort();
  } catch {
    // No kits: the hash still covers the manifest.
  }
  const concerts = YAML.parse(readFileSync(join(root, CONCERTS_FILE), "utf8")) as {
    id: string;
  }[];
  for (const name of kitNames) {
    const source = readFileSync(join(kitsDir, name), "utf8");
    hash.update(`kit:${name}\n${source.replace(/\r\n/g, "\n")}\n`);
    const concertId = (YAML.parse(source) as { concert?: unknown } | null)?.concert;
    const row = concerts.find((entry) => entry.id === concertId);
    hash.update(`concert:${String(concertId)}\n${JSON.stringify(row ?? null)}\n`);
  }
  hash.update(
    `manifest\n${readFileSync(join(root, PRESS_MANIFEST), "utf8").replace(/\r\n/g, "\n")}\n`,
  );
  const pageCopy = YAML.parse(readFileSync(join(root, PRESS_COPY_FILE), "utf8")) as Record<
    string,
    Record<string, unknown> | undefined
  >;
  for (const [section, field] of PACK_COPY_FIELDS) {
    hash.update(`copy:${section}.${field}\n${JSON.stringify(pageCopy[section]?.[field] ?? null)}\n`);
  }
  hash.update(`foundation\n${JSON.stringify(FOUNDATION)}\n`);
  hash.update(`mark\n${readFileSync(join(root, MARK_FILE), "utf8").replace(/\r\n/g, "\n")}`);
  return hash.digest("hex").slice(0, 16);
}

// ── The pack's index ──────────────────────────────────────────────────────────────────────────

/** One file under `public/press/`, as `index.json` lists it. `path` is relative to that folder. */
export interface PressFile {
  readonly path: string;
  readonly bytes: number;
  readonly width?: number;
  readonly height?: number;
}

export interface PressPhoto extends PressFile {
  readonly id: string;
  readonly ratio: "16:9" | "4:5";
  readonly caption: string;
  readonly credit: string;
  /** 2400 px, for the lightbox. */
  readonly preview: PressFile;
  readonly thumbs: { readonly w640: PressFile; readonly w1280: PressFile };
}

export interface PressGraphic extends PressFile {
  readonly format: "4x5" | "9x16" | "16x9";
  readonly thumb: PressFile;
}

/** `public/press/index.json` — the contract between `scripts/press-pack.mjs` and the page. */
export interface PressIndex {
  readonly kitHash: string;
  readonly generatedAt: string;
  readonly readme: PressFile;
  readonly invoice: PressFile;
  readonly archives: { readonly komplet: PressFile; readonly zdjecia: PressFile };
  readonly photos: readonly PressPhoto[];
  readonly logo: readonly PressFile[];
  /** Absent when no kit's concert is still ahead. */
  readonly concert?: {
    readonly id: string;
    readonly release: PressFile;
    readonly biograms: PressFile;
    readonly announceShort: PressFile;
    readonly announceLong: PressFile;
    /** Present when the kit carries `announce.en`. */
    readonly announceShortEn?: PressFile;
    readonly announceLongEn?: PressFile;
    readonly post: PressFile;
    readonly hashtags: PressFile;
    readonly poster: PressFile;
    /** The designer's own print file, copied as-is. Absent until one is dropped into
     *  `press-pack/posters/<concert-id>.pdf`. */
    readonly posterPrint?: PressFile;
    readonly graphics: readonly PressGraphic[];
  };
}
