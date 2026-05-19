/**
 * @file ImageRiteSection.tsx
 * @description The "light" section — full-bleed dimmed photo behind a centered quote,
 * with a cursor-tracked spotlight (rite-glow) on desktop fine pointers.
 * @architecture Enterprise SaaS 2026
 * @module widgets/landing/ImageRiteSection
 */

import { forwardRef } from "react";

export const ImageRiteSection = forwardRef<HTMLElement>(function ImageRiteSection(_props, ref) {
  return (
    <section className="image-rite" id="rite" aria-label="Światło" ref={ref}>
      <img
        data-parallax="0.18"
        src="/photos/chor-spot-1920.webp"
        srcSet="/photos/chor-spot-800.webp 800w, /photos/chor-spot-1920.webp 1920w"
        sizes="100vw"
        alt=""
        loading="lazy"
        decoding="async"
      />
      <div className="rite-glow" aria-hidden="true" />
      <div className="rite-quote reveal">
        <svg className="mark" viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <circle cx="32" cy="32" r="3" stroke="currentColor" strokeWidth="1" />
          <path
            d="M32 5V23M32 41V59M5 32H23M41 32H59M13 13L25 25M39 39L51 51M51 13L39 25M25 39L13 51"
            stroke="currentColor"
            strokeWidth="1"
          />
        </svg>
        <h2>Światło prowadzi słuchacza.</h2>
        <p>
          Nie jako efekt sceniczny. Jako oddech, napięcie i moment, w którym przestrzeń
          zaczyna słuchać razem z nami.
        </p>
      </div>
    </section>
  );
});
