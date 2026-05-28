/**
 * @file ThresholdGate.tsx
 * @description Opening choice modal: "enter in silence" vs "enter with voice". On voice the
 *  ambient track begins on the user gesture (autoplay-policy compliant); on silence the page
 *  proceeds soundless. Choice persists with a 3h TTL — repeat visits skip the gate. Deep-link
 *  bypass: any URL pointing at the donation flow (`#wesprzyj`, `#przelew`, `?donate`) skips the
 *  gate, and `?nogate` skips it for synthetic auditors. Receives the shared ChantAudio from the
 *  always-mounted AudioController (this modal removes itself, so it must NOT own the audio graph).
 * @architecture Astro islands 2026
 * @module islands/landing/ThresholdGate
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { BrandGlyph } from "./BrandGlyph";
import { useAudioChoice, type AudioChoice } from "./hooks/useAudioChoice";
import { useBodyClass } from "./hooks/useBodyClass";
import type { ChantAudio } from "./hooks/useChantAudio";

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

function wantsGateSkipFromUrl(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("nogate");
}

export function ThresholdGate({ audio }: ThresholdGateProps): React.JSX.Element | null {
  const { read, write } = useAudioChoice();
  const innerRef = useRef<HTMLDivElement>(null);
  // Start "pending" (renders null) so SSR and the first client render agree — the gate decision
  // depends on localStorage/URL, both client-only, so computing it in the initializer caused a
  // hydration mismatch that stranded a dead SSR gate with no live handlers (the "asks again +
  // buttons don't work" bug). We decide once on mount instead; returning visitors see no flash
  // because "pending" renders nothing.
  const [phase, setPhase] = useState<"pending" | "open" | "hiding" | "removed">("pending");

  useBodyClass(phase === "open" ? "threshold-open" : null);

  // Client-only gate decision, run once on mount (also fires on remount when returning to "/").
  useEffect(() => {
    if (wantsDonationFromUrl() || wantsGateSkipFromUrl()) {
      setPhase("removed");
      return;
    }
    const saved = read();
    if (saved === "voice") {
      // Returning "voice" visitor: skip the gate and arm auto-resume on the next gesture.
      audio.armAutoResume();
      setPhase("removed");
      return;
    }
    if (saved === "silence") {
      setPhase("removed");
      return;
    }
    setPhase("open");
    // Intentionally run once: the gate is shown/skipped a single time per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  if (phase === "pending" || phase === "removed") return null;

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
