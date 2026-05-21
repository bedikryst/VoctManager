/**
 * @file StickyHeader.tsx
 * @description Glass chrome header: brand glyph, live countdown pill, audio toggle,
 * vault opener. Adapts its tint (paper vs dark) by probing the section directly
 * below it through useChromeTone, and switches into glass mode once the hero is
 * scrolled past.
 * @architecture Enterprise SaaS 2026
 * @module widgets/landing/StickyHeader
 */

import { forwardRef } from "react";

import { CONCERT } from "@/features/landing/constants/concert";
import type { ChantAudio } from "@/features/landing/hooks/useChantAudio";
import { useCountdown } from "@/features/landing/hooks/useCountdown";
import { useAudioChoice } from "@/features/landing/hooks/useAudioChoice";
import { formatCountdownPL } from "@/features/landing/lib/countdown";
import { useVault } from "@/features/landing/providers/VaultContext";
import { BrandGlyph } from "@/widgets/landing/BrandGlyph/BrandGlyph";

interface StickyHeaderProps {
  readonly audio: ChantAudio;
}

function pillLabel(days: number): string {
  if (days > 1 || days === 1 || days === 0) {
    return `${formatCountdownPL(days)} · ${CONCERT.venueShort}`;
  }
  return `17 maja 2026 · ${CONCERT.venueShort}`;
}

export const StickyHeader = forwardRef<HTMLElement, StickyHeaderProps>(function StickyHeader(
  { audio },
  ref,
) {
  const days = useCountdown(CONCERT.date);
  const { open } = useVault();
  const { write } = useAudioChoice();

  const toggleAudio = () => {
    write(audio.isOn ? "silence" : "voice");
    void audio.toggle();
  };

  return (
    <header className="chrome" aria-label="Nawigacja" ref={ref}>
      <a className="brand" href="#top" aria-label="VoctEnsemble">
        <span className="brand-glyph-wrap" aria-hidden="true">
          <span className="brand-glyph-halo" />
          <BrandGlyph className="brand-glyph" />
        </span>
        <span>VoctEnsemble</span>
      </a>
      <div className="event-pill">{pillLabel(days)}</div>
      <div className="chrome-actions">
        <button
          type="button"
          className={`audio-toggle plausible-event-name=przycisk+cisza${audio.isOn ? " is-on" : ""}`}
          aria-pressed={audio.isOn}
          onClick={toggleAudio}
        >
          {audio.isOn ? "Głos" : "Cisza"}
        </button>
        <a
          className="support-link plausible-event-name=skarbiec+menu"
          href="#wesprzyj"
          data-no-lenis
          onClick={(event) => {
            event.preventDefault();
            open(100);
          }}
        >
          Wesprzyj
        </a>
      </div>
    </header>
  );
});
