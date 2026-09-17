/**
 * @file nuntius.ts
 * @description The concert notice list's chrome, in all three locales: the form's labels and
 *  errors, the consent clause, and every state the `/nuntius` receipt page can be in.
 *
 *  WHY ALL OF THIS IS CHROME AND NOT COPY ON THE DESK. The line the site draws is not "prose vs
 *  label" but whether COMPLETENESS CAN BE DEMANDED (copy-desk spec §6r): a field that may print
 *  Polish beside English is copy; one that would be BROKEN in Polish on an English page is
 *  chrome, and `Record<Locale, …>` is what makes the compiler say so. Both halves of this band
 *  are on the demanding side, for two different reasons:
 *
 *  - **The consent clause.** It is the text a reader agrees to, and the version they saw is
 *    stamped into the consent record (`outreach/consent.py`). A per-field fallback would let an
 *    English reader tick a Polish sentence while the database recorded a clause version as if
 *    they had read it. That is the one fallback on this site that would make a record untrue.
 *  - **The receipt page.** It says whether a link worked. A state message in the wrong language
 *    is not a rough edge there, it is a reader who cannot tell whether they are subscribed.
 *
 *  What DOES go to the desk is the band's own voice — the heading, the invitation, and what the
 *  page says once the mail is on its way. Those live in `src/content/pages/koncerty.yaml` under
 *  `notice.*`, where Florent can edit them.
 *
 *  THE CLAUSE AND ITS VERSION MOVE TOGETHER. Changing what `consentHtml` PROMISES — the purpose,
 *  the frequency, the controller, how to withdraw — means bumping `NOTICE_CLAUSE_VERSION` in
 *  `backend/outreach/consent.py` in the same commit, and saying so in the privacy policy's own
 *  history. Fixing a typo is not a bump.
 *
 *  `consentHtml` IS A FIRST LAYER, NOT THE ACCOUNT. It carries the three things art. 13 wants in
 *  front of a reader as they hand the address over — who the controller is, what it is for, how
 *  to leave — and links the rest, which is the shape the EDPB's transparency guidelines describe
 *  and the shape `content/pages/polityka-prywatnosci.yaml` was already written for (see the note
 *  above its *Lista zaproszeń* section). Anything this clause stops saying must be findable
 *  there BEFORE it leaves here; a detail that exists in neither place is one nobody was told.
 * @architecture Astro islands 2026
 * @module i18n/content/nuntius
 */

import type { Locale } from "../config";

/** Every state the receipt page can render. `checking` is the in-flight one; `missing` is the
    page opened with no token at all, which is what a reader sees if they bookmark it. */
export type NoticeState =
  | "checking"
  /**
   * A link has been opened and NOTHING HAS BEEN SPENT YET — the page is holding the token and
   * waiting for a person to press the button. These two are what keeps automatic execution from
   * standing in for human action: the mount effect reads the URL, and only a click POSTs.
   *
   * The older arrangement, which POSTed from the effect, already kept link scanners from spending
   * a token on the GET. What it could not do is show that the reader themselves decided — and on
   * a double opt-in list the deliberate act IS the evidence, so it may not be inferred from a
   * browser having run some JavaScript.
   */
  | "confirm"
  | "unsubscribe"
  | "confirmed"
  | "already_confirmed"
  | "expired"
  | "invalid"
  | "unsubscribed"
  | "already_unsubscribed"
  | "missing"
  | "error"
  /** The greeting form, open and waiting. Reached by `?preferences=…`, which — unlike the other
      two links — asks before it does anything, because there is nothing here to spend. */
  | "preferences"
  | "preferences_saved"
  /** A live token whose consent has since been withdrawn: a real person, no letter to greet. */
  | "withdrawn";

export interface NoticeStateCopy {
  readonly title: string;
  readonly body: string;
}

export interface NoticeFormChrome {
  /** Landmark name for the band. Read instead of its heading, so it names the band. */
  readonly bandAria: string;
  readonly emailLabel: string;
  readonly emailPlaceholder: string;
  /**
   * The one optional field. THE LABEL CARRIES THE WORD "OPTIONAL" AND NOTHING ELSE: what the
   * name is FOR is stated in the clause a few centimetres below, which the reader has to read
   * anyway, and a hint repeating it would be the same promise made twice on one screen. What
   * the label may not do is stay silent about the field being optional — a name asked for
   * without that word is a name most people will believe is required.
   */
  readonly nameLabel: string;
  readonly namePlaceholder: string;
  /** The clause itself — inline markup, rendered through `set:html`. */
  readonly consentHtml: string;
  readonly submit: string;
  readonly submitting: string;
  /** Errors, in the order the form checks them. `errorSend` names the inbox to write to. */
  readonly errorEmail: string;
  readonly errorSend: string;
  /**
   * The waiting leaf's own controls. Its two sentences are the BAND'S — `koncerty.yaml`, under
   * `notice.sentTitle` / `sentBody` / `sentHint`, where the desk can edit them. What is here is
   * only what a reader operates, which is chrome for the reason the whole file is.
   *
   * `pendingAddressLabel` names a value this browser typed and nothing else. It may not be
   * phrased as a report of where a letter went: the endpoint answers identically for a new
   * address, one already pending and one long confirmed, and a line reading "we wrote to …"
   * would turn the receipt into the membership oracle the endpoint refuses to be.
   */
  readonly pendingAddressLabel: string;
  readonly editAddress: string;
  /** The recovery disclosure, shut by default — a reader whose letter arrived never opens it. */
  readonly recoverySummary: string;
  readonly recoveryBody: string;
  readonly resend: string;
  readonly resending: string;
  /**
   * NEVER "the letter has been sent". `subscribe()` accepts a request; whether a mail followed
   * depends on the cooldown it may have been swallowed by and on a transport that reports its
   * failures to us and not to the reader. This says what we actually know we did.
   */
  readonly resent: string;
  /** `{time}` is a mm:ss countdown mirroring the server's own resend floor. */
  readonly resendWait: string;
  /** The band without JavaScript: the form cannot post, so it says where to write instead. */
  readonly noscript: string;
}

/**
 * The one control on the receipt page — the greeting form. Small enough to be chrome rather than
 * desk copy, and it has to be: a label printed in Polish under English prose would be a control
 * the reader cannot read.
 */
export interface NoticePreferencesChrome {
  readonly nameLabel: string;
  readonly namePlaceholder: string;
  readonly submit: string;
  readonly submitting: string;
  /** What an empty field does. Stated at the control, because "clear it" is not guessable. */
  readonly clearHint: string;
  readonly errorSend: string;
}

export interface NuntiusPageChrome {
  readonly meta: { readonly title: string; readonly description: string };
  /** Latin rubric's vernacular gloss; the Latin `Nuntius` stands unchanged beside it. */
  readonly eyebrow: string;
  readonly states: Readonly<Record<NoticeState, NoticeStateCopy>>;
  readonly preferences: NoticePreferencesChrome;
  /** The two buttons that spend a token. Each names its own act rather than saying "continue":
      the reader is about to join a list or leave one, and those are not the same press. */
  readonly actions: {
    readonly confirm: string;
    readonly confirming: string;
    readonly unsubscribe: string;
    readonly unsubscribing: string;
  };
  /**
   * The programme entry a confirmed leaf carries. It has no "there is no concert" string, and
   * that absence is the design: `confirmed.body` already states what the list promises without
   * naming a date, so an evening exists or the leaf simply says nothing about one. A second
   * sentence for the empty case would print the same promise twice.
   */
  readonly programme: {
    readonly eyebrow: string;
    readonly action: string;
  };
  readonly backToConcerts: string;
  readonly backHome: string;
  readonly noscript: string;
}

/**
 * The invitation, which is deliberately NOT a form. Three surfaces stand away from `/koncerty` and
 * name the list rather than take an address: the landing's open card, the closing rail of the
 * newest concert, and `/kontakt`. Each of them points at the band, which is the single place a
 * consent is given — a second form would mean a second `surface` value, and `surface` is part of
 * the consent record, not a click path.
 *
 * Chrome, not desk copy, for the reason this whole file is: a link label that printed Polish under
 * English prose would be a control the reader cannot read, and this one is repeated on three pages
 * at once. It also says nothing about whether a date exists — the band above it does, and the day
 * the sixth evening is announced that sentence changes while these three do not.
 */
export interface NuntiusInvitation {
  /** What the address is for, in one sentence. The rubric alone would be a riddle. */
  readonly line: string;
  /**
   * The act. No arrow: each surface prints its own, in its own direction.
   *
   * IT NAMES THE LIST, NOT THE ADDRESS, because one surface prints it with no `line` above it:
   * the landing's poster block, where the act stands beside "see the programme" and two lines
   * under a church's street address. "Leave your address" there named the cost instead of the
   * offer and could be read as a request for somewhere to send post.
   */
  readonly cta: string;
}

/**
 * `/newsletter` — the sign-up under an address a person can be TOLD. Everything the page says is
 * the band's own voice on /koncerty, read from the desk through `NoticeSignup`; the only thing
 * owned here is what search engines and a browser tab read, which is machinery in the same sense
 * the receipt page's meta is.
 *
 * WHY THE ROUTE IS THE ONE ENGLISH WORD ON THIS SITE. The page is named for the act of finding it:
 * a reader told "sign up for the invitations" types the word they already have, and `nuntius` is
 * not that word in any of the three languages. It stays in the address bar and out of the prose —
 * the list is called *Zaproszenia · Nuntius* everywhere a reader can read it.
 *
 * WHY THE LATIN STAYS WHILE THE VERNACULAR MOVED. `/nuntius` is frozen: it is `NOTICE_PATH` in
 * the backend and it is printed into every unsubscribe link already sitting in somebody's inbox,
 * so it has to resolve for as long as those mails exist. The word beside it is free, and had to
 * move — *zawiadomienie* survives in Polish almost only in official collocations (of a crime, of
 * proceedings) and read on a concert page as a summons. The rubric is therefore a naming rather
 * than a gloss, which is the trade this route's permanence forces.
 */
export interface NuntiusSignupChrome {
  readonly meta: { readonly title: string; readonly description: string };
}

/**
 * The rubrics over /newsletter's register of evenings — two words naming two blocks, and nothing
 * else. Every fact in the register itself is DERIVED from the concert corpus (`lib/noticeRegister`):
 * the numerals, the titles, the places and the moments are data, and a locale file is the one place
 * they must never be retyped.
 *
 * `record` NAMES A RECORD OF EVENINGS, NEVER OF LETTERS. The list is new and has written to
 * nobody, so a rubric reading "the evenings we wrote about" would be the single sentence on this
 * page that the database could contradict. What the block honestly shows is what the ensemble has
 * sung — which is the same cadence, stated as a fact instead of as a claim.
 */
export interface NuntiusRegisterChrome {
  /** Over the evening still ahead — the one the next letter will be about. */
  readonly ahead: string;
  /** Over the evenings already sung. */
  readonly record: string;
  /** Names the record for a screen reader, which cannot see the rubric standing above it. */
  readonly recordAria: string;
}

export interface NuntiusChrome {
  readonly form: NoticeFormChrome;
  readonly page: NuntiusPageChrome;
  readonly signup: NuntiusSignupChrome;
  readonly register: NuntiusRegisterChrome;
  readonly invitation: NuntiusInvitation;
}

const CONTACT_MAILBOX = "kontakt@voctensemble.com";

export const NUNTIUS: Record<Locale, NuntiusChrome> = {
  pl: {
    form: {
      bandAria: "Zaproszenia na koncerty",
      emailLabel: "Adres e-mail",
      emailPlaceholder: "imie@przyklad.pl",
      nameLabel: "Imię — nieobowiązkowe",
      namePlaceholder: "Ania",
      consentHtml:
        `Zapisując się, prosisz Fundację VoctFoundation o zaproszenia na koncerty VoctEnsemble. ` +
        `Imię trafia wyłącznie do powitania listu, a wypisujesz się jednym kliknięciem ` +
        `w każdej wiadomości. Gdyby Fundacja zakończyła działalność, lista może przejść do ` +
        `osoby prowadzącej dalej ten zespół — uprzedzimy o tym osobną wiadomością. Reszta ` +
        `jest w <a href="/polityka-prywatnosci">polityce prywatności</a>.`,
      submit: "Zapisz mnie",
      submitting: "Wysyłamy…",
      errorEmail: "Podaj adres e-mail, na który mamy napisać.",
      errorSend: `Nie udało się wysłać. Spróbuj ponownie albo napisz na ${CONTACT_MAILBOX}.`,
      pendingAddressLabel: "Wpisany adres",
      editAddress: "Popraw adres",
      recoverySummary: "Wiadomość nie dotarła?",
      recoveryBody:
        "Możemy poprosić o potwierdzenie jeszcze raz. Jeśli i to nie pomoże, napisz na " +
        `${CONTACT_MAILBOX} — dopiszemy Cię ręcznie.`,
      resend: "Wyślij ponownie",
      resending: "Wysyłamy…",
      resent: "Poprosiliśmy o ponowną wysyłkę.",
      resendWait: "Kolejna prośba za {time}.",
      noscript: `Formularz wymaga JavaScriptu. Napisz na ${CONTACT_MAILBOX}, a dopiszemy Cię ręcznie.`,
    },
    page: {
      meta: {
        title: "Zaproszenia — VoctEnsemble",
        description: "Potwierdzenie zapisu na zaproszenia na koncerty VoctEnsemble.",
      },
      eyebrow: "Zaproszenia",
      states: {
        checking: {
          title: "Sprawdzamy link…",
          body: "To potrwa chwilę.",
        },
        confirm: {
          title: "Potwierdź zapis.",
          body:
            "Jeszcze jeden ruch i zaproszenia będą przychodzić na ten adres. Zgodę zapisujemy " +
            "dopiero wtedy, gdy naciśniesz — nie robi tego za Ciebie program pocztowy.",
        },
        unsubscribe: {
          title: "Wypisać ten adres?",
          body:
            "Po naciśnięciu nie wyślemy już na niego nic. Dopóki nie naciśniesz, nic się " +
            "nie dzieje.",
        },
        /* THE BODY NAMES NO DATE, and that is what lets one sentence serve both leaves: below it
           stands the programme entry when an evening is published, and nothing when none is. The
           earlier wording promised to write "when the next Spiritual Concert is given a date",
           which read as a contradiction directly above a dated programme entry. */
        confirmed: {
          title: "Jesteś na liście.",
          body:
            "Piszemy tylko o koncertach. Termin, miejsce, program i każda zmiana. " +
            "W każdej wiadomości będzie link do wypisania się.",
        },
        already_confirmed: {
          title: "Ten adres już jest na liście.",
          body: "Nic nie trzeba robić. Napiszemy, gdy będzie o czym.",
        },
        expired: {
          title: "Ten link wygasł.",
          body: "Linki potwierdzające są ważne siedem dni. Zapisz się jeszcze raz, a wyślemy nowy.",
        },
        invalid: {
          title: "Nie rozpoznajemy tego linku.",
          body:
            "Mógł już zostać użyty albo został skrócony po drodze przez program pocztowy. " +
            "Zapisz się jeszcze raz albo napisz do nas.",
        },
        unsubscribed: {
          title: "Wypisaliśmy Cię.",
          body: "Nie wyślemy już nic na ten adres. Gdybyś kiedyś zmienił zdanie — zapraszamy z powrotem.",
        },
        already_unsubscribed: {
          title: "Ten adres jest już wypisany.",
          body: "Nic więcej nie wysyłamy.",
        },
        missing: {
          title: "Tę stronę otwiera link z wiadomości.",
          body:
            "Bez niego nie ma tu nic do potwierdzenia. Jeśli chcesz dostawać zaproszenia " +
            "na koncerty, zapisz się — zajmie to chwilę.",
        },
        error: {
          title: "Coś poszło nie tak.",
          body: `Spróbuj otworzyć link jeszcze raz. Jeśli to się powtórzy, napisz na ${CONTACT_MAILBOX}.`,
        },
        preferences: {
          title: "Jak mamy się do Ciebie zwracać?",
          body:
            "Imię pojawia się wyłącznie w powitaniu listu i nigdzie indziej. Możesz je dodać, " +
            "zmienić albo usunąć — teraz i kiedykolwiek później.",
        },
        preferences_saved: {
          title: "Zapisane.",
          body: "Tak zwrócimy się do Ciebie w następnym zaproszeniu.",
        },
        withdrawn: {
          title: "Ten adres jest wypisany.",
          body:
            "Nie wysyłamy już na niego nic, więc nie ma listu, w którym moglibyśmy Cię powitać. " +
            "Jeśli chcesz wrócić na listę, zapisz się jeszcze raz.",
        },
      },
      preferences: {
        nameLabel: "Imię (nieobowiązkowe)",
        namePlaceholder: "Anna",
        submit: "Zapisz",
        submitting: "Zapisujemy…",
        clearHint: "Puste pole znaczy list bez imienia.",
        errorSend: `Nie udało się zapisać. Spróbuj jeszcze raz albo napisz na ${CONTACT_MAILBOX}.`,
      },
      actions: {
        confirm: "Potwierdzam zapis",
        confirming: "Potwierdzamy…",
        unsubscribe: "Wypisz mnie",
        unsubscribing: "Wypisujemy…",
      },
      programme: {
        eyebrow: "Najbliższy koncert",
        action: "Zobacz program",
      },
      backToConcerts: "Wróć do koncertów",
      backHome: "Strona główna",
      noscript: "Ta strona potrzebuje JavaScriptu, żeby dokończyć zapis lub wypisanie.",
    },
    signup: {
      meta: {
        title: "Zaproszenia na koncerty — VoctEnsemble",
        description:
          "Piszemy tylko o koncertach. Termin, miejsce, program i każda zmiana. Zapisz się, " +
          "a napiszemy przed następnym Koncertem Duchowym.",
      },
    },
    register: {
      ahead: "Najbliższy wieczór",
      record: "Dotychczas",
      recordAria: "Rejestr wieczorów",
    },
    invitation: {
      line: "Napiszemy przed następnym Koncertem Duchowym.",
      cta: "Otrzymuj zaproszenia",
    },
  },

  en: {
    form: {
      bandAria: "Invitations to the concerts",
      emailLabel: "Email address",
      emailPlaceholder: "name@example.com",
      nameLabel: "First name — optional",
      namePlaceholder: "Anna",
      consentHtml:
        `By signing up you are asking Fundacja VoctFoundation for invitations to VoctEnsemble's ` +
        `concerts. A first name is used only in the letter's greeting, and one click in any ` +
        `message takes you off the list. Were the foundation to wind up, the list may pass to ` +
        `whoever carries this ensemble on — we would tell you separately first. The rest is ` +
        `in the <a href="/polityka-prywatnosci">privacy policy</a>.`,
      submit: "Put me on the list",
      submitting: "Sending…",
      errorEmail: "Give us an address to write to.",
      errorSend: `We could not send it. Try again, or write to ${CONTACT_MAILBOX}.`,
      pendingAddressLabel: "The address you entered",
      editAddress: "Correct the address",
      recoverySummary: "Nothing arrived?",
      recoveryBody:
        "We can ask for the confirmation once more. If that does not help either, write to " +
        `${CONTACT_MAILBOX} and we will add you by hand.`,
      resend: "Send it again",
      resending: "Sending…",
      resent: "We have asked for it to be sent again.",
      resendWait: "You can ask again in {time}.",
      noscript: `The form needs JavaScript. Write to ${CONTACT_MAILBOX} and we will add you by hand.`,
    },
    page: {
      meta: {
        title: "Invitations — VoctEnsemble",
        description: "Confirmation for VoctEnsemble's concert invitation list.",
      },
      eyebrow: "Invitations",
      states: {
        checking: {
          title: "Checking the link…",
          body: "One moment.",
        },
        confirm: {
          title: "Confirm your sign-up.",
          body:
            "One more move and the invitations will come to this address. The consent is " +
            "recorded only when you press — a mail program does not do it for you.",
        },
        unsubscribe: {
          title: "Unsubscribe this address?",
          body:
            "Once you press, nothing further will be sent to it. Until you press, nothing " +
            "happens.",
        },
        confirmed: {
          title: "You are on the list.",
          body:
            "We write only about concerts. The date, the place, the programme and every " +
            "change. Every message carries a link to leave.",
        },
        already_confirmed: {
          title: "This address is already on the list.",
          body: "There is nothing to do. We will write when there is something to write about.",
        },
        expired: {
          title: "This link has expired.",
          body: "Confirmation links are good for seven days. Sign up again and we will send a new one.",
        },
        invalid: {
          title: "We do not recognise this link.",
          body:
            "It may already have been used, or a mail client may have trimmed it on the way. " +
            "Sign up again, or write to us.",
        },
        unsubscribed: {
          title: "You are unsubscribed.",
          body: "Nothing further will be sent to this address. If you ever change your mind, you are welcome back.",
        },
        already_unsubscribed: {
          title: "This address is already unsubscribed.",
          body: "We send nothing further.",
        },
        missing: {
          title: "This page is opened by a link from a message.",
          body:
            "Without one there is nothing here to confirm. If you would like invitations to " +
            "the concerts, sign up — it takes a moment.",
        },
        error: {
          title: "Something went wrong.",
          body: `Try opening the link once more. If it happens again, write to ${CONTACT_MAILBOX}.`,
        },
        preferences: {
          title: "How should we address you?",
          body:
            "The name appears in the letter's greeting and nowhere else. You may add it, change " +
            "it or remove it — now and at any time after.",
        },
        preferences_saved: {
          title: "Saved.",
          body: "That is how we will greet you in the next invitation.",
        },
        withdrawn: {
          title: "This address is unsubscribed.",
          body:
            "We send nothing to it any more, so there is no letter in which to greet you. " +
            "If you would like to come back to the list, sign up again.",
        },
      },
      preferences: {
        nameLabel: "First name (optional)",
        namePlaceholder: "Anna",
        submit: "Save",
        submitting: "Saving…",
        clearHint: "An empty field means a letter with no name.",
        errorSend: `We could not save it. Try again, or write to ${CONTACT_MAILBOX}.`,
      },
      actions: {
        confirm: "Confirm my sign-up",
        confirming: "Confirming…",
        unsubscribe: "Unsubscribe me",
        unsubscribing: "Unsubscribing…",
      },
      programme: {
        eyebrow: "The next concert",
        action: "See the programme",
      },
      backToConcerts: "Back to the concerts",
      backHome: "Home",
      noscript: "This page needs JavaScript to finish a sign-up or an unsubscribe.",
    },
    signup: {
      meta: {
        title: "Concert invitations — VoctEnsemble",
        description:
          "We write only about concerts. The date, the place, the programme and every change. " +
          "Sign up and we will write before the next Spiritual Concert.",
      },
    },
    register: {
      ahead: "The next evening",
      record: "So far",
      recordAria: "Register of evenings",
    },
    invitation: {
      line: "We will write before the next Spiritual Concert.",
      cta: "Receive the invitations",
    },
  },

  fr: {
    form: {
      bandAria: "Invitations aux concerts",
      emailLabel: "Adresse e-mail",
      emailPlaceholder: "nom@exemple.fr",
      nameLabel: "Prénom — facultatif",
      namePlaceholder: "Anne",
      consentHtml:
        `En vous inscrivant, vous demandez à la Fundacja VoctFoundation les invitations aux ` +
        `concerts du VoctEnsemble. Le prénom ne sert qu'à la formule d'appel de la lettre, et ` +
        `un clic dans n'importe quel message vous retire de la liste. Si la Fondation cessait ` +
        `son activité, la liste pourrait passer à la personne qui poursuit cet ensemble — nous ` +
        `vous en préviendrions par un message séparé. Le reste figure dans la ` +
        `<a href="/polityka-prywatnosci">politique de confidentialité</a>.`,
      submit: "Inscrivez-moi",
      submitting: "Envoi…",
      errorEmail: "Indiquez l'adresse à laquelle écrire.",
      errorSend: `L'envoi a échoué. Réessayez ou écrivez à ${CONTACT_MAILBOX}.`,
      pendingAddressLabel: "L'adresse saisie",
      editAddress: "Corriger l'adresse",
      recoverySummary: "Rien n'est arrivé ?",
      recoveryBody:
        "Nous pouvons redemander la confirmation. Si cela ne suffit pas non plus, écrivez à " +
        `${CONTACT_MAILBOX} et nous vous inscrirons à la main.`,
      resend: "Envoyer à nouveau",
      resending: "Envoi…",
      resent: "Nous avons demandé un nouvel envoi.",
      resendWait: "Nouvelle demande possible dans {time}.",
      noscript: `Le formulaire nécessite JavaScript. Écrivez à ${CONTACT_MAILBOX} et nous vous inscrirons à la main.`,
    },
    page: {
      meta: {
        title: "Invitations — VoctEnsemble",
        description: "Confirmation d'inscription aux invitations aux concerts de VoctEnsemble.",
      },
      eyebrow: "Invitations",
      states: {
        checking: {
          title: "Vérification du lien…",
          body: "Un instant.",
        },
        confirm: {
          title: "Confirmez votre inscription.",
          body:
            "Encore un geste et les invitations arriveront à cette adresse. Le consentement " +
            "n'est enregistré qu'au moment où vous appuyez — un logiciel de messagerie ne le " +
            "fait pas à votre place.",
        },
        unsubscribe: {
          title: "Désinscrire cette adresse ?",
          body:
            "Une fois que vous aurez appuyé, plus rien ne partira vers elle. Tant que vous " +
            "n'appuyez pas, rien ne se passe.",
        },
        confirmed: {
          title: "Vous êtes inscrit.",
          body:
            "Nous n'écrivons que pour les concerts. La date, le lieu, le programme et chaque " +
            "changement. Chaque message porte un lien pour se désinscrire.",
        },
        already_confirmed: {
          title: "Cette adresse est déjà inscrite.",
          body: "Il n'y a rien à faire. Nous écrirons quand il y aura de quoi.",
        },
        expired: {
          title: "Ce lien a expiré.",
          body:
            "Les liens de confirmation sont valables sept jours. Inscrivez-vous à nouveau et " +
            "nous en enverrons un autre.",
        },
        invalid: {
          title: "Nous ne reconnaissons pas ce lien.",
          body:
            "Il a peut-être déjà servi, ou un logiciel de messagerie l'a tronqué en chemin. " +
            "Inscrivez-vous à nouveau, ou écrivez-nous.",
        },
        unsubscribed: {
          title: "Vous êtes désinscrit.",
          body: "Plus rien ne partira vers cette adresse. Si vous changez d'avis, vous serez le bienvenu.",
        },
        already_unsubscribed: {
          title: "Cette adresse est déjà désinscrite.",
          body: "Nous n'envoyons plus rien.",
        },
        missing: {
          title: "Cette page s'ouvre depuis un lien reçu par courrier.",
          body:
            "Sans lui, il n'y a rien à confirmer ici. Si vous souhaitez recevoir les " +
            "invitations aux concerts, inscrivez-vous — cela prend un instant.",
        },
        error: {
          title: "Quelque chose s'est mal passé.",
          body: `Essayez d'ouvrir le lien une nouvelle fois. Si cela se reproduit, écrivez à ${CONTACT_MAILBOX}.`,
        },
        preferences: {
          title: "Comment souhaitez-vous que nous vous appelions ?",
          body:
            "Le prénom n'apparaît que dans la salutation de la lettre, nulle part ailleurs. " +
            "Vous pouvez l'ajouter, le modifier ou le retirer — maintenant et à tout moment.",
        },
        preferences_saved: {
          title: "Enregistré.",
          body: "C'est ainsi que nous vous saluerons dans la prochaine invitation.",
        },
        withdrawn: {
          title: "Cette adresse est désinscrite.",
          body:
            "Nous n'y envoyons plus rien : il n'y a donc pas de lettre dans laquelle vous " +
            "saluer. Si vous souhaitez revenir sur la liste, inscrivez-vous à nouveau.",
        },
      },
      preferences: {
        nameLabel: "Prénom (facultatif)",
        namePlaceholder: "Anne",
        submit: "Enregistrer",
        submitting: "Enregistrement…",
        clearHint: "Un champ vide signifie une lettre sans prénom.",
        errorSend: `Nous n'avons pas pu l'enregistrer. Réessayez ou écrivez à ${CONTACT_MAILBOX}.`,
      },
      actions: {
        confirm: "Je confirme mon inscription",
        confirming: "Confirmation…",
        unsubscribe: "Désinscrivez-moi",
        unsubscribing: "Désinscription…",
      },
      programme: {
        eyebrow: "Le prochain concert",
        action: "Voir le programme",
      },
      backToConcerts: "Retour aux concerts",
      backHome: "Accueil",
      noscript:
        "Cette page a besoin de JavaScript pour terminer une inscription ou une désinscription.",
    },
    signup: {
      meta: {
        title: "Invitations aux concerts — VoctEnsemble",
        description:
          "Nous n'écrivons que pour les concerts. La date, le lieu, le programme et chaque " +
          "changement. Inscrivez-vous : nous écrirons avant le prochain Concert Spirituel.",
      },
    },
    register: {
      ahead: "La prochaine soirée",
      record: "Jusqu'ici",
      recordAria: "Registre des soirées",
    },
    invitation: {
      line: "Nous écrirons avant le prochain Concert Spirituel.",
      cta: "Recevoir les invitations",
    },
  },
};
