/**
 * @file ui.ts
 * @description Chrome dictionary — the short, cross-page UI strings shared by SiteChrome and
 *  SiteFooter (nav labels, menu affordances, footer headings, the language switcher). These are
 *  ATOMIC labels, so they live as keyed strings; page PROSE does not belong here (it lives in
 *  per-locale content modules under `i18n/content/`). Latin rubrics on the nav (Introitus, De
 *  nobis, Via, Scribe nobis, Sustinete nos) are locale-neutral and stay in the markup — only the
 *  vernacular gloss is translated here. The Polish column is the source of truth and is copied
 *  verbatim from the pre-i18n markup, so `lang="pl"` renders byte-identical to before.
 * @architecture Astro islands 2026
 * @module i18n/ui
 */

import type { Locale } from "./config";

export interface UIStrings {
  /** Skip-link target text ("jump to content"). */
  readonly skipToContent: string;
  readonly nav: {
    /** aria-label on the <header>. */
    readonly ariaHeader: string;
    /** aria-label on the primary <nav> (desktop + mobile share it). */
    readonly ariaPrimary: string;
    /** aria-label on the brand link home. */
    readonly brandAria: string;
    readonly home: string;
    readonly about: string;
    readonly concerts: string;
    readonly contact: string;
    readonly support: string;
    /** aria-label on the hamburger toggle. */
    readonly menu: string;
    /** Visible close affordance in the mobile card. */
    readonly close: string;
    /** aria-label on the close button. */
    readonly closeAria: string;
    /** aria-label around the language switcher. */
    readonly langAria: string;
  };
  readonly footer: {
    readonly foundation: string;
    readonly site: string;
    readonly contactMedia: string;
    readonly home: string;
    readonly about: string;
    readonly concerts: string;
    readonly contact: string;
    readonly support: string;
    readonly colophon: string;
    readonly privacy: string;
    /** Quiet note under the legal identifiers. */
    readonly donationNote: string;
    /** "Built by" credit label in the footer base row. */
    readonly realizedBy: string;
  };
}

export const UI: Record<Locale, UIStrings> = {
  pl: {
    skipToContent: "Przejdź do treści",
    nav: {
      ariaHeader: "Nawigacja",
      ariaPrimary: "Nawigacja główna",
      brandAria: "VoctEnsemble — strona główna",
      home: "Główna",
      about: "O nas",
      concerts: "Koncerty",
      contact: "Kontakt",
      support: "Wesprzyj",
      menu: "Menu",
      close: "Zamknij",
      closeAria: "Zamknij menu",
      langAria: "Wybór języka",
    },
    footer: {
      foundation: "Fundacja",
      site: "Strona",
      contactMedia: "Kontakt i media",
      home: "Strona główna",
      about: "O nas",
      concerts: "Koncerty",
      contact: "Kontakt",
      support: "Wesprzyj",
      colophon: "Kolofon",
      privacy: "Polityka prywatności",
      donationNote: "Darowizna na cele statutowe.",
      realizedBy: "Realizacja",
    },
  },
  en: {
    skipToContent: "Skip to content",
    nav: {
      ariaHeader: "Navigation",
      ariaPrimary: "Main navigation",
      brandAria: "VoctEnsemble — home",
      home: "Home",
      about: "About",
      concerts: "Concerts",
      contact: "Contact",
      support: "Support us",
      menu: "Menu",
      close: "Close",
      closeAria: "Close menu",
      langAria: "Language",
    },
    footer: {
      foundation: "Foundation",
      site: "Site",
      contactMedia: "Contact & media",
      home: "Home",
      about: "About",
      concerts: "Concerts",
      contact: "Contact",
      support: "Support us",
      colophon: "Colophon",
      privacy: "Privacy policy",
      donationNote: "Donations serve the foundation's charitable purposes.",
      realizedBy: "Built by",
    },
  },
  fr: {
    skipToContent: "Aller au contenu",
    nav: {
      ariaHeader: "Navigation",
      ariaPrimary: "Navigation principale",
      brandAria: "VoctEnsemble — accueil",
      home: "Accueil",
      about: "À propos",
      concerts: "Concerts",
      contact: "Contact",
      support: "Nous soutenir",
      menu: "Menu",
      close: "Fermer",
      closeAria: "Fermer le menu",
      langAria: "Langue",
    },
    footer: {
      foundation: "Fondation",
      site: "Site",
      contactMedia: "Contact & médias",
      home: "Accueil",
      about: "À propos",
      concerts: "Concerts",
      contact: "Contact",
      support: "Nous soutenir",
      colophon: "Colophon",
      privacy: "Politique de confidentialité",
      donationNote: "Les dons servent les buts statutaires de la fondation.",
      realizedBy: "Réalisation",
    },
  },
};
