/**
 * @file podziekowanie.ts
 * @description Every word of `/podziekowanie`: the thanks sent after one concert to the guests its
 *  invitation reached outside the notice list, with the recording, the photographs, the cast and
 *  the acknowledgements, and, as a postscript, the list itself.
 *
 *  POLISH ONLY AND OFF THE COPY DESK, like `/zaproszenie`, whose concert it is bound to
 *  (`INVITATION_CONCERT_ID`): the guests were invited in Polish, by a link sent by hand, and the
 *  page is reached the same way. The concert's facts (title, day, place, the Canticle's first
 *  verse and its gloss, the cast) and the church photograph's alt are read from the corpus entry,
 *  and the cover's hands are described by `ZAPROSZENIE`, so none of them is restated here.
 *
 *  THE PROSE STARTS FROM THE LIST'S LETTER on this concert (`backend/outreach/letters.py`,
 *  `POCHWALA_STWORZENIA`, Polish) AND DOES NOT FOLLOW IT. The two are copies: an edit to one never
 *  reaches the other. Kept from the letter: its fact and its sentences (`lede`, `sung`, `thanks`,
 *  the donors' first two sentences, the first two photograph alts) and its register ("Ty", in
 *  forms with no grammatical gender, because the thanks and the list's own strings are written in
 *  it). The page is not the letter: the donors are asked by an act, not a link in the sentence; the
 *  acknowledgements and the cast stand as a programme prints them, from those the ensemble
 *  published after the concert; the letter's line about the next concert opens the list's ask,
 *  since these readers are not on the list yet.
 *
 *  THE ASK IS THE LIST'S, IN ITS OWN VOICE. The promise, the receipt and the errors are /koncerty's
 *  `notice.*` and `nuntius.ts`'s, already in "Ty", so only the sentence before them is written here.
 * @module i18n/content/podziekowanie
 */

import type { ConcertChrome } from "./koncert";

/** Binds a full name, which the typography pass does not. Built from its code point, as `lib/typo` builds its own. */
const NBSP = String.fromCharCode(0xa0);

const CONTACT_MAILBOX = "kontakt@voctensemble.com";

/** The glyph's chrome on this page. The concert page's says "wieczór", the site's word for a
    concert, and this concert was an afternoon; these readers meet the site here first. */
const LISTEN: ConcertChrome["excerpts"] = {
  title: "Posłuchaj",
  source: "Po jednym fragmencie z każdego utworu",
  unavailable: "Nagranie jest chwilowo niedostępne",
  play: "Odtwórz fragmenty nagrania z koncertu",
  pause: "Wstrzymaj fragmenty nagrania z koncertu",
  stop: "Zatrzymaj",
  region: "Odtwarzacz fragmentów nagrania z koncertu",
};

export const PODZIEKOWANIE = {
  meta: {
    title: "Dziękujemy · Pochwała Stworzenia — VoctEnsemble",
    /** What a messenger prints under the link, so the first sentence a guest reads. */
    description:
      "Zdjęcia i nagranie z koncertu Pochwała Stworzenia w kościele Wszystkich Świętych w Warszawie, 11 października 2026.",
  },
  cover: {
    line: "Dziękujemy",
  },
  letter: {
    lede:
      "W Asyżu przechowywany jest najstarszy znany rękopis Pieśni słonecznej. Nad pierwszymi " +
      "wersami wyrysowano w nim linie pod melodię, ale nikt nie zapisał na nich nut. Franciszek " +
      "sam ułożył do tej pieśni melodię, która się nie zachowała. Zostały tylko słowa i puste linie.",
    sung:
      "Każdy kompozytor, który później sięgał po ten tekst, wpisywał w te linie własną muzykę. " +
      "W niedzielę 11 października w kościele Wszystkich Świętych w Warszawie śpiewaliśmy Pieśń " +
      `słoneczną z muzyką, którą ponad siedemset lat po Franciszku napisał Carl${NBSP}Orff.`,
    thanks:
      "Jeśli udało Ci się wtedy przyjść, dziękujemy Ci za to niedzielne popołudnie. Śpiewało nam " +
      "się inaczej niż na próbach, bo w ławkach siedzieli ludzie, którzy przyszli posłuchać właśnie " +
      "tej muzyki.",
    /** The letter's sentences; the invitation to join the donors is the act under them. */
    donors:
      "Koncert był otwarty dla wszystkich dzięki darczyńcom, którzy wspierają nasze Koncerty " +
      "Duchowe. Im także bardzo dziękujemy.",
    /** For whoever could not come, split around its link to the concert page. */
    otherwise: {
      before: "Jeśli tym razem nie udało Ci się przyjść,",
      link: "na stronie koncertu",
      after: "są też program z opisami utworów i tekst Pieśni z przekładem.",
    },
    closing: "Serdecznie pozdrawiamy",
    signature: "VoctEnsemble",
  },
  /** The act under the donors' sentences. It opens the donation vault in place. */
  give: {
    act: "Dołącz do darczyńców",
  },
  listen: LISTEN,
  photos: {
    aria: "Zdjęcia z koncertu",
    /** The pair, in reading order. No caption explains it; the second alt says "the same view". */
    rehearsalAlt: "Próba VoctEnsemble przed ołtarzem głównym kościoła Wszystkich Świętych, ławki jeszcze puste",
    concertAlt: "Ten sam widok podczas koncertu: VoctEnsemble przed ołtarzem, słuchacze w ławkach",
    gallery: "Wszystkie zdjęcia z koncertu",
  },
  /** The programme's back page. The cast's groups and the conductor's role are the corpus's. */
  cast: {
    rubric: "Wykonawcy",
  },
  /** Those the afternoon was prepared with, as the ensemble thanked them after the concert: who,
      in the nominative a programme's credits use, then what for. */
  partners: {
    rubric: "Podziękowania",
    list: [
      {
        who: `Ewa${NBSP}Gnatkowska i Fundacja Hospicyjna „Mój Dom”`,
        for: `za zaproszenie do finału III${NBSP}edycji festiwalu „Fenomen Człowieka”`,
      },
      { who: "Polskie Centrum Informacji Muzycznej POLMIC", for: "za patronat medialny" },
      { who: `Kamil${NBSP}Staszowski`, for: "za wprowadzenie do koncertu" },
      { who: `dr${NBSP}Wiktoria${NBSP}Antonczyk`, for: "za artykuł o koncercie" },
    ],
  },
  ask: {
    rubric: "Zaproszenia",
    invitation:
      "Daty następnego koncertu jeszcze nie znamy. Zostaw adres, a napiszemy do Ciebie, kiedy ją ustalimy.",
    noscript: "Formularz wymaga JavaScriptu. Napisz do nas na adres",
    contactEmail: CONTACT_MAILBOX,
  },
} as const;
