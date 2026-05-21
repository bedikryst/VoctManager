/**
 * @file ManifestSection.tsx
 * @description Three-stanza ensemble manifest with Roman-numeral indices and a candle
 * underline that fills on hover. The closing line uses an emphasized colour break to
 * separate "Sacrum nie zdobi." from "Odsłania.".
 * @architecture Enterprise SaaS 2026
 * @module widgets/landing/ManifestSection
 */

import { MANIFEST_LINES } from "@/features/landing/constants/manifestLines";

export function ManifestSection(): React.JSX.Element {
  return (
    <section className="section manifest" id="manifest" aria-label="Manifest chóru VoctEnsemble">
      <div className="section-grid manifest-grid">
        <div className="section-label micro">
          <span>ESSENCE</span>
        </div>
        <div className="manifest-lines">
          {MANIFEST_LINES.map((line) => (
            <p
              key={line.index}
              className={`manifest-line reveal${line.closing ? " manifest-line--closing" : ""}`}
            >
              <span className="manifest-index">{line.index}</span>
              <span className="manifest-text">
                {line.text}
                {line.emphasis ? (
                  <>
                    {" "}
                    <span className="reveal-italic">{line.emphasis}</span>
                  </>
                ) : null}
              </span>
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
