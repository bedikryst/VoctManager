/**
 * @file skarbiecChrome.ts
 * @description The donation vault's chrome: every affordance, landmark name, form label and
 *  validation message the island needs, complete in all three locales.
 *
 *  WHY IT IS NOT IN `skarbiec.ts` WITH THE REST OF THE PAGE'S CONTRACT, which is where every other
 *  page keeps its chrome. Two reasons, and the second is the one that settles it.
 *
 *  The vault is a CLIENT island, so this table is read in the browser rather than at build — every
 *  other page's chrome is read by an Astro component and never leaves the server. And `skarbiec.ts`
 *  builds a zod schema at module scope, which is a side effect no bundler may drop: an island
 *  importing one exported constant from that file would ship zod to every reader of every page on
 *  this site. The prose stays there; the strings a browser needs live here.
 *
 *  WHY THIS IS NOT ON THE DESK. The line is §6r's — whether completeness can be DEMANDED. A form
 *  that answers a refused card in the wrong language is broken, not untranslated, so a type has to
 *  say the locale is missing; a paragraph, by contrast, must be allowed to stand in Polish until
 *  somebody reviews its translation, which is what the overlay does per field.
 *
 *  A COUNTED NOUN IS CHROME (§6x): `donors(n)` is a closed table walked by an arithmetic result.
 *  Polish needs THREE forms and the vault printed two, so "2 darczyńców" was ungrammatical on the
 *  live site until this existed.
 * @architecture Astro islands 2026
 * @module i18n/content/skarbiecChrome
 */

import type { Locale } from "../config";

export interface VaultChrome {
  /** Accessible name of the sheet's close control. */
  readonly close: string;
  /** The two forms of support, as a tablist. */
  readonly tabsAria: string;
  readonly tabOnce: string;
  readonly tabMecenat: string;
  /** The campaign rail. `goalLabel` precedes a formatted amount. */
  readonly progressAria: string;
  readonly goalLabel: string;
  /**
   * The donor count, in the language's own plural. Polish takes three forms and the vault printed
   * two, so "2 darczyńców" was ungrammatical on the live site until this existed.
   */
  readonly donors: (count: number) => string;
  /** The three cards and the badge each of them wears. */
  readonly methodsAria: string;
  readonly statusReady: string;
  readonly statusMecenat: string;
  /** The give form. */
  readonly amountLabel: string;
  readonly currencyAria: string;
  readonly tiersAria: string;
  readonly customTier: string;
  readonly customAria: string;
  readonly emailLabel: string;
  readonly emailPlaceholder: string;
  readonly ctaProcessing: string;
  /** "Give 100 zł" — the amount arrives already formatted for this locale. */
  readonly ctaGive: (amount: string) => string;
  readonly ctaFallback: string;
  /** Precedes the transfer title the gateway will show, which stays Polish in every locale. */
  readonly transactionTitleLabel: string;
  /** What the give form says when it refuses to submit. */
  readonly errorAmount: string;
  readonly errorAmountMax: (max: string) => string;
  readonly errorEmail: string;
  readonly errorConsent: string;
  readonly errorNetwork: string;
  /** Zrzutka. */
  readonly zrzutkaCta: string;
  /** The bank-QR card. */
  readonly qrAlt: string;
  readonly qrPending1: string;
  readonly qrPending2: string;
  readonly qrDebugSummary: string;
  readonly qrDebugCopy: string;
  /** The copy-to-clipboard fields, and the two states of their button. */
  readonly copy: string;
  readonly copied: string;
  readonly fieldAccount: string;
  readonly fieldRecipient: string;
  readonly fieldAddress: string;
  readonly fieldTransferTitle: string;
  readonly fieldRecurringTitle: string;
  /** The patronage panel and its form. */
  readonly mecenatAria: string;
  readonly firstNameLabel: string;
  readonly lastNameLabel: string;
  readonly mecenatEmailLabel: string;
  readonly mecenatSubmitting: string;
  readonly mecenatSubmit: string;
  readonly mecenatErrorName: string;
  readonly mecenatErrorEmail: string;
  readonly mecenatErrorConsent: string;
  readonly mecenatErrorSend: (email: string) => string;
  /** The terms overlay. */
  readonly termsClose: string;
  readonly termsAccept: string;
  readonly versionLabel: string;
  readonly effectiveLabel: string;
  /** The two overlays a donor meets on the way back from the gateway. */
  readonly gratitudeClose: string;
  readonly failureRetry: string;
}

/**
 * Polish plural for a counted noun: one, two-to-four (except the teens), and everything else.
 * The teens exception is what a naive `n % 10` rule gets wrong — "22 darczyńcy" but
 * "12 darczyńców".
 */
function plDonors(count: number): string {
  const last = count % 10;
  const lastTwo = count % 100;
  if (count === 1) return `${count} darczyńca`;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${count} darczyńcy`;
  return `${count} darczyńców`;
}

export const VAULT_CHROME: Record<Locale, VaultChrome> = {
  pl: {
    close: "Zamknij",
    tabsAria: "Forma wsparcia",
    tabOnce: "Jednorazowo",
    tabMecenat: "Mecenat",
    progressAria: "Postęp zbiórki",
    goalLabel: "cel",
    donors: plDonors,
    methodsAria: "Wybierz drogę wsparcia",
    statusReady: "dostępne",
    statusMecenat: "mecenat",
    amountLabel: "Kwota darowizny",
    currencyAria: "Waluta darowizny",
    tiersAria: "Sugerowana kwota darowizny",
    customTier: "Inna kwota",
    customAria: "Własna kwota darowizny",
    emailLabel: "E-mail · na ten adres wyślemy potwierdzenie",
    emailPlaceholder: "twoj@adres.pl",
    ctaProcessing: "Przetwarzanie...",
    ctaGive: (amount) => `Wesprzyj ${amount}`,
    ctaFallback: "Przejdź do płatności",
    transactionTitleLabel: "Tytuł transakcji",
    errorAmount: "Wpisz kwotę darowizny, którą chcesz przekazać.",
    errorAmountMax: (max) =>
      `Maksymalna kwota wpłaty online to ${max}. Większą darowiznę prosimy przekazać przelewem.`,
    errorEmail: "Podaj poprawny adres e-mail — wyślemy na niego potwierdzenie darowizny.",
    errorConsent: "Zaznacz akceptację regulaminu darowizn, aby przejść do płatności.",
    errorNetwork:
      "Wystąpił problem z połączeniem. Spróbuj ponownie za chwilę lub skorzystaj z przelewu poniżej.",
    zrzutkaCta: "Otwórz Zrzutkę",
    qrAlt: "Kod QR przelewu — Fundacja VoctFoundation",
    qrPending1: "QR",
    qrPending2: "w przygotowaniu",
    qrDebugSummary: "pokaż dane QR",
    qrDebugCopy: "Kopiuj dane QR",
    copy: "Kopiuj",
    copied: "Skopiowano",
    fieldAccount: "Numer konta · PLN",
    fieldRecipient: "Odbiorca",
    fieldAddress: "Adres fundacji",
    fieldTransferTitle: "Tytuł przelewu",
    fieldRecurringTitle: "Tytuł przelewu cyklicznego",
    mecenatAria: "Mecenat — wsparcie regularne",
    firstNameLabel: "Imię",
    lastNameLabel: "Nazwisko",
    mecenatEmailLabel: "E-mail · na ten adres się odezwiemy",
    mecenatSubmitting: "Wysyłanie...",
    mecenatSubmit: "Dołączam do mecenatu",
    mecenatErrorName: "Podaj imię i nazwisko, abyśmy wiedzieli, komu dziękować.",
    mecenatErrorEmail: "Podaj poprawny adres e-mail — na niego się odezwiemy.",
    mecenatErrorConsent: "Zaznacz zgodę na kontakt, abyśmy mogli się do Ciebie odezwać.",
    mecenatErrorSend: (email) =>
      `Nie udało się wysłać zgłoszenia. Spróbuj ponownie za chwilę lub napisz na ${email}.`,
    termsClose: "Zamknij regulamin",
    termsAccept: "Akceptuję regulamin",
    versionLabel: "Wersja",
    effectiveLabel: "obowiązuje od",
    gratitudeClose: "Wróć do strony",
    failureRetry: "Spróbuj ponownie",
  },
  en: {
    close: "Close",
    tabsAria: "Form of support",
    tabOnce: "One-off",
    tabMecenat: "Patronage",
    progressAria: "Campaign progress",
    goalLabel: "goal",
    donors: (count) => `${count} ${count === 1 ? "donor" : "donors"}`,
    methodsAria: "Choose how to give",
    statusReady: "available",
    statusMecenat: "patronage",
    amountLabel: "Amount",
    currencyAria: "Donation currency",
    tiersAria: "Suggested amount",
    customTier: "Other amount",
    customAria: "Your own amount",
    emailLabel: "E-mail · we will send the confirmation here",
    emailPlaceholder: "you@address.com",
    ctaProcessing: "Processing...",
    ctaGive: (amount) => `Give ${amount}`,
    ctaFallback: "Continue to payment",
    transactionTitleLabel: "Transaction title",
    errorAmount: "Enter the amount you would like to give.",
    errorAmountMax: (max) =>
      `The most that can be given online is ${max}. For a larger donation, please use a bank transfer.`,
    errorEmail: "Enter a valid e-mail address — we will send your confirmation to it.",
    errorConsent: "Please accept the donation terms to continue to payment.",
    errorNetwork:
      "Something went wrong with the connection. Try again in a moment, or use the bank transfer below.",
    zrzutkaCta: "Open Zrzutka",
    qrAlt: "Bank transfer QR code — Fundacja VoctFoundation",
    qrPending1: "QR",
    qrPending2: "in preparation",
    qrDebugSummary: "show QR data",
    qrDebugCopy: "Copy QR data",
    copy: "Copy",
    copied: "Copied",
    fieldAccount: "Account number · PLN",
    fieldRecipient: "Recipient",
    fieldAddress: "Foundation address",
    fieldTransferTitle: "Transfer title",
    fieldRecurringTitle: "Standing order title",
    mecenatAria: "Patronage — regular support",
    firstNameLabel: "First name",
    lastNameLabel: "Surname",
    mecenatEmailLabel: "E-mail · we will reply to this address",
    mecenatSubmitting: "Sending...",
    mecenatSubmit: "I am joining",
    mecenatErrorName: "Give us your name, so we know who to thank.",
    mecenatErrorEmail: "Enter a valid e-mail address — it is where we will write.",
    mecenatErrorConsent: "Please agree to be contacted, so we can write back to you.",
    mecenatErrorSend: (email) =>
      `We could not send your message. Try again in a moment, or write to ${email}.`,
    termsClose: "Close the terms",
    termsAccept: "I accept the terms",
    versionLabel: "Version",
    effectiveLabel: "in force since",
    gratitudeClose: "Back to the site",
    failureRetry: "Try again",
  },
  fr: {
    close: "Fermer",
    tabsAria: "Forme de soutien",
    tabOnce: "Ponctuel",
    tabMecenat: "Mécénat",
    progressAria: "Avancement de la collecte",
    goalLabel: "objectif",
    donors: (count) => `${count} ${count === 1 ? "donateur" : "donateurs"}`,
    methodsAria: "Choisir une forme de soutien",
    statusReady: "disponible",
    statusMecenat: "mécénat",
    amountLabel: "Montant du don",
    currencyAria: "Devise du don",
    tiersAria: "Montant suggéré",
    customTier: "Autre montant",
    customAria: "Votre propre montant",
    emailLabel: "E-mail · nous y enverrons la confirmation",
    emailPlaceholder: "vous@adresse.fr",
    ctaProcessing: "Traitement...",
    ctaGive: (amount) => `Soutenir ${amount}`,
    ctaFallback: "Passer au paiement",
    transactionTitleLabel: "Intitulé de la transaction",
    errorAmount: "Indiquez le montant que vous souhaitez donner.",
    errorAmountMax: (max) =>
      `Le montant maximal en ligne est de ${max}. Pour un don plus important, merci de passer par un virement.`,
    errorEmail: "Indiquez une adresse e-mail valide — nous y enverrons votre confirmation.",
    errorConsent: "Acceptez le règlement des dons pour passer au paiement.",
    errorNetwork:
      "Un problème de connexion est survenu. Réessayez dans un instant, ou utilisez le virement ci-dessous.",
    zrzutkaCta: "Ouvrir Zrzutka",
    qrAlt: "QR code de virement — Fundacja VoctFoundation",
    qrPending1: "QR",
    qrPending2: "en préparation",
    qrDebugSummary: "afficher les données du QR",
    qrDebugCopy: "Copier les données du QR",
    copy: "Copier",
    copied: "Copié",
    fieldAccount: "Numéro de compte · PLN",
    fieldRecipient: "Bénéficiaire",
    fieldAddress: "Adresse de la fondation",
    fieldTransferTitle: "Intitulé du virement",
    fieldRecurringTitle: "Intitulé du virement permanent",
    mecenatAria: "Mécénat — soutien régulier",
    firstNameLabel: "Prénom",
    lastNameLabel: "Nom",
    mecenatEmailLabel: "E-mail · c'est là que nous répondrons",
    mecenatSubmitting: "Envoi...",
    mecenatSubmit: "Je rejoins le mécénat",
    mecenatErrorName: "Donnez-nous votre nom, pour que nous sachions qui remercier.",
    mecenatErrorEmail: "Indiquez une adresse e-mail valide — c'est là que nous écrirons.",
    mecenatErrorConsent: "Acceptez d'être contacté, pour que nous puissions vous répondre.",
    mecenatErrorSend: (email) =>
      `Nous n'avons pas pu envoyer votre message. Réessayez dans un instant, ou écrivez à ${email}.`,
    termsClose: "Fermer le règlement",
    termsAccept: "J'accepte le règlement",
    versionLabel: "Version",
    effectiveLabel: "en vigueur depuis le",
    gratitudeClose: "Retour au site",
    failureRetry: "Réessayer",
  },
};
