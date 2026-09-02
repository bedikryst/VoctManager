/**
 * @file copyOverlay.ts
 * @description The READ side of the per-locale overlays. `concerts.yaml` is Polish-only; every
 *  English and French value the site prints for a concert lives in `concerts.en.yaml` /
 *  `concerts.fr.yaml` under the copy desk's own dotted key (`concert.wcielenie.about.blurb`), and
 *  this module is the single place that resolves one.
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

import enRaw from "../content/concerts.en.yaml?raw";
import frRaw from "../content/concerts.fr.yaml?raw";
import { DEFAULT_LOCALE, type Locale } from "../i18n/config";

/** A locale that can have an overlay: every locale but the Polish source (`DEFAULT_LOCALE`, which
    is annotated as `Locale` and so cannot narrow this type on its own). */
export type OverlayLocale = Exclude<Locale, "pl">;

/**
 * Parse one overlay, failing the build on anything that is not a flat map of strings. The files are
 * machine-written, so a shape that surprises this is a hand edit that went wrong, and it is better
 * to hear about it here than to print `[object Object]` into a page.
 */
function parseOverlay(raw: string, locale: OverlayLocale): ReadonlyMap<string, string> {
  const parsed: unknown = YAML.parse(raw) ?? {};
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`concerts.${locale}.yaml is not a map of key → value.`);
  }
  const entries = new Map<string, string>();
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "string") {
      throw new Error(`concerts.${locale}.yaml: ${key} holds ${typeof value}, not a string.`);
    }
    if (value.length > 0) entries.set(key, value);
  }
  return entries;
}

const OVERLAYS: Readonly<Record<OverlayLocale, ReadonlyMap<string, string>>> = {
  en: parseOverlay(enRaw, "en"),
  fr: parseOverlay(frRaw, "fr"),
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
