/**
 * @file SiteFooter.tsx
 * @description Closing chapter — "Inscriptio finalis": Sygnał (Warsaw clock, canonical hour,
 * liturgical tempus) and Fundatio (foundation identity, board, documents, contacts).
 * Hairline social ribbon → colophon. The Coda owns the final "amen"; the footer is chrome,
 * not monument.
 * @architecture Enterprise SaaS 2026
 * @module widgets/landing/SiteFooter
 */

import { useLiturgicalClock } from "./hooks/useLiturgicalClock";
import { Typo } from "./lib/Typo";

export function SiteFooter(): React.JSX.Element {
  const clock = useLiturgicalClock();

  return (
    <Typo>
      <footer className="site-footer" aria-label="Stopka">
        <div className="site-footer-inner">
          {/* The footer had no entrance at all while every block above it was written into
              being — and it is not chrome: it numbers itself IV, continuing the interludes'
              I/II/III, so it is the page's last movement and owes the same cadence.
              Its blocks take the ink register one at a time (inscription, signal, foundation,
              presence, colophon) rather than one node for the whole footer, which would be
              far past the height a single ink onset can cover.

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
          <div className="site-footer-incipit reveal" aria-hidden="true">
            <span className="footer-incipit-rule" />
            <span className="aether-inscription">
              <span className="roman">IV</span>
              <span className="dot">·</span>
              <span className="latin">Inscriptio finalis</span>
            </span>
            <span className="footer-incipit-rule" />
          </div>

          <div className="site-footer-grid">
            <div className="footer-col footer-col-signal reveal">
              <span className="footer-col-label micro">Sygnał</span>
              <div className="footer-col-body footer-col-signal-body">
                <div className="footer-signal-block footer-signal-now">
                  <span className="footer-signal-key micro">Kraków · teraz</span>
                  <span className="footer-signal-coord">50°03′41″N · 19°56′18″E</span>
                  {/* Every node below renders a clock value, and this page is STATIC: the
                      server text is whatever the time was when the site was built, while the
                      client renders "now". Without these opt-outs that is a guaranteed
                      hydration mismatch on every single visit, and React's recovery is to
                      throw the server HTML for this island away and re-render it — which
                      silently detaches every element in the footer from anything outside
                      React that was holding a reference to it. That is what stopped the
                      footer's reveals from ever firing: the shared observer was watching the
                      nodes React had already replaced. `useLiturgicalClock` takes a fresh
                      snapshot on mount, so the build-time text these keep is corrected within
                      a frame — and a visitor without JS still sees a rendered clock face
                      rather than the blank one a null initial state would leave. */}
                  <span
                    className="footer-signal-clock"
                    aria-live="off"
                    suppressHydrationWarning
                  >
                    {clock.hm}
                    <span
                      className="footer-signal-seconds"
                      aria-hidden="true"
                      suppressHydrationWarning
                    >
                      {clock.seconds}
                    </span>
                  </span>
                  <p className="footer-signal-hora-row">
                    <em
                      className="footer-signal-hora-name"
                      aria-live="off"
                      suppressHydrationWarning
                    >
                      {clock.hora.name}
                    </em>
                    <span className="footer-signal-hora-sep" aria-hidden="true">
                      ·
                    </span>
                    <span className="footer-signal-hora-poem" suppressHydrationWarning>
                      {clock.hora.poem}
                    </span>
                  </p>
                  <p className="footer-signal-tempus-row">
                    <em className="footer-signal-tempus" suppressHydrationWarning>
                      {clock.tempus.lat}
                    </em>
                    <span className="footer-signal-tempus-sep" aria-hidden="true">
                      ·
                    </span>
                    <span className="footer-signal-tempus-pl" suppressHydrationWarning>
                      {clock.tempus.pl}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="footer-col footer-col-foundation reveal">
              <span className="footer-col-label micro">Fundacja</span>
              <div className="footer-col-body">
                <div className="foundation-mark">
                  <em className="foundation-title">VoctFoundation</em>
                  <p className="foundation-seat">
                    Św. Filipa 23/3
                    <span className="sep" aria-hidden="true">
                      ·
                    </span>
                    31-150 Kraków
                  </p>
                  <ul className="foundation-legal" aria-label="Numery rejestrowe">
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

                <div className="foundation-stanza">
                  <span className="foundation-stanza-label">
                    <span className="dot" aria-hidden="true">
                      ·
                    </span>
                    <span className="latin">Consilium</span>
                    <span className="pl">zarząd</span>
                  </span>
                  <ul className="foundation-consilium-list">
                    <li>Florent de Bazelaire</li>
                    <li>Anna Marcisz</li>
                    <li>Krystian Bugalski</li>
                  </ul>
                </div>

                <div className="foundation-stanza">
                  <span className="foundation-stanza-label">
                    <span className="dot" aria-hidden="true">
                      ·
                    </span>
                    <span className="latin">Corpus</span>
                    <span className="pl">dokumenty</span>
                  </span>
                  <ul className="foundation-corpus-list">
                    <li>
                      <a
                        href="/docs/Statut-VoctFoundation.pdf"
                        className="plausible-event-name=statut+fundacji"
                        target="_blank"
                        rel="noopener"
                        aria-label="Statut Fundacji VoctFoundation — dokument PDF, otwiera się w nowej karcie"
                      >
                        Statut fundacji{" "}
                        <span className="doc-tag" aria-hidden="true">
                          PDF
                        </span>
                      </a>
                    </li>
                    <li>
                      <a
                        href="/polityka-prywatnosci"
                        className="plausible-event-name=polityka+prywatnosci"
                      >
                        Polityka prywatności
                      </a>
                    </li>
                  </ul>
                </div>

                <div className="foundation-stanza foundation-stanza-vox">
                  <span className="foundation-stanza-label">
                    <span className="dot" aria-hidden="true">
                      ·
                    </span>
                    <span className="latin">Vox</span>
                    <span className="pl">kontakt</span>
                  </span>
                  <ul className="foundation-vox-list">
                    <li>
                      <a href="/kontakt" className="plausible-event-name=kontakt">
                        napisz do nas
                      </a>
                    </li>
                    <li>
                      <a
                        href="mailto:booking@voctensemble.com"
                        className="plausible-event-name=booking"
                      >
                        booking
                      </a>
                    </li>
                    <li>
                      <a
                        href="mailto:patronat@voctensemble.com"
                        className="plausible-event-name=patronat"
                      >
                        patronat
                      </a>
                    </li>
                    <li>
                      <a
                        href="mailto:florent.de.bazelaire@voctensemble.com"
                        className="plausible-event-name=dyrekcja"
                      >
                        dyrekcja artystyczna
                      </a>
                    </li>
                  </ul>
                  <p className="foundation-vox-rodo">
                    <span className="key">RODO</span>
                    <a
                      href="mailto:rodo@voctensemble.com"
                      className="plausible-event-name=rodo+mail"
                    >
                      rodo@voctensemble.com
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="footer-ribbon reveal" aria-label="Obecność w sieci">
            <span className="footer-ribbon-rule" aria-hidden="true" />
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
                href="/kolofon"
                aria-label="Kolofon — fonty, prawa, autorzy"
              >
                Colophon <span aria-hidden="true">↗</span>
              </a>
              {/* Each name is set in the face it names — the list demonstrates the stack
                  rather than describing it, so it has to stay in sync with base.css.
                  Focusable: the weight/tracking bloom is the only thing that happens here,
                  and a keyboard reader deserves it as much as a pointer does. */}
              <span className="footer-colophon-faces">
                <span className="ff ff--cormorant" tabIndex={0}>
                  Cormorant Garamond
                </span>
                <span className="ff-sep" aria-hidden="true">
                  ·
                </span>
                <span className="ff ff--cinzel" tabIndex={0}>
                  Cinzel
                </span>
                <span className="ff-sep" aria-hidden="true">
                  ·
                </span>
                <span className="ff ff--plex-sans" tabIndex={0}>
                  IBM Plex Sans
                </span>
                <span className="ff-sep" aria-hidden="true">
                  ·
                </span>
                <span className="ff ff--plex-mono" tabIndex={0}>
                  IBM Plex Mono
                </span>
              </span>
            </div>
            <div className="footer-colophon-signature micro">
              {/* Latin, like the rest of this footer's vocabulary (INSCRIPTIO FINALIS,
                  CONSILIUM, CORPUS, VOX): the standard rights formula, not a coinage. */}
              <span>MMXXVI · omnia iura reservata</span>
              <span className="footer-colophon-author">
                Site ·{" "}
                <a
                  href="mailto:krystbugalski@gmail.com"
                  className="plausible-event-name=author+mail"
                  rel="author"
                >
                  Krystian Bugalski <span aria-hidden="true">↗</span>
                </a>
              </span>
            </div>
          </div>
        </div>
      </footer>
    </Typo>
  );
}
