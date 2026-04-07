import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import pl from "./locales/pl/translation.json";
import en from "./locales/en/translation.json";

i18n.use(initReactI18next).init({
  resources: {
    pl: { translation: pl },
    en: { translation: en },
  },
  lng: "pl", // Domyślny język
  fallbackLng: "en", // Język awaryjny
  interpolation: { escapeValue: false },
});

export default i18n;
