/**
 * @file rsvp.ts
 * @description Every word of `/rsvp` — the reply card sent with the invitations — and the two
 *  facts it shares with the backend: which evening it answers for and how many seats one reply
 *  may ask for.
 *
 *  POLISH ONLY AND OFF THE COPY DESK, on purpose. The invitations it answers are Polish and named,
 *  the page lives for ten days before one concert, and nobody reaches it except by the link sent
 *  with the invitation. The evening's own facts (title, day, hour, map) are not restated here: the
 *  page reads them from the corpus entry `RSVP_CONCERT_ID` names, so the card and the concert page
 *  cannot disagree about when to come.
 *
 *  WRITTEN TO THE GUEST WHO HAS JUST READ THE INVITATION. The rubric is the card's own word; the
 *  sentence under it is not the card's, because the card's ("Wstęp na koncert jest wolny…
 *  zaproszonych gości… do 9 października") was written for everyone the PDF goes to, and repeated
 *  here it told one guest, who had just read it, what they already knew, about guests in the third
 *  person. So it speaks to them, says why the name is asked, and leaves the admission and the
 *  deadline to the invitation. Gratitude waits for the receipt: before the act the guest may still
 *  decline. The invitation's own sentences belong to `/zaproszenie` (`i18n/content/zaproszenie.ts`).
 *
 *  THE CLAUSE IS THE SHORT FORM OF THE POLICY'S ACCOUNT. The privacy policy describes this form in
 *  full (`content/pages/polityka-prywatnosci.yaml`: `s3.reservations`, and the `reservations` items
 *  of § 4 and § 7); `privacyHtml` still carries on its own the core a guest is owed at the point of
 *  collection — what is kept, why, on what basis, for how long, and where to ask — and links to the
 *  rest. Its "30 days after" is `RESERVATION_RETENTION` in `backend/outreach/models.py`, and the
 *  three move together.
 * @architecture Astro islands 2026
 * @module i18n/content/rsvp
 */

/** The corpus id of the evening (`content/concerts.yaml`) — also the key the backend accepts
    (`backend/outreach/reservations.RESERVABLE_CONCERTS`). */
export const RSVP_CONCERT_ID = "pochwala-stworzenia";

/** `MAX_SEATS_PER_REPLY` in `backend/outreach/reservations.py`. Move the two together. */
export const RSVP_MAX_SEATS = 10;

/** What the reply form says. Handed to the island whole, so no wording lives in a component. */
export interface RsvpFormCopy {
  /** Printed under the writing line, as a reply card captions its blanks. */
  readonly nameLabel: string;
  readonly seatsLabel: string;
  readonly fewer: string;
  readonly more: string;
  /** Printed under the stepper once it stands at the ceiling; the address follows it. */
  readonly largerParty: string;
  readonly submit: string;
  readonly sending: string;
  readonly errorName: string;
  readonly errorSeats: string;
  /** The address follows it, as the way out. */
  readonly errorNetwork: string;
  /** Under the act: turns the card into a decline, the same name line and no seats. */
  readonly declineSwitch: string;
  /** The same switch, back, while the card is a decline. */
  readonly attendSwitch: string;
  readonly declineSubmit: string;
  readonly receiptTitle: string;
  readonly receiptName: string;
  readonly receiptSeats: string;
  /** Composed by the page from the corpus: "Do zobaczenia 11 października o 13:30." */
  readonly farewell: string;
  readonly change: string;
  readonly declinedTitle: string;
  readonly declinedFarewell: string;
  readonly declinedChange: string;
  readonly closed: string;
  readonly privacyHtml: string;
}

export const RSVP = {
  meta: {
    title: "Potwierdzenie obecności · Pochwała Stworzenia — VoctEnsemble",
    description:
      "Potwierdzenie obecności i rezerwacja miejsc dla zaproszonych gości: Pochwała Stworzenia, 11 października 2026, Kościół Wszystkich Świętych w Warszawie.",
  },
  /** "godz." before the hour, as the printed invitation sets it. */
  hourPrefix: "godz.",
  place: {
    church: "Kościół Wszystkich Świętych",
    address: "pl. Grzybowski 3/5, Warszawa",
    /** The building has two churches; the festival's schedule puts this hour upstairs. */
    room: "kościół górny",
  },
  rubric: "RSVP",
  welcome: "Będzie nam bardzo miło gościć Państwa na koncercie.",
  /** What the name is for, said as the reservation it becomes. */
  purpose: "Miejsca zarezerwujemy na Państwa nazwisko.",
  /** The rubric's meaning, for the page's heading as assistive technology reads it. */
  formAria: "Potwierdzenie obecności",
  /** `{date}` and `{time}` are filled from the corpus. */
  farewell: "Cieszymy się, że będą Państwo z nami. Do zobaczenia {date} o {time}.",
  form: {
    nameLabel: "imię i nazwisko",
    seatsLabel: "liczba miejsc",
    fewer: "Jedno miejsce mniej",
    more: "Jedno miejsce więcej",
    largerParty: "Większa grupa? Prosimy o wiadomość:",
    submit: "Potwierdzam obecność",
    sending: "Wysyłamy…",
    errorName: "Prosimy wpisać imię i nazwisko.",
    errorSeats: `Prosimy wybrać od 1 do ${RSVP_MAX_SEATS} miejsc.`,
    errorNetwork: "Nie udało się wysłać odpowiedzi. Prosimy spróbować ponownie albo napisać na",
    declineSwitch: "Nie mogą Państwo przyjść?",
    attendSwitch: "Jednak przyjdę",
    declineSubmit: "Niestety nie przyjdę",
    receiptTitle: "Dziękujemy za potwierdzenie",
    receiptName: "Imię i nazwisko",
    receiptSeats: "Liczba miejsc",
    change: "Zmień liczbę miejsc",
    declinedTitle: "Dziękujemy za odpowiedź",
    declinedFarewell: "Żałujemy, że tym razem nie będą Państwo z nami.",
    declinedChange: "Zmień odpowiedź",
    closed: "Przyjmowanie potwierdzeń na ten koncert jest już zamknięte.",
    privacyHtml:
      'Imię i nazwisko oraz odpowiedź zapisujemy wyłącznie po to, by przygotować miejsca na koncert (art. 6 ust. 1 lit. f RODO), i usuwamy je 30 dni po nim. Prawo dostępu, sprostowania i usunięcia danych: <a href="mailto:rodo@voctensemble.com">rodo@voctensemble.com</a>. Więcej w <a href="/polityka-prywatnosci">polityce prywatności</a>.',
  },
  /** Without JavaScript the form cannot send, so the address takes the reply instead. */
  noscript: "Potwierdzenie prosimy przesłać na adres",
  /** A reply, and a decline, go through the form; the address is for plans that change later. */
  contact: {
    line: "Gdyby plany się zmieniły, prosimy o informację:",
    email: "kontakt@voctensemble.com",
  },
  programme: "Program koncertu",
} as const;
