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
 * @architecture Astro islands 2026
 * @module i18n/content/nuntius
 */

import type { Locale } from "../config";

/** Every state the receipt page can render. `checking` is the in-flight one; `missing` is the
    page opened with no token at all, which is what a reader sees if they bookmark it. */
export type NoticeState =
  | "checking"
  | "confirmed"
  | "already_confirmed"
  | "expired"
  | "invalid"
  | "unsubscribed"
  | "already_unsubscribed"
  | "missing"
  | "error";

export interface NoticeStateCopy {
  readonly title: string;
  readonly body: string;
}

export interface NoticeFormChrome {
  /** Landmark name for the band. Read instead of its heading, so it names the band. */
  readonly bandAria: string;
  readonly emailLabel: string;
  readonly emailPlaceholder: string;
  /** The clause itself — inline markup, rendered through `set:html`. */
  readonly consentHtml: string;
  readonly submit: string;
  readonly submitting: string;
  /** Errors, in the order the form checks them. `errorSend` names the inbox to write to. */
  readonly errorEmail: string;
  readonly errorConsent: string;
  readonly errorSend: string;
  /** The band without JavaScript: the form cannot post, so it says where to write instead. */
  readonly noscript: string;
}

export interface NuntiusPageChrome {
  readonly meta: { readonly title: string; readonly description: string };
  /** Latin rubric's vernacular gloss; the Latin `Nuntius` stands unchanged beside it. */
  readonly eyebrow: string;
  readonly states: Readonly<Record<NoticeState, NoticeStateCopy>>;
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
  /** The act. No arrow: each surface prints its own, in its own direction. */
  readonly cta: string;
}

/**
 * `/newsletter` — the sign-up under an address a person can be TOLD. Everything the page says is
 * the band's own voice on /koncerty, read from the desk through `NoticeSignup`; the only thing
 * owned here is what search engines and a browser tab read, which is machinery in the same sense
 * the receipt page's meta is.
 *
 * WHY THE ROUTE IS THE ONE ENGLISH WORD ON THIS SITE. The page is named for the act of finding it:
 * a reader told "sign up for the notices" types the word they already have, and `nuntius` is not
 * that word in any of the three languages. It stays in the address bar and out of the prose — the
 * list is called *Zawiadomienia · Nuntius* everywhere a reader can read it.
 */
export interface NuntiusSignupChrome {
  readonly meta: { readonly title: string; readonly description: string };
}

export interface NuntiusChrome {
  readonly form: NoticeFormChrome;
  readonly page: NuntiusPageChrome;
  readonly signup: NuntiusSignupChrome;
  readonly invitation: NuntiusInvitation;
}

/** Written to in every locale by the clause and by the receipt page's failure states. */
const DATA_MAILBOX = "rodo@voctensemble.com";
const CONTACT_MAILBOX = "kontakt@voctensemble.com";

export const NUNTIUS: Record<Locale, NuntiusChrome> = {
  pl: {
    form: {
      bandAria: "Zawiadomienie o następnym koncercie",
      emailLabel: "Adres e-mail",
      emailPlaceholder: "imie@przyklad.pl",
      consentHtml:
        `Zgadzam się na otrzymywanie zawiadomień o koncertach VoctEnsemble na podany adres. ` +
        `Administratorem danych jest Fundacja VoctFoundation. Zgodę mogę wycofać w każdej chwili ` +
        `— linkiem w każdej wiadomości albo pisząc na <a href="mailto:${DATA_MAILBOX}">${DATA_MAILBOX}</a>. ` +
        `Szczegóły w <a href="/polityka-prywatnosci">polityce prywatności</a>.`,
      submit: "Zapisz mnie",
      submitting: "Wysyłamy…",
      errorEmail: "Podaj adres e-mail, na który mamy napisać.",
      errorConsent: "Bez zgody nie możemy zapisać adresu.",
      errorSend: `Nie udało się wysłać. Spróbuj ponownie albo napisz na ${CONTACT_MAILBOX}.`,
      noscript: `Formularz wymaga JavaScriptu. Napisz na ${CONTACT_MAILBOX}, a dopiszemy Cię ręcznie.`,
    },
    page: {
      meta: {
        title: "Zawiadomienie — VoctEnsemble",
        description: "Potwierdzenie zapisu na zawiadomienia o koncertach VoctEnsemble.",
      },
      eyebrow: "Zawiadomienie",
      states: {
        checking: {
          title: "Sprawdzamy link…",
          body: "To potrwa chwilę.",
        },
        confirmed: {
          title: "Jesteś na liście.",
          body:
            "Napiszemy, gdy następny Koncert Duchowy dostanie datę — jeden list na jeden " +
            "wieczór, z miejscem i programem. W każdej wiadomości będzie link do wypisania się.",
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
            "Bez niego nie ma tu nic do potwierdzenia. Jeśli chcesz dostawać zawiadomienia " +
            "o koncertach, zostaw adres — zajmie to chwilę.",
        },
        error: {
          title: "Coś poszło nie tak.",
          body: `Spróbuj otworzyć link jeszcze raz. Jeśli to się powtórzy, napisz na ${CONTACT_MAILBOX}.`,
        },
      },
      backToConcerts: "Wróć do koncertów",
      backHome: "Strona główna",
      noscript: "Ta strona potrzebuje JavaScriptu, żeby dokończyć zapis lub wypisanie.",
    },
    signup: {
      meta: {
        title: "Zawiadomienia o koncertach — VoctEnsemble",
        description:
          "Jeden list na jeden wieczór: miejsce, godzina, program. Zostaw adres, a napiszemy " +
          "przed następnym Koncertem Duchowym.",
      },
    },
    invitation: {
      line: "Napiszemy przed następnym Koncertem Duchowym.",
      cta: "Zostaw adres",
    },
  },

  en: {
    form: {
      bandAria: "Notice of the next concert",
      emailLabel: "Email address",
      emailPlaceholder: "name@example.com",
      consentHtml:
        `I agree to receive notices of VoctEnsemble's concerts at this address. The data ` +
        `controller is Fundacja VoctFoundation. I may withdraw my consent at any time — through ` +
        `the link in every message, or by writing to ` +
        `<a href="mailto:${DATA_MAILBOX}">${DATA_MAILBOX}</a>. ` +
        `The details are in the <a href="/polityka-prywatnosci">privacy policy</a>.`,
      submit: "Put me on the list",
      submitting: "Sending…",
      errorEmail: "Give us an address to write to.",
      errorConsent: "Without your consent we cannot keep the address.",
      errorSend: `We could not send it. Try again, or write to ${CONTACT_MAILBOX}.`,
      noscript: `The form needs JavaScript. Write to ${CONTACT_MAILBOX} and we will add you by hand.`,
    },
    page: {
      meta: {
        title: "Notice — VoctEnsemble",
        description: "Confirmation for VoctEnsemble's concert notice list.",
      },
      eyebrow: "Notice",
      states: {
        checking: {
          title: "Checking the link…",
          body: "One moment.",
        },
        confirmed: {
          title: "You are on the list.",
          body:
            "We will write when the next Spiritual Concert is given a date — one letter for one " +
            "evening, with the place and the programme. Every message carries a link to leave.",
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
            "Without one there is nothing here to confirm. If you would like notice of the " +
            "concerts, leave your address — it takes a moment.",
        },
        error: {
          title: "Something went wrong.",
          body: `Try opening the link once more. If it happens again, write to ${CONTACT_MAILBOX}.`,
        },
      },
      backToConcerts: "Back to the concerts",
      backHome: "Home",
      noscript: "This page needs JavaScript to finish a sign-up or an unsubscribe.",
    },
    signup: {
      meta: {
        title: "Concert notices — VoctEnsemble",
        description:
          "One letter for one evening: the place, the hour, the programme. Leave your address " +
          "and we will write before the next Spiritual Concert.",
      },
    },
    invitation: {
      line: "We will write before the next Spiritual Concert.",
      cta: "Leave your address",
    },
  },

  fr: {
    form: {
      bandAria: "Annonce du prochain concert",
      emailLabel: "Adresse e-mail",
      emailPlaceholder: "nom@exemple.fr",
      consentHtml:
        `J'accepte de recevoir les annonces des concerts de VoctEnsemble à cette adresse. Le ` +
        `responsable du traitement est la Fundacja VoctFoundation. Je peux retirer mon ` +
        `consentement à tout moment — par le lien présent dans chaque message ou en écrivant à ` +
        `<a href="mailto:${DATA_MAILBOX}">${DATA_MAILBOX}</a>. ` +
        `Les détails figurent dans la <a href="/polityka-prywatnosci">politique de confidentialité</a>.`,
      submit: "Inscrivez-moi",
      submitting: "Envoi…",
      errorEmail: "Indiquez l'adresse à laquelle écrire.",
      errorConsent: "Sans votre consentement, nous ne pouvons pas conserver l'adresse.",
      errorSend: `L'envoi a échoué. Réessayez ou écrivez à ${CONTACT_MAILBOX}.`,
      noscript: `Le formulaire nécessite JavaScript. Écrivez à ${CONTACT_MAILBOX} et nous vous inscrirons à la main.`,
    },
    page: {
      meta: {
        title: "Annonce — VoctEnsemble",
        description: "Confirmation d'inscription aux annonces de concerts de VoctEnsemble.",
      },
      eyebrow: "Annonce",
      states: {
        checking: {
          title: "Vérification du lien…",
          body: "Un instant.",
        },
        confirmed: {
          title: "Vous êtes inscrit.",
          body:
            "Nous écrirons lorsque le prochain Concert Spirituel recevra une date — une lettre " +
            "pour une soirée, avec le lieu et le programme. Chaque message porte un lien pour se " +
            "désinscrire.",
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
            "Sans lui, il n'y a rien à confirmer ici. Si vous souhaitez être prévenu des " +
            "concerts, laissez votre adresse — cela prend un instant.",
        },
        error: {
          title: "Quelque chose s'est mal passé.",
          body: `Essayez d'ouvrir le lien une nouvelle fois. Si cela se reproduit, écrivez à ${CONTACT_MAILBOX}.`,
        },
      },
      backToConcerts: "Retour aux concerts",
      backHome: "Accueil",
      noscript: "Cette page a besoin de JavaScript pour terminer une inscription ou une désinscription.",
    },
    signup: {
      meta: {
        title: "Annonces des concerts — VoctEnsemble",
        description:
          "Une lettre pour une soirée : le lieu, l'heure, le programme. Laissez votre adresse " +
          "et nous écrirons avant le prochain Concert Spirituel.",
      },
    },
    invitation: {
      line: "Nous écrirons avant le prochain Concert Spirituel.",
      cta: "Laissez votre adresse",
    },
  },
};
