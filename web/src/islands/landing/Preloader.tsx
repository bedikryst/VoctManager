/**
 * @file Preloader.tsx
 * @description The single opening rite: a dark threshold whose FINAL BEAT is the audio
 *  choice. One overlay, one decision.
 *
 *  ITS WORDS ARRIVE AS PROPS, in two kinds. The hold's two display words, the kicker, the title
 *  and the subtitle are PROSE and come from the copy desk; the two BUTTONS are chrome, complete in
 *  every locale by type, because `polityka-prywatnosci` quotes them by name — two documents on one
 *  site may not call one button two things. A prop rather than a hook because this island is
 *  server-rendered: a locale read from the document is Polish during SSR, and React answers the
 *  mismatch by discarding the server DOM.
 *
 *  WHAT THIS SCREEN ACTUALLY ASKS is whether to play the ensemble quietly in the
 *  background, and every word on it has to earn its size against that. The rite used to
 *  spend its two display words and its 86px title on "cisza" and "głos" while the only
 *  line saying what the sound IS sat in an 11px hint under a button — so the largest type
 *  carried metaphysics and the smallest carried the function, and a first-time reader was
 *  asked a rhetorical question by someone who had not yet said who they were. The hold now
 *  names the ensemble, the kicker gives it a category and a city, and the title states the
 *  fact the two buttons answer. "Cisza" survives where it is functional — the button, and
 *  the nav's own state pill, which is unreadable as anything but decoration unless this
 *  screen teaches that the word means "no sound".
 *
 *  Dramaturgy in two parts, because a curtain covers a wait of UNKNOWN length and a
 *  fixed-length film cannot do that:
 *   - the HOLD is a loop — the candle-spark breathes at the centre, rings radiate like
 *     sound in a dark nave, and two display words surface and sink on the diagonal. Those
 *     two positions are the best type on the site and they carry the ensemble itself, so
 *     the answer to "who is this" arrives half a second in rather than after the cadence.
 *     It lasts as long as the page needs and never looks stuck, pre-hydration included
 *     (pure CSS).
 *   - the CADENCE is "scriptura + illuminatio", the site's two motion idioms in their
 *     manuscript order: the pen WRITES the one true line of the mark — the long stem
 *     descending into the note, its punctum — then light RISES from that note and OPENS
 *     the V in its real, modulated letterform. The V is never drawn as a wireframe.
 *   - the HINGE into the question is the mark ITSELF: the lit mark shrinks and travels to
 *     the slot above the question rather than dying so a smaller copy can be born there.
 *     One measured FLIP (`armMarkTransit`) — the slot's position follows the question's
 *     content height, so no static CSS can know it — animated by the BOX, not by a
 *     transform, so the shrinking mark is rasterised honestly at every size it passes.
 *
 *  Phase machine, decided per mount:
 *   - donation deep-link (`#wesprzyj`, `#przelew`, `?donate`, `?donated=…`) or `?nogate`
 *     → "removed" (intent-carrying URLs skip the whole rite);
 *   - reduced motion → no rite at all: the question (or the page) is owed immediately,
 *     because the ceremony IS the motion;
 *   - valid saved audio choice (3h TTL, useAudioChoice) → the BRIEF rite: cadence only,
 *     fixed length, never waiting for `load` — holding a curtain to mask loading when
 *     there is no question to ask is a performance, not a threshold. DocumentGates arms
 *     `html.rite-brief` before paint, so the pen starts writing on the first frame,
 *     before this island hydrates; here we only schedule the resolution off the already
 *     running animation;
 *   - no valid choice → the FULL rite: hold (min one breath, elastic until `load`,
 *     capped) → cadence → the question, with the rings still breathing behind it;
 *   - rite already seen this session (e.g. TTL expired mid-session) → the question
 *     immediately, without the ceremony.
 *
 *  The chosen option is written here and broadcast as `voct:audio-choice`; the
 *  always-mounted AudioController starts the ambient inside the same click call stack
 *  (autoplay-policy compliant). Scroll lock: `preload-open` during the rite,
 *  `threshold-open` during the choice — GratitudeModal polls exactly these two classes.
 * @architecture Astro islands 2026
 * @module islands/landing/Preloader
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { Locale } from "../../i18n/config";
import type { LandingChrome, LandingCopy } from "../../i18n/content/landing";
import { BrandGlyph } from "./BrandGlyph";
import { useAudioChoice, type AudioChoice } from "./hooks/useAudioChoice";
import { useBodyClass } from "./hooks/useBodyClass";
import { useFocusTrap } from "./hooks/useFocusTrap";
import { Typo } from "./lib/Typo";

// MIN_HOLD lets the spark finish igniting before the pen takes over; SAFETY_CEILING caps
// waiting for `load` — past it the cadence begins regardless, because the threshold
// question is a better place to wait than a curtain: there the visitor has something to
// do. CADENCE_MS mirrors the CSS timeline (illumination ends ~2900ms on the brief path's
// lead-in) and is only the fallback — the primary resolution is the `riteIllum`
// animation's own `finished`. REST_BEAT lets the completed mark land before it parts.
const MIN_HOLD = 1600;
const SAFETY_CEILING = 3000;
const CADENCE_MS = 2950;
const REST_BEAT = 420;
const HERO_GRACE = 900;
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

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Resolves when the hero photo can paint, or when `capMs` runs out. A curtain that lifts
 * onto an unpainted hero shows the media's dark ground for a beat and then snaps the
 * photo in — the one motion this site never makes. Capped, because the photo is not worth
 * an open-ended wait: past the cap it lands late and fades in (BleedImage).
 */
async function heroSettled(capMs: number): Promise<void> {
  const img = document.querySelector<HTMLImageElement>("picture.bleed img");
  if (!img) return;
  // decode() waits for the fetch AND the decode, so it resolves on the frame the photo
  // could actually be drawn — `complete` alone can still precede a slow AVIF decode.
  const painted = img.decode().catch(() => undefined);
  const cap = new Promise<void>((resolve) => window.setTimeout(resolve, capMs));
  await Promise.race([painted, cap]);
}

/**
 * Writes the FLIP that carries the lit mark out of the rite's centre and into the
 * question's own mark slot: both rects as `--transit-from-*` / `--transit-to-*` on the
 * overlay, and the pin that takes the rite out of the grid at exactly where it stands.
 * The CSS owns the motion — and animates the BOX rather than a transform, for the
 * rasterisation reason recorded on `.preloader.is-transit .rite`.
 *
 * The slot has to be MEASURED: it sits at the head of the question's content block, so
 * its position follows that block's height — which changes with the viewport, the copy's
 * wrapping and the ≤640 responsive variant. And it has to be measured AT REST: the
 * `is-measuring` frame strips the choice layer's 14px entrance offset and the slot's
 * breathing scale, both of which would otherwise be baked into the rect. That class is
 * added and removed inside this one synchronous turn, so it never paints.
 *
 * Returns false when the geometry is unreadable; the caller then leaves the overlay on
 * the plain cross-fade rather than sending the mark somewhere wrong.
 */
function armMarkTransit(overlay: HTMLElement | null): boolean {
  if (!overlay || prefersReducedMotion()) return false;

  const rite = overlay.querySelector<HTMLElement>(".rite");
  const slot = overlay.querySelector<HTMLElement>(".threshold-mark .brand-glyph-shape");
  if (!rite || !slot) return false;

  overlay.classList.add("is-measuring");
  const from = rite.getBoundingClientRect();
  const to = slot.getBoundingClientRect();
  overlay.classList.remove("is-measuring");

  if (from.height < 1 || to.height < 1) return false;

  // Both boxes are height-limited `contain` masks, so their HEIGHT is the drawn mark's
  // height and their centre is its centre — but the slot's box is a touch wider than the
  // mark it draws, so the destination width is derived from the rite's aspect rather than
  // measured, and the two are matched on their centres.
  const height = to.height;
  const width = from.width * (height / from.height);
  const left = to.left + to.width / 2 - width / 2;
  const top = to.top + to.height / 2 - height / 2;
  if (![height, width, left, top].every((n) => Number.isFinite(n))) return false;

  const px = (n: number): string => `${n.toFixed(2)}px`;
  overlay.style.setProperty("--transit-from-x", px(from.left));
  overlay.style.setProperty("--transit-from-y", px(from.top));
  overlay.style.setProperty("--transit-from-w", px(from.width));
  overlay.style.setProperty("--transit-from-h", px(from.height));
  overlay.style.setProperty("--transit-to-x", px(left));
  overlay.style.setProperty("--transit-to-y", px(top));
  overlay.style.setProperty("--transit-to-w", px(width));
  overlay.style.setProperty("--transit-to-h", px(height));

  // The pin has to become the BEFORE-CHANGE style in its own style recalc, or the browser
  // never sees the traveller at its origin and there is nothing to transition from. It is
  // the rite's current rect to the pixel, so the frame it may cost is identical. React
  // re-asserts the class on the commit that follows (see the render's class list).
  overlay.classList.add("is-pinned");
  void rite.offsetWidth;
  return true;
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

type Phase = "hold" | "cadence" | "choice" | "hiding" | "removed";

interface PreloaderProps {
  /** The rite's own prose, from the copy desk. */
  readonly copy: LandingCopy["rite"];
  /**
   * The two buttons and their hints. THEY ARE CHROME, and the privacy policy is why: § 3 and § 10
   * quote them by name in all three languages, so a locale falling back to Polish here would
   * leave a legal document citing a control that does not exist on the page it describes.
   */
  readonly chrome: LandingChrome;
  /** The page's language — the typographic pass this rite's words are set with, and a prop for
   *  the same reason the words are: the overlay is server-rendered. */
  readonly lang: Locale;
}

export function Preloader({ copy, chrome, lang }: PreloaderProps): React.JSX.Element | null {
  // Initial state is deterministic ("hold") so SSR and the first client render agree —
  // hydration mismatches would strand a dead SSR overlay. The session/choice decision
  // happens in the mount effect below; CSS gated on `html.preloader-skip` /
  // `html.rite-brief` (decided before paint by DocumentGates) makes the pre-hydration
  // frames already correct for every path.
  const [phase, setPhase] = useState<Phase>("hold");
  const { read, write } = useAudioChoice();
  const overlayRef = useRef<HTMLDivElement>(null);
  const choiceRef = useRef<HTMLDivElement>(null);
  const riteRef = useRef<HTMLDivElement>(null);
  // The trail refs keep `.is-cadence` / `.is-choice` on the overlay through later
  // phases: cadence fill-states must survive into the choice and the dissolve, or the
  // lit mark would snap back to darkness the moment the phase moves on.
  const wentCadence = useRef(false);
  const wentChoice = useRef(false);
  const wentTransit = useRef(false);

  useBodyClass(
    phase === "choice" ? "threshold-open" : phase !== "removed" ? "preload-open" : null,
  );

  useEffect(() => {
    if (phase !== "hold") return;

    if (wantsRiteSkipFromUrl()) {
      setPhase("removed");
      return;
    }

    // Same session: never replay the rite. Reduced motion: never play it at all. Either
    // way the saved choice decides whether the question is still owed. (DocumentGates
    // arms `preloader-skip` for both cases before paint, so nothing flashes.)
    if (prefersReducedMotion() || preloaderAlreadySeen()) {
      markPreloaderSeen();
      if (read() === null) {
        wentChoice.current = true;
        setPhase("choice");
      } else {
        setPhase("removed");
      }
      return;
    }

    // The brief rite: the choice is remembered, so the cadence is the whole ceremony —
    // fixed length, already running since first paint via `html.rite-brief`. No waiting
    // for `load`: the page may keep painting under the dissolve.
    if (read() !== null) {
      markPreloaderSeen();
      wentCadence.current = true;
      setPhase("cadence");
      return;
    }

    // The full rite: the hold loop breathes until the page is ready AND the spark has
    // finished igniting, then the pen takes over.
    const startedAt = performance.now();
    let timer: number | undefined;

    const beginCadence = () => {
      const remaining = Math.max(0, MIN_HOLD - (performance.now() - startedAt));
      timer = window.setTimeout(() => {
        markPreloaderSeen();
        wentCadence.current = true;
        setPhase("cadence");
      }, remaining);
    };

    if (document.readyState === "complete") {
      beginCadence();
    } else {
      window.addEventListener("load", beginCadence, { once: true });
    }
    const safety = window.setTimeout(beginCadence, SAFETY_CEILING);

    return () => {
      if (timer) window.clearTimeout(timer);
      window.clearTimeout(safety);
      window.removeEventListener("load", beginCadence);
    };
  }, [phase, read]);

  useEffect(() => {
    if (phase !== "cadence") return;

    let settled = false;
    let cancelled = false;
    let beat: number | undefined;

    const finish = () => {
      if (settled) return;
      settled = true;
      // The cadence's resolution: into the question, or simply part. Measure BEFORE the
      // phase flips — the transform and the class that starts it must land in one commit,
      // or the mark would sit at its destination for a frame and then be told to travel.
      if (read() === null) {
        wentTransit.current = armMarkTransit(overlayRef.current);
        wentChoice.current = true;
        setPhase("choice");
        return;
      }
      // The brief rite parts onto the page itself, so unlike the question — which is a
      // room of its own to wait in — it must not part onto a hero that has no pixels yet.
      void heroSettled(HERO_GRACE).then(() => {
        if (!cancelled) setPhase("hiding");
      });
    };

    // On the brief path the animation started at paint, not at this mount — hydration
    // time must not stretch the rite. Schedule off the running illumination itself; the
    // fixed timer is only the belt for a cancelled animation.
    const illum = riteRef.current
      ?.getAnimations({ subtree: true })
      .find(
        (anim): anim is CSSAnimation =>
          anim instanceof CSSAnimation && anim.animationName === "riteIllum",
      );
    if (illum) {
      void illum.finished
        .then(() => {
          if (!settled) beat = window.setTimeout(finish, REST_BEAT);
        })
        .catch(() => {
          /* animation cancelled (overlay left the DOM) — the fallback timer owns it */
        });
    }
    const fallback = window.setTimeout(finish, CADENCE_MS + 500);

    return () => {
      settled = true;
      cancelled = true;
      window.clearTimeout(fallback);
      if (beat) window.clearTimeout(beat);
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
  const classes = ["preloader"];
  if (wentCadence.current) classes.push("is-cadence");
  if (isChoice || (phase === "hiding" && wentChoice.current)) classes.push("is-choice");
  if (wentTransit.current) classes.push("is-pinned", "is-transit");
  if (phase === "hiding") classes.push("is-hidden");

  return (
    <Typo locale={lang}>
      <div
        ref={overlayRef}
        className={classes.join(" ")}
        role={isChoice ? "dialog" : undefined}
        aria-modal={isChoice || undefined}
        aria-labelledby={isChoice ? "threshold-title" : undefined}
        aria-hidden={isChoice ? undefined : true}
      >
        <div className="preloader-rings" aria-hidden="true">
          <span className="preloader-ring r1" />
          <span className="preloader-ring r2" />
          <span className="preloader-ring r3" />
        </div>

        <div className="preloader-hold" aria-hidden="true">
          <span className="preloader-spark" />
          <span className="preloader-word w1">{copy.word1}</span>
          <span className="preloader-word w2">{copy.word2}</span>
        </div>

        <div className="rite" ref={riteRef} aria-hidden="true">
          {/* The scriptura beat draws ONLY the parts of the mark that truly are lines —
              the stem (a 13-unit rect in /voct-mark.svg) and the note ellipse, at their
              exact coordinates (same viewBox, so the layers register). The V is never
              drawn as a centerline: a uniform-stroke wireframe of a serif letterform is
              a different object (it read as a downward arrow), so the V only ever
              appears in its true modulated form, opened by the rising light. */}
          <svg className="rite-skel" viewBox="0 0 1000 2469.8" fill="none">
            <path className="rs rs-stem" d="M 500,4 L 500,2221.7" pathLength={1} />
            <ellipse
              className="rs-note"
              cx="500"
              cy="2427.3"
              rx="60.8"
              ry="38.5"
              transform="rotate(-22.7 500 2427.3)"
            />
          </svg>
          <span className="rite-fill" />
          {/* The raster master, dark until the mark starts down. The vector is the only
              legible master at the rite's size and the raster is the only legible one at
              the question's, so the traveller exchanges them in flight, around 110px
              where both are true — arriving as the same PNG the question's own mark is.
              Handing over at the destination instead is what made the hairlines blink
              out on the way down and snap back on arrival. */}
          <span className="rite-raster" />
        </div>

        <div className="preloader-choice">
          <div className="threshold-inner" ref={choiceRef} tabIndex={-1}>
            <div className="threshold-mark" aria-hidden="true">
              <span className="threshold-mark-halo" />
              <BrandGlyph />
            </div>
            {/* The category and the city, not the name alone. This is the first calmly
                readable line of the whole site and the only place before the hero where a
                reader can learn what they have walked into; a bare wordmark at 11px and
                half opacity names something without saying what it is. */}
            <div className="threshold-kicker micro">{copy.kicker}</div>
            {/* Intentionally NOT an <h1>: the page's h1 is the hero title. DECLARATIVE, and
                that is the whole point of it — this gate asks for consent to play audio, so
                the largest type on the screen has to state the fact the two buttons answer.
                Put as a question it read as a rhetorical opening from a stranger, and left
                the functional content ("cicho, głosem zespołu") to a hint under a button. */}
            <p className="threshold-title" id="threshold-title">
              {copy.title1}
              <br />
              {copy.title2}
            </p>
            <p className="threshold-subtitle">{copy.subtitle}</p>
            <div className="threshold-actions">
              <button
                type="button"
                className="threshold-btn plausible-event-name=enterSilence"
                data-choice="silence"
                aria-label={chrome.enterSilenceAria}
                onClick={() => pick("silence")}
              >
                <span className="threshold-btn-dots" aria-hidden="true">
                  <span className="threshold-dot" />
                  <span className="threshold-dot" />
                  <span className="threshold-dot" />
                </span>
                <span className="threshold-btn-label">{chrome.enterSilence}</span>
                <span className="threshold-btn-hint">{chrome.enterSilenceHint}</span>
              </button>
              <button
                type="button"
                className="threshold-btn plausible-event-name=enterVoice"
                data-choice="voice"
                aria-label={chrome.enterVoiceAria}
                onClick={() => pick("voice")}
              >
                <span className="threshold-btn-dots" aria-hidden="true">
                  <span className="threshold-dot is-live" />
                  <span className="threshold-dot is-live" />
                  <span className="threshold-dot is-live" />
                </span>
                <span className="threshold-btn-label">{chrome.enterVoice}</span>
                <span className="threshold-btn-hint">{chrome.enterVoiceHint}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Typo>
  );
}
