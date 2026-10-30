/**
 * @file zaproszenie.ts
 * @description Every word of `/zaproszenie` — the invitation to one concert, opened on a screen, with
 *  an invitation to the next concerts where a printed card would ask for an RSVP.
 *
 *  POLISH ONLY AND OFF THE COPY DESK, on purpose, like `/rsvp`: the invitation is Polish, the page
 *  lives until one evening has been sung, and it is reached by a link sent with the invitation.
 *  The evening's own facts (title, day, hour, venue, address, room, frame, organiser, funding) are
 *  not restated here: the page reads them from the corpus entry `INVITATION_CONCERT_ID` names, with
 *  its next performance laid over it (`lib/cycle` `currentPerformance`). A programme sung again
 *  therefore moves this page to its next evening by data alone. The downloadable calendar reads the
 *  same evening.
 *
 *  THE WORDING IS THE PRINTED CARD'S (docs/specs — the invitation PDF for 11 October 2026), carried
 *  to the evening the page now invites to. The cover line, the inside page, the composers and the
 *  foundation's paragraph are the card's own sentences. The departures are deliberate: the
 *  paragraph about the concert is the card's as edited for this page, with one sentence about the
 *  evening (the programme's second performance, and its church); the foundation's paragraph ends
 *  its first sentence at the ensemble's projects, as the conductor asked, and its second counts
 *  the foundation's concerts; the Canticle's Polish
 *  name is spelled as the site spells it („Pieśń słoneczna”); a festival is named without an
 *  edition number; the ensemble is billed above its soloists; and the donors' line under the
 *  foundation's paragraph and the cover photographs' credit are not on the card at all.
 *  `about.eveningHtml` and `about.cast` belong to one evening and change with it.
 *
 *  THE ASK IS THE LIST'S, IN THE CARD'S VOICE. Where the card prints its RSVP the page invites the
 *  reader onto the concert invitation list (`outreach`, the "Zaproszenia" list). What must read the
 *  same on every placement of that list is not written here: the promise under the sentence and
 *  the receipt's hint come from `notice.*` on /koncerty, the act and the clause from `nuntius.ts`,
 *  so the scope a reader consents to and the clause they read cannot drift. What is written here
 *  is what the card's register asks for: the list addresses its readers as "Ty", the invitation
 *  addresses its guests as "Państwo", so the sentence, the errors and the receipt's first two lines
 *  are set in the invitation's voice.
 * @module i18n/content/zaproszenie
 */

export const INVITATION_CONCERT_ID = "pochwala-stworzenia";

const CONTACT_MAILBOX = "kontakt@voctensemble.com";

export const ZAPROSZENIE = {
  meta: {
    title: "Zaproszenie · Pochwała Stworzenia — VoctEnsemble",
    description: "VoctEnsemble zaprasza na Koncert Duchowy {title}: {day}, godz. {time}, {venue}.",
    /** Appended to the description, and to the calendar's note, when admission is free. */
    free: "Wstęp wolny.",
  },
  cover: {
    line: "Zaproszenie na koncert",
    /** The cover's eclipse, for a reader who cannot see it. */
    eclipse: "Całkowite zaćmienie Słońca: ostatni błysk światła na krawędzi tarczy Księżyca",
    /** Closes the page, the smallest line on it, when the build found the eclipse's photograph. */
    credit: {
      lead: "Na okładce:",
      eclipseHtml: "całkowite zaćmienie Słońca 21&nbsp;sierpnia 2017&nbsp;r., fot. NASA/Carla&nbsp;Thomas",
    },
  },
  inside: {
    /** The inside page as assistive technology names it; it carries no heading of its own. */
    aria: "Zaproszenie",
    host: "VoctEnsemble",
    invites: "serdecznie zaprasza na",
    kind: "Koncert Duchowy",
    subtitleHtml: "inspirowany kantykiem <em>Laudes&nbsp;creaturarum</em> św. Franciszka z Asyżu",
    /** "godz." before the hour, as the printed invitation sets it. */
    hourPrefix: "godz.",
    admission: "wstęp wolny",
    /** The line under the address that names the evening's frame; `{name}` is set in italics. */
    frame: {
      finale: "finał festiwalu {name}",
      festival: "w ramach festiwalu {name}",
      series: "w ramach cyklu {name}",
    },
    organizer: "Organizator: {name}",
    signature: {
      name: "Florent de Bazelaire",
      role: "— Dyrygent VoctEnsemble",
    },
  },
  about: {
    heading: "O koncercie",
    textHtml:
      "To kolejny koncert z autorskiego cyklu Koncertów Duchowych VoctEnsemble, inspirowanego " +
      "XVIII-wieczną tradycją francuskich <em>Concerts Spirituels</em>. Program koncertu wyrasta " +
      "z <em>Laudes creaturarum</em> św. Franciszka z Asyżu, kantyku znanego jako " +
      "„Pieśń&nbsp;słoneczna” – pochwały Boga poprzez stworzenie: od słońca, księżyca " +
      "i żywiołów aż po ludzkie doświadczenie cierpienia, przebaczenia i śmierci.",
    /** The evening's place in the programme's run and its church, closing the paragraph above. */
    eveningHtml:
      "„Pochwała Stworzenia” po raz pierwszy zabrzmiała w październiku w Warszawie. Po raz drugi " +
      "usłyszą ją Państwo w Poznaniu, u franciszkanów, w kościele zakonu, który założył sam autor " +
      "kantyku.",
    /** In the card's order, which is not the running order. */
    composers: [
      "Pärt",
      "Borkowski",
      "Orff",
      "Massenet",
      "Ešenvalds",
      "Vaughan Williams",
      "Sykulski",
      "Enescu",
      "Dubra",
    ],
    /** Two lines, each line's items joined by a centred dot. The ensemble and its conductor lead,
        a grade above the soloists, as a concert programme bills them. The count of voices is the
        evening's, as the press texts give it. */
    cast: [
      ["12 głosów VoctEnsemble", "Florent de Bazelaire"],
      ["Radu Ropotan — skrzypce", "Jakub Kapała — organy"],
    ],
    programme: "Program koncertu",
  },
  actions: {
    aria: "Zachowaj datę koncertu",
    calendar: "Dodaj do kalendarza",
    facebook: "Wydarzenie na Facebooku",
    share: "Zaproś kogoś",
    accept: "Przyjmuję zaproszenie",
    accepted: "Dziękujemy. Do zobaczenia!",
    /** The calendar entry's note opens with this; admission, room, frame and organiser follow. */
    calendarDescription: "Koncert Duchowy VoctEnsemble.",
  },
  ask: {
    rubric: "Zaproszenia",
    invitation: "Z przyjemnością zaprosimy Państwa także na kolejne koncerty.",
    errorEmail: "Prosimy podać adres e-mail, na który mamy napisać.",
    errorSend: `Nie udało się wysłać. Prosimy spróbować ponownie albo napisać na ${CONTACT_MAILBOX}.`,
    sentTitle: "Prosimy sprawdzić skrzynkę.",
    sentBody: "Zapis trzeba jeszcze potwierdzić w wiadomości od VoctEnsemble.",
    noscript: "Formularz wymaga JavaScriptu. Prosimy napisać na adres",
    contactEmail: CONTACT_MAILBOX,
  },
  foundation: {
    name: "VoctFoundation",
    text:
      "Fundacja wspiera rozwój VoctEnsemble i jego projektów artystycznych. „Pochwała Stworzenia” " +
      "w Poznaniu jest drugim koncertem realizowanym przez Fundację.",
    /** The page's last, smallest line, and the link leads to the donation vault. It speaks of the
        concerts to come rather than of this one, which an outside organiser may be paying for.
        Impersonal, so it holds the card's "Państwo". */
    donors: "Następne koncerty VoctEnsemble są możliwe dzięki wsparciu darczyńców.",
    support: "Zapraszamy do ich współtworzenia, by pozostały otwarte dla wszystkich.",
  },
} as const;

/** The `inside.frame` template for an evening's festival or series. */
export const frameTemplate = (festival: {
  readonly kind: "festival" | "series";
  readonly role?: "finale" | undefined;
}): string =>
  festival.kind === "series"
    ? ZAPROSZENIE.inside.frame.series
    : festival.role === "finale"
      ? ZAPROSZENIE.inside.frame.finale
      : ZAPROSZENIE.inside.frame.festival;
