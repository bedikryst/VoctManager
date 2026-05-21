/**
 * @file HeroSection.tsx
 * @description Opening threshold into the nave — a full-bleed "luminous fresco": the choir
 * image lifted to warm alabaster light, edges dissolving into the paper so image and page
 * read as one surface. The liturgy (kicker → "Z ciszy / głos." → director) lives in a lit
 * left zone; the headline enters voice-by-voice (intro-stage) like SATB entries; one raking
 * light breathes over the surface. No countdown, no donation CTA — the hero is pure ensemble
 * identity; the offering and the event live further down the nave (Path, FinalSupport).
 * @architecture Enterprise SaaS 2026
 * @module widgets/landing/HeroSection
 */

import { forwardRef } from "react";

import { CONCERT } from "@/features/landing/constants/concert";

export const HeroSection = forwardRef<HTMLElement>(function HeroSection(_props, ref) {
  return (
    <section className="hero" id="top" aria-label="VoctEnsemble — Z ciszy, głos" ref={ref}>
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

      <div className="hero-light" aria-hidden="true" />
      <div className="hero-veil" aria-hidden="true" />

      <div className="hero-inner">
        <p className="hero-kicker micro intro-stage s2">{CONCERT.cycle}</p>
        <h1 className="hero-title">
          <span className="hero-title-line hero-title-anteced intro-stage s3">Z ciszy</span>
          <span className="hero-title-line intro-stage s4">
            <em>głos.</em>
          </span>
        </h1>
        <p className="hero-strap intro-stage s5">
          pod kierownictwem artystycznym{" "}
          <span className="hero-strap-name">Florenta&nbsp;de&nbsp;Bazelaire</span>
        </p>
      </div>

      <a className="hero-descend intro-stage s6" href="#manifest" aria-label="Wejdź w głąb">
        <span className="hero-descend-label">Wejdź w głąb</span>
      </a>
    </section>
  );
});
