import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import pl from "./locales/pl/translation.json";
import en from "./locales/en/translation.json";
import fr from "./locales/fr/translation.json";

i18n.use(initReactI18next).init({
  resources: {
    pl: { translation: pl },
    en: { translation: en },
    fr: { translation: fr },
  },
  lng: "en", // Domyślny język
  fallbackLng: "pl", // Język awaryjny
  interpolation: { escapeValue: false },
});

export default i18n;
