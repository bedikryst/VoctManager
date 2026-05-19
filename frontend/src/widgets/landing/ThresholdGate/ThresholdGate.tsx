/**
 * @file ThresholdGate.tsx
 * @description Opening choice modal: "enter in silence" vs "enter with voice". On voice
 * the ambient track begins on user gesture (autoplay-policy compliant), on silence the
 * page proceeds soundless. Choice is persisted with a 3h TTL — repeat visits skip
 * the gate. Deep-link bypass: any URL pointing at the donation flow (`#wesprzyj`,
 * `#przelew`, `?donate`) skips the gate so the conversion path is unobstructed.
 * @architecture Enterprise SaaS 2026
 * @module widgets/landing/ThresholdGate
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { useAudioChoice, type AudioChoice } from "@/features/landing/hooks/useAudioChoice";
import type { ChantAudio } from "@/features/landing/hooks/useChantAudio";
import { useBodyClass } from "@/features/landing/hooks/useBodyClass";
import { BrandGlyph } from "@/widgets/landing/BrandGlyph/BrandGlyph";

const EXIT_DURATION = 1200;

interface ThresholdGateProps {
  readonly audio: ChantAudio;
}

function wantsDonationFromUrl(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.location.hash === "#wesprzyj" ||
    window.location.hash === "#przelew" ||
    new URLSearchParams(window.location.search).has("donate")
  );
}

export function ThresholdGate({ audio }: ThresholdGateProps): React.JSX.Element | null {
  const { read, write } = useAudioChoice();
  const innerRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"open" | "hiding" | "removed">(() => {
    if (typeof window === "undefined") return "open";
    if (wantsDonationFromUrl()) return "removed";
    const saved = read();
    return saved === "silence" || saved === "voice" ? "removed" : "open";
  });

  useBodyClass(phase === "open" ? "threshold-open" : null);

  // On reload with saved="voice", rehydrate audio state and arm an auto-resume gesture listener.
  useEffect(() => {
    if (phase !== "removed") return;
    const saved = read();
    if (saved === "voice") {
      audio.armAutoResume();
    }
  }, [phase, audio, read]);

  const close = useCallback(
    (choice: AudioChoice) => {
      write(choice);
      if (choice === "voice") {
        void audio.start();
      }
      setPhase("hiding");
    },
    [audio, write],
  );

  useEffect(() => {
    if (phase !== "open") return;
    const focusTimer = window.setTimeout(() => {
      innerRef.current?.focus({ preventScroll: true });
    }, 2100);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close("silence");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKey);
    };
  }, [phase, close]);

  useEffect(() => {
    if (phase !== "hiding") return;
    const timer = window.setTimeout(() => setPhase("removed"), EXIT_DURATION);
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (phase === "removed") return null;

  return (
    <div
      className={`threshold${phase === "hiding" ? " is-hidden" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="threshold-title"
    >
      <div className="threshold-inner" ref={innerRef} tabIndex={-1}>
        <div className="threshold-mark" aria-hidden="true">
          <span className="threshold-mark-halo" />
          <BrandGlyph />
        </div>
        <div className="threshold-kicker micro">VoctEnsemble</div>
        <h1 className="threshold-title" id="threshold-title">
          Czy wejdziesz<br />w ciszę?
        </h1>
        <p className="threshold-subtitle">
          Wybierz, jak ma cię przyjąć ta strona. Możesz to zmienić w każdej chwili.
        </p>
        <div className="threshold-actions">
          <button
            type="button"
            className="threshold-btn plausible-event-name=enterSilence"
            data-choice="silence"
            onClick={() => close("silence")}
          >
            <span className="threshold-btn-dots" aria-hidden="true">
              <span className="threshold-dot" />
              <span className="threshold-dot" />
              <span className="threshold-dot" />
            </span>
            <span className="threshold-btn-label">Wejdź w ciszę</span>
            <span className="threshold-btn-hint">bez dźwięku</span>
          </button>
          <button
            type="button"
            className="threshold-btn plausible-event-name=enterVoice"
            data-choice="voice"
            onClick={() => close("voice")}
          >
            <span className="threshold-btn-dots" aria-hidden="true">
              <span className="threshold-dot is-live" />
              <span className="threshold-dot is-live" />
              <span className="threshold-dot is-live" />
            </span>
            <span className="threshold-btn-label">Wejdź z głosem</span>
            <span className="threshold-btn-hint">z ambientem · cicho</span>
          </button>
        </div>
      </div>
    </div>
  );
}
