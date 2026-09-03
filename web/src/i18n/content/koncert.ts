/**
 * @file koncert.ts
 * @description Per-locale CHROME for the concert page (components/pages/ConcertPage.astro) — the
 *  band labels, the affordances, the aria names and the two default sentences the page prints when
 *  a concert supplies none. Everything here is the PAGE talking; everything the CONCERT says comes
 *  from `concerts.yaml` (Polish) through the copy desk's per-locale overlay (lib/copyOverlay), and
 *  the two must not be confused: a string in this file is the same on all six evenings, a string in
 *  the overlay belongs to one of them.
 *
 *  Latin rubrics (Ante concentum, Verbum, Itinerarium, Reflectio, Programma, Voces, Imago viva,
 *  Imagines, Tabula, Via) are locale-neutral and stay in the markup — only their vernacular gloss
 *  is held here, which is the same split `i18n/ui.ts` makes for the nav.
 *
 *  ONE LABEL SERVES THE BAND AND ITS INDEX ROW. `bands` is read twice per section: once by the
 *  tabula (the page's own table of contents, front matter and chrome alike) and once by the band's
 *  `aria-label` and section heading. That is deliberate — an index that renames what it points at
 *  is a second vocabulary for one page, and the tabula's own header in the component says so.
 *
 *  Carries no typography: write the prose plainly and let the build pass (lib/typo.ts) pin Polish
 *  orphans and French punctuation spacing in the rendered HTML. In particular, type an ORDINARY
 *  space before a French colon.
 * @architecture Astro islands 2026
 * @module i18n/content/koncert
 */

import type { Locale } from "../config";

/** The eight bands a concert page can raise, each named the same way in its heading and its index
    row. A concert that lacks the field a band hangs off never renders it — the `when` guards in the
    component are the single source of that decision. */
export interface ConcertBands {
  readonly prologue: string;
  readonly verbum: string;
  readonly tour: string;
  readonly reflection: string;
  readonly program: string;
  readonly voces: string;
  readonly film: string;
  readonly gallery: string;
}

export interface ConcertChrome {
  readonly meta: {
    /** Tail of the document title, after the concert's own. */
    readonly titleSuffix: string;
    /** The cycle's name as the breadcrumb prints it. */
    readonly breadcrumb: string;
  };
  readonly hero: {
    /** The cycle's word for one of its stations — "Obraz III". Composed with the roman numeral,
        which is data and never translated. */
    readonly station: string;
    /** What stands before the clock time in the dateline. Empty in English, which simply prints
        the time; the component joins on a space and drops an empty part. */
    readonly timePrefix: string;
    /** The scroll cue under the hero — an invitation, not an instruction. */
    readonly cue: string;
  };
  /** Gloss of `Tabula`: what the front-matter contents list and its aria-label are called. */
  readonly tabula: string;
  readonly bands: ConcertBands;
  readonly verbum: {
    /** Summary of the disclosure holding the whole transcript. */
    readonly fullCue: string;
    /** The page owning up to the editing. Subtractive only — see the band's comment. */
    readonly note: string;
  };
  readonly program: {
    /** aria-label on the credits list. */
    readonly creditsAria: string;
    /** Role for a `realizacja` line that carries no "Rola:" prefix of its own. */
    readonly realizacjaRole: string;
    /** aria-label on a movement's scriptural interlude. */
    readonly interludeAria: string;
    /** Summary of the disclosure holding a sung text beside its gloss. */
    readonly textCue: string;
    /**
     * Where the printed texts come from, for a concert that states nothing of its own. A concert
     * that does states it in `textNote`, which is a desk field and must describe THIS locale's
     * glosses — see the glossary's rule that `textNote` is not a translation of itself.
     */
    readonly textNoteDefault: string;
    /** The Spotify link's own words. */
    readonly spotify: string;
  };
  /** aria-label on the pull quote, which prints no heading of its own. */
  readonly quoteAria: string;
  readonly gallery: {
    /** The road out of the gallery, to the archive of every evening. */
    readonly allImages: string;
  };
  readonly poster: {
    readonly caption: string;
    /** Used only where a concert supplies no `posterAlt`. `{title}` takes the concert's name. */
    readonly altFallback: string;
  };
  readonly coda: {
    readonly aria: string;
    readonly navAria: string;
    /** Gloss of `Via` on the coda's rail. */
    readonly viaLabel: string;
    readonly allConcerts: string;
  };
}

/** Fill a `{name}` slot in a chrome string. One caller today (the poster's alt fallback); it exists
    so a template stays a plain string in the table rather than becoming a function per locale. */
export const fill = (template: string, values: Readonly<Record<string, string>>): string =>
  template.replace(/\{(\w+)\}/gu, (_match, name: string) => values[name] ?? "");

export const CONCERT: Record<Locale, ConcertChrome> = {
  pl: {
    meta: {
      titleSuffix: "Koncerty Duchowe · VoctEnsemble",
      breadcrumb: "Koncerty Duchowe",
    },
    hero: {
      station: "Obraz",
      timePrefix: "godz.",
      cue: "Wejdź w wieczór",
    },
    tabula: "Zawartość wieczoru",
    bands: {
      prologue: "Próg wieczoru",
      verbum: "Słowo wprowadzające",
      tour: "Wykonania",
      reflection: "Refleksja",
      program: "Program koncertu",
      voces: "Głosy wieczoru",
      film: "Zapis wieczoru",
      gallery: "Obrazy wieczoru",
    },
    verbum: {
      fullCue: "Całe słowo wprowadzenia",
      note: "Zapis słowa wprowadzającego, nieznacznie zredagowany dla czytelności.",
    },
    program: {
      creditsAria: "Obsada",
      realizacjaRole: "Realizacja",
      interludeAria: "Przerywnik biblijny",
      textCue: "Tekst i przekład",
      textNoteDefault:
        "Teksty łacińskie i oryginalne — z programów zespołu; przekłady polskie własne.",
      spotify: "wybrzmiało m.in. na Spotify",
    },
    quoteAria: "Cytat",
    gallery: { allImages: "Obrazy wszystkich wieczorów" },
    poster: {
      caption: "Plakat wieczoru",
      altFallback: "Plakat koncertu {title}",
    },
    coda: {
      aria: "Droga koncertów",
      navAria: "Nawigacja po cyklu",
      viaLabel: "Droga trwa",
      allConcerts: "Wszystkie Koncerty Duchowe",
    },
  },
  en: {
    meta: {
      titleSuffix: "Spiritual Concerts · VoctEnsemble",
      breadcrumb: "Spiritual Concerts",
    },
    hero: {
      station: "Image",
      timePrefix: "",
      cue: "Step into the evening",
    },
    tabula: "What the evening holds",
    bands: {
      prologue: "The threshold of the evening",
      verbum: "The opening word",
      tour: "Performances",
      reflection: "Reflection",
      program: "The concert programme",
      voces: "Voices of the evening",
      film: "The evening on film",
      gallery: "Images of the evening",
    },
    verbum: {
      fullCue: "The whole of the opening word",
      note: "A transcript of the opening word, lightly edited for readability.",
    },
    program: {
      creditsAria: "Performers",
      realizacjaRole: "Production",
      interludeAria: "Scriptural interlude",
      textCue: "Text and translation",
      textNoteDefault:
        "Latin and original texts from the ensemble's own programmes; English translations our own.",
      spotify: "some of it can be heard on Spotify",
    },
    quoteAria: "Quotation",
    gallery: { allImages: "Images from every evening" },
    poster: {
      caption: "The evening's poster",
      altFallback: "Poster for the concert {title}",
    },
    coda: {
      aria: "The path of the concerts",
      navAria: "Navigation within the cycle",
      viaLabel: "The road goes on",
      allConcerts: "All the Spiritual Concerts",
    },
  },
  fr: {
    meta: {
      titleSuffix: "Concerts Spirituels · VoctEnsemble",
      breadcrumb: "Concerts Spirituels",
    },
    hero: {
      station: "Image",
      timePrefix: "à",
      cue: "Entrez dans la soirée",
    },
    tabula: "Le contenu de la soirée",
    bands: {
      prologue: "Le seuil de la soirée",
      verbum: "La parole d'ouverture",
      tour: "Exécutions",
      reflection: "Réflexion",
      program: "Le programme du concert",
      voces: "Les voix de la soirée",
      film: "L'enregistrement de la soirée",
      gallery: "Images de la soirée",
    },
    verbum: {
      fullCue: "L'intégralité de la parole d'ouverture",
      note: "Transcription de la parole d'ouverture, légèrement éditée pour la lisibilité.",
    },
    program: {
      creditsAria: "Distribution",
      realizacjaRole: "Réalisation",
      interludeAria: "Interlude biblique",
      textCue: "Texte et traduction",
      textNoteDefault:
        "Textes latins et originaux tirés des programmes de l'ensemble ; traductions françaises les nôtres.",
      spotify: "on peut en écouter une partie sur Spotify",
    },
    quoteAria: "Citation",
    gallery: { allImages: "Images de toutes les soirées" },
    poster: {
      caption: "L'affiche de la soirée",
      altFallback: "Affiche du concert {title}",
    },
    coda: {
      aria: "Le chemin des concerts",
      navAria: "Navigation dans le cycle",
      viaLabel: "Le chemin continue",
      allConcerts: "Tous les Concerts Spirituels",
    },
  },
};
