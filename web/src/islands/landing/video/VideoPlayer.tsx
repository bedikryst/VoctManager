/**
 * @file VideoPlayer.tsx
 * @description Shared minimal video player for the site's video surfaces (VoxMoment
 *  in-flow, VideoLightbox overlay, /press hero + archive). Custom chrome in the site's
 *  register — poster veil + circle play affordance, hairline scrub (pointer drag + full
 *  slider keyboard), mono time label, custom-chrome fullscreen — never native controls.
 *  Owns the ambient-bed contract: dispatches `voct:audio-duck` before play and
 *  `voct:audio-restore` on pause/end/unmount (AudioController fades the choir loop;
 *  pages without it simply don't listen). Broadcasts `voct:video-play` so only one video
 *  sounds at a time, and pauses itself when scrolled out of view. Playback position is
 *  shared only between players using the exact same media `src`.
 *  Publishes duration on the scrub (`data-cursor="seek"` + `data-duration`) so the site
 *  cursor can become the seek tooltip. Global ←/→ seek ±5 s on the most recently started
 *  player without needing the scrub focused (the focused slider keeps its full keymap).
 *  Registers OS Media Session metadata on play.
 *  `tone="dark"` flips the chrome for night surfaces; `idleHide` fades the chrome after
 *  stillness (projection room — also automatic in fullscreen); `glow` bleeds a blurred
 *  mirror of the frame behind the stage; `portrait` switches to a height-driven 9:16
 *  frame for phone-shot audience documents — their caption + `note` (honest provenance
 *  line) render as a museum plaque BESIDE the frame on wide viewports (stacked below on
 *  narrow ones), while the utility row (time + fullscreen) stays under the scrub. A
 *  missing/broken file degrades to the poster + a quiet mono note. Self-hosted media only.
 * @architecture Astro islands 2026
 * @module islands/landing/video/VideoPlayer
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { formatTime } from "./formatTime";
import { clearPosition, readPosition, savePosition } from "./resumeStore";

interface VideoPlayerProps {
  readonly src: string;
  readonly poster?: string;
  readonly caption?: string;
  /** Provenance line under the caption (piece credit · recording origin) — serif italic. */
  readonly note?: string;
  /** Lightbox: try to start immediately (rides the opening click's transient activation). */
  readonly autoPlay?: boolean;
  /** Chrome palette — "light" sits on parchment (default), "dark" on night surfaces. */
  readonly tone?: "light" | "dark";
  /** Projection-room mode: chrome recedes after stillness while playing. */
  readonly idleHide?: boolean;
  /** Ambient glow: a blurred low-res mirror of the frame bleeds behind the stage. */
  readonly glow?: boolean;
  /** 9:16 audience document — height-driven portrait frame instead of the 16:9 stage. */
  readonly portrait?: boolean;
  /** Keep playback position in sessionStorage for other players using the same media src. */
  readonly resume?: boolean;
}

/** Same dip ListenMoment used — the choir bed recedes under the video, never dies. */
const DUCK_GAIN = 0.04;
/** Slider keyboard steps — arrows fine, PageUp/Down coarse. */
const SEEK_STEP_S = 5;
const SEEK_PAGE_S = 30;
/** Stillness before the chrome recedes (idle-hide / fullscreen). */
const IDLE_MS = 2500;
/** Glow sampling cadence — deliberately slow; it's room light, not a second video. */
const GLOW_INTERVAL_MS = 350;

type FullscreenVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

// Module-scoped: the most recently started player owns the global arrow shortcuts — one
// pair of keys, one unambiguous target (only one video sounds at a time anyway). Survives
// pauses (you can still nudge the paused film), cleared when that player unmounts.
let globalKeysOwnerId: string | null = null;
let playerIdSequence = 0;

export function VideoPlayer({
  src,
  poster,
  caption,
  note,
  autoPlay = false,
  tone = "light",
  idleHide = false,
  glow = false,
  portrait = false,
  resume = true,
}: VideoPlayerProps): React.JSX.Element {
  const idRef = useRef<string | null>(null);
  if (idRef.current === null) {
    playerIdSequence += 1;
    idRef.current = `vplayer-${playerIdSequence}`;
  }
  const id = idRef.current;
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [idle, setIdle] = useState(false);
  const [veiled, setVeiled] = useState(true);
  const [failed, setFailed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const rootRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scrubRef = useRef<HTMLButtonElement | null>(null);
  const timeRef = useRef<HTMLSpanElement | null>(null);
  const glowRef = useRef<HTMLCanvasElement | null>(null);
  // Render-time ref mirrors (same pattern as AudioController.tsx:23-24) so window listeners
  // and the IntersectionObserver read fresh state without re-subscribing.
  const playingRef = useRef(false);
  playingRef.current = playing;
  const scrubbingRef = useRef(false);
  // A seek issued while the engine still executes the previous one queues here and is
  // applied from the 'seeked' handler — dragging never floods the decoder.
  const pendingFractionRef = useRef<number | null>(null);

  const restore = useCallback((): void => {
    window.dispatchEvent(new CustomEvent("voct:audio-restore"));
  }, []);

  /** Mirror playhead + duration into the chrome (CSS --p, slider ARIA, mono label). */
  const paintProgress = useCallback((time: number, duration: number): void => {
    const scrub = scrubRef.current;
    if (scrub && Number.isFinite(duration) && duration > 0) {
      scrub.style.setProperty("--p", String(Math.min(1, Math.max(0, time / duration))));
      scrub.setAttribute("aria-valuenow", String(Math.round(time)));
      scrub.setAttribute("aria-valuetext", `${formatTime(time)} z ${formatTime(duration)}`);
    }
    if (timeRef.current) {
      timeRef.current.textContent = `${formatTime(time)} / ${formatTime(duration)}`;
    }
  }, []);

  const pause = useCallback((): void => {
    const video = videoRef.current;
    if (!video) return;
    if (resume && !video.paused) savePosition(src, video.currentTime, video.duration);
    video.pause();
  }, [resume, src]);

  const play = useCallback(async (): Promise<void> => {
    const video = videoRef.current;
    if (!video) return;
    window.dispatchEvent(new CustomEvent("voct:audio-duck", { detail: { gain: DUCK_GAIN } }));
    window.dispatchEvent(new CustomEvent("voct:video-play", { detail: { id } }));
    globalKeysOwnerId = id;
    const resumeAt = resume ? readPosition(src) : 0;
    if (resumeAt > 0 && Math.abs(resumeAt - video.currentTime) > 2) {
      const applyResume = (): void => {
        video.currentTime =
          Number.isFinite(video.duration) && video.duration > 0
            ? Math.min(resumeAt, Math.max(0, video.duration - 1))
            : resumeAt;
      };
      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) applyResume();
      else video.addEventListener("loadedmetadata", applyResume, { once: true });
    }
    // Cold start on a slow network: show the breathing ring until 'playing' clears it
    // (the CSS show-delay keeps instant starts from ever flashing it).
    if (video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) setBuffering(true);
    try {
      await video.play();
    } catch {
      // Autoplay refused (transient activation expired) — stay in poster state.
      setBuffering(false);
      restore();
    }
  }, [id, restore, resume, src]);

  const toggle = useCallback((): void => {
    if (failed) return;
    if (playingRef.current) pause();
    else void play();
  }, [failed, pause, play]);

  // OS media surface (lockscreen, headset keys, media hub) — re-registered on every play,
  // so across surfaces the handlers always belong to the most recently started player.
  const applyMediaSession = useCallback((): void => {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: caption ?? "VoctEnsemble",
        artist: "VoctEnsemble",
        artwork: poster ? [{ src: poster }] : [],
      });
      navigator.mediaSession.setActionHandler("play", () => void play());
      navigator.mediaSession.setActionHandler("pause", () => pause());
      navigator.mediaSession.setActionHandler("seekbackward", () => {
        const video = videoRef.current;
        if (video) video.currentTime = Math.max(0, video.currentTime - 10);
      });
      navigator.mediaSession.setActionHandler("seekforward", () => {
        const video = videoRef.current;
        if (video && Number.isFinite(video.duration)) {
          video.currentTime = Math.min(video.duration, video.currentTime + 10);
        }
      });
    } catch {
      // Media Session is a nicety — some engines throw on unknown action names.
    }
  }, [caption, pause, play, poster]);

  // Media events are the single source of truth for `playing` — covers native fullscreen
  // controls on iOS and OS media-session pauses, not just our buttons.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = (): void => {
      setPlaying(true);
      setVeiled(false);
      applyMediaSession();
    };
    const onPause = (): void => {
      setPlaying(false);
      setBuffering(false);
      restore();
      if (resume) savePosition(src, video.currentTime, video.duration);
    };
    const onEnded = (): void => {
      setPlaying(false);
      setBuffering(false);
      setVeiled(true); // the curtain falls back over the frame
      restore();
      if (resume) clearPosition(src);
      video.currentTime = 0;
      paintProgress(0, video.duration);
    };
    const onTime = (): void => {
      // Mid-drag the pointer owns the playhead — a lagging engine must not tug it back.
      if (scrubbingRef.current) return;
      paintProgress(video.currentTime, video.duration);
    };
    const onMeta = (): void => {
      // Publish duration for the cursor's seek tooltip + the ARIA slider range.
      scrubRef.current?.setAttribute("data-duration", String(video.duration));
      scrubRef.current?.setAttribute("aria-valuemax", String(Math.round(video.duration)));
      paintProgress(video.currentTime, video.duration);
    };
    const onSeeked = (): void => {
      if (resume) savePosition(src, video.currentTime, video.duration);
      const pending = pendingFractionRef.current;
      if (pending !== null && Number.isFinite(video.duration) && video.duration > 0) {
        pendingFractionRef.current = null;
        video.currentTime = pending * video.duration;
      }
    };
    const onWaiting = (): void => setBuffering(true);
    const onPlaying = (): void => setBuffering(false);
    // Missing/broken file (media lives out-of-band on the build host) — poster + note.
    const onError = (): void => {
      setPlaying(false);
      setBuffering(false);
      setFailed(true);
      restore();
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("error", onError);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("error", onError);
    };
  }, [applyMediaSession, paintProgress, restore, resume, src]);

  // Only one video sounds at a time: any player starting broadcasts; the others pause.
  useEffect(() => {
    const onOther = (event: Event): void => {
      const otherId = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (otherId !== id && playingRef.current) pause();
    };
    window.addEventListener("voct:video-play", onOther);
    return () => window.removeEventListener("voct:video-play", onOther);
  }, [id, pause]);

  // Global ←/→ seek ±5 s on the shortcut owner — seeking must not require the scrub to
  // be focused. Only the horizontal pair: ↑/↓ keep scrolling the page (they still seek
  // when the slider itself has focus, which owns its full keymap and is excluded here
  // to avoid double-stepping). Typing surfaces and modifier combos are left alone.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (globalKeysOwnerId !== id) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('input, textarea, select, [contenteditable="true"], [role="slider"]')
      ) {
        return;
      }
      const video = videoRef.current;
      if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
      event.preventDefault();
      const delta = event.key === "ArrowLeft" ? -SEEK_STEP_S : SEEK_STEP_S;
      // Clamp a breath before the edge so → can't fire 'ended' and reset to 0:00.
      const clamped = Math.min(
        Math.max(video.currentTime + delta, 0),
        Math.max(video.duration - 0.25, 0),
      );
      video.currentTime = clamped;
      paintProgress(clamped, video.duration);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id, paintProgress]);

  // Scrolled out of view while playing → pause (no sound from nowhere).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting && playingRef.current) pause();
        }),
      { threshold: 0 },
    );
    io.observe(root);
    return () => io.disconnect();
  }, [pause]);

  // ClientRouter swaps can replace the DOM before React unmount cleanup runs. Pause on the
  // transition boundary so the outgoing player saves its resume point and releases playback.
  useEffect(() => {
    const onBeforeSwap = (): void => {
      if (globalKeysOwnerId === id) globalKeysOwnerId = null;
      const video = videoRef.current;
      if (video && !video.paused) {
        if (resume) savePosition(src, video.currentTime, video.duration);
        video.pause();
      }
      restore();
    };
    document.addEventListener("astro:before-swap", onBeforeSwap);
    return () => document.removeEventListener("astro:before-swap", onBeforeSwap);
  }, [id, restore, resume, src]);

  // Fullscreen tracking — drives the ✕/⤢ label and enables the idle chrome fade.
  useEffect(() => {
    const onChange = (): void => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Projection-room stillness: chrome recedes while playing (lightbox + any fullscreen).
  useEffect(() => {
    if ((!idleHide && !fullscreen) || !playing) {
      setIdle(false);
      return;
    }
    let timer: number | null = null;
    const arm = (): void => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), IDLE_MS);
    };
    const wake = (): void => {
      setIdle(false);
      arm();
    };
    arm();
    window.addEventListener("mousemove", wake, { passive: true });
    window.addEventListener("pointerdown", wake, { passive: true });
    window.addEventListener("keydown", wake);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
      setIdle(false);
    };
  }, [fullscreen, idleHide, playing]);

  // Ambient glow — a 32×18 snapshot blurred by CSS into room light. Same-origin media,
  // so the canvas stays untainted. Reduced motion gets a single still frame per play.
  useEffect(() => {
    if (!glow) return;
    const video = videoRef.current;
    const canvas = glowRef.current;
    const ctx = canvas?.getContext("2d");
    if (!video || !canvas || !ctx) return;
    const draw = (): void => {
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      } catch {
        // Decode hiccup — skip the frame.
      }
    };
    draw();
    if (!playing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const interval = window.setInterval(draw, GLOW_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [glow, playing]);

  // Lightbox: start with the opening gesture's transient activation.
  useEffect(() => {
    if (autoPlay) void play();
    // Mount-time intent only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Unmount (lightbox close, view-transition swap): save this src's resume point, stop sound,
  // lift the duck, and detach the OS media surface.
  useEffect(() => {
    return () => {
      if (globalKeysOwnerId === id) globalKeysOwnerId = null;
      const video = videoRef.current;
      if (video && !video.paused) {
        if (resume) savePosition(src, video.currentTime, video.duration);
        video.pause();
      }
      window.dispatchEvent(new CustomEvent("voct:audio-restore"));
      if ("mediaSession" in navigator) {
        try {
          navigator.mediaSession.metadata = null;
          navigator.mediaSession.setActionHandler("play", null);
          navigator.mediaSession.setActionHandler("pause", null);
          navigator.mediaSession.setActionHandler("seekbackward", null);
          navigator.mediaSession.setActionHandler("seekforward", null);
        } catch {
          // Best-effort detach.
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seekToFraction = useCallback(
    (fraction: number): void => {
      const video = videoRef.current;
      if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
      const clamped = Math.min(1, Math.max(0, fraction));
      // Visual feedback is immediate even when the engine seek has to queue.
      paintProgress(clamped * video.duration, video.duration);
      if (video.seeking) {
        pendingFractionRef.current = clamped;
        return;
      }
      video.currentTime = clamped * video.duration;
    },
    [paintProgress],
  );

  const scrubFraction = (event: React.PointerEvent<HTMLButtonElement>): number => {
    const rect = event.currentTarget.getBoundingClientRect();
    return rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
  };

  const onScrubDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>): void => {
      if (event.button !== 0) return; // middle stays with autoscroll, right with the menu
      event.currentTarget.setPointerCapture(event.pointerId);
      scrubbingRef.current = true;
      setScrubbing(true);
      seekToFraction(scrubFraction(event));
    },
    [seekToFraction],
  );

  const onScrubMove = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>): void => {
      if (!scrubbingRef.current) return;
      seekToFraction(scrubFraction(event));
    },
    [seekToFraction],
  );

  const onScrubEnd = useCallback((event: React.PointerEvent<HTMLButtonElement>): void => {
    if (!scrubbingRef.current) return;
    scrubbingRef.current = false;
    setScrubbing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const onScrubKey = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>): void => {
      const video = videoRef.current;
      if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
      let next: number;
      switch (event.key) {
        case "ArrowLeft":
        case "ArrowDown":
          next = video.currentTime - SEEK_STEP_S;
          break;
        case "ArrowRight":
        case "ArrowUp":
          next = video.currentTime + SEEK_STEP_S;
          break;
        case "PageDown":
          next = video.currentTime - SEEK_PAGE_S;
          break;
        case "PageUp":
          next = video.currentTime + SEEK_PAGE_S;
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = video.duration;
          break;
        default:
          return;
      }
      event.preventDefault();
      // End stops a breath before the edge so it doesn't fire 'ended' and reset to 0:00.
      const clamped = Math.min(Math.max(next, 0), Math.max(video.duration - 0.25, 0));
      video.currentTime = clamped;
      paintProgress(clamped, video.duration);
    },
    [paintProgress],
  );

  const onFullscreen = useCallback((): void => {
    const root = rootRef.current;
    const video = videoRef.current as FullscreenVideo | null;
    if (!root || !video) return;
    if (document.fullscreenElement === root) {
      void document.exitFullscreen();
      return;
    }
    // Fullscreen the whole figure so the custom chrome rides along (scrub, time, caption);
    // iPhone Safari has no element fullscreen — fall back to the native video presentation.
    if (root.requestFullscreen) void root.requestFullscreen();
    else video.webkitEnterFullscreen?.();
  }, []);

  const classes = [
    "vplayer",
    tone === "dark" ? "vplayer--dark" : "",
    portrait ? "vplayer--portrait" : "",
    playing ? "is-playing" : "",
    buffering ? "is-buffering" : "",
    scrubbing ? "is-scrubbing" : "",
    idle ? "is-idle" : "",
    failed ? "is-failed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <figure className={classes} ref={rootRef}>
      <div className="vplayer-stage">
        {glow && (
          <canvas
            className="vplayer-glow"
            width={portrait ? 18 : 32}
            height={portrait ? 32 : 18}
            aria-hidden="true"
            ref={glowRef}
          />
        )}
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          preload="metadata"
          playsInline
          onClick={toggle}
        />
        {poster && (
          <div
            className={`vplayer-veil${veiled ? "" : " is-lifted"}`}
            style={{ backgroundImage: `url("${poster}")` }}
            aria-hidden="true"
          />
        )}
        <span className="vplayer-buffer" aria-hidden="true" />
        {!failed && (
          <button
            type="button"
            className={`vplayer-btn${playing ? " is-quiet" : ""}`}
            aria-label={playing ? "Zatrzymaj odtwarzanie" : "Odtwórz wideo"}
            aria-pressed={playing}
            onClick={toggle}
          >
            {playing ? (
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
            )}
          </button>
        )}
      </div>
      {/* data-cursor="seek": the site cursor becomes a caret + timestamp over this rail
          (no snap — over a precision surface the visible cursor must equal the click
          point). aria-valuemax/valuenow/valuetext + data-duration are kept fresh
          imperatively (paintProgress/loadedmetadata) to avoid re-rendering on timeupdate. */}
      <button
        type="button"
        role="slider"
        className="vplayer-scrub"
        aria-label="Oś czasu wideo"
        aria-valuemin={0}
        data-cursor="seek"
        disabled={failed}
        ref={scrubRef}
        onPointerDown={onScrubDown}
        onPointerMove={onScrubMove}
        onPointerUp={onScrubEnd}
        onPointerCancel={onScrubEnd}
        onKeyDown={onScrubKey}
      >
        <span className="vplayer-rail" aria-hidden="true">
          <span className="vplayer-fill" />
          <span className="vplayer-dot" />
        </span>
      </button>
      <div className="vplayer-side">
        {failed ? (
          <span className="vplayer-error">Materiał chwilowo niedostępny</span>
        ) : (
          <span className="vplayer-time" ref={timeRef} aria-hidden="true">
            0:00 / 0:00
          </span>
        )}
        <button
          type="button"
          className="vplayer-fs"
          aria-label={fullscreen ? "Zamknij pełny ekran" : "Pełny ekran"}
          onClick={onFullscreen}
          disabled={failed}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </svg>
        </button>
      </div>
      {(caption || note) && (
        <figcaption className="vplayer-meta">
          {caption}
          {note && <span className="vplayer-note">{note}</span>}
        </figcaption>
      )}
    </figure>
  );
}
