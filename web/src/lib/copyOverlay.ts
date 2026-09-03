/**
 * @file copyOverlay.ts
 * @description The READ side of the per-locale overlays. The site's Polish is the source and is
 *  held in two corpora — `concerts.yaml` for the evenings, `content/pages/<page>.yaml` for the
 *  static pages — and every English and French value it prints lives in an overlay file beside
 *  them, under the copy desk's own dotted key (`concert.wcielenie.about.blurb`,
 *  `page.kontakt.hero.lede`). This module is the single place that resolves one.
 *
 *  ONE LOOKUP OVER FOUR FILES. The two corpora keep their own overlays because `copy:apply` writes
 *  each of them whole, but they share a key space (`concert.` / `page.` are the namespaces), so a
 *  reader asks by key and never says which file it came from. A key present in both is refused at
 *  module load: it would mean one fact with two translations, and whichever the page did not read
 *  would rot in silence.
 *
 *  WHY THE TRANSLATIONS LEFT THE CORPUS. Keeping them beside their Polish would have meant a
 *  second line-level rewrite of a file whose ~150 comments carry decisions nothing else records,
 *  every time an editor accepted a translation — the one operation in the copy-desk plan that can
 *  destroy the corpus. With the split, `apply-copy` only ever replaces a Polish scalar in place and
 *  the overlays are machine-written whole (docs/web-copy-desk-2026-09.md §8).
 *
 *  FALLBACK IS PER FIELD, NOT PER PAGE, which is the rule stage A set for the locale maps and the
 *  reason a half-translated evening still builds: a field with no overlay value prints its Polish,
 *  beside fields that print English. A page that waited for a complete translation would show
 *  nothing at all for months.
 *
 *  BUILD-TIME ONLY. The two files are inlined by Vite as raw text and parsed once per build; the
 *  site is static, so no reader ever downloads them. Do not import this from a client island — it
 *  would ship both locales' prose into the bundle.
 * @architecture Astro islands 2026
 * @module lib/copyOverlay
 */
import YAML from "yaml";

import concertsEnRaw from "../content/concerts.en.yaml?raw";
import concertsFrRaw from "../content/concerts.fr.yaml?raw";
import pagesEnRaw from "../content/pages.en.yaml?raw";
import pagesFrRaw from "../content/pages.fr.yaml?raw";
import { DEFAULT_LOCALE, type Locale } from "../i18n/config";

/** A locale that can have an overlay: every locale but the Polish source (`DEFAULT_LOCALE`, which
    is annotated as `Locale` and so cannot narrow this type on its own). */
export type OverlayLocale = Exclude<Locale, "pl">;

/**
 * Parse one overlay, failing the build on anything that is not a flat map of strings. The files are
 * machine-written, so a shape that surprises this is a hand edit that went wrong, and it is better
 * to hear about it here than to print `[object Object]` into a page.
 */
function parseOverlay(raw: string, file: string, into: Map<string, string>): void {
  const parsed: unknown = YAML.parse(raw) ?? {};
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${file} is not a map of key → value.`);
  }
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "string") {
      throw new Error(`${file}: ${key} holds ${typeof value}, not a string.`);
    }
    if (value.length === 0) continue;
    if (into.has(key)) throw new Error(`${file}: ${key} is already translated in another overlay.`);
    into.set(key, value);
  }
}

function loadLocale(locale: OverlayLocale, files: readonly [string, string][]): ReadonlyMap<string, string> {
  const entries = new Map<string, string>();
  for (const [name, raw] of files) parseOverlay(raw, `${name}.${locale}.yaml`, entries);
  return entries;
}

const OVERLAYS: Readonly<Record<OverlayLocale, ReadonlyMap<string, string>>> = {
  en: loadLocale("en", [
    ["concerts", concertsEnRaw],
    ["pages", pagesEnRaw],
  ]),
  fr: loadLocale("fr", [
    ["concerts", concertsFrRaw],
    ["pages", pagesFrRaw],
  ]),
};

/**
 * What this locale holds for a key, or undefined where nothing has been translated yet. Polish is
 * always undefined by construction: it is the source, and it is read from `concerts.yaml`.
 */
export function overlayValue(key: string, locale: Locale): string | undefined {
  if (locale === DEFAULT_LOCALE) return undefined;
  return OVERLAYS[locale as OverlayLocale]?.get(key);
}

/** The translation of a key, or the Polish it renders. The form most callers want. */
export function withOverlay(key: string, locale: Locale, polish: string): string {
  return overlayValue(key, locale) ?? polish;
}

/** The dotted key a concert field is addressed by, on both sides of the desk. */
export function concertKey(id: string, field: string): string {
  return `concert.${id}.${field}`;
}
