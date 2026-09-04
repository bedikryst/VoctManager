/**
 * @file RegulaminModal.tsx
 * @description Donation terms overlay, layered above the vault sheet. The accept button flips the
 *  give-form consent checkbox via the shared VaultContext acceptor. Scroll-end detection fades the
 *  bottom veil once read to the end.
 *
 *  THE DOCUMENT IS NOT IN THIS FILE. It lives in `src/content/pages/regulamin-darowizn.yaml`,
 *  arrives resolved for this locale as a prop, and its § numerals are the only thing set here —
 *  they are the same in every language, and they are what the text's own cross-references point
 *  at. The Polish version is the binding one; § 5 ust. 3 of the document says so itself.
 * @architecture Astro islands 2026
 * @module islands/landing/vault/RegulaminModal
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { longDate } from "../../../lib/dates";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useVault } from "../providers/VaultContext";
import { useVaultCopy } from "./copyContext";
import { Typo } from "../lib/Typo";

/** One paragraph of the document: plain text, or markup that has to be injected. */
type Paragraph = { readonly text: string } | { readonly html: string };

export function RegulaminModal(): React.JSX.Element {
  const { isRegulaminOpen, closeRegulamin, acceptRegulamin } = useVault();
  const { lang, terms, t } = useVaultCopy();
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atEnd, setAtEnd] = useState(false);

  useFocusTrap(panelRef, isRegulaminOpen, { onEscape: closeRegulamin });

  /* The five sections, in the order the document numbers them. The `§` is markup — locale-neutral,
     like every other rubric on this site — and the paragraphs are NAMED fields rather than a list,
     because § 3 ust. 4 refers back to "ust. 2" and a reorderable list could break that. */
  const sections = useMemo<
    readonly { readonly num: string; readonly title: string; readonly items: readonly Paragraph[] }[]
  >(
    () => [
      {
        num: "§ 1",
        title: terms.s1.title,
        items: [
          { html: terms.s1.p1Html },
          { html: terms.s1.p2Html },
          { text: terms.s1.p3 },
          { text: terms.s1.p4 },
        ],
      },
      {
        num: "§ 2",
        title: terms.s2.title,
        items: [
          { text: terms.s2.p1 },
          { text: terms.s2.p2 },
          { text: terms.s2.p3 },
          { text: terms.s2.p4 },
          { text: terms.s2.p5 },
          { text: terms.s2.p6 },
        ],
      },
      {
        num: "§ 3",
        title: terms.s3.title,
        items: [
          { text: terms.s3.p1 },
          { html: terms.s3.p2Html },
          { text: terms.s3.p3 },
          { text: terms.s3.p4 },
          { text: terms.s3.p5 },
        ],
      },
      {
        num: "§ 4",
        title: terms.s4.title,
        items: [{ text: terms.s4.p1 }, { html: terms.s4.p2Html }],
      },
      {
        num: "§ 5",
        title: terms.s5.title,
        items: [{ text: terms.s5.p1 }, { text: terms.s5.p2 }, { text: terms.s5.p3 }],
      },
    ],
    [terms],
  );

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
    <Typo locale={lang}>
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
              <span className="micro regulamin-kicker">{terms.head.kicker}</span>
              <h2 className="regulamin-title" id="regulamin-title">
                {terms.head.title}
              </h2>
            </div>
            <button
              type="button"
              className="regulamin-close"
              onClick={closeRegulamin}
              aria-label={t.termsClose}
            >
              <span />
              <span />
            </button>
          </header>

          <div className={`regulamin-scroll-wrap${atEnd ? " is-end" : ""}`}>
            <div className="regulamin-scroll" ref={scrollRef} onScroll={syncScrollEnd}>
              <div className="regulamin-doc">
                <p className="regulamin-lede">{terms.head.lede}</p>

                {sections.map((section) => (
                  <section className="regulamin-section" key={section.num}>
                    <h3 data-num={section.num}>{section.title}</h3>
                    <ol>
                      {section.items.map((item, index) =>
                        "html" in item ? (
                          <li key={index} dangerouslySetInnerHTML={{ __html: item.html }} />
                        ) : (
                          <li key={index}>{item.text}</li>
                        ),
                      )}
                    </ol>
                  </section>
                ))}

                <details className="regulamin-history">
                  <summary>
                    <span>{terms.history.label}</span>
                    <span className="regulamin-history-icon" aria-hidden="true" />
                  </summary>
                  <ul className="regulamin-history-list">
                    {terms.history.entries.map((entry) => (
                      <li key={entry.id}>
                        <strong>
                          {`${t.versionLabel} ${entry.version} · ${longDate(entry.date, lang)}`}
                        </strong>
                        {` — ${entry.note}`}
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            </div>
            <div className="regulamin-scroll-fade" aria-hidden="true" />
          </div>

          <footer className="regulamin-foot">
            <p className="regulamin-foot-note">
              {`${t.versionLabel} ${terms.version} · ${t.effectiveLabel} ${longDate(terms.effectiveFrom, lang)}`}
            </p>
            <button type="button" className="regulamin-accept" onClick={acceptRegulamin}>
              <span>{t.termsAccept}</span>
              <span className="regulamin-accept-arrow" aria-hidden="true">
                →
              </span>
            </button>
          </footer>
        </div>
      </div>
    </Typo>
  );
}
