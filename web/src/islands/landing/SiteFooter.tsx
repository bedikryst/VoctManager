/**
 * @file SiteFooter.tsx
 * @description Closing chapter — "Inscriptio finalis", read as four horizontal bands: the head
 * (title left, rule, dateline right — instant, canonical hour, liturgical season), the register
 * of the foundation in four ruled columns (Fundatio · Consilium · Corpus · Vox), the ribbon of
 * presence (names left, rule running out to the right edge — the head band mirrored), the
 * colophon. The Coda owns the final "amen"; the footer is chrome, not monument.
 *
 *  ONE DOM, TWO COMPOSITIONS. Below 640px this stops being a register and becomes an
 *  IMPRESSIO — the imprint at the foot of a printed leaf: the movement mark, the moment of
 *  printing (clock · hora · gloss · tempus, stacked and decrescendo), the house, one
 *  invitation, its documents, its presence, and the fine print under the mark. The phone
 *  prints a strict subset of this markup and 11-mobile.css is the only thing that decides
 *  which — no second tree, no duplicated link, nothing to keep in sync.
 *
 *  WHAT THE PHONE DOES NOT PRINT, and why none of it is lost: the board, NIP, REGON, the
 *  statute, the typefaces and three of the four contact routes are all set — in a fuller
 *  form, under their own heads — on /kolofon and /kontakt, and both of those pages are
 *  linked from the plate itself. Collapsed into one narrow column the register was a
 *  1200px restatement of a page it links to, which is why no amount of alignment ever
 *  settled it: the fault was never the axis, it was printing the archive twice. What stays
 *  is what a foundation's footer owes on a phone — who we are, where we sit, the KRS that
 *  proves it, how to write, where the documents are.
 *
 *  WHY THE CLOCK IS A DATELINE AND NOT A COLUMN. It spent a long time as the left half of a
 *  diptych, and that placement is what kept going wrong. The clock is not a heading its column can
 *  be named after — it is the MOMENT THE PAGE IS BEING READ, which is what a dateline is, and
 *  datelines sit on the rule at the head of a document. As a column it had a quarter of the
 *  facing column's height (five short lines against a twenty-line register), which left a
 *  permanent void nobody could fill with content because there was no more time to print; the
 *  void then invited decoration, and a solar-day figure was built three times to fill it and cut
 *  each time (docs/web-landing-guardrails.md). Moved onto the rule the void has no place to form,
 *  the register takes the whole measure, and the 80px clock stops out-shouting `VoctFoundation`,
 *  which is the actual subject of this footer.
 *  THE PLATE IS PRINTED ON THE HOUR'S OWN GROUND. This footer already prints the hora
 *  canonica it is being read in; since 2026-08 it is SET on that hour's light too —
 *  parchment through the day, a night plate at Completorium and Matutinum. Two full
 *  palettes on one axis (`--nox`, styles/landing/06-footer.css), and the assignment is a
 *  field on the hours themselves (`lib/horaeCanonicae.ts`), so nothing here decides it.
 *
 *  THE TONE IS NOT SET BY THIS ISLAND, deliberately. It hydrates `client:visible`, i.e.
 *  when the footer enters the viewport — a palette applied on mount would land in front
 *  of the reader every single time, the plate arriving parchment and turning under their
 *  eyes. The page's ground is not island state; `scripts/landing.ts` settles it at module
 *  time and in `astro:after-swap`, long before anyone reaches the foot of the page. What
 *  this island still owns is the clock, which is the one thing that must be live.
 * @architecture Enterprise SaaS 2026
 * @module widgets/landing/SiteFooter
 */

import { localizePath, type Locale } from "../../i18n/config";
import { UI } from "../../i18n/ui";
import type { LandingChrome } from "../../i18n/content/landing";
import { useLiturgicalClock } from "./hooks/useLiturgicalClock";
import { Typo } from "./lib/Typo";

interface SiteFooterProps {
  /**
   * The page's language. TAKEN, NOT READ, and this plate is the reason the rule is worth stating
   * twice: the island is server-rendered, so a locale read from the document is Polish during SSR
   * — and React answers a hydration mismatch by discarding the server DOM, which strands every
   * class the shared reveal observer had already set on nodes that are no longer in the document.
   * That is exactly how this footer's entrance failed once before (guardrails §2).
   */
  readonly lang: Locale;
  /** The landing footer's own glosses and landmark names. */
  readonly chrome: LandingChrome;
}

export function SiteFooter({ lang, chrome }: SiteFooterProps): React.JSX.Element {
  const clock = useLiturgicalClock();
  const t = UI[lang];
  const hrefContact = localizePath("/kontakt", lang);
  const hrefPrivacy = localizePath("/polityka-prywatnosci", lang);
  const hrefColophon = localizePath("/kolofon", lang);

  return (
    <Typo locale={lang}>
      <footer className="site-footer" aria-label={chrome.footerAria}>
        <div className="site-footer-inner">
          {/* The footer had no entrance at all while every block above it was written into
              being — and it is not chrome: it numbers itself IV, continuing the interludes'
              I/II/III, so it is the page's last movement and owes the same cadence.
              Its blocks take the ink register one at a time (inscription, dateline, then the
              four stanzas of the register left to right, ribbon, colophon) rather than one node
              for the whole footer, which would be far past the height a single ink onset can
              cover. The four stanzas entering in sequence is the register being written across
              the measure, which is why they are four nodes and not one.

              TWO conditions keep an externally-applied class alive on a React island, and the
              second one is the one that bites. (1) These classNames must stay CONSTANT
              strings: the clock re-renders this island every second, and React writes
              `className` to the DOM only when the prop VALUE changed, so a constant is left
              alone. (2) The island must HYDRATE CLEANLY. A hydration mismatch is not a warning
              — React answers it by discarding the server DOM and re-rendering, and the shared
              observer is then holding nodes that are no longer in the document, so nothing it
              does is ever seen. This footer mismatched on every visit (see the clock note
              below) and that is exactly how it failed: the reveals were being applied, to
              elements React had already thrown away. */}
          {/* THE HEAD — title left, rule, date right: the form the head of a dated document
              takes, and the reason the two are ONE band. They were two: a rule-flanked
              inscription with a CENTRED dateline under it, and the dateline was then the only
              centred object above a register that hangs from the left of the measure, so it
              belonged to nothing and floated. On the measure's right edge it shares an axis
              with the Vox column and the band reads as a head rather than as a caption.

              The two long rules that used to flank the inscription were this footer's own
              addition — the rhyme with the interludes' I/II/III is carried by
              `.aether-inscription` itself (capitalis, the roman in italic serif, the two
              diamond fleurons), which is untouched here. That is what makes the asymmetry
              affordable. */}
          <div className="site-footer-head reveal">
            <span className="aether-inscription" aria-hidden="true">
              <span className="roman">IV</span>
              <span className="dot">·</span>
              <span className="latin">Inscriptio finalis</span>
            </span>

            {/* LEAD, alone: this hairline is the only object in the band that is a line, and
                the band's ink lives on its parent. It is the one rule in this footer that
                follows its text instead of leading it, and that is what it IS rather than an
                exception — it CLOSES the running head (under both voices on the phone,
                between them on the wide measure), and a scribe rules a line before writing on
                it but draws a closing rule after. Which is also the order the shared onset
                queue gives it for free, the parent standing ahead of it in the markup. */}
            <span className="footer-head-rule reveal-rule" aria-hidden="true" />

            {/* THE DATELINE — instant, canonical hour, liturgical season: three depths of time
                descending, and the type descends with them (clock → hora → gloss → tempus), so
                the line decrescendos left to right instead of shouting in several voices. It
                printed the PLACE too and that was a restatement — the seat is set in full a
                hundred pixels below, in the Fundatio stanza.

                Every node here renders a clock value, and this page is STATIC: the server text
                is whatever the time was when the site was built, while the client renders "now".
                Without these opt-outs that is a guaranteed hydration mismatch on every single
                visit, and React's recovery is to throw the server HTML for this island away and
                re-render it — which silently detaches every element in the footer from anything
                outside React that was holding a reference to it. That is what stopped the
                footer's reveals from ever firing: the shared observer was watching the nodes
                React had already replaced. `useLiturgicalClock` takes a fresh snapshot on mount,
                so the build-time text these keep is corrected within a frame — and a visitor
                without JS still sees a rendered clock face rather than the blank one a null
                initial state would leave.

                The two groups wrap as units. A dateline that broke between `Completorium` and
                `noc się zamyka` would read as two entries rather than one glossed one. */}
            <p className="site-footer-dateline">
              <span className="dateline-clock" aria-live="off" suppressHydrationWarning>
                {clock.hm}
                <span className="dateline-seconds" aria-hidden="true" suppressHydrationWarning>
                  {clock.seconds}
                </span>
              </span>
              <span className="dateline-sep" aria-hidden="true">
                ·
              </span>
              <span className="dateline-group">
                <em className="dateline-hora" aria-live="off" suppressHydrationWarning>
                  {clock.hora.name}
                </em>
                <span className="dateline-gloss" suppressHydrationWarning>
                  {clock.hora.poem[lang]}
                </span>
              </span>
              <span className="dateline-sep" aria-hidden="true">
                ·
              </span>
              <em className="dateline-tempus" suppressHydrationWarning>
                {clock.tempus.lat}
              </em>
            </p>
          </div>

          {/* THE REGISTER — four stanzas of one rank, each under its own ruled head, all hanging
              from one line across the whole measure. They were two columns (a narrow Sygnał
              against a Fundatio that carried its own internal 2×2), which is three columns of
              content wearing a two-column shell; the register now says what it is. The heads
              share the stanza's `· LATIN polski` form because they are siblings now — the old
              Polish `Sygnał`/`Fundacja` labels sat in a different vocabulary from the Latin
              sub-heads they governed. */}
          <div className="site-footer-grid">
            {/* Each stanza is INK + LEAD on one node — the one pair the register language
                allows, because it is a single causal gesture: the cap is ruled left to right
                and the stanza is written onto it a beat later (0.18s, registers.css). Nothing
                was added to have something to rule; the cap is the border these columns have
                carried since they became four stanzas of one rank. The rule is top-anchored,
                which is where the trigger fires, so it is drawn where it was armed.

                On the phone the same four nodes are three acts and a hidden column, so the
                caps that are not printed there hand their pseudo-rule `--rule-ink: transparent`
                (11-mobile.css) rather than growing a second set of classes. */}
            <div className="footer-stanza footer-stanza-mark reveal reveal-rule">
              <span className="foundation-stanza-label">
                <span className="dot" aria-hidden="true">
                  ·
                </span>
                <span className="latin">Fundatio</span>
                <span className="pl">{chrome.stanzaFoundation}</span>
              </span>
              <div className="foundation-mark">
                <em className="foundation-title">VoctFoundation</em>
                <p className="foundation-seat">
                  Św. Filipa 23/3
                  <span className="sep" aria-hidden="true">
                    ·
                  </span>
                  31-150 Kraków
                </p>
                <ul className="foundation-legal" aria-label={chrome.registryAria}>
                  <li>
                    <span className="key">KRS</span>
                    <span className="val">0001237252</span>
                  </li>
                  <li>
                    <span className="key">NIP</span>
                    <span className="val">6762718992</span>
                  </li>
                  <li>
                    <span className="key">REGON</span>
                    <span className="val">544621525</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="footer-stanza footer-stanza-consilium reveal reveal-rule">
              <span className="foundation-stanza-label">
                <span className="dot" aria-hidden="true">
                  ·
                </span>
                <span className="latin">Consilium</span>
                <span className="pl">{chrome.stanzaBoard}</span>
              </span>
              <ul className="foundation-consilium-list">
                <li>Florent de Bazelaire</li>
                <li>Anna Marcisz</li>
                <li>Krystian Bugalski</li>
              </ul>
            </div>

            <div className="footer-stanza footer-stanza-corpus reveal reveal-rule">
              <span className="foundation-stanza-label">
                <span className="dot" aria-hidden="true">
                  ·
                </span>
                <span className="latin">Corpus</span>
                <span className="pl">{chrome.stanzaDocuments}</span>
              </span>
              <ul className="foundation-corpus-list">
                <li>
                  <a
                    href="/docs/Statut-VoctFoundation.pdf"
                    className="plausible-event-name=statut+fundacji"
                    target="_blank"
                    rel="noopener"
                    aria-label={t.footer.statuteAria}
                  >
                    {t.footer.statute}{" "}
                    <span className="doc-tag" aria-hidden="true">
                      PDF
                    </span>
                  </a>
                </li>
                <li>
                  <a href={hrefPrivacy} className="plausible-event-name=polityka+prywatnosci">
                    {t.footer.privacy}
                  </a>
                </li>
              </ul>
            </div>

            <div className="footer-stanza footer-stanza-vox reveal reveal-rule">
              <span className="foundation-stanza-label">
                <span className="dot" aria-hidden="true">
                  ·
                </span>
                <span className="latin">Vox</span>
                <span className="pl">{chrome.stanzaContact}</span>
              </span>
              <ul className="foundation-vox-list">
                <li>
                  <a href={hrefContact} className="plausible-event-name=kontakt">
                    {chrome.voxWrite}
                  </a>
                </li>
                <li>
                  <a href="mailto:booking@voctensemble.com" className="plausible-event-name=booking">
                    {chrome.voxBooking}
                  </a>
                </li>
                <li>
                  <a href="mailto:patronat@voctensemble.com" className="plausible-event-name=patronat">
                    {chrome.voxPatronage}
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:florent.de.bazelaire@voctensemble.com"
                    className="plausible-event-name=dyrekcja"
                  >
                    {chrome.voxDirection}
                  </a>
                </li>
              </ul>
              <p className="foundation-vox-rodo">
                <span className="key">{t.footer.dataProtection}</span>
                <a href="mailto:rodo@voctensemble.com" className="plausible-event-name=rodo+mail">
                  rodo@voctensemble.com
                </a>
              </p>
            </div>
          </div>

          {/* THE RIBBON — the head band mirrored. There the inscription hangs left and the
              dateline is driven out to the right edge of the measure; here the names hang left
              and the rule runs out to that same edge. Between two rules it was centred, which
              made it a third axis in a footer whose every other band starts at the left margin.
              Rule AFTER the list in the source, not just in the grid: it is the band's tail. */}
          <div className="footer-ribbon reveal" aria-label={chrome.presenceAria}>
            <ul className="footer-ribbon-list">
              <li>
                <a
                  href="https://www.instagram.com/voctensemble/"
                  className="plausible-event-name=instagram"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  instagram
                </a>
              </li>
              <li>
                <a
                  href="https://www.facebook.com/voctensemble/"
                  className="plausible-event-name=facebook"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  facebook
                </a>
              </li>
              <li>
                <a
                  href="https://www.youtube.com/@VoctEnsemble-nb7gh"
                  className="plausible-event-name=youtube"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  youtube
                </a>
              </li>
            </ul>
            <span className="footer-ribbon-rule" aria-hidden="true" />
          </div>

          <div className="site-footer-colophon reveal">
            <div className="footer-colophon-fonts micro">
              <a
                className="footer-colophon-label"
                href={hrefColophon}
                aria-label={chrome.colophonAria}
              >
                Colophon <span aria-hidden="true">↗</span>
              </a>
              {/* Each name is set in the face it names — the list demonstrates the stack
                  rather than describing it, so it has to stay in sync with base.css.
                  NOT focusable, and that reverses an earlier reading of the same problem. These
                  four carried `tabIndex={0}` so a keyboard reader could reach the bloom — four
                  stops in the tab order that announce nothing, do nothing, and pay out in a font
                  wobble a screen reader cannot perceive at all. The bloom now fires on ARRIVAL
                  (06-footer.css), which gives the demonstration to everyone who reaches the foot
                  of the page rather than to whoever hovers; hover still answers on top of it.
                  Desktop only either way — 11-mobile.css hides this list on a phone. */}
              <span className="footer-colophon-faces">
                <span className="ff ff--cormorant">Cormorant Garamond</span>
                <span className="ff-sep" aria-hidden="true">
                  ·
                </span>
                <span className="ff ff--cinzel">Cinzel</span>
                <span className="ff-sep" aria-hidden="true">
                  ·
                </span>
                <span className="ff ff--plex-sans">IBM Plex Sans</span>
                <span className="ff-sep" aria-hidden="true">
                  ·
                </span>
                <span className="ff ff--plex-mono">IBM Plex Mono</span>
              </span>
            </div>
            <div className="footer-colophon-signature micro">
              {/* Latin, like the rest of this footer's vocabulary (INSCRIPTIO FINALIS,
                  CONSILIUM, CORPUS, VOX): the standard rights formula, not a coinage. */}
              <span>MMXXVI · omnia iura reservata</span>
              {/* `Auctor`, in the Latin this block already speaks (`omnia iura reservata` beside
                  it, INSCRIPTIO FINALIS / CONSILIUM / CORPUS / VOX above) — it was the one English
                  word in a Polish footer, and it is the same rubric the colophon puts over the
                  same name. The site-map footer keeps its Polish `Realizacja`: that one is
                  translated per locale, this one is not.
                  No `↗` on the address: the arrow marks a link that opens elsewhere in the
                  BROWSER, and a `mailto:` hands off to a mail client. Own domain, because the line
                  credits the person who built the site rather than a role in the foundation. */}
              <span className="footer-colophon-author">
                <span lang="la">Auctor</span> ·{" "}
                <a
                  href="mailto:krystian@bugalski.dev"
                  className="plausible-event-name=author+mail"
                  rel="author"
                >
                  Krystian Bugalski
                </a>
              </span>
            </div>
          </div>
        </div>
      </footer>
    </Typo>
  );
}
