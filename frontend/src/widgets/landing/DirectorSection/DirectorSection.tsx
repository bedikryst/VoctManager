/**
 * @file DirectorSection.tsx
 * @description Florent de Bazelaire — artistic direction. Side-by-side portrait + bio,
 * with subtle breathe glow on the portrait when audio is on.
 * @architecture Enterprise SaaS 2026
 * @module widgets/landing/DirectorSection
 */

export function DirectorSection(): React.JSX.Element {
  return (
    <section className="section" aria-label="Kierownictwo artystyczne">
      <div className="director-grid">
        <div className="portrait reveal reveal-img">
          <img
            src="/photos/florent-1920.webp"
            srcSet="/photos/florent-800.webp 800w, /photos/florent-1920.webp 1920w"
            sizes="(max-width: 980px) 100vw, 46vw"
            alt="Florent de Bazelaire prowadzący VoctEnsemble"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="director-copy reveal">
          <div className="role micro">Kierownictwo artystyczne</div>
          <h2>
            Florent<br />de Bazelaire
          </h2>
          <p>
            Pod jego kierownictwem VoctEnsemble przywraca tradycję dawnych Concerts
            Spirituels: muzykę sakralną traktowaną nie jako repertuar, lecz jako język
            człowieczeństwa.
          </p>
          <p>
            Od debiutu — <em>Kontemplacji Wcielenia</em> (2024) — przez modlitwy w intencji
            pokoju po międzynarodowe projekty interdyscyplinarne, wprowadza na polską
            scenę nową jakość estetyczną i duchową: koncert jako próg, nie performance.
          </p>
          <p>
            Równolegle rozwija VoctFoundation — fundację tworzącą stabilne zaplecze dla
            projektów artystycznych i społecznych realizowanych w interesie publicznym.
          </p>
        </div>
      </div>
    </section>
  );
}
