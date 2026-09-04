/**
 * @file landing.ts
 * @description Everything about the landing (`/`) except its words: the shape its Polish prose must
 *  have (zod, `.strict()`), the copy desk's key contract over that prose, and the page's own chrome
 *  in all three locales.
 *
 *  THE LINE IS NOT "PROSE VS LABEL" but whether COMPLETENESS CAN BE DEMANDED (spec §6r). A landmark
 *  name, the audio pill and the copy button have to exist in every locale or the page is broken for
 *  somebody, and `Record<Locale, …>` makes the compiler say so. A paragraph is the opposite: it
 *  arrives one field at a time through review, and the English page has to stand with English
 *  chrome around Polish prose for as long as that takes. So the prose lives in
 *  `src/content/pages/landing.yaml` with its translations in `src/content/pages.{en,fr}.yaml`,
 *  falling back per field.
 *
 *  THE THRESHOLD'S TWO BUTTONS ARE CHROME, and they are the one place on this page where the test
 *  above is not the whole reason. `page.polityka-prywatnosci` QUOTES them — § 3 and § 10 name the
 *  buttons a reader pressed to consent to sound — so a locale falling back to Polish here would
 *  leave a legal document citing a control that does not exist in the language it is written in.
 *  Two documents on one site may not name one button two ways. Their hints travel with them for the
 *  same reason a label and its hint are one control.
 *
 *  WHERE A LANDMARK'S NAME IS A HEADING THE PAGE ALREADY PRINTS, THE LANDMARK READS THAT HEADING.
 *  That is §6cc's rule the other way round (the privacy page reads its name off the chrome because
 *  thirty footers print it): a name printed twice is READ twice and drifts on the first edit. So
 *  the director section, the Vox moment, the Imagines band and the register take their
 *  `aria-label` from the copy they already display, and only the sections whose name a reader never
 *  sees are keyed here.
 *
 *  THIS FILE IS IMPORTED BY NODE, not only by Vite: the desk's extractor reads the contract below
 *  straight from here (type-stripping, no build step), so that the key a translation is stored
 *  under is the same expression as the key the page looks up. Keep it free of `?raw`,
 *  `astro:assets` and anything else only a bundler can resolve.
 *
 *  Chrome carries no typography either — `lib/typo.ts` gives each locale its own at build.
 * @architecture Astro islands 2026
 * @module i18n/content/landing
 */

import { z } from "astro/zod";

import type { Locale } from "../config";
import type { CopyEntry, PageCopySpec } from "./copySpec";

// ── The prose, as a shape ─────────────────────────────────────────────────────────────────────

/**
 * `.strict()` throughout: a hand-added `en:` beside a Polish value would otherwise be dropped in
 * silence by zod's default and the translation would simply never appear. Translations belong in
 * the overlay, and this is what says so.
 */
const landingCopySchema = z
  .object({
    meta: z
      .object({ title: z.string(), description: z.string(), ensembleDescription: z.string() })
      .strict(),
    rite: z
      .object({
        word1: z.string(),
        word2: z.string(),
        kicker: z.string(),
        title1: z.string(),
        title2: z.string(),
        subtitle: z.string(),
      })
      .strict(),
    hero: z
      .object({
        announceLabel: z.string(),
        title1: z.string(),
        title2: z.string(),
        response: z.string(),
        strapHtml: z.string(),
        videoLabel: z.string(),
        videoMeta: z.string(),
        concertsLink: z.string(),
        cue: z.string(),
      })
      .strict(),
    manifest: z
      .object({
        label: z.string(),
        lines: z.array(z.object({ id: z.string(), text: z.string() }).strict()).min(1),
        statement: z.string(),
        answer: z.string(),
      })
      .strict(),
    litany: z.object({ inCatalogue: z.string(), moreLink: z.string() }).strict(),
    ensemble: z
      .object({
        eyebrow: z.string(),
        title1: z.string(),
        title2: z.string(),
        origin: z.string(),
        p2: z.string(),
        facts: z.array(z.object({ id: z.string(), label: z.string() }).strict()).min(1),
      })
      .strict(),
    director: z
      .object({
        role: z.string(),
        p1: z.string(),
        p2Html: z.string(),
        p3: z.string(),
        portraitAlt: z.string(),
      })
      .strict(),
    vox: z.object({ eyebrow: z.string(), lineHtml: z.string(), videoCaption: z.string() }).strict(),
    imagines: z
      .object({
        rubric: z.string(),
        lineHtml: z.string(),
        caption: z.string(),
        allLink: z.string(),
      })
      .strict(),
    register: z
      .object({
        label: z.string(),
        title: z.string(),
        lede: z.string(),
        videoLabel: z.string(),
        programLabel: z.string(),
        entries: z
          .array(
            z
              .object({
                id: z.string(),
                tag: z.string(),
                place: z.string(),
                note: z.string(),
                credit: z.string().optional(),
                videoNote: z.string().optional(),
              })
              .strict(),
          )
          .min(1),
        next: z
          .object({
            tag: z.string(),
            title: z.string(),
            place: z.string(),
            summary: z.string(),
            cta: z.string(),
          })
          .strict(),
      })
      .strict(),
    support: z
      .object({
        eyebrow: z.string(),
        title: z.string(),
        lede: z.string(),
        tiers: z
          .array(z.object({ id: z.string(), amount: z.string(), text: z.string() }).strict())
          .min(1),
        bank: z.object({ recipient: z.string(), transferTitle: z.string() }).strict(),
        contactLabel: z.string(),
        supportCta: z.string(),
        writeCta: z.string(),
      })
      .strict(),
    coda: z.object({ captionHtml: z.string() }).strict(),
  })
  .strict();

export type LandingCopy = z.infer<typeof landingCopySchema>;

// ── The desk contract ─────────────────────────────────────────────────────────────────────────

/**
 * DECLARATION ORDER IS READING ORDER — the desk renders this page in the sequence a reader meets
 * it, threshold to coda, because `order` is a counter over this list. Re-ordering it re-orders the
 * desk and never changes a key.
 */
const LANDING_CONTRACT: readonly CopyEntry[] = [
  // ── Metadane ──────────────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "meta.title",
    label: "Metadane · tytuł strony",
    note: "Read in a search result and a browser tab, not on the page. It carries the ensemble, the page's own line and the name of the cycle.",
  },
  {
    kind: "field",
    path: "meta.description",
    label: "Metadane · opis strony",
    note: "Under ~160 characters: Google truncates past that, and a description that spends its visible half on a second slogan buries the one fact a searcher needs.",
  },
  {
    kind: "field",
    path: "meta.ensembleDescription",
    label: "Metadane · opis zespołu (JSON-LD)",
    note: "Not printed anywhere. It describes the ENSEMBLE as an entity in the structured-data graph, and /o-nas points at the same entity without describing it, so this is the only description search engines are given.",
  },

  // ── Próg (rytuał wejścia) ─────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "rite.word1",
    label: "Próg · słowo 1",
    note: "One of the two display words that surface and sink while the page loads. They are the largest type on the site and they answer 'who is this' before anything else does — two noun phrases, no verb, no punctuation.",
  },
  { kind: "field", path: "rite.word2", label: "Próg · słowo 2" },
  {
    kind: "field",
    path: "rite.kicker",
    label: "Próg · rubryka",
    note: "The category and the city. The name beside them is the ensemble's and stays itself; the middot is the site's own separator.",
  },
  {
    kind: "field",
    path: "rite.title1",
    label: "Próg · tytuł, wers 1",
    note: "Set as two lines and DECLARATIVE on purpose: this screen asks consent to play audio, so the largest type has to state the fact the two buttons answer. Put as a question it reads as a rhetorical opening from a stranger. Split the sentence where the target language wants it.",
  },
  { kind: "field", path: "rite.title2", label: "Próg · tytuł, wers 2" },
  {
    kind: "field",
    path: "rite.subtitle",
    label: "Próg · podtytuł",
    note: "Says what the sound IS and that the choice is reversible. The two buttons under it are chrome and are named in `i18n/content/landing.ts` — the privacy policy quotes those names, so they may not be rewritten here.",
  },

  // ── Hero ──────────────────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "hero.announceLabel",
    label: "Hero · zapowiedź",
    note: "Dormant until `concerts.yaml` carries a future date. The evening's own title and moment are appended after it, so this is the opening word alone.",
  },
  {
    kind: "field",
    path: "hero.title1",
    label: "Hero · tytuł, wers 1",
    note: "The page's h1, set as two lines; the second takes the candle gold. It is the site's motto and it is reprised twice below — the Vox moment and the coda answer it — so a rendering has to survive being said three times.",
  },
  { kind: "field", path: "hero.title2", label: "Hero · tytuł, wers 2" },
  { kind: "field", path: "hero.response", label: "Hero · odpowiedź" },
  {
    kind: "field",
    path: "hero.strapHtml",
    label: "Hero · pasmo",
    note: "The link is an in-page jump to the director's section; keep it on the name and nowhere else. Do not add hard spaces inside it — the sheet already binds the name.",
  },
  {
    kind: "field",
    path: "hero.videoLabel",
    label: "Hero · przycisk filmu",
    note: "The same words the Vox moment prints as its own rubric further down, and they are one name for one film.",
  },
  {
    kind: "field",
    path: "hero.videoMeta",
    label: "Hero · długość filmu",
    note: "The runtime is part of the invitation rather than a footnote to it. Keep the leading middot — it is the separator, not punctuation to translate.",
  },
  { kind: "field", path: "hero.concertsLink", label: "Hero · przycisk koncertów" },
  { kind: "field", path: "hero.cue", label: "Hero · zachęta do zejścia" },

  // ── Manifest ──────────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "manifest.label", label: "Manifest · rubryka" },
  {
    kind: "list",
    path: "manifest.lines",
    keyBy: "id",
    label: "Manifest · teza",
    note: "VERBATIM FOUNDING TEXT — quoted from Florent's vision document, not written for the site. It is here so a translation can be reviewed against it, never so the Polish can be rewritten. Each line is set alone at display size and swept by a light: one sentence, no subordinate clause.",
    fields: [{ path: "text", label: "wers" }],
  },
  {
    kind: "field",
    path: "manifest.statement",
    label: "Manifest · zdanie",
    note: "THE ONE NEGATION ON THE WHOLE SITE. Statement and answer are a single utterance and the layout sets them as one block, so they are rendered together or not at all.",
  },
  {
    kind: "field",
    path: "manifest.answer",
    label: "Manifest · odpowiedź",
    note: "One word, in gold italic, replying to the line above. A rendering that needs two is not this answer.",
  },

  // ── Litania ───────────────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "litany.inCatalogue",
    label: "Litania · odczyt bez wieczoru",
    note: "What the plate prints for a catalogued composer none of the register's evenings records. POSITIVE, and that is the point — 'no evening on record' says the same thing by negation.",
  },
  {
    kind: "field",
    path: "litany.moreLink",
    label: "Litania · odnośnik do katalogu",
    note: "It names its destination and stops; itemising what the reader would find there is the fault the plate's own head was cured of. Keep the trailing arrow.",
  },

  // ── Zespół ────────────────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "ensemble.eyebrow",
    label: "Zespół · rubryka",
    note: "The title of the founding document the two paragraphs below are quoted from.",
  },
  {
    kind: "field",
    path: "ensemble.title1",
    label: "Zespół · nagłówek, wers 1",
    note: "Set as two lines; the break is compositional.",
  },
  { kind: "field", path: "ensemble.title2", label: "Zespół · nagłówek, wers 2" },
  {
    kind: "field",
    path: "ensemble.origin",
    label: "Zespół · świadectwo",
    note: "QUOTED founding text, marked as such by a gold rule down its margin. Keep it testimony; brochure prose is the failure mode. 'Voct' is the ensemble's own name and stays itself.",
  },
  {
    kind: "field",
    path: "ensemble.p2",
    label: "Zespół · akapit 2",
    note: "Also quoted. Heterofonia / politonalność / polifonia are the terms of art they look like — render them as the terms, not as description.",
  },
  {
    kind: "list",
    path: "ensemble.facts",
    keyBy: "id",
    label: "Zespół · kafelek",
    note: "The ledger reads WHO · WHEN · WHERE, and each tile's numeral is DATA that the component prints in front of this line. The third is a counted noun with the count beside it — Polish declines it and English and French do not, so render the plural the language actually uses; the places follow it and are derived from `concerts.yaml`.",
    fields: [{ path: "label", label: "opis" }],
  },

  // ── Kierownictwo artystyczne ──────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "director.role",
    label: "Dyrygent · rubryka",
    note: "It also names the section for a screen reader, so it is read twice and written once.",
  },
  {
    kind: "field",
    path: "director.p1",
    label: "Dyrygent · akapit 1",
    note: "`Concert Spirituel` is the historical Paris institution and stays itself, singular, exactly as it stands. Only verified public facts belong in this section — Florent's personal biography is deliberately absent until he supplies an authorised biogram.",
  },
  {
    kind: "field",
    path: "director.p2Html",
    label: "Dyrygent · akapit 2",
    note: "The italicised title is a concert this site publishes; take its rendering from that concert's own page rather than translating it again here. The three programmes after it are named, not titled.",
  },
  { kind: "field", path: "director.p3", label: "Dyrygent · akapit 3" },
  {
    kind: "field",
    path: "director.portraitAlt",
    label: "Dyrygent · opis portretu",
    note: "Alt text, read aloud rather than seen. Translate it: leaving it Polish on the English page is an accessibility regression, not a cosmetic one.",
  },

  // ── Vox ───────────────────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "vox.eyebrow",
    label: "Vox · rubryka",
    note: "Stands after the Latin `Vox` and a middot, and it also names the section for a screen reader. The hero's own film button says the same words — one film, one name.",
  },
  {
    kind: "field",
    path: "vox.lineHtml",
    label: "Vox · wers",
    note: "The hero's motto reprised after the silence the page has just held: the reader lived through it, now the voice enters. The emphasis carries the second half.",
  },
  {
    kind: "field",
    path: "vox.videoCaption",
    label: "Vox · podpis filmu",
    note: "Printed under the frame and again inside the full-screen projection — one film, one caption. The concert's title is quoted; take its rendering from that concert's own page.",
  },

  // ── Imagines ──────────────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "imagines.rubric",
    label: "Imagines · rubryka",
    note: "The vernacular of `Imagines`, which stands before it unchanged in every locale, and also the band's accessible name.",
  },
  {
    kind: "field",
    path: "imagines.lineHtml",
    label: "Imagines · wers",
    note: "THE STEP IS ALWAYS FORWARD. Movement II runs silence → voice → memory and this band is where it turns to the third term, so the subject is what the voice LEAVES BEHIND. It echoes the Vox line in syntax; a rendering should keep the family resemblance without becoming a couplet.",
  },
  {
    kind: "field",
    path: "imagines.caption",
    label: "Imagines · podpis plansz",
    note: "The span of years the five frames cover is appended by the component. It states the genre rather than the count — 'five' over five visible panels is the reader's own arithmetic read back to them.",
  },
  {
    kind: "field",
    path: "imagines.allLink",
    label: "Imagines · odnośnik do archiwum",
    note: "Printed, not called for: an arrow here would make a row of photographs read as a card shelf with a 'see all' under it. The chrome names the same destination more briefly; keep this one's register.",
  },

  // ── Rejestr wieczorów ─────────────────────────────────────────────────────────────────────
  { kind: "field", path: "register.label", label: "Rejestr · rubryka" },
  {
    kind: "field",
    path: "register.title",
    label: "Rejestr · nagłówek",
    note: "Also the section's accessible name. It is the past tense the whole site speaks until a future date lands in `concerts.yaml`.",
  },
  { kind: "field", path: "register.lede", label: "Rejestr · zapowiedź" },
  {
    kind: "field",
    path: "register.videoLabel",
    label: "Rejestr · przycisk fragmentu",
    note: "One control, on the two evenings that have footage. It opens a FRAGMENT, not the whole film the hero offers — the distinction is the label's job.",
  },
  {
    kind: "field",
    path: "register.programLabel",
    label: "Rejestr · rozwijany program",
    note: "The summary of a disclosure widget, repeated on every entry. The works under it come from `concerts.yaml` and are not translated here.",
  },
  {
    kind: "list",
    path: "register.entries",
    keyBy: "id",
    label: "Wieczór",
    note: "The landing's own editorial layer over an evening. Its TITLE is not here — it belongs to the concert and is read from that concert's own page, so the two can never print different names. `place` is this register's prose form of the venue; the concert page and /koncerty state the same place in their own registers, and the three may read differently but may never name different buildings.",
    fields: [
      { path: "tag", label: "etykieta" },
      { path: "place", label: "miejsce" },
      {
        path: "note",
        label: "lead",
        note: "One honest sentence in the closed row, before anything is unfolded. Composers are named; works keep their titles.",
      },
      {
        path: "credit",
        label: "podziękowania",
        note: "Provenance: recording credits, partners, media patrons. Every institution here is a proper name; only the ROLE words in front of them are rendered.",
      },
      {
        path: "videoNote",
        label: "opis fragmentu",
        note: "A composer, a work title and two descriptions of the recording. The first two stay themselves.",
      },
    ],
  },
  {
    kind: "field",
    path: "register.next.tag",
    label: "Szósty wieczór · etykieta",
    note: "The register's open card. It states the two real preconditions for the next evening rather than implying a date exists — the ensemble does not book venues on its own, so a date here would be false.",
  },
  { kind: "field", path: "register.next.title", label: "Szósty wieczór · nagłówek" },
  { kind: "field", path: "register.next.place", label: "Szósty wieczór · miejsce" },
  { kind: "field", path: "register.next.summary", label: "Szósty wieczór · treść" },
  {
    kind: "field",
    path: "register.next.cta",
    label: "Szósty wieczór · przycisk",
    note: "The one home left for `wybrzmieć` as a verb on this site — used as a noun it reads as translated Polish, and the noun form was swept out. Keep it a verb.",
  },

  // ── Wsparcie ──────────────────────────────────────────────────────────────────────────────
  { kind: "field", path: "support.eyebrow", label: "Wsparcie · rubryka" },
  { kind: "field", path: "support.title", label: "Wsparcie · nagłówek" },
  {
    kind: "field",
    path: "support.lede",
    label: "Wsparcie · treść",
    note: "Names the real cost structure instead of a metaphor, and that honesty is the argument. No amounts per item, ever — published rates for musicians are both volatile and indiscreet.",
  },
  {
    kind: "list",
    path: "support.tiers",
    keyBy: "id",
    label: "Transza",
    note: "QUALITATIVE, never a rate card: each line says what a gift DOES. The amount the vault opens at is data and is not here; the printed amount is, because a currency needs saying in the reader's own way.",
    fields: [
      { path: "amount", label: "kwota" },
      { path: "text", label: "co robi" },
    ],
  },
  {
    kind: "field",
    path: "support.bank.recipient",
    label: "Przelew · odbiorca",
    note: "A label and a legal name. The name is the foundation's registered one and stays itself, letter for letter — it is typed into a bank form.",
  },
  {
    kind: "field",
    path: "support.bank.transferTitle",
    label: "Przelew · tytuł",
    note: "The same shape: a label, then the words a donor copies into the transfer title. The footer states the same purpose in one clause — keep the two saying one thing.",
  },
  { kind: "field", path: "support.contactLabel", label: "Wsparcie · etykieta kontaktu" },
  {
    kind: "field",
    path: "support.supportCta",
    label: "Wsparcie · przycisk darowizny",
    note: "The chrome's own nav prints this word too, and here they are genuinely the same call — keep them agreeing.",
  },
  { kind: "field", path: "support.writeCta", label: "Wsparcie · przycisk kontaktu" },

  // ── Koda ──────────────────────────────────────────────────────────────────────────────────
  {
    kind: "field",
    path: "coda.captionHtml",
    label: "Koda · podpis",
    note: "The page's last words, answering the hero in the same voice (roman, then gold italic). A fermata over a whole rest already instructs 'hold the silence', so this line is the third statement of that motif and must not become a fourth by explaining itself.",
  },
];

/** Everything else in `landing.yaml`, with the reason it is not text a reader is meant to read. */
const LANDING_NOT_COPY: Readonly<Record<string, string>> = {
  "manifest.lines[].id": "identity — it is this thesis's key part",
  "ensemble.facts[].id": "identity — it is this tile's key part, and the component pairs its numeral to it",
  "register.entries[].id":
    "identity — it is the concert's own id in `concerts.yaml`, which is how the register joins an evening to its title, its programme and its photographs",
  "support.tiers[].id": "identity — it is this tier's key part",
};

/** What `lib/pageCopy` needs to read this page, and the extractor to key it. */
export const LANDING_PAGE: PageCopySpec<LandingCopy> = {
  id: "landing",
  label: "Strona główna",
  schema: landingCopySchema,
  contract: LANDING_CONTRACT,
  notCopy: LANDING_NOT_COPY,
};

// ── The chrome ────────────────────────────────────────────────────────────────────────────────

export interface LandingChrome {
  /** Landmark names for the sections whose name a reader never sees. The ones that DO print a
      heading (the director, the Vox moment, the Imagines band, the register) read that heading
      instead, so no name on this page is written twice. */
  readonly manifestAria: string;
  readonly ensembleAria: string;
  readonly silenceAria: string;
  readonly codaAria: string;
  readonly supportAria: string;
  /** The list of past evenings inside the register, which needs a name of its own: sharing the
      section's would give a screen reader two things called the same thing on one screen. */
  readonly registerListAria: string;
  /** The open card at the foot of the register. */
  readonly nextAria: string;
  /** The transfer block inside the support section. */
  readonly bankAria: string;
  /** The right-edge movement index. */
  readonly spineAria: string;

  /** The audio pill in the bar, which prints its STATE rather than its action — "voice" while the
      ensemble is singing, "silence" while it is not. The threshold below teaches both words. */
  readonly audioOn: string;
  readonly audioOff: string;

  /**
   * The threshold's two buttons, each with its hint and its accessible name.
   *
   * THE PRIVACY POLICY QUOTES THESE. § 3 and § 10 of `polityka-prywatnosci.yaml` name the button a
   * reader pressed to consent to sound, in each of the three languages, so a fallback to Polish
   * here would leave a legal document citing a control that does not exist on the page it
   * describes. Change one and the other has to move in the same commit.
   */
  readonly enterSilence: string;
  readonly enterSilenceHint: string;
  readonly enterSilenceAria: string;
  readonly enterVoice: string;
  readonly enterVoiceHint: string;
  readonly enterVoiceAria: string;

  /** The IBAN copy control, before and after the click. */
  readonly copy: string;
  readonly copied: string;

  /** The footer plate. Its four stanza heads are the vernacular half of a two-voice rubric —
      `Fundatio` · `Consilium` · `Corpus` · `Vox` are set beside them and are never translated — so
      these are glosses, not labels: one word each, true to the Latin above them. */
  readonly footerAria: string;
  readonly stanzaFoundation: string;
  readonly stanzaBoard: string;
  readonly stanzaDocuments: string;
  readonly stanzaContact: string;
  readonly registryAria: string;
  /** The four routes in the Vox stanza. `booking` and `patronat` are the addresses themselves and
      are read as such; only the last one is a role that a language renders. */
  readonly voxWrite: string;
  readonly voxBooking: string;
  readonly voxPatronage: string;
  readonly voxDirection: string;
  readonly presenceAria: string;
  readonly colophonAria: string;
}

export const LANDING_CHROME: Record<Locale, LandingChrome> = {
  pl: {
    manifestAria: "Manifest chóru VoctEnsemble",
    ensembleAria: "Zespół",
    silenceAria: "Chwila ciszy",
    codaAria: "Cisza brzmi dalej",
    supportAria: "Wesprzyj VoctEnsemble",
    registerListAria: "Wcześniejsze koncerty cyklu",
    nextAria: "Następny koncert cyklu",
    bankAria: "Dane do przelewu",
    spineAria: "Części",
    audioOn: "Głos",
    audioOff: "Cisza",
    enterSilence: "Wejdź w ciszę",
    enterSilenceHint: "tak jak teraz",
    enterSilenceAria: "Wejdź w ciszę — strona bez dźwięku",
    enterVoice: "Wejdź z głosem",
    enterVoiceHint: "śpiew zespołu · cicho",
    enterVoiceAria: "Wejdź z głosem — cichy śpiew zespołu",
    copy: "Kopiuj",
    copied: "Skopiowano",
    footerAria: "Stopka",
    stanzaFoundation: "fundacja",
    stanzaBoard: "zarząd",
    stanzaDocuments: "dokumenty",
    stanzaContact: "kontakt",
    registryAria: "Numery rejestrowe",
    voxWrite: "napisz do nas",
    voxBooking: "booking",
    voxPatronage: "patronat",
    voxDirection: "dyrekcja artystyczna",
    presenceAria: "Obecność w sieci",
    colophonAria: "Kolofon — fonty, prawa, autorzy",
  },
  en: {
    manifestAria: "The VoctEnsemble manifesto",
    ensembleAria: "The ensemble",
    silenceAria: "A moment of silence",
    codaAria: "The silence sounds on",
    supportAria: "Support VoctEnsemble",
    registerListAria: "Earlier concerts of the cycle",
    nextAria: "The next concert of the cycle",
    bankAria: "Bank transfer details",
    spineAria: "Movements",
    audioOn: "Voice",
    audioOff: "Silence",
    enterSilence: "Enter in silence",
    enterSilenceHint: "as it is now",
    enterSilenceAria: "Enter in silence — the site without sound",
    enterVoice: "Enter with voice",
    enterVoiceHint: "the ensemble singing · quietly",
    enterVoiceAria: "Enter with voice — the ensemble singing quietly",
    copy: "Copy",
    copied: "Copied",
    footerAria: "Footer",
    stanzaFoundation: "foundation",
    stanzaBoard: "board",
    stanzaDocuments: "documents",
    stanzaContact: "contact",
    registryAria: "Registry numbers",
    voxWrite: "write to us",
    voxBooking: "booking",
    voxPatronage: "patronage",
    voxDirection: "artistic direction",
    presenceAria: "Presence online",
    colophonAria: "Colophon — typefaces, rights, credits",
  },
  fr: {
    manifestAria: "Le manifeste de VoctEnsemble",
    ensembleAria: "L'ensemble",
    silenceAria: "Un instant de silence",
    codaAria: "Le silence résonne encore",
    supportAria: "Soutenir VoctEnsemble",
    registerListAria: "Concerts passés du cycle",
    nextAria: "Le prochain concert du cycle",
    bankAria: "Coordonnées bancaires",
    spineAria: "Mouvements",
    audioOn: "Voix",
    audioOff: "Silence",
    enterSilence: "Entrer en silence",
    enterSilenceHint: "comme maintenant",
    enterSilenceAria: "Entrer en silence — le site sans son",
    enterVoice: "Entrer avec la voix",
    enterVoiceHint: "le chant de l'ensemble · en sourdine",
    enterVoiceAria: "Entrer avec la voix — le chant de l'ensemble en sourdine",
    copy: "Copier",
    copied: "Copié",
    footerAria: "Pied de page",
    stanzaFoundation: "fondation",
    stanzaBoard: "conseil",
    stanzaDocuments: "documents",
    stanzaContact: "contact",
    registryAria: "Numéros d'enregistrement",
    voxWrite: "écrivez-nous",
    voxBooking: "booking",
    voxPatronage: "mécénat",
    voxDirection: "direction artistique",
    presenceAria: "Présence en ligne",
    colophonAria: "Colophon — caractères, droits, crédits",
  },
};
