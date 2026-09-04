/**
 * @file ui.ts
 * @description Chrome dictionary — the short, cross-page UI strings the site carries onto every
 *  page: SiteChrome and SiteFooter (nav labels, menu affordances, footer headings, the language
 *  switcher), and the three client islands mounted above them (the photograph lightbox, the film
 *  player, the scroll-to-top control). These are
 *  ATOMIC labels, so they live as keyed strings, complete in every locale because the type says so.
 *
 *  THE ISLANDS DO NOT TAKE THEIR LOCALE AS A PROP — they read it from the document
 *  (`i18n/documentLocale`), because one of them is `transition:persist` and would otherwise hold
 *  the locale of whichever page the tab opened on. The header of that module carries the reasoning.
 *  Page PROSE does not belong here: it is the copy desk's, held in Polish under
 *  `src/content/pages/<page>.yaml` and translated per field through the overlay (`lib/pageCopy`).
 *  A page's OWN chrome — its landmark names, its affordances — sits beside that page's schema in
 *  `i18n/content/<page>.ts`, on the same rule: chrome must be complete, prose may not be required
 *  to be. Latin rubrics on the nav (Introitus, De
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
    /**
     * aria-label on the "tabula" — the page's OWN table of contents, which the chrome grows on
     * long documents (styles/tabula.css). It must not read as the site's index: the mobile card
     * and the footer already carry that one, and a reader meeting two navigations both called
     * "contents" cannot tell which is which. Hence "of this page" in every locale.
     *
     * Both pages that carry a tabula — `/obrazy` and the concert pages — are read in all three
     * locales, so all three strings are live.
     */
    readonly tabulaAria: string;
    /** The photograph archive (/obrazy) as the registrum's closing line names it, plus the gloss
        under it. Both surfaces that print it (the desktop register's closing line, the Via's
        closing row) send the reader through `localizePath`, so the name and the destination
        agree — they did not while the page was Polish-only and the hrefs were hand-written. */
    readonly archive: string;
    readonly archiveGloss: string;
  };
  /**
   * The three column heads are the POLISH HALF of a two-voice rubric — the Latin
   * (`Fundatio` · `Index` · `Vox`) is set in the component and never translated, because
   * Latin is the same in every locale and that is half the point of the form. So these
   * strings are glosses, not labels: keep them one or two words and keep them true to the
   * Latin above them.
   */
  readonly footer: {
    readonly foundation: string;
    /** Glosses `Index` — the site's own table of contents, not the word "page". */
    readonly site: string;
    readonly contactMedia: string;
    readonly home: string;
    readonly about: string;
    readonly concerts: string;
    /** The photograph archive (/obrazy). */
    readonly images: string;
    readonly contact: string;
    readonly support: string;
    readonly colophon: string;
    readonly privacy: string;
    /** The foundation's founding document, linked as a PDF beside the registry numbers. */
    readonly statute: string;
    /** Accessible name for the statute link — states the format and the new tab. */
    readonly statuteAria: string;
    /** The data-protection acronym, which is genuinely different per locale. */
    readonly dataProtection: string;
    /** Quiet note under the legal identifiers. */
    readonly donationNote: string;
    /** "Built by" credit label in the footer base row. */
    readonly realizedBy: string;
  };
  /**
   * The lightbox over a photograph (`islands/ImageLightbox`), open on /obrazy, /kolofon and every
   * concert page. All four are accessible names — a surface with no visible text of its own.
   */
  readonly lightbox: {
    readonly dialogAria: string;
    readonly close: string;
    readonly previous: string;
    readonly next: string;
  };
  /** The film player on a concert page (`islands/video/VideoPlayer`). The landing's own
      `VideoLightbox` is not here: it mounts on `/` alone, which the copy desk has not reached. */
  readonly player: {
    readonly play: string;
    readonly pause: string;
    readonly timeline: string;
    readonly fullscreen: string;
    readonly fullscreenExit: string;
    /** Shown in place of the film when the source will not load. The one VISIBLE string here. */
    readonly unavailable: string;
    /** Joins elapsed and total in the scrubber's `aria-valuetext` ("3:20 of 8:04"). One word,
        and it is a word: Polish "z" and French "sur" are not interchangeable with English "of". */
    readonly ofDuration: string;
  };
  /**
   * The scroll-to-top control (`islands/ScrollTopButton`), which BaseLayout mounts on every page
   * of the site. `hint` is VISIBLE on hover and is the one line of this dictionary that is closer
   * to a phrase than to a label — it is kept here regardless, because the control appears on
   * pages the copy desk does not hold and a missing locale would print Polish under a French
   * cursor.
   */
  readonly scrollTop: {
    readonly action: string;
    readonly hint: string;
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
      tabulaAria: "Spis treści tej strony",
      archive: "Obrazy",
      archiveGloss: "wszystkie fotografie",
    },
    footer: {
      foundation: "Fundacja",
      site: "Spis",
      contactMedia: "Kontakt i media",
      home: "Strona główna",
      about: "O nas",
      concerts: "Koncerty",
      images: "Obrazy",
      contact: "Kontakt",
      support: "Wesprzyj",
      colophon: "Kolofon",
      privacy: "Polityka prywatności",
      statute: "Statut fundacji",
      statuteAria: "Statut Fundacji VoctFoundation — dokument PDF, otwiera się w nowej karcie",
      dataProtection: "RODO",
      donationNote: "Darowizna na cele statutowe.",
      realizedBy: "Realizacja",
    },
    lightbox: {
      dialogAria: "Powiększone zdjęcie",
      close: "Zamknij",
      previous: "Poprzedni kadr",
      next: "Następny kadr",
    },
    player: {
      play: "Odtwórz wideo",
      pause: "Zatrzymaj odtwarzanie",
      timeline: "Oś czasu wideo",
      fullscreen: "Pełny ekran",
      fullscreenExit: "Zamknij pełny ekran",
      unavailable: "Materiał chwilowo niedostępny",
      ofDuration: "z",
    },
    scrollTop: {
      action: "Wróć na początek strony",
      hint: "wróć w ciszę",
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
      tabulaAria: "Contents of this page",
      archive: "Images",
      archiveGloss: "every photograph",
    },
    footer: {
      foundation: "Foundation",
      site: "Contents",
      contactMedia: "Contact & media",
      home: "Home",
      about: "About",
      concerts: "Concerts",
      images: "Images",
      contact: "Contact",
      support: "Support us",
      colophon: "Colophon",
      privacy: "Privacy policy",
      statute: "Foundation statute",
      statuteAria: "Statute of the VoctFoundation — PDF document, opens in a new tab",
      dataProtection: "GDPR",
      donationNote: "Donations serve the foundation's charitable purposes.",
      realizedBy: "Built by",
    },
    lightbox: {
      dialogAria: "Enlarged photograph",
      close: "Close",
      previous: "Previous frame",
      next: "Next frame",
    },
    player: {
      play: "Play the film",
      pause: "Pause the film",
      timeline: "Film timeline",
      fullscreen: "Full screen",
      fullscreenExit: "Exit full screen",
      unavailable: "Temporarily unavailable",
      ofDuration: "of",
    },
    scrollTop: {
      action: "Back to the top of the page",
      hint: "back into the silence",
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
      tabulaAria: "Sommaire de cette page",
      archive: "Images",
      archiveGloss: "toutes les photographies",
    },
    footer: {
      foundation: "Fondation",
      site: "Sommaire",
      contactMedia: "Contact & médias",
      home: "Accueil",
      about: "À propos",
      concerts: "Concerts",
      images: "Images",
      contact: "Contact",
      support: "Nous soutenir",
      colophon: "Colophon",
      privacy: "Politique de confidentialité",
      statute: "Statuts de la fondation",
      statuteAria: "Statuts de la Fondation VoctFoundation — document PDF, s'ouvre dans un nouvel onglet",
      dataProtection: "RGPD",
      donationNote: "Les dons servent les buts statutaires de la fondation.",
      realizedBy: "Réalisation",
    },
    lightbox: {
      dialogAria: "Photographie agrandie",
      close: "Fermer",
      previous: "Photographie précédente",
      next: "Photographie suivante",
    },
    player: {
      play: "Lire la vidéo",
      pause: "Mettre la vidéo en pause",
      timeline: "Barre de progression de la vidéo",
      fullscreen: "Plein écran",
      fullscreenExit: "Quitter le plein écran",
      unavailable: "Momentanément indisponible",
      ofDuration: "sur",
    },
    scrollTop: {
      action: "Revenir en haut de la page",
      hint: "retour au silence",
    },
  },
};
