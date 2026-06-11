/**
 * @file Preloader.tsx
 * @description The single opening rite: dark preloader whose FINAL BEAT is the audio
 *  threshold ("Wejdź w ciszę / Wejdź z głosem"). One overlay, one decision — the old
 *  two-airlock sequence (preloader, then a separate ThresholdGate modal) doubled the
 *  time-to-content for first-time visitors.
 *
 *  Phase machine, decided per mount:
 *   - donation deep-link (`#wesprzyj`, `#przelew`, `?donate`, `?donated=…`) or `?nogate`
 *     → "removed" (intent-carrying URLs skip the whole rite);
 *   - valid saved audio choice (3h TTL, useAudioChoice)
 *     → rite plays once per session, NO question (the choice is remembered);
 *   - no valid choice
 *     → rite blooms into the choice ("choice" phase); if the rite was already seen this
 *       session (e.g. TTL expired mid-session), the choice appears immediately.
 *
 *  The chosen option is written here and broadcast as `voct:audio-choice`; the
 *  always-mounted AudioController starts the ambient inside the same click call stack
 *  (autoplay-policy compliant). Scroll lock: `preload-open` during the rite,
 *  `threshold-open` during the choice — GratitudeModal polls exactly these two classes.
 * @architecture Astro islands 2026
 * @module islands/landing/Preloader
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { BrandGlyph } from "./BrandGlyph";
import { useAudioChoice, type AudioChoice } from "./hooks/useAudioChoice";
import { useBodyClass } from "./hooks/useBodyClass";
import { useFocusTrap } from "./hooks/useFocusTrap";

// 2.2s keeps the candle bloom + ring expansion intact (animations are front-loaded
// under 2s) while keeping time-to-content tight. SAFETY_CEILING stays a beat above
// MIN so a slow `load` event still resolves through it.
const MIN_DURATION = 2200;
const SAFETY_CEILING = 3000;
const EXIT_DURATION = 700;
const SEEN_KEY = "voct.preloader.seen";

function preloaderAlreadySeen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markPreloaderSeen(): void {
  try {
    window.sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* private mode / disabled storage — non-fatal */
  }
}

/** Donation-intent and auditor URLs skip the rite AND the choice. */
function wantsRiteSkipFromUrl(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return (
    window.location.hash === "#wesprzyj" ||
    window.location.hash === "#przelew" ||
    params.has("donate") ||
    params.has("donated") ||
    params.has("nogate")
  );
}

type Phase = "shown" | "choice" | "hiding" | "removed";

export function Preloader(): React.JSX.Element | null {
  // Initial state is deterministic ("shown") so SSR and the first client render agree —
  // hydration mismatches would strand a dead SSR overlay. The session/choice decision
  // happens in the mount effect below; the CSS gated on `html.preloader-skip` (set by
  // PreloaderGate's inline head script) prevents any visible flash for returning visitors.
  const [phase, setPhase] = useState<Phase>("shown");
  const { read, write } = useAudioChoice();
  const choiceRef = useRef<HTMLDivElement>(null);

  useBodyClass(
    phase === "choice" ? "threshold-open" : phase !== "removed" ? "preload-open" : null,
  );

  useEffect(() => {
    if (phase !== "shown") return;

    if (wantsRiteSkipFromUrl()) {
      setPhase("removed");
      return;
    }

    // Same session: never replay the rite. If the saved choice expired mid-session,
    // ask immediately — the question without the ceremony.
    if (preloaderAlreadySeen()) {
      setPhase(read() === null ? "choice" : "removed");
      return;
    }

    const startedAt = performance.now();
    let timer: number | undefined;

    const beginResolve = () => {
      const remaining = Math.max(0, MIN_DURATION - (performance.now() - startedAt));
      timer = window.setTimeout(() => {
        markPreloaderSeen();
        // The rite's final beat: bloom into the question, or simply part.
        setPhase(read() === null ? "choice" : "hiding");
      }, remaining);
    };

    if (document.readyState === "complete") {
      beginResolve();
    } else {
      window.addEventListener("load", beginResolve, { once: true });
    }
    const safety = window.setTimeout(beginResolve, SAFETY_CEILING);

    return () => {
      if (timer) window.clearTimeout(timer);
      window.clearTimeout(safety);
      window.removeEventListener("load", beginResolve);
    };
  }, [phase, read]);

  const pick = useCallback(
    (choice: AudioChoice) => {
      write(choice);
      // AudioController (always mounted) starts the ambient synchronously inside this
      // same click call stack — the user gesture WebAudio needs.
      window.dispatchEvent(new CustomEvent("voct:audio-choice", { detail: { choice } }));
      setPhase("hiding");
    },
    [write],
  );

  const onEscape = useCallback(() => pick("silence"), [pick]);
  // Initial focus is NOT delegated to the trap (it would land on the first button with
  // a visible focus ring for mouse users too) — the container takes focus after the
  // 0.9s entrance, matching the old gate's behaviour.
  useFocusTrap(choiceRef, phase === "choice", { onEscape, focusInitial: false });

  useEffect(() => {
    if (phase !== "choice") return;
    const timer = window.setTimeout(() => {
      choiceRef.current?.focus({ preventScroll: true });
    }, 950);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "hiding") return;
    const timer = window.setTimeout(() => setPhase("removed"), EXIT_DURATION);
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (phase === "removed") return null;

  const isChoice = phase === "choice";

  return (
    <div
      className={`preloader${phase === "hiding" ? " is-hidden" : ""}${isChoice ? " is-choice" : ""}`}
      role={isChoice ? "dialog" : undefined}
      aria-modal={isChoice || undefined}
      aria-labelledby={isChoice ? "threshold-title" : undefined}
      aria-hidden={isChoice ? undefined : true}
    >
      <span className="preloader-spark" />
      <span className="preloader-ring r1" />
      <span className="preloader-ring r2" />
      <span className="preloader-ring r3" />
      <span className="preloader-word w1">cisza</span>
      <span className="preloader-word w2">głos</span>
      <svg className="preloader-mark" viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="32" r="3" stroke="currentColor" strokeWidth="1" />
        <path
          d="M32 6V22M32 42V58M6 32H22M42 32H58M14 14L25 25M39 39L50 50M50 14L39 25M25 39L14 50"
          stroke="currentColor"
          strokeWidth="1"
        />
      </svg>

      <div className="preloader-choice">
        <div className="threshold-inner" ref={choiceRef} tabIndex={-1}>
          <div className="threshold-mark" aria-hidden="true">
            <span className="threshold-mark-halo" />
            <BrandGlyph />
          </div>
          <div className="threshold-kicker micro">VoctEnsemble</div>
          {/* Intentionally NOT an <h1>: the page's h1 is the hero title. */}
          <p className="threshold-title" id="threshold-title">
            Czy wejdziesz<br />w ciszę?
          </p>
          <p className="threshold-subtitle">
            Wybierz, jak ma cię przyjąć ta strona. Możesz to zmienić w każdej chwili.
          </p>
          <div className="threshold-actions">
            <button
              type="button"
              className="threshold-btn plausible-event-name=enterSilence"
              data-choice="silence"
              onClick={() => pick("silence")}
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
              onClick={() => pick("voice")}
            >
              <span className="threshold-btn-dots" aria-hidden="true">
                <span className="threshold-dot is-live" />
                <span className="threshold-dot is-live" />
                <span className="threshold-dot is-live" />
              </span>
              <span className="threshold-btn-label">Wejdź z głosem</span>
              <span className="threshold-btn-hint">śpiew zespołu · cicho</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
