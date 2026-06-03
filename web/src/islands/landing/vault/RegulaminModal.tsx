/**
 * @file RegulaminModal.tsx
 * @description Donation terms-of-use overlay, layered above the vault sheet. The "Akceptuję
 *  regulamin" button flips the give-form consent checkbox via the shared VaultContext acceptor.
 *  Scroll-end detection fades the bottom veil once read to the end. Web/Astro port.
 * @architecture Astro islands 2026
 * @module islands/landing/vault/RegulaminModal
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { useFocusTrap } from "../hooks/useFocusTrap";
import { useVault } from "../providers/VaultContext";

interface RegulaminSection {
  readonly num: string;
  readonly title: string;
  readonly items: readonly React.ReactNode[];
}

const SECTIONS: readonly RegulaminSection[] = [
  {
    num: "§ 1",
    title: "Postanowienia ogólne",
    items: [
      <>
        Niniejszy regulamin określa zasady przekazywania darowizn na rzecz{" "}
        <strong>Fundacji VoctFoundation</strong> z siedzibą w Krakowie (ul. Św. Filipa 23/3,
        31-150 Kraków), wpisanej do rejestru Krajowego Rejestru Sądowego pod numerem KRS:
        0001237252, NIP: 6762718992, REGON: 544621525, zwanej dalej „Fundacją”.
      </>,
      <>
        Zgodnie z § 5 oraz § 6{" "}
        <a href="/docs/Statut-VoctFoundation.pdf" target="_blank" rel="noopener">
          Statutu Fundacji
        </a>
        , opublikowanego na stronie internetowej Fundacji, wszystkie darowizny przekazywane
        na rzecz Fundacji są przeznaczane wyłącznie na realizację jej celów statutowych,
        w szczególności działalności artystycznej, w tym muzycznej, rozwoju i upowszechniania
        twórczości muzycznej, dokumentowania, ochrony i upowszechniania dziedzictwa
        muzycznego, działalności edukacyjnej i popularyzatorskiej w obszarze kultury,
        zwiększania dostępności kultury, wspierania młodych artystów oraz realizacji
        projektów artystycznych, w tym działalności zespołu-rezydenta Fundacji.
      </>,
      "Darczyńcą może być każda pełnoletnia osoba fizyczna, osoba prawna lub jednostka organizacyjna nieposiadająca osobowości prawnej.",
      "Zgodnie z art. 890 § 1 zd. 2 Kodeksu cywilnego, umowa darowizny środków pieniężnych staje się ważna i skuteczna w momencie spełnienia świadczenia (czyli w chwili wpłynięcia środków na rachunek Fundacji), niezależnie od formy oświadczenia woli.",
    ],
  },
  {
    num: "§ 2",
    title: "Zasady przekazywania darowizn i metody płatności",
    items: [
      "Przekazywanie darowizn online odbywa się za pośrednictwem formularza wsparcia dostępnego na stronie internetowej voctensemble.com.",
      "Operatorem płatności online jest BNP Paribas Bank Polska S.A. z siedzibą w Warszawie (bramka Axepta BNP Paribas), a dla transakcji kartowych agentem rozliczeniowym jest PayU S.A. z siedzibą w Poznaniu.",
      "Darczyńca ma możliwość przekazania darowizny z wykorzystaniem nowoczesnych, szyfrowanych metod płatności, w szczególności: kart płatniczych (Visa, Mastercard), systemu BLIK, szybkich przelewów bankowych (Pay-By-Link) oraz portfeli elektronicznych (Apple Pay, Google Pay).",
      "Niezależnie od płatności online, Darczyńca może przekazać darowiznę zwykłym przelewem bankowym bezpośrednio na rachunek Fundacji — jednorazowo lub w formie zlecenia stałego (przelewu cyklicznego), które Darczyńca ustanawia, zmienia i odwołuje samodzielnie w swojej bankowości; Fundacja nie przechowuje w tym celu danych karty ani zgody na obciążenia. Darowiznę można również przekazać za pośrednictwem serwisu zbiórkowego Zrzutka.pl, na zasadach określonych w regulaminie tego serwisu.",
      "Darowizny mogą być przekazywane w walutach: PLN oraz EUR. Dostępność poszczególnych metod płatności zależy od wybranej waluty.",
      "Kliknięcie przycisku potwierdzającego chęć przekazania wsparcia w formularzu oraz dokonanie płatności jest równoznaczne z zawarciem umowy darowizny oraz akceptacją niniejszego Regulaminu.",
    ],
  },
  {
    num: "§ 3",
    title: "Reklamacje i zwroty",
    items: [
      "Darczyńca ma prawo zgłosić reklamację dotyczącą ewentualnych nieprawidłowości w procesie przekazywania darowizny (np. w przypadku usterek technicznych systemu płatności).",
      <>
        Zgłoszenia prosimy kierować drogą elektroniczną na adres e-mail:{" "}
        <a href="mailto:kontakt@voctensemble.com">kontakt@voctensemble.com</a>.
      </>,
      "Fundacja rozpatruje zgłoszenia z najwyższą starannością, niezwłocznie, nie później jednak niż w terminie 14 dni od daty ich otrzymania.",
      "W przypadku omyłkowego wykonania wpłaty lub awarii po stronie banku Darczyńcy skutkującej podwójnym obciążeniem, Darczyńca ma prawo żądać zwrotu przekazanej darowizny w terminie 14 dni od momentu jej zrealizowania. Wniosek o zwrot należy przesłać na adres wskazany w ust. 2, podając identyfikator transakcji oraz adres e-mail użyty podczas płatności.",
      "Mając na uwadze bezpieczeństwo finansowe Darczyńców, wszelkie zwroty środków są realizowane wyłącznie na tę samą metodę płatności (ten sam rachunek bankowy lub kartę płatniczą), przy użyciu której dokonano pierwotnej wpłaty, co wynika z przepisów prawa oraz regulaminów operatorów płatności.",
    ],
  },
  {
    num: "§ 4",
    title: "Dane osobowe (RODO)",
    items: [
      "Administratorem danych osobowych Darczyńców jest Fundacja VoctFoundation.",
      <>
        Szczegółowe informacje dotyczące przetwarzania danych osobowych, celów ich
        przetwarzania, ról operatorów płatności (Axepta BNP Paribas, PayU) oraz praw
        przysługujących Darczyńcom, znajdują się w{" "}
        <a href="/polityka-prywatnosci" target="_blank" rel="noopener">
          Polityce prywatności
        </a>{" "}
        dostępnej na stronie voctensemble.com.
      </>,
    ],
  },
  {
    num: "§ 5",
    title: "Postanowienia końcowe",
    items: [
      "Fundacja zastrzega sobie prawo do wprowadzania zmian w Regulaminie, o czym będzie informować poprzez aktualizację jego treści na stronie internetowej.",
      "W sprawach nieuregulowanych niniejszym Regulaminem zastosowanie mają odpowiednie przepisy prawa polskiego, w szczególności Kodeksu cywilnego.",
    ],
  },
];

export function RegulaminModal(): React.JSX.Element {
  const { isRegulaminOpen, closeRegulamin, acceptRegulamin } = useVault();
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atEnd, setAtEnd] = useState(false);

  useFocusTrap(panelRef, isRegulaminOpen, { onEscape: closeRegulamin });

  // Hide the bottom fade once the document has been scrolled to the end.
  const syncScrollEnd = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    setAtEnd(scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4);
  }, []);

  useEffect(() => {
    if (!isRegulaminOpen) return;
    const scroller = scrollRef.current;
    if (scroller) {
      scroller.scrollTop = 0;
      window.requestAnimationFrame(syncScrollEnd);
    }
    window.addEventListener("resize", syncScrollEnd);
    return () => window.removeEventListener("resize", syncScrollEnd);
  }, [isRegulaminOpen, syncScrollEnd]);

  return (
    <div
      className={`regulamin${isRegulaminOpen ? " is-open" : ""}`}
      id="regulamin"
      role="dialog"
      aria-modal="true"
      aria-hidden={!isRegulaminOpen}
      aria-labelledby="regulamin-title"
    >
      <div className="regulamin-backdrop" onClick={closeRegulamin} aria-hidden="true" />
      <div className="regulamin-panel" role="document" tabIndex={-1} data-lenis-prevent ref={panelRef}>
        <header className="regulamin-head">
          <div className="regulamin-head-text">
            <span className="micro regulamin-kicker">Dokument · darowizny</span>
            <h2 className="regulamin-title" id="regulamin-title">
              Regulamin przekazywania darowizn
            </h2>
          </div>
          <button
            type="button"
            className="regulamin-close"
            onClick={closeRegulamin}
            aria-label="Zamknij regulamin"
          >
            <span />
            <span />
          </button>
        </header>

        <div className={`regulamin-scroll-wrap${atEnd ? " is-end" : ""}`}>
          <div className="regulamin-scroll" ref={scrollRef} onScroll={syncScrollEnd}>
            <div className="regulamin-doc">
              <p className="regulamin-lede">
                Regulamin określa zasady przekazywania darowizn na rzecz Fundacji
                VoctFoundation za pośrednictwem strony voctensemble.com — w formie płatności
                online oraz przelewu bankowego.
              </p>

              {SECTIONS.map((section) => (
                <section className="regulamin-section" key={section.num}>
                  <h3 data-num={section.num}>{section.title}</h3>
                  <ol>
                    {section.items.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ol>
                </section>
              ))}

              <details className="regulamin-history">
                <summary>
                  <span>Historia wersji</span>
                  <span className="regulamin-history-icon" aria-hidden="true" />
                </summary>
                <ul className="regulamin-history-list">
                  <li>
                    <strong>Wersja 1.1 · 3 czerwca 2026</strong> — Uzupełniono § 2 o sposoby
                    przekazania darowizny poza bramką płatności online: zwykły przelew bankowy
                    (jednorazowy oraz w formie zlecenia stałego) i serwis zbiórkowy Zrzutka.pl.
                  </li>
                  <li>
                    <strong>Wersja 1.0 · 13 maja 2026</strong> — Pierwotna wersja Regulaminu,
                    opublikowana wraz z uruchomieniem strony voctensemble.com.
                  </li>
                </ul>
              </details>
            </div>
          </div>
          <div className="regulamin-scroll-fade" aria-hidden="true" />
        </div>

        <footer className="regulamin-foot">
          <p className="regulamin-foot-note">Wersja 1.1 · obowiązuje od 3 czerwca 2026</p>
          <button type="button" className="regulamin-accept" onClick={acceptRegulamin}>
            <span>Akceptuję regulamin</span>
            <span className="regulamin-accept-arrow" aria-hidden="true">
              →
            </span>
          </button>
        </footer>
      </div>
    </div>
  );
}
