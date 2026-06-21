/**
 * @file i18n.ts
 * @description Internationalization (i18n) core configuration.
 * Implements persistent language resolution via localStorage and browser defaults.
 * @architecture Enterprise SaaS 2026
 * @module shared/config/i18n
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import pl from "./locales/pl/translation.json";
import en from "./locales/en/translation.json";
import fr from "./locales/fr/translation.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      pl: { translation: pl },
      en: { translation: en },
      fr: { translation: fr },
    },

    fallbackLng: "pl",
    supportedLngs: ["pl", "en", "fr"],
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "voctmanager_lang",
    },
    interpolation: {
      escapeValue: false,
    },
  });

/**
 * Canonical "switch the app language" primitive. Changes the active i18next
 * language (also persisted to localStorage by the detector) and reflects it on
 * the document for accessibility/SEO. This is the ONLY place the two should be
 * changed together — callers (login adoption, settings save, auth switcher)
 * route through here so they never drift. Backend persistence of the
 * authenticated user's preference is handled separately by the settings
 * mutation (profile.language is the server-side source of truth for comms).
 */
export const changeAppLanguage = (lang: string): void => {
  if (i18n.language !== lang) {
    void i18n.changeLanguage(lang);
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang;
  }
};

export default i18n;
