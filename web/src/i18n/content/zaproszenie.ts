/**
 * @file zaproszenie.ts
 * @description Every word of `/zaproszenie` — the printed invitation to one concert, opened on a
 *  screen, with an invitation to the next concerts where the card asks for an RSVP.
 *
 *  POLISH ONLY AND OFF THE COPY DESK, on purpose, like `/rsvp`: the invitation is Polish, the page
 *  lives until one concert has been sung, and it is reached by a link sent with the invitation.
 *  The evening's own facts (title, day, hour, map) are not restated here: the page reads them from
 *  the corpus entry `INVITATION_CONCERT_ID` names. The downloadable calendar uses the same entry.
 *
 *  THE PRINTED INVITATION IS THE SOURCE OF THE WORDING (docs/specs — the invitation PDF). The
 *  cover line, the inside page, the composers, the performers and the foundation's paragraph are
 *  the card's own sentences. The departures are deliberate: the paragraph about the concert is the
 *  card's as edited for this page; the Canticle's Polish name is spelled as the site spells it
 *  („Pieśń słoneczna”); the festival line under the place names the festival without an edition
 *  number, which the corpus has never confirmed; and the ensemble is billed above its soloists.
 *  Change the rest together with the card.
 *
 *  THE ASK IS THE LIST'S, IN THE CARD'S VOICE. Where the card prints its RSVP the page invites the
 *  reader onto the concert invitation list (`outreach`, the "Zaproszenia" list). What must read the
 *  same on every placement of that list is not written here: the promise under the sentence and
 *  the receipt's hint come from `notice.*` on /koncerty, the act and the clause from `nuntius.ts`,
 *  so the scope a reader consents to and the clause they read cannot drift. What is written here
 *  is what the card's register asks for: the list addresses its readers as "Ty", the invitation
 *  addresses its guests as "Państwo", so the sentence, the errors and the receipt's first two lines
 *  are set in the invitation's voice.
 * @architecture Astro islands 2026
 * @module i18n/content/zaproszenie
 */

export const INVITATION_CONCERT_ID = "pochwala-stworzenia";

const CONTACT_MAILBOX = "kontakt@voctensemble.com";

export const ZAPROSZENIE = {
  meta: {
    title: "Zaproszenie · Pochwała Stworzenia — VoctEnsemble",
    description:
      "VoctEnsemble zaprasza na Koncert Duchowy Pochwała Stworzenia: niedziela, 11 października 2026, godz. 13:30, Kościół Wszystkich Świętych w Warszawie. Wstęp wolny.",
  },
  cover: {
    line: "Zaproszenie na koncert",
    /** The cover's two hands, for a reader who cannot see them. */
    hands: "Dwie dłonie wyciągnięte ku sobie w świetle, motyw ze „Stworzenia Adama” Michała Anioła",
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
    place: {
      church: "Kościół Wszystkich Świętych",
      address: "pl. Grzybowski 3/5, Warszawa",
      /** The building has two churches; the festival's schedule puts this hour upstairs. */
      room: "kościół górny",
      festivalHtml: "finał festiwalu <em>Fenomen Człowieka</em>",
    },
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
        a grade above the soloists, as a concert programme bills them; the card prints the
        soloists first. */
    cast: [
      ["12 głosów VoctEnsemble", "Florent de Bazelaire"],
      ["Radu Ropotan — skrzypce", "Sebastian Kuczyński — organy"],
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
    calendarDescription:
      "Koncert Duchowy VoctEnsemble. Wstęp wolny. Kościół górny. Finał festiwalu Fenomen Człowieka.",
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
      "Fundacja wspiera rozwój VoctEnsemble i jego projektów artystycznych, tworząc warunki do ich " +
      "realizacji i spotkania z publicznością. „Pochwała Stworzenia” jest pierwszym projektem " +
      "realizowanym przez Fundację.",
  },
} as const;
