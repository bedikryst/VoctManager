/**
 * @file CodaSection.tsx
 * @description Per-letter variable-font wght cascade closing the page. The animation is
 * driven entirely by `animation-timeline: scroll()` from CSS — no JS needed. Browsers
 * without scroll-timeline degrade to the static `wght: 320` fallback.
 * @architecture Enterprise SaaS 2026
 * @module widgets/landing/CodaSection
 */

const LETTERS = ["C", "i", "s", "z", "a"] as const;

export function CodaSection(): React.JSX.Element {
  return (
    <section className="coda" aria-label="Muzyka brzmi dalej">
      <div className="coda-container">
        <p className="coda-headline" aria-label="Cisza">
          {LETTERS.map((letter, index) => (
            <span key={index} className="coda-letter" aria-hidden="true">
              {letter}
            </span>
          ))}
          <span className="coda-letter coda-letter--punct" aria-hidden="true">
            .
          </span>
        </p>
        <p className="coda-tail">brzmi dalej</p>
      </div>
    </section>
  );
}
