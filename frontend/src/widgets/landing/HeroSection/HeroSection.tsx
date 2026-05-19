/**
 * @file HeroSection.tsx
 * @description Opening hero with full-bleed choir photo, kicker, two-line headline,
 * direction strap (Florent), occasion block with countdown-aware label, and a CTA row
 * that opens the donation vault with a 100 PLN preset.
 * @architecture Enterprise SaaS 2026
 * @module widgets/landing/HeroSection
 */

import { forwardRef } from "react";

import { CONCERT } from "@/features/landing/constants/concert";
import { useCountdown } from "@/features/landing/hooks/useCountdown";
import { formatCountdownPL } from "@/features/landing/lib/countdown";
import { useVault } from "@/features/landing/providers/VaultContext";

function heroOccasionLabel(days: number): string {
  if (days > 1 || days === 1 || days === 0) {
    return `${formatCountdownPL(days)} · ${CONCERT.venueLong}`;
  }
  return `16 maja 2026 · ${CONCERT.venueLong}`;
}

export const HeroSection = forwardRef<HTMLElement>(function HeroSection(_props, ref) {
  const days = useCountdown(CONCERT.date);
  const { open } = useVault();

  return (
    <section className="hero" id="top" aria-label="VoctEnsemble" ref={ref}>
      <div className="hero-media" aria-hidden="true">
        <picture>
          <source media="(max-width: 880px)" srcSet="/photos/chor-poklon-800.webp" />
          <img
            src="/photos/chor-poklon-1920.webp"
            alt=""
            loading="eager"
            // @ts-expect-error — React 19 supports fetchPriority; @types/react may lag.
            fetchpriority="high"
            decoding="async"
          />
        </picture>
      </div>

      <div className="hero-inner">
        <div className="hero-grid">
          <div>
            <div className="hero-kicker micro intro-stage">Concerts Spirituels · MMXXVI</div>
            <h1 className="hero-title">
              <span className="intro-stage s2">Z ciszy</span>
              <span className="intro-stage s3">
                <em>głos.</em>
              </span>
            </h1>
            <p className="hero-strap intro-stage s4">
              Cykl liturgii i koncertów duchowych — kierownictwo artystyczne:{" "}
              <span className="hero-strap-name">Florent&nbsp;de&nbsp;Bazelaire</span>.
            </p>
          </div>

          <div className="hero-side">
            <div className="hero-occasion intro-stage s5">
              <div className="micro">Najbliższe wydarzenia</div>
              <strong>{CONCERT.occasion}</strong>
              <span className="hero-occasion-meta">{heroOccasionLabel(days)}</span>
            </div>
            <p className="hero-copy intro-stage s6">
              Nie szukamy publiczności. Szukamy wspólnoty słuchania. Wesprzyj naszą misję,
              by muzyka miała gdzie wybrzmieć.
            </p>
            <div className="hero-actions intro-stage s7">
              <a
                className="primary-link plausible-event-name=skarbiec+hero"
                href="#wesprzyj"
                data-no-lenis
                onClick={(event) => {
                  event.preventDefault();
                  open(100);
                }}
              >
                Wesprzyj cykl
              </a>
              <a className="secondary-link plausible-event-name=poznaj+zespol" href="#zespol">
                Poznaj zespół
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
