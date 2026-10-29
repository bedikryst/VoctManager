/**
 * @file podziekowanie.ts
 * @description Every word of `/podziekowanie`: the thanks sent after one concert to the guests its
 *  invitation reached outside the notice list, with the recording, the donors, the photographs,
 *  the list itself, the cast and the acknowledgements.
 *
 *  POLISH ONLY AND OFF THE COPY DESK, like `/zaproszenie`, whose concert it is bound to
 *  (`INVITATION_CONCERT_ID`): the guests were invited in Polish, by a link sent by hand, and the
 *  page is reached the same way. The concert's facts (title, day, place, the Canticle's first
 *  verse and its gloss, the cast) and the church photograph's alt are read from the corpus entry,
 *  and the cover's hands are described by `ZAPROSZENIE`, so none of them is restated here.
 *
 *  THE PROSE STARTS FROM THE LIST'S LETTER on this concert (`backend/outreach/letters.py`,
 *  `POCHWALA_STWORZENIA`, Polish) AND DOES NOT FOLLOW IT. The two are copies: an edit to one never
 *  reaches the other. Kept from the letter: its fact (`lede`), its thanks, the donors' first two
 *  sentences, the first two photograph alts, and its register ("Ty", in forms with no grammatical
 *  gender, because the thanks and the list's own strings are written in it). The page is not the
 *  letter: the day and the city are the cover's, so `sung` does not repeat them; the donors stand
 *  in their own frame with an act under their sentences; the acknowledgements and the cast stand
 *  as a programme prints them, from those the ensemble published after the concert; the card is
 *  signed with the name alone; the list's ask opens with an invitation of the page's own, since
 *  these readers are not on the list yet.
 *
 *  THE ASK IS THE LIST'S, IN ITS OWN VOICE. The promise, the receipt and the errors are /koncerty's
 *  `notice.*` and `nuntius.ts`'s, already in "Ty", so only the sentence before them is written here.
 * @module i18n/content/podziekowanie
 */

import type { ConcertChrome } from "./koncert";

/** Binds a full name, which the typography pass does not. Built from its code point, as `lib/typo` builds its own. */
const NBSP = String.fromCharCode(0xa0);

const CONTACT_MAILBOX = "kontakt@voctensemble.com";

/** One acknowledgement: who, then what for. A `link` ends the "what for" line and leaves the
    site, so the page marks it as the card marks its other ways out. */
interface Partner {
  readonly who: string;
  readonly for: string;
  readonly link?: { readonly text: string; readonly href: string };
}

/** Those the afternoon was prepared with, as the ensemble thanked them after the concert, in the
    nominative a programme's credits use. */
const PARTNERS: readonly Partner[] = [
  {
    who: `Ewa${NBSP}Gnatkowska i Fundacja Hospicyjna „Mój Dom”`,
    for: `za zaproszenie do finału III${NBSP}edycji festiwalu „Fenomen Człowieka”`,
  },
  { who: "Polskie Centrum Informacji Muzycznej POLMIC", for: "za patronat medialny" },
  { who: `Mateusz${NBSP}Kaczmarek`, for: "za wprowadzenie do koncertu" },
  {
    who: `dr${NBSP}Wiktoria${NBSP}Antonczyk`,
    for: "za",
    link: {
      text: "artykuł o koncercie",
      href:
        "https://polmic.pl/pl/dzieje-sie/" +
        "iii-fenomen-czlowieka-widziany-przez-pryzmat-piekna-koncert-voctensemble-w-warszawskim-kosciele-wszystkich-swietych",
    },
  },
];

/** The glyph's chrome on this page. The concert page's says "wieczór", the site's word for a
    concert, and this concert was an afternoon; these readers meet the site here first. The source
    line promises an order and not a count: the reel is cut by hand and need not hold every work. */
const LISTEN: ConcertChrome["excerpts"] = {
  title: "Posłuchaj",
  source: "Fragmenty utworów w kolejności programu",
  unavailable: "Nagranie jest chwilowo niedostępne",
  play: "Odtwórz fragmenty nagrania z koncertu",
  pause: "Wstrzymaj fragmenty nagrania z koncertu",
  stop: "Zatrzymaj",
  region: "Odtwarzacz fragmentów nagrania z koncertu",
  timeline: "Oś czasu nagrania",
};

export const PODZIEKOWANIE = {
  meta: {
    title: "Dziękujemy · Pochwała Stworzenia — VoctEnsemble",
    /** What a messenger prints under the link, so the first sentence a guest reads. */
    description:
      "Zdjęcia i fragmenty nagrania z koncertu Pochwała Stworzenia w kościele Wszystkich Świętych w Warszawie, 11 października 2026.",
  },
  cover: {
    line: "Dziękujemy",
    /** The Warsaw invitation's two hands, for a reader who cannot see them. */
    hands: "Dwie dłonie wyciągnięte ku sobie w świetle, motyw ze „Stworzenia Adama” Michała Anioła",
  },
  letter: {
    lede:
      "W Asyżu przechowywany jest najstarszy znany rękopis Pieśni słonecznej. Nad pierwszymi " +
      "wersami wyrysowano w nim linie pod melodię, ale nikt nie zapisał na nich nut. Franciszek " +
      "sam ułożył do tej pieśni melodię, która się nie zachowała. Zostały tylko słowa i puste linie.",
    sung:
      "Każdy kompozytor, który później sięgał po ten tekst, wpisywał w te linie własną muzykę. " +
      "Tamtej niedzieli w kościele Wszystkich Świętych śpiewaliśmy Pieśń słoneczną w opracowaniu " +
      `Carla${NBSP}Orffa, napisanym ponad siedemset lat po Franciszku.`,
    thanks:
      "Jeśli udało Ci się wtedy przyjść, dziękujemy Ci za to niedzielne popołudnie. Śpiewało nam " +
      "się inaczej niż na próbach, bo w ławkach siedzieli ludzie, którzy przyszli posłuchać właśnie " +
      "tej muzyki.",
    /** The letter's sentences, in the donors' frame; the invitation to join them is the act under them. */
    donors:
      "Koncert był otwarty dla wszystkich dzięki darczyńcom, którzy wspierają nasze Koncerty " +
      "Duchowe. Im także bardzo dziękujemy.",
    /** What the concert page holds and this one does not, split around its link; the spaces are
        the strings', since the link sits between them with none of its own. */
    more: {
      before: "Opisy utworów i pełny tekst Pieśni z przekładem znajdziesz ",
      link: "na stronie koncertu",
      after: ".",
    },
    signature: "VoctEnsemble",
  },
  /** The act in the donors' frame. It opens the donation vault in place. */
  give: {
    act: "Dołącz do darczyńców",
  },
  listen: LISTEN,
  photos: {
    aria: "Zdjęcia z koncertu",
    /** The pair, in reading order. No caption explains it; the second alt says "the same view". */
    rehearsalAlt: "Próba VoctEnsemble przed ołtarzem głównym kościoła Wszystkich Świętych, ławki jeszcze puste",
    concertAlt: "Ten sam widok podczas koncertu: VoctEnsemble przed ołtarzem, słuchacze w ławkach",
    gallery: "Więcej zdjęć z koncertu",
  },
  /** The programme's back page. The cast's groups and the conductor's role are the corpus's. */
  cast: {
    rubric: "Wykonawcy",
  },
  partners: {
    rubric: "Podziękowania",
    list: PARTNERS,
  },
  ask: {
    rubric: "Zaproszenia",
    /** Says what the list does for this reader and nothing about how little it sends: the scope
        is the promise's under it (`notice.lede`), which the consent version records. */
    invitation: "Zostaw adres, a zaprosimy Cię na kolejny koncert.",
    noscript: "Formularz wymaga JavaScriptu. Napisz do nas na adres",
    contactEmail: CONTACT_MAILBOX,
  },
} as const;
