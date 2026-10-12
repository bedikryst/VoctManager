/**
 * @file strings.ts
 * @description The comment mode's own words, in the three languages its chrome speaks. This is
 *  tool chrome, not desk copy: it never reaches the public page, so it lives here as a
 *  `Record<Locale, …>` and not in the copy desk.
 *
 *  The chrome speaks the editor's `Profile.language` (from the index request), and `<html lang>`
 *  only before sign-in: the bar switches the page between PL, EN and FR, and buttons that followed
 *  the page would change language under the editor's thumb.
 *
 *  `markupNote` repeats the desk's `copy_desk.editor.markup_note` in all three locales, and
 *  `frenchSpacing` the desk's `FRENCH_SPACING_NOTE`, which is French in every chrome because it is
 *  addressed to whoever types French. Change them together with the desk.
 * @architecture Astro islands 2026
 * @module comment-mode/strings
 */

import type { Locale } from "../i18n/config";

export interface Strings {
  readonly modeName: string;
  readonly loading: string;
  readonly signedOut: string;
  readonly signIn: string;
  readonly refused: string;
  readonly loadFailed: string;
  readonly retry: string;
  readonly hintFine: string;
  readonly hintCoarse: string;
  readonly paused: string;
  readonly pause: string;
  readonly resume: string;
  readonly end: string;
  readonly saved: (label: string) => string;
  readonly withdrawn: (label: string) => string;

  readonly menu: string;
  readonly pageLanguage: string;
  readonly polishOnly: string;
  readonly showFields: string;
  readonly showPreviews: string;
  readonly showingPublished: string;
  readonly done: string;
  readonly doneHint: string;
  readonly sending: string;
  readonly doneSent: string;
  readonly doneNothing: string;
  readonly doneNobody: string;
  readonly doneFailed: string;

  readonly editText: string;
  readonly open: string;
  readonly chooseField: string;
  readonly sharedTitle: string;
  readonly sharedBody: string;
  readonly sharedFields: string;
  readonly openOnItsPage: string;
  readonly close: string;

  readonly sheetLabel: string;
  readonly untranslated: string;
  readonly stale: string;
  readonly mineOpen: string;
  readonly mineAccepted: string;
  readonly textLabel: string;
  readonly commentLabel: string;
  readonly commentHint: string;
  readonly save: string;
  readonly saving: string;
  readonly withdraw: string;
  readonly withdrawing: string;
  readonly empty: string;
  readonly nothingToSave: string;
  readonly saveFailed: string;
  readonly sessionEnded: string;
  readonly settled: string;
  readonly withdrawFailed: string;
  readonly sanitized: string;
  readonly draftRestored: string;
  readonly discardDraft: string;
  readonly otherLanguages: string;
  readonly notTranslated: string;
  readonly othersProposals: string;
  readonly detailsLoading: string;
  readonly detailsFailed: string;
  readonly markupNote: string;
  readonly frenchMissingSpace: (fragments: string) => string;
  readonly localeNames: Readonly<Record<Locale, string>>;
}

/** The desk's French spacing note, French in every chrome. */
export const FRENCH_SPACING_NOTE = "Mettez une espace avant « ? ! : ; » : le site la rend insécable.";

const PL: Strings = {
  modeName: "Tryb uwag",
  loading: "Wczytuję teksty strony…",
  signedOut: "Zaloguj się, żeby poprawiać teksty.",
  signIn: "Zaloguj się",
  refused: "To konto nie ma dostępu do redakcji tekstów.",
  loadFailed: "Nie udało się wczytać tekstów.",
  retry: "Spróbuj ponownie",
  hintFine: "Kliknij tekst, który chcesz poprawić.",
  hintCoarse: "Dotknij tekstu, który chcesz poprawić.",
  paused: "Edycja wstrzymana: linki i przyciski działają zwyczajnie.",
  pause: "Wstrzymaj edycję",
  resume: "Wznów edycję",
  end: "Zakończ",
  saved: (label) => `Zapisano propozycję: ${label}`,
  withdrawn: (label) => `Cofnięto propozycję: ${label}`,

  menu: "Menu",
  pageLanguage: "Język strony",
  polishOnly: "Ta strona jest tylko po polsku.",
  showFields: "Podświetlaj teksty do poprawy",
  showPreviews: "Pokazuj moje propozycje",
  showingPublished: "Widzisz opublikowany tekst, bez swoich propozycji.",
  done: "Gotowe: powiadom redakcję",
  doneHint: "Bez tego redakcja i tak dostanie zestawienie po pół godzinie ciszy.",
  sending: "Wysyłam…",
  doneSent: "Redakcja dostała wiadomość o Twoich nowych propozycjach.",
  doneNothing: "Redakcja wie już o wszystkich Twoich propozycjach.",
  doneNobody: "Nie ma komu wysłać wiadomości. Propozycje czekają w kolejce redakcji.",
  doneFailed: "Nie udało się powiadomić redakcji. Spróbuj jeszcze raz.",

  editText: "Edytuj tekst",
  open: "Otwórz",
  chooseField: "Ten tekst stoi w kilku polach. Które poprawiasz?",
  sharedTitle: "Tego napisu nie da się tu przypisać",
  sharedBody:
    "To samo słowo stoi w kilku polach innych stron. Tutaj może pochodzić z któregoś z nich albo ze stałego elementu serwisu, takiego jak menu czy stopka, którego nie ma w redakcji. Tryb uwag nie zgaduje, żeby poprawka nie trafiła w inne miejsce niż to, które widzisz.",
  sharedFields: "Pola z tym tekstem:",
  openOnItsPage: "Otwórz na jego stronie",
  close: "Zamknij",

  sheetLabel: "Poprawka tekstu",
  untranslated: "Nie ma jeszcze tłumaczenia: strona pokazuje tu polski tekst.",
  stale: "Polski tekst zmienił się od czasu tego tłumaczenia.",
  mineOpen: "Twoja propozycja czeka na decyzję redakcji.",
  mineAccepted:
    "Twoja propozycja jest przyjęta i czeka na publikację. Zmiana tego tekstu trafi do redakcji jako nowa propozycja.",
  textLabel: "Tekst",
  commentLabel: "Uwaga",
  commentHint: "Dla redakcji, nieobowiązkowo: dlaczego tak.",
  save: "Zapisz",
  saving: "Zapisuję…",
  withdraw: "Cofnij moją propozycję",
  withdrawing: "Cofam…",
  empty: "Pole nie może być puste: tekst zniknąłby ze strony.",
  nothingToSave: "Zmień tekst albo dopisz uwagę.",
  saveFailed: "Nie udało się zapisać. Tekst został w polu, spróbuj jeszcze raz.",
  sessionEnded: "Sesja wygasła. Szkic zostaje w tej karcie: zaloguj się i zapisz go ponownie.",
  settled: "Tej propozycji nie da się już cofnąć: redakcja ją rozpatrzyła.",
  withdrawFailed: "Nie udało się cofnąć propozycji. Spróbuj jeszcze raz.",
  sanitized:
    "Zapisany tekst różni się od wpisanego: serwer zostawia tylko znaczniki em, strong, a i code, a resztę usuwa.",
  draftRestored: "Przywrócono niezapisany szkic.",
  discardDraft: "Odrzuć szkic",
  otherLanguages: "Inne języki",
  notTranslated: "brak tłumaczenia",
  othersProposals: "Propozycje innych osób",
  detailsLoading: "Wczytuję…",
  detailsFailed: "Nie udało się wczytać innych języków ani propozycji.",
  markupNote:
    "W niektórych polach widać znaczniki strony: „<em>” wyróżnia słowo, „<a …>” robi odnośnik. Poprawiaj tekst między nimi i zostaw je na miejscu — skasowany znacznik zabiera ze strony wyróżnienie albo odnośnik.",
  frenchMissingSpace: (fragments) => `Brak spacji przed znakiem: ${fragments}`,
  localeNames: { pl: "polski", en: "angielski", fr: "francuski" },
};

const EN: Strings = {
  modeName: "Copy review",
  loading: "Loading the page’s texts…",
  signedOut: "Sign in to edit the texts.",
  signIn: "Sign in",
  refused: "This account has no access to editing the texts.",
  loadFailed: "The texts could not be loaded.",
  retry: "Try again",
  hintFine: "Click the text you want to correct.",
  hintCoarse: "Tap the text you want to correct.",
  paused: "Editing paused: links and buttons work as usual.",
  pause: "Pause editing",
  resume: "Resume editing",
  end: "Exit",
  saved: (label) => `Proposal saved: ${label}`,
  withdrawn: (label) => `Proposal withdrawn: ${label}`,

  menu: "Menu",
  pageLanguage: "Page language",
  polishOnly: "This page exists in Polish only.",
  showFields: "Highlight editable texts",
  showPreviews: "Show my proposals",
  showingPublished: "You are seeing the published text, without your proposals.",
  done: "Done: notify the reviewers",
  doneHint: "Otherwise the reviewers get a summary after half an hour of quiet.",
  sending: "Sending…",
  doneSent: "The reviewers have been told about your new proposals.",
  doneNothing: "The reviewers already know about all your proposals.",
  doneNobody: "There is nobody to notify. Your proposals are waiting in the review queue.",
  doneFailed: "The reviewers could not be notified. Try again.",

  editText: "Edit the text",
  open: "Open",
  chooseField: "This text is in several fields. Which one are you correcting?",
  sharedTitle: "This text can’t be traced from here",
  sharedBody:
    "The same word stands in several fields on other pages. Here it may come from one of them, or from a fixed part of the site such as the menu or the footer, which the copy desk does not hold. Copy review doesn’t guess, so that a correction never lands anywhere other than where you see it.",
  sharedFields: "Fields with this text:",
  openOnItsPage: "Open it on its own page",
  close: "Close",

  sheetLabel: "Text correction",
  untranslated: "Not translated yet: the page shows the Polish text here.",
  stale: "The Polish text has changed since this translation.",
  mineOpen: "Your proposal is waiting for review.",
  mineAccepted:
    "Your proposal is accepted and waiting to be published. A change to this text goes to the reviewers as a new proposal.",
  textLabel: "Text",
  commentLabel: "Note",
  commentHint: "For the reviewers, optional: why.",
  save: "Save",
  saving: "Saving…",
  withdraw: "Withdraw my proposal",
  withdrawing: "Withdrawing…",
  empty: "The field can’t be empty: the text would disappear from the page.",
  nothingToSave: "Change the text or add a note.",
  saveFailed: "Saving failed. Your text is still here; try again.",
  sessionEnded: "Your session has expired. The draft stays in this tab: sign in and save it again.",
  settled: "This proposal can no longer be withdrawn: it has been reviewed.",
  withdrawFailed: "The proposal could not be withdrawn. Try again.",
  sanitized:
    "The stored text differs from what you typed: the server keeps only the em, strong, a and code tags and removes the rest.",
  draftRestored: "Unsaved draft restored.",
  discardDraft: "Discard draft",
  otherLanguages: "Other languages",
  notTranslated: "not translated",
  othersProposals: "Other people’s proposals",
  detailsLoading: "Loading…",
  detailsFailed: "The other languages and proposals could not be loaded.",
  markupNote:
    "Some fields show the page's own markup: “<em>” emphasises a word, “<a …>” makes a link. Edit the text between them and leave them where they are — a tag you delete takes the emphasis or the link off the site with it.",
  frenchMissingSpace: (fragments) => `No space before: ${fragments}`,
  localeNames: { pl: "Polish", en: "English", fr: "French" },
};

const FR: Strings = {
  modeName: "Relecture",
  loading: "Chargement des textes de la page…",
  signedOut: "Connectez-vous pour corriger les textes.",
  signIn: "Se connecter",
  refused: "Ce compte n’a pas accès à la correction des textes.",
  loadFailed: "Impossible de charger les textes.",
  retry: "Réessayer",
  hintFine: "Cliquez sur le texte à corriger.",
  hintCoarse: "Touchez le texte à corriger.",
  paused: "Édition suspendue : les liens et les boutons fonctionnent normalement.",
  pause: "Suspendre l’édition",
  resume: "Reprendre l’édition",
  end: "Quitter",
  saved: (label) => `Proposition enregistrée : ${label}`,
  withdrawn: (label) => `Proposition retirée : ${label}`,

  menu: "Menu",
  pageLanguage: "Langue de la page",
  polishOnly: "Cette page n’existe qu’en polonais.",
  showFields: "Surligner les textes modifiables",
  showPreviews: "Afficher mes propositions",
  showingPublished: "Vous voyez le texte publié, sans vos propositions.",
  done: "Terminé : prévenir la relecture",
  doneHint: "Sinon, la relecture reçoit un récapitulatif après une demi-heure sans activité.",
  sending: "Envoi…",
  doneSent: "La relecture a été prévenue de vos nouvelles propositions.",
  doneNothing: "La relecture connaît déjà toutes vos propositions.",
  doneNobody: "Personne à prévenir. Vos propositions attendent dans la file de relecture.",
  doneFailed: "Impossible de prévenir la relecture. Réessayez.",

  editText: "Modifier le texte",
  open: "Ouvrir",
  chooseField: "Ce texte figure dans plusieurs champs. Lequel corrigez-vous ?",
  sharedTitle: "Impossible d’attribuer ce texte ici",
  sharedBody:
    "Le même mot figure dans plusieurs champs d’autres pages. Ici, il peut venir de l’un d’eux, ou d’un élément fixe du site, comme le menu ou le pied de page, qui n’est pas dans la rédaction. La relecture ne devine pas, pour que la correction n’aille jamais ailleurs que là où vous la voyez.",
  sharedFields: "Champs contenant ce texte :",
  openOnItsPage: "Ouvrir sur sa page",
  close: "Fermer",

  sheetLabel: "Correction du texte",
  untranslated: "Pas encore traduit : la page affiche ici le texte polonais.",
  stale: "Le texte polonais a changé depuis cette traduction.",
  mineOpen: "Votre proposition attend la relecture.",
  mineAccepted:
    "Votre proposition est acceptée et attend la publication. Toute modification de ce texte part à la relecture comme une nouvelle proposition.",
  textLabel: "Texte",
  commentLabel: "Remarque",
  commentHint: "Pour la relecture, facultatif : pourquoi.",
  save: "Enregistrer",
  saving: "Enregistrement…",
  withdraw: "Retirer ma proposition",
  withdrawing: "Retrait…",
  empty: "Le champ ne peut pas être vide : le texte disparaîtrait de la page.",
  nothingToSave: "Modifiez le texte ou ajoutez une remarque.",
  saveFailed: "L’enregistrement a échoué. Votre texte est toujours là ; réessayez.",
  sessionEnded:
    "Votre session a expiré. Le brouillon reste dans cet onglet : connectez-vous et enregistrez-le de nouveau.",
  settled: "Cette proposition ne peut plus être retirée : elle a été examinée.",
  withdrawFailed: "Impossible de retirer la proposition. Réessayez.",
  sanitized:
    "Le texte enregistré diffère de la saisie : le serveur ne garde que les balises em, strong, a et code et retire les autres.",
  draftRestored: "Brouillon non enregistré restauré.",
  discardDraft: "Abandonner le brouillon",
  otherLanguages: "Autres langues",
  notTranslated: "pas de traduction",
  othersProposals: "Propositions d’autres personnes",
  detailsLoading: "Chargement…",
  detailsFailed: "Impossible de charger les autres langues et les propositions.",
  markupNote:
    "Certains champs laissent voir le balisage de la page : « <em> » met un mot en valeur, « <a …> » crée un lien. Modifiez le texte entre les balises et laissez-les en place — une balise supprimée emporte avec elle la mise en valeur ou le lien.",
  frenchMissingSpace: (fragments) => `Espace manquante avant : ${fragments}`,
  localeNames: { pl: "polonais", en: "anglais", fr: "français" },
};

export const STRINGS: Readonly<Record<Locale, Strings>> = { pl: PL, en: EN, fr: FR };
