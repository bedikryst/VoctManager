/**
 * @file SiteFooter.tsx
 * @description Closing chapter — "Inscriptio finalis" diptych: Sygnał (live Warsaw clock,
 * canonical hour and liturgical tempus, plus countdown to the next concert) and Fundatio
 * (foundation identity, board roster, document corpus, contact addresses). Below the
 * grid: hairline social ribbon → giant cursor-reactive wordmark → colophon.
 * @architecture Enterprise SaaS 2026
 * @module widgets/landing/SiteFooter
 */

import { useRef } from "react";

import { CONCERT } from "@/features/landing/constants/concert";
import { useCountdown } from "@/features/landing/hooks/useCountdown";
import { useFooterMarkCursor } from "@/features/landing/hooks/useFooterMarkCursor";
import { useLiturgicalClock } from "@/features/landing/hooks/useLiturgicalClock";
import { formatCountdownPL } from "@/features/landing/lib/countdown";

export function SiteFooter(): React.JSX.Element {
  const markRef = useRef<HTMLSpanElement>(null);
  useFooterMarkCursor(markRef);
  const days = useCountdown(CONCERT.date);
  const clock = useLiturgicalClock();
  const countdownLabel = days >= 0 ? formatCountdownPL(days) : "wybrzmiało";

  return (
    <footer className="site-footer" aria-label="Stopka">
      <div className="site-footer-inner">
        <div className="site-footer-incipit" aria-hidden="true">
          <span className="aether-inscription">
            <span className="roman">IV</span>
            <span className="dot">·</span>
            <span className="latin">Inscriptio finalis</span>
          </span>
        </div>

        <div className="site-footer-grid">
          <div className="footer-col footer-col-signal">
            <span className="footer-col-label micro">Sygnał</span>
            <div className="footer-col-body footer-col-signal-body">
              <div className="footer-signal-block footer-signal-event">
                <span className="footer-signal-key micro">Najbliższe wybrzmienie</span>
                <span className="footer-signal-time">{CONCERT.iso}</span>
                <span className="footer-signal-countdown">{countdownLabel}</span>
              </div>

              <div className="footer-signal-block footer-signal-now">
                <span className="footer-signal-key micro">Kraków · teraz</span>
                <span className="footer-signal-coord">50°03′41″N · 19°56′18″E</span>
                <span className="footer-signal-clock" aria-live="off">
                  {clock.hm}
                  <span className="footer-signal-seconds" aria-hidden="true">
                    {clock.seconds}
                  </span>
                </span>
                <p className="footer-signal-hora-row">
                  <em className="footer-signal-hora-name" aria-live="off">
                    {clock.hora.name}
                  </em>
                  <span className="footer-signal-hora-sep" aria-hidden="true">
                    ·
                  </span>
                  <span className="footer-signal-hora-poem">{clock.hora.poem}</span>
                </p>
                <p className="footer-signal-tempus-row">
                  <em className="footer-signal-tempus">{clock.tempus.lat}</em>
                  <span className="footer-signal-tempus-sep" aria-hidden="true">
                    ·
                  </span>
                  <span className="footer-signal-tempus-pl">{clock.tempus.pl}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="footer-col footer-col-foundation">
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

        <div className="footer-ribbon" aria-label="Obecność w sieci">
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

        <div className="site-footer-mark" aria-hidden="true">
          <span className="site-footer-mark-text" data-text="VoctEnsemble" ref={markRef}>
            VoctEnsemble
          </span>
        </div>

        <div className="site-footer-colophon">
          <div className="footer-colophon-fonts micro">
            <span className="footer-colophon-label">Colophon</span>
            <span>
              <em>Cormorant Garamond</em> · Inter · IBM Plex Mono
            </span>
          </div>
          <div className="footer-colophon-signature micro">
            <span>MMXXVI · wszystkie wybrzmienia</span>
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
  );
}
