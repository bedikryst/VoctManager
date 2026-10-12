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
  /** A proposal in another language than the page's, `language` from `localeAdverbs`. */
  readonly savedIn: (label: string, language: string) => string;
  readonly withdrawnIn: (label: string, language: string) => string;
  /** A trusted translator's save, accepted without a review. */
  readonly accepted: (label: string) => string;
  readonly acceptedIn: (label: string, language: string) => string;

  readonly menu: string;
  readonly myProposals: string;
  readonly restTexts: string;
  readonly restIntro: string;
  readonly mineEmpty: string;
  readonly notInDesk: string;
  readonly noOwnFields: string;
  readonly allVisible: string;
  readonly backToList: string;
  readonly statusOpen: string;
  readonly statusAccepted: string;
  readonly pageLanguage: string;
  readonly polishOnly: string;
  readonly showFields: string;
  readonly showPreviews: string;
  readonly showingPublished: string;
  readonly done: string;
  readonly doneHint: string;
  readonly doneHintTrusted: string;
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
  readonly previewTitle: string;
  readonly previewWhy: string;
  readonly slotNote: string;

  readonly sheetLabel: string;
  readonly untranslated: string;
  readonly stale: string;
  readonly mineOpen: string;
  readonly mineAccepted: string;
  /** Accepted, in a language where the reader's saves need no review. */
  readonly mineAcceptedTrusted: string;
  readonly textLabel: string;
  readonly commentLabel: string;
  readonly commentHint: string;
  /** The note's hint in a trusted language, where a note is what sends a change to the reviewers. */
  readonly commentHintTrusted: string;
  readonly save: string;
  readonly saving: string;
  readonly savedHere: string;
  readonly savedAccepted: string;
  /** Why a trusted translator's save went to the reviewers: the `{ }` differ from the Polish. */
  readonly heldSlots: string;
  /** Why a trusted translator's save went to the reviewers: the link targets differ. */
  readonly heldLinks: string;
  readonly withdraw: string;
  /** "Cofnij" over the reader's own change accepted on save. */
  readonly withdrawChange: string;
  readonly withdrawing: string;
  readonly withdrawnHere: string;
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
  readonly editOther: string;
  readonly polishNow: string;
  readonly notTranslated: string;
  readonly othersProposals: string;
  readonly detailsLoading: string;
  readonly detailsFailed: string;
  readonly markupNote: string;
  readonly frenchMissingSpace: (fragments: string) => string;
  /** Words in the chrome's own quotation marks. */
  readonly quoted: (words: string) => string;

  /** The markup editor's controls (`richField.ts`). */
  readonly toolsLabel: string;
  readonly italic: string;
  readonly bold: string;
  readonly link: string;
  readonly unlink: string;
  /** Over the link targets on offer: only the Polish text's. */
  readonly linkChoose: string;
  readonly linkSelectFirst: string;

  /** The checklist under the field (`checklist.ts`). */
  readonly checksHead: string;
  /** Read out for an unticked item; the mark beside it says it on screen. */
  readonly checkMissing: string;
  readonly checkExtraLink: string;
  /** Puts a missing slot back at the caret. */
  readonly insertSlot: string;
  /** The braces that make a `TEXT` field's link, counted. */
  readonly checkBraceLink: (actual: number, expected: number) => string;
  /** Other braces that are not slots, counted. */
  readonly checkBraces: (actual: number, expected: number) => string;
  /** In a trusted language: what a save will do with the list as it stands. */
  readonly checkTrustedOk: string;
  readonly checkTrustedNoted: string;
  readonly checkTrustedHeld: string;
  /** `em` and `strong` against the Polish, `[here, Polish]` where they differ. */
  readonly emphasisHint: (em: readonly [number, number] | null, strong: readonly [number, number] | null) => string;
  readonly localeNames: Readonly<Record<Locale, string>>;
  /** "in English": the form a sentence takes the language in. */
  readonly localeAdverbs: Readonly<Record<Locale, string>>;
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
  savedIn: (label, language) => `Zapisano propozycję ${language}: ${label}`,
  withdrawnIn: (label, language) => `Cofnięto propozycję ${language}: ${label}`,
  accepted: (label) => `Zmiana przyjęta: ${label}`,
  acceptedIn: (label, language) => `Zmiana ${language} przyjęta: ${label}`,

  menu: "Menu",
  myProposals: "Moje propozycje na tej stronie",
  restTexts: "Pozostałe teksty",
  restIntro:
    "Teksty tej strony, których na niej nie widać: tytuł i opis dla wyszukiwarek, opisy zdjęć, treść zamkniętych okien. Poprawka trafi do redakcji, ale na stronie jej nie zobaczysz.",
  mineEmpty: "Nie masz jeszcze propozycji na tej stronie.",
  notInDesk: "Ta strona nie jest w redakcji.",
  noOwnFields: "Ta strona nie ma w redakcji własnych tekstów. To, co na niej widać, poprawisz prosto na stronie.",
  allVisible: "Wszystkie teksty tej strony są na widoku: poprawisz je prosto na stronie.",
  backToList: "← Wróć do listy",
  statusOpen: "Propozycja czeka na decyzję redakcji",
  statusAccepted: "Propozycja przyjęta, czeka na publikację",
  pageLanguage: "Język strony",
  polishOnly: "Ta strona jest tylko po polsku.",
  showFields: "Podświetlaj teksty do poprawy",
  showPreviews: "Pokazuj moje propozycje",
  showingPublished: "Widzisz opublikowany tekst, bez swoich propozycji.",
  done: "Gotowe: powiadom redakcję",
  doneHint: "Bez tego redakcja i tak dostanie zestawienie po pół godzinie ciszy.",
  doneHintTrusted:
    "Twoje tłumaczenia są przyjmowane od razu. Ten przycisk powie redakcji, że czekają na publikację; bez niego dowie się po pół godzinie ciszy.",
  sending: "Wysyłam…",
  doneSent: "Redakcja dostała wiadomość o Twoich nowych zmianach.",
  doneNothing: "Redakcja wie już o wszystkich Twoich zmianach.",
  doneNobody: "Nie ma komu wysłać wiadomości. Twoje zmiany są zapisane.",
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
  previewTitle: "Twoja propozycja",
  previewWhy: "Tego tekstu nie da się podmienić na stronie, więc pokazuję propozycję tutaj.",
  slotNote: "Słowa w klamrach strona zastępuje własnymi danymi.",

  sheetLabel: "Poprawka tekstu",
  untranslated: "Nie ma jeszcze tłumaczenia: strona pokazuje tu polski tekst.",
  stale: "Polski tekst zmienił się od czasu tego tłumaczenia.",
  mineOpen: "Twoja propozycja czeka na decyzję redakcji.",
  mineAccepted:
    "Twoja propozycja jest przyjęta i czeka na publikację. Zmiana tego tekstu trafi do redakcji jako nowa propozycja.",
  mineAcceptedTrusted: "Twoja zmiana jest przyjęta i czeka na publikację. Możesz ją jeszcze poprawić.",
  textLabel: "Tekst",
  commentLabel: "Uwaga",
  commentHint: "Dla redakcji, nieobowiązkowo: dlaczego tak.",
  commentHintTrusted:
    "Dla redakcji, nieobowiązkowo. Zmiana z uwagą czeka na decyzję redakcji, a bez uwagi jest przyjmowana od razu.",
  save: "Zapisz",
  saving: "Zapisuję…",
  savedHere: "Zapisano.",
  savedAccepted: "Zapisano i przyjęto: zmiana czeka na publikację.",
  heldSlots:
    "Ta zmiana trafi do redakcji: klamry { } muszą zostać takie jak w polskim tekście, bo strona wstawia w nie własne dane albo robi z nich odnośnik.",
  heldLinks:
    "Ta zmiana trafi do redakcji: odnośniki muszą prowadzić tam, gdzie w polskim tekście. Redakcja sprawdzi link.",
  withdraw: "Cofnij moją propozycję",
  withdrawChange: "Cofnij moją zmianę",
  withdrawing: "Cofam…",
  withdrawnHere: "Cofnięto propozycję.",
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
  editOther: "Popraw",
  polishNow: "Polski tekst teraz:",
  notTranslated: "brak tłumaczenia",
  othersProposals: "Propozycje innych osób",
  detailsLoading: "Wczytuję…",
  detailsFailed: "Nie udało się wczytać innych języków ani propozycji.",
  markupNote:
    "W niektórych polach widać znaczniki strony: „<em>” wyróżnia słowo, „<a …>” robi odnośnik. Poprawiaj tekst między nimi i zostaw je na miejscu — skasowany znacznik zabiera ze strony wyróżnienie albo odnośnik.",
  frenchMissingSpace: (fragments) => `Brak spacji przed znakiem: ${fragments}`,
  quoted: (words) => `„${words}”`,

  toolsLabel: "Wyróżnienia i odnośniki",
  italic: "Kursywa",
  bold: "Pogrubienie",
  link: "Odnośnik",
  unlink: "Usuń odnośnik",
  linkChoose: "Dokąd prowadzi odnośnik? Do wyboru są adresy z polskiego tekstu.",
  linkSelectFirst: "Najpierw zaznacz słowa, które mają być odnośnikiem.",

  checksHead: "Do zachowania:",
  checkMissing: "brak",
  checkExtraLink: "Odnośnik spoza polskiego tekstu",
  insertSlot: "Wstaw",
  checkBraceLink: (actual, expected) => `Odnośnik w klamrach { }: ${actual} z ${expected}`,
  checkBraces: (actual, expected) => `Inne klamry { }: ${actual} z ${expected}`,
  checkTrustedOk: "Wszystko jest na miejscu: zmiana bez uwagi zostanie przyjęta od razu.",
  checkTrustedNoted: "Z uwagą zmiana poczeka na decyzję redakcji.",
  checkTrustedHeld: "Dopóki czegoś tu brakuje, zmiana poczeka na decyzję redakcji.",
  emphasisHint: (em, strong) =>
    `Wyróżnienia inaczej niż w polskim: ${[
      em && `kursywa ${em[0]} zamiast ${em[1]}`,
      strong && `pogrubienie ${strong[0]} zamiast ${strong[1]}`,
    ]
      .filter(Boolean)
      .join(", ")}.`,
  localeNames: { pl: "polski", en: "angielski", fr: "francuski" },
  localeAdverbs: { pl: "po polsku", en: "po angielsku", fr: "po francusku" },
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
  savedIn: (label, language) => `Proposal saved ${language}: ${label}`,
  withdrawnIn: (label, language) => `Proposal withdrawn ${language}: ${label}`,
  accepted: (label) => `Change accepted: ${label}`,
  acceptedIn: (label, language) => `Change ${language} accepted: ${label}`,

  menu: "Menu",
  myProposals: "My proposals on this page",
  restTexts: "Other texts",
  restIntro:
    "Texts of this page that you can’t see on it: the title and description for search engines, image descriptions, the contents of closed windows. A correction goes to the reviewers, but it won’t show on the page.",
  mineEmpty: "You have no proposals on this page yet.",
  notInDesk: "This page is not in the copy desk.",
  noOwnFields: "This page has no texts of its own in the copy desk. Correct what you see on it right on the page.",
  allVisible: "Every text of this page is on view: correct it right on the page.",
  backToList: "← Back to the list",
  statusOpen: "Proposal waiting for review",
  statusAccepted: "Proposal accepted, waiting to be published",
  pageLanguage: "Page language",
  polishOnly: "This page exists in Polish only.",
  showFields: "Highlight editable texts",
  showPreviews: "Show my proposals",
  showingPublished: "You are seeing the published text, without your proposals.",
  done: "Done: notify the reviewers",
  doneHint: "Otherwise the reviewers get a summary after half an hour of quiet.",
  doneHintTrusted:
    "Your translations are accepted as you save them. This tells the reviewers they are waiting to be published; otherwise they learn of it after half an hour of quiet.",
  sending: "Sending…",
  doneSent: "The reviewers have been told about your new changes.",
  doneNothing: "The reviewers already know about all your changes.",
  doneNobody: "There is nobody to notify. Your changes are saved.",
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
  previewTitle: "Your proposal",
  previewWhy: "This text can’t be swapped on the page, so the proposal is shown here.",
  slotNote: "The page replaces the words in braces with its own data.",

  sheetLabel: "Text correction",
  untranslated: "Not translated yet: the page shows the Polish text here.",
  stale: "The Polish text has changed since this translation.",
  mineOpen: "Your proposal is waiting for review.",
  mineAccepted:
    "Your proposal is accepted and waiting to be published. A change to this text goes to the reviewers as a new proposal.",
  mineAcceptedTrusted: "Your change is accepted and waiting to be published. You can still revise it.",
  textLabel: "Text",
  commentLabel: "Note",
  commentHint: "For the reviewers, optional: why.",
  commentHintTrusted:
    "For the reviewers, optional. A change with a note waits for their decision; without one it is accepted at once.",
  save: "Save",
  saving: "Saving…",
  savedHere: "Saved.",
  savedAccepted: "Saved and accepted: the change is waiting to be published.",
  heldSlots:
    "This change goes to the reviewers: the braces { } must stay as they are in the Polish text, because the page fills them with its own data or turns them into a link.",
  heldLinks:
    "This change goes to the reviewers: its links must lead where the Polish text’s links do. The reviewers will check them.",
  withdraw: "Withdraw my proposal",
  withdrawChange: "Withdraw my change",
  withdrawing: "Withdrawing…",
  withdrawnHere: "Proposal withdrawn.",
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
  editOther: "Edit",
  polishNow: "The Polish now:",
  notTranslated: "not translated",
  othersProposals: "Other people’s proposals",
  detailsLoading: "Loading…",
  detailsFailed: "The other languages and proposals could not be loaded.",
  markupNote:
    "Some fields show the page's own markup: “<em>” emphasises a word, “<a …>” makes a link. Edit the text between them and leave them where they are — a tag you delete takes the emphasis or the link off the site with it.",
  frenchMissingSpace: (fragments) => `No space before: ${fragments}`,
  quoted: (words) => `“${words}”`,

  toolsLabel: "Emphasis and links",
  italic: "Italic",
  bold: "Bold",
  link: "Link",
  unlink: "Remove link",
  linkChoose: "Where does the link go? The choices are the addresses in the Polish text.",
  linkSelectFirst: "First select the words that should become the link.",

  checksHead: "To keep:",
  checkMissing: "missing",
  checkExtraLink: "Link not in the Polish text",
  insertSlot: "Insert",
  checkBraceLink: (actual, expected) => `Link in braces { }: ${actual} of ${expected}`,
  checkBraces: (actual, expected) => `Other braces { }: ${actual} of ${expected}`,
  checkTrustedOk: "Everything is in place: without a note, the change is accepted at once.",
  checkTrustedNoted: "With a note, the change waits for the reviewers’ decision.",
  checkTrustedHeld: "While something here is missing, the change waits for the reviewers’ decision.",
  emphasisHint: (em, strong) =>
    `Emphasis differs from the Polish: ${[
      em && `italics ${em[0]} instead of ${em[1]}`,
      strong && `bold ${strong[0]} instead of ${strong[1]}`,
    ]
      .filter(Boolean)
      .join(", ")}.`,
  localeNames: { pl: "Polish", en: "English", fr: "French" },
  localeAdverbs: { pl: "in Polish", en: "in English", fr: "in French" },
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
  savedIn: (label, language) => `Proposition enregistrée ${language} : ${label}`,
  withdrawnIn: (label, language) => `Proposition retirée ${language} : ${label}`,
  accepted: (label) => `Modification acceptée : ${label}`,
  acceptedIn: (label, language) => `Modification ${language} acceptée : ${label}`,

  menu: "Menu",
  myProposals: "Mes propositions sur cette page",
  restTexts: "Autres textes",
  restIntro:
    "Les textes de cette page qu’on n’y voit pas : le titre et la description pour les moteurs de recherche, les descriptions d’images, le contenu des fenêtres fermées. La correction part à la relecture, mais elle n’apparaîtra pas sur la page.",
  mineEmpty: "Vous n’avez encore aucune proposition sur cette page.",
  notInDesk: "Cette page n’est pas dans la rédaction.",
  noOwnFields:
    "Cette page n’a pas de textes propres dans la rédaction. Corrigez ce que vous y voyez directement sur la page.",
  allVisible: "Tous les textes de cette page sont visibles : corrigez-les directement sur la page.",
  backToList: "← Retour à la liste",
  statusOpen: "Proposition en attente de relecture",
  statusAccepted: "Proposition acceptée, en attente de publication",
  pageLanguage: "Langue de la page",
  polishOnly: "Cette page n’existe qu’en polonais.",
  showFields: "Surligner les textes modifiables",
  showPreviews: "Afficher mes propositions",
  showingPublished: "Vous voyez le texte publié, sans vos propositions.",
  done: "Terminé : prévenir la relecture",
  doneHint: "Sinon, la relecture reçoit un récapitulatif après une demi-heure sans activité.",
  doneHintTrusted:
    "Vos traductions sont acceptées dès l’enregistrement. Ce bouton prévient la relecture qu’elles attendent la publication ; sinon, elle l’apprend après une demi-heure sans activité.",
  sending: "Envoi…",
  doneSent: "La relecture a été prévenue de vos nouvelles modifications.",
  doneNothing: "La relecture connaît déjà toutes vos modifications.",
  doneNobody: "Personne à prévenir. Vos modifications sont enregistrées.",
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
  previewTitle: "Votre proposition",
  previewWhy: "Ce texte ne peut pas être remplacé sur la page : la proposition s’affiche ici.",
  slotNote: "La page remplace les mots entre accolades par ses propres données.",

  sheetLabel: "Correction du texte",
  untranslated: "Pas encore traduit : la page affiche ici le texte polonais.",
  stale: "Le texte polonais a changé depuis cette traduction.",
  mineOpen: "Votre proposition attend la relecture.",
  mineAccepted:
    "Votre proposition est acceptée et attend la publication. Toute modification de ce texte part à la relecture comme une nouvelle proposition.",
  mineAcceptedTrusted:
    "Votre modification est acceptée et attend la publication. Vous pouvez encore la retoucher.",
  textLabel: "Texte",
  commentLabel: "Remarque",
  commentHint: "Pour la relecture, facultatif : pourquoi.",
  commentHintTrusted:
    "Pour la relecture, facultatif. Une modification accompagnée d’une remarque attend sa décision ; sans remarque, elle est acceptée aussitôt.",
  save: "Enregistrer",
  saving: "Enregistrement…",
  savedHere: "Enregistré.",
  savedAccepted: "Enregistré et accepté : la modification attend la publication.",
  heldSlots:
    "Cette modification part à la relecture : les accolades { } doivent rester comme dans le texte polonais, car la page y insère ses propres données ou en fait un lien.",
  heldLinks:
    "Cette modification part à la relecture : ses liens doivent mener là où mènent ceux du texte polonais. La relecture les vérifiera.",
  withdraw: "Retirer ma proposition",
  withdrawChange: "Retirer ma modification",
  withdrawing: "Retrait…",
  withdrawnHere: "Proposition retirée.",
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
  editOther: "Modifier",
  polishNow: "Le polonais actuel :",
  notTranslated: "pas de traduction",
  othersProposals: "Propositions d’autres personnes",
  detailsLoading: "Chargement…",
  detailsFailed: "Impossible de charger les autres langues et les propositions.",
  markupNote:
    "Certains champs laissent voir le balisage de la page : « <em> » met un mot en valeur, « <a …> » crée un lien. Modifiez le texte entre les balises et laissez-les en place — une balise supprimée emporte avec elle la mise en valeur ou le lien.",
  frenchMissingSpace: (fragments) => `Espace manquante avant : ${fragments}`,
  quoted: (words) => `« ${words} »`,

  toolsLabel: "Mise en valeur et liens",
  italic: "Italique",
  bold: "Gras",
  link: "Lien",
  unlink: "Retirer le lien",
  linkChoose: "Où mène le lien ? Les choix sont les adresses du texte polonais.",
  linkSelectFirst: "Sélectionnez d’abord les mots qui doivent devenir le lien.",

  checksHead: "À conserver :",
  checkMissing: "manquant",
  checkExtraLink: "Lien absent du texte polonais",
  insertSlot: "Insérer",
  checkBraceLink: (actual, expected) => `Lien entre accolades { } : ${actual} sur ${expected}`,
  checkBraces: (actual, expected) => `Autres accolades { } : ${actual} sur ${expected}`,
  checkTrustedOk: "Tout est en place : sans remarque, la modification est acceptée aussitôt.",
  checkTrustedNoted: "Avec une remarque, la modification attend la décision de la relecture.",
  checkTrustedHeld: "Tant qu’il manque quelque chose ici, la modification attend la décision de la relecture.",
  emphasisHint: (em, strong) =>
    `Mise en valeur différente du polonais : ${[
      em && `italique ${em[0]} au lieu de ${em[1]}`,
      strong && `gras ${strong[0]} au lieu de ${strong[1]}`,
    ]
      .filter(Boolean)
      .join(", ")}.`,
  localeNames: { pl: "polonais", en: "anglais", fr: "français" },
  localeAdverbs: { pl: "en polonais", en: "en anglais", fr: "en français" },
};

export const STRINGS: Readonly<Record<Locale, Strings>> = { pl: PL, en: EN, fr: FR };
