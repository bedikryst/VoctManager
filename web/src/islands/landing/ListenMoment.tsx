/**
 * @file ListenMoment.tsx
 * @description "Posłuchaj" — one opt-in listening beat in movement II (Vox memoriae), sitting
 *  after SilenceMoment so the real voice rises out of the enforced stillness. Plays a short,
 *  self-hosted a cappella excerpt the visitor starts with a single tap; an own AnalyserNode
 *  draws a hairline candle-gold waveform and the page's ambient bed ducks for the duration
 *  (voct:audio-duck / voct:audio-restore, honoured by AudioController).
 *
 *  Graceful-by-design: the island renders NOTHING until /audio/vox-excerpt.{webm,m4a} is
 *  actually reachable at runtime, so the moment self-activates the instant the asset is dropped
 *  into web/public/audio — no rebuild contract, no broken control before the file exists.
 * @architecture Astro islands 2026
 * @module islands/landing/ListenMoment
 */

import { useCallback, useEffect, useRef, useState } from "react";

interface Candidate {
  readonly src: string;
  readonly type: string;
}

/** Drop either (or both) into web/public/audio. Opus/WebM preferred; M4A/AAC is the Safari fallback. */
const CANDIDATES: readonly Candidate[] = [
  { src: "/audio/vox-excerpt.webm", type: 'audio/webm; codecs="opus"' },
  { src: "/audio/vox-excerpt.m4a", type: 'audio/mp4; codecs="mp4a.40.2"' },
];

/** Edit freely — the credit shown under the waveform. */
const CAPTION = "Fragment Koncertu Duchowego · a cappella";
/** Foreground listening level (the excerpt should dominate the ducked ambient bed). */
const LISTEN_GAIN = 0.92;

type Status = "probing" | "ready" | "absent";
type WindowWithWebkit = typeof window & { webkitAudioContext?: typeof AudioContext };

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ListenMoment(): React.JSX.Element | null {
  const [status, setStatus] = useState<Status>("probing");
  const [playing, setPlaying] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const rafRef = useRef<number | null>(null);
  const dprRef = useRef(1);

  const rootRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fillRef = useRef<HTMLSpanElement | null>(null);
  const timeRef = useRef<HTMLSpanElement | null>(null);

  // ── Probe: find a candidate the browser can both decode and actually fetch. ──────────────
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    let index = 0;
    let done = false;

    const tryNext = (): void => {
      while (index < CANDIDATES.length && audio.canPlayType(CANDIDATES[index].type) === "") {
        index += 1;
      }
      if (index >= CANDIDATES.length) {
        done = true;
        setStatus("absent");
        return;
      }
      audio.src = CANDIDATES[index].src;
      audio.load();
    };

    const onOk = (): void => {
      if (done) return;
      done = true;
      setStatus("ready");
    };
    const onErr = (): void => {
      if (done) return;
      index += 1;
      tryNext();
    };

    audio.addEventListener("loadedmetadata", onOk);
    audio.addEventListener("error", onErr);
    tryNext();

    return () => {
      audio.removeEventListener("loadedmetadata", onOk);
      audio.removeEventListener("error", onErr);
    };
  }, []);

  // ── Canvas drawing ───────────────────────────────────────────────────────────────────────
  const drawIdle = useCallback((): void => {
    const canvas = canvasRef.current;
    const c2d = canvas?.getContext("2d");
    if (!canvas || !c2d) return;
    c2d.clearRect(0, 0, canvas.width, canvas.height);
    c2d.lineWidth = dprRef.current;
    c2d.strokeStyle = "rgba(116, 109, 98, 0.32)";
    c2d.beginPath();
    c2d.moveTo(0, canvas.height / 2);
    c2d.lineTo(canvas.width, canvas.height / 2);
    c2d.stroke();
    rootRef.current?.style.setProperty("--vox-level", "0");
  }, []);

  const drawLive = useCallback((): void => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    const data = dataRef.current;
    const c2d = canvas?.getContext("2d");
    if (!canvas || !analyser || !data || !c2d) return;

    analyser.getByteTimeDomainData(data);
    const { width, height } = canvas;
    c2d.clearRect(0, 0, width, height);
    c2d.lineWidth = dprRef.current;
    c2d.strokeStyle = "rgba(198, 164, 91, 0.92)";
    c2d.beginPath();

    const slice = width / data.length;
    let x = 0;
    let sumSquares = 0;
    for (let i = 0; i < data.length; i += 1) {
      const v = data[i] / 128 - 1;
      sumSquares += v * v;
      const y = height / 2 + v * (height / 2) * 0.92;
      if (i === 0) c2d.moveTo(x, y);
      else c2d.lineTo(x, y);
      x += slice;
    }
    c2d.stroke();

    const rms = Math.sqrt(sumSquares / data.length);
    rootRef.current?.style.setProperty("--vox-level", Math.min(1, rms * 2.2).toFixed(3));
    rafRef.current = window.requestAnimationFrame(drawLive);
  }, []);

  const stopDraw = useCallback((): void => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    drawIdle();
  }, [drawIdle]);

  // ── Once the file is confirmed: size the canvas, prime the meters, bind media events. ─────
  useEffect(() => {
    if (status !== "ready") return;
    const audio = audioRef.current;
    if (!audio) return;

    const sizeCanvas = (): void => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      dprRef.current = dpr;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      if (rafRef.current === null) drawIdle();
    };

    const setTimeLabel = (): void => {
      if (timeRef.current) {
        timeRef.current.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
      }
    };

    const onTime = (): void => {
      if (audio.duration > 0) {
        fillRef.current?.style.setProperty("transform", `scaleX(${audio.currentTime / audio.duration})`);
      }
      setTimeLabel();
    };

    const onEnded = (): void => {
      setPlaying(false);
      stopDraw();
      window.dispatchEvent(new CustomEvent("voct:audio-restore"));
      audio.currentTime = 0;
      fillRef.current?.style.setProperty("transform", "scaleX(0)");
      setTimeLabel();
    };

    sizeCanvas();
    setTimeLabel();
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    window.addEventListener("resize", sizeCanvas);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
      window.removeEventListener("resize", sizeCanvas);
    };
  }, [status, drawIdle, stopDraw]);

  // ── Full teardown on unmount (e.g. View-Transition swap away from "/"). ───────────────────
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      window.dispatchEvent(new CustomEvent("voct:audio-restore"));
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.src = "";
      }
      const ctx = ctxRef.current;
      if (ctx && ctx.state !== "closed") void ctx.close().catch(() => {});
    };
  }, []);

  const play = useCallback(async (): Promise<void> => {
    const audio = audioRef.current;
    if (!audio) return;

    // Build the analyser graph lazily, inside the user gesture (iOS needs the gesture to unlock).
    if (!ctxRef.current) {
      const Ctx = window.AudioContext ?? (window as WindowWithWebkit).webkitAudioContext;
      if (Ctx) {
        try {
          const ctx = new Ctx();
          const source = ctx.createMediaElementSource(audio);
          const gain = ctx.createGain();
          gain.gain.value = LISTEN_GAIN;
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 1024;
          source.connect(gain);
          gain.connect(ctx.destination);
          gain.connect(analyser);
          ctxRef.current = ctx;
          analyserRef.current = analyser;
          dataRef.current = new Uint8Array(new ArrayBuffer(analyser.fftSize));
        } catch {
          /* Graph unavailable — playback still works, just without the reactive waveform. */
        }
      }
    }

    const ctx = ctxRef.current;
    if (ctx && ctx.state === "suspended") await ctx.resume();

    window.dispatchEvent(new CustomEvent("voct:audio-duck", { detail: { gain: 0.04 } }));
    try {
      await audio.play();
      setPlaying(true);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduced && analyserRef.current) {
        if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
        rafRef.current = window.requestAnimationFrame(drawLive);
      }
    } catch {
      window.dispatchEvent(new CustomEvent("voct:audio-restore"));
    }
  }, [drawLive]);

  const pause = useCallback((): void => {
    audioRef.current?.pause();
    setPlaying(false);
    stopDraw();
    window.dispatchEvent(new CustomEvent("voct:audio-restore"));
  }, [stopDraw]);

  const onToggle = useCallback((): void => {
    if (playing) pause();
    else void play();
  }, [playing, pause, play]);

  if (status !== "ready") return null;

  return (
    <section className="listen" ref={rootRef} aria-label="Posłuchaj fragmentu">
      <div className="listen-inner">
        <p className="listen-eyebrow">
          <span className="lat">Vox</span> · Posłuchaj
        </p>
        <p className="listen-line">
          Zanim przeczytasz — <em>usłysz.</em>
        </p>

        <div className="listen-player">
          <button
            type="button"
            className="listen-btn"
            aria-label={playing ? "Zatrzymaj odtwarzanie" : "Odtwórz fragment"}
            aria-pressed={playing}
            onClick={onToggle}
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

          <div className="listen-graph">
            <canvas className="listen-wave" ref={canvasRef} aria-hidden="true" />
            <span className="listen-rail" aria-hidden="true">
              <span className="listen-fill" ref={fillRef} />
            </span>
            <span className="listen-meta">
              <span className="listen-caption">{CAPTION}</span>
              <span className="listen-time" ref={timeRef} aria-hidden="true">0:00 / 0:00</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
