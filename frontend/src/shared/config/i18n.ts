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

export default i18n;
