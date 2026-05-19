/**
 * @file EnsembleSection.tsx
 * @description "Jedność artystyczna" — ensemble portrait section over a dark parallax
 * choir image with three fact tiles (voices, debut year, geography).
 * @architecture Enterprise SaaS 2026
 * @module widgets/landing/EnsembleSection
 */

interface Fact {
  readonly num: string;
  readonly label: string;
}

const FACTS: readonly Fact[] = [
  { num: "12+", label: "głosów na scenie" },
  { num: "2024", label: "debiut · Kontemplacja Wcielenia" },
  { num: "PL · UE", label: "Koncerty Duchowe, liturgie, projekty autorskie" },
];

export function EnsembleSection(): React.JSX.Element {
  return (
    <section className="ensemble" id="zespol" aria-label="Zespół">
      <div className="ensemble-media" aria-hidden="true">
        <img
          data-parallax="0.14"
          src="/photos/chor-nawa-1920.webp"
          srcSet="/photos/chor-nawa-800.webp 800w, /photos/chor-nawa-1920.webp 1920w"
          sizes="100vw"
          alt=""
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="ensemble-inner section">
        <div className="ensemble-copy reveal">
          <div className="micro">Wspólnota głosów</div>
          <h2>Jedność artystyczna</h2>
          <p>
            VoctEnsemble to profesjonalny zespół wokalny, który poprzez muzyczną
            precyzję i uważnie budowane doświadczenie zaprasza publiczność do
            autentycznego spotkania. Tworzymy koncerty, w których muzyka, światło
            i cisza współtworzą jedno doświadczenie.
          </p>
          <div className="ensemble-facts">
            {FACTS.map((fact) => (
              <div key={fact.num} className="fact">
                <span className="fact-num">{fact.num}</span>
                <span className="fact-label">{fact.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
