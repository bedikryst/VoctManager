/**
 * @file i18n.ts
 * @description Internationalization (i18n) core configuration.
 * Locales are lazy-loaded: only the active language (plus the Polish fallback)
 * is fetched, each as its own chunk, instead of bundling all three into the
 * main entry. `i18nReady` resolves once the active bundle is registered, and
 * main.tsx holds first paint on it so the opening render already has its strings
 * (no missing-key flash). Language switches load the target bundle before
 * switching, so the UI never flashes either.
 * @architecture Enterprise SaaS 2026
 * @module shared/config/i18n
 */

import i18n from "i18next";
import type { ResourceLanguage } from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

const FALLBACK_LANGUAGE = "pl";
const SUPPORTED_LANGUAGES = ["pl", "en", "fr"] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// Each locale is a ~150KB JSON bundle. Loading all three eagerly put ~475KB of
// translation data into the main chunk — downloaded AND parsed on every boot,
// for two languages the user isn't using. Each is now its own lazy chunk.
const LOCALE_LOADERS: Record<
  SupportedLanguage,
  () => Promise<{ default: ResourceLanguage }>
> = {
  pl: () =>
    import("./locales/pl/translation.json").then((m) => ({
      default: m.default as ResourceLanguage,
    })),
  en: () =>
    import("./locales/en/translation.json").then((m) => ({
      default: m.default as ResourceLanguage,
    })),
  fr: () =>
    import("./locales/fr/translation.json").then((m) => ({
      default: m.default as ResourceLanguage,
    })),
};

const normalizeLanguage = (lng: string | undefined): SupportedLanguage => {
  const base = (lng ?? FALLBACK_LANGUAGE).split("-")[0];
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(base)
    ? (base as SupportedLanguage)
    : FALLBACK_LANGUAGE;
};

// Idempotent lazy registration of a locale bundle. Re-entrant calls for an
// already-loaded language are no-ops (guarded by hasResourceBundle; the dynamic
// import is itself cached by the bundler runtime).
const ensureLanguageLoaded = async (lng: string): Promise<void> => {
  const target = normalizeLanguage(lng);
  if (i18n.hasResourceBundle(target, "translation")) return;
  const bundle = await LOCALE_LOADERS[target]();
  i18n.addResourceBundle(target, "translation", bundle.default, true, true);
};

/**
 * Resolves once the detected language (and the Polish fallback) are registered.
 * main.tsx awaits this before the first React render.
 */
export const i18nReady: Promise<unknown> = i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // Bundles are added at runtime via addResourceBundle, not shipped here.
    resources: {},
    partialBundledLanguages: true,
    fallbackLng: FALLBACK_LANGUAGE,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    load: "languageOnly",
    nonExplicitSupportedLngs: true,
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "voctmanager_lang",
    },
    interpolation: {
      escapeValue: false,
    },
    // Resources are guaranteed present before first render (main.tsx awaits
    // i18nReady) and before every switch (changeAppLanguage loads first), so
    // i18next never suspends — matching the prior all-eager behaviour exactly.
    react: {
      useSuspense: false,
    },
  })
  .then(async () => {
    const active = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
    await ensureLanguageLoaded(active);
    // Keep the fallback's keys available so anything missing in a non-default
    // language degrades to Polish rather than showing the raw key id.
    if (active !== FALLBACK_LANGUAGE) {
      await ensureLanguageLoaded(FALLBACK_LANGUAGE);
    }
    // Re-emit languageChanged so react-i18next re-renders against the freshly
    // registered bundle.
    await i18n.changeLanguage(i18n.language);
  });

/**
 * Canonical "switch the app language" primitive. Loads the target locale bundle
 * (lazy) before switching, then changes the active i18next language (persisted
 * to localStorage by the detector) and reflects it on the document for
 * accessibility/SEO. This is the ONLY place the two should change together —
 * callers (login adoption, settings save, auth switcher) route through here so
 * they never drift. The async load is fire-and-forget to keep the signature
 * synchronous for callers. Backend persistence of the authenticated user's
 * preference is handled separately by the settings mutation (profile.language
 * is the server-side source of truth for comms).
 */
export const changeAppLanguage = (lang: string): void => {
  void (async () => {
    await ensureLanguageLoaded(lang);
    if (i18n.language !== lang) {
      await i18n.changeLanguage(lang);
    }
  })();
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang;
  }
};

export default i18n;
