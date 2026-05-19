/**
 * @file AetherInterlude.tsx
 * @description Three liturgical interludes between sections: I · Lumen quaerit,
 * II · Vox memoriae, III · Sustinete nos. Each renders an aether-knot SVG keyed to its
 * variant — ascending wisps, concentric echo rings, or a vesica piscis. The
 * `--knot-intensity` CSS prop is driven by the audio-reactive analyser hook.
 * @architecture Enterprise SaaS 2026
 * @module widgets/landing/AetherInterlude
 */

import type { ReactNode } from "react";

export type AetherVariant = "passage" | "memory" | "offering";

interface AetherInterludeProps {
  readonly variant: AetherVariant;
  readonly roman: string;
  readonly latin: string;
}

const KNOTS: Readonly<Record<AetherVariant, () => ReactNode>> = {
  passage: () => (
    <svg viewBox="0 0 180 60" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <defs>
        <filter id="ethereal-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <line x1="0" y1="30" x2="180" y2="30" strokeWidth="0.5" strokeOpacity="0.2" />
      <path className="knot-wave knot-wave-top" d="M 0,30 C 45,30 60,10 90,10 C 120,10 135,30 180,30" strokeWidth="0.75" strokeOpacity="0.5" />
      <path className="knot-wave knot-wave-bottom" d="M 0,30 C 45,30 60,50 90,50 C 120,50 135,30 180,30" strokeWidth="0.75" strokeOpacity="0.5" />
      <path className="knot-wave knot-harmonic-top" d="M 20,30 C 50,30 65,20 90,20 C 115,20 130,30 160,30" strokeWidth="0.5" strokeOpacity="0.3" />
      <path className="knot-wave knot-harmonic-bottom" d="M 20,30 C 50,30 65,40 90,40 C 115,40 130,30 160,30" strokeWidth="0.5" strokeOpacity="0.3" />
      <line className="ascend-wisp w1" x1="90" y1="50" x2="90" y2="34" strokeWidth="0.6" strokeOpacity="0.6" />
      <line className="ascend-wisp w2" x1="85" y1="50" x2="85" y2="40" strokeWidth="0.35" strokeOpacity="0.4" />
      <line className="ascend-wisp w3" x1="95" y1="50" x2="95" y2="40" strokeWidth="0.35" strokeOpacity="0.4" />
      <circle className="knot-light" cx="90" cy="30" r="2" fill="currentColor" stroke="none" filter="url(#ethereal-glow)" />
    </svg>
  ),
  memory: () => (
    <svg viewBox="0 0 200 60" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <line x1="0" y1="30" x2="200" y2="30" strokeWidth="0.5" strokeOpacity="0.2" />
      <path className="knot-wave knot-wave-top" d="M 10,30 C 55,30 70,10 100,10 C 130,10 145,30 190,30" strokeWidth="0.75" strokeOpacity="0.4" />
      <path className="knot-wave knot-wave-bottom" d="M 10,30 C 55,30 70,50 100,50 C 130,50 145,30 190,30" strokeWidth="0.75" strokeOpacity="0.4" />
      <circle className="echo-ring r1" cx="100" cy="30" r="6" fill="none" strokeWidth="0.5" />
      <circle className="echo-ring r2" cx="100" cy="30" r="11" fill="none" strokeWidth="0.45" />
      <circle className="echo-ring r3" cx="100" cy="30" r="17" fill="none" strokeWidth="0.4" />
      <circle className="knot-light" cx="100" cy="30" r="2" fill="currentColor" stroke="none" filter="url(#ethereal-glow)" />
    </svg>
  ),
  offering: () => (
    <svg viewBox="0 0 180 60" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <line x1="0" y1="30" x2="180" y2="30" strokeWidth="0.5" strokeOpacity="0.2" />
      <circle className="vesica-half v-left" cx="80" cy="30" r="14" fill="none" strokeWidth="0.6" />
      <circle className="vesica-half v-right" cx="100" cy="30" r="14" fill="none" strokeWidth="0.6" />
      <circle className="knot-light" cx="90" cy="30" r="2" fill="currentColor" stroke="none" filter="url(#ethereal-glow)" />
    </svg>
  ),
};

export function AetherInterlude({ variant, roman, latin }: AetherInterludeProps): React.JSX.Element {
  return (
    <div className="aether-interlude reveal" data-variant={variant} aria-hidden="true">
      <span className="aether-inscription">
        <span className="roman">{roman}</span>
        <span className="dot">·</span>
        <span className="latin">{latin}</span>
      </span>
      <div className="aether-row">
        <div className="aether-line" />
        <div className="aether-knot">{KNOTS[variant]()}</div>
        <div className="aether-line" />
      </div>
    </div>
  );
}
