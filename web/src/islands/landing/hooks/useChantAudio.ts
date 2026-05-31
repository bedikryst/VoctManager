/**
 * @file useChantAudio.ts
 * @description Web-Audio backed ambient track controller with side-chain AnalyserNode for
 * audio-reactive UI (interlude knots). Uses a GainNode for cross-platform fades
 * (iOS Safari makes `audio.volume` read-only, so a native volume ramp would no-op).
 * Side-effects:
 *  - Sets `--knot-intensity` (0..1) on every `.aether-knot` element @ ~30Hz when audio plays.
 *  - Toggles `body.audio-on` so the candle halo / portrait breathe CSS animations engage.
 *  - Auto-pauses on `visibilitychange` and rehydrates on return.
 * @architecture Enterprise SaaS 2026
 * @module features/landing/hooks/useChantAudio
 */

import { useCallback, useEffect, useRef, useState } from "react";

const AMBIENT_SRC = "/ambient.m4a";
/** Normal ambient bed gain. Exported so cross-island ducking (ListenMoment) can restore it. */
export const TARGET_GAIN = 0.28;
const FADE_MS = 1400;

type ChantState = "silent" | "loading" | "playing";

export interface ChantAudio {
  readonly state: ChantState;
  readonly isOn: boolean;
  readonly start: () => Promise<void>;
  readonly stop: () => Promise<void>;
  readonly toggle: () => Promise<void>;
  readonly armAutoResume: () => void;
  /** Ramp the gain to a target value over `durationMs` without touching state.
   *  Use for soft fades around lifecycle events (Astro view-transition swap). */
  readonly fadeGain: (target: number, durationMs?: number) => Promise<void>;
}

interface AudioGraph {
  audio: HTMLAudioElement;
  context: AudioContext;
  gain: GainNode;
  analyser: AnalyserNode;
  buffer: Uint8Array<ArrayBuffer>;
}

function isReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useChantAudio(): ChantAudio {
  const [state, setState] = useState<ChantState>("silent");
  const graphRef = useRef<AudioGraph | null>(null);
  const reactiveRafRef = useRef<number | null>(null);
  const reactiveKnotsRef = useRef<NodeListOf<HTMLElement> | null>(null);
  const resumeAbortRef = useRef<AbortController | null>(null);
  const isOnRef = useRef(false);

  const buildGraph = useCallback((): AudioGraph | null => {
    if (graphRef.current) return graphRef.current;
    const Ctx = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    try {
      const audio = new Audio(AMBIENT_SRC);
      audio.loop = true;
      audio.preload = "auto";
      audio.crossOrigin = "anonymous";
      audio.volume = 1;

      const context = new Ctx();
      const source = context.createMediaElementSource(audio);
      const gain = context.createGain();
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(context.destination);

      const analyser = context.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.85;
      gain.connect(analyser);
      const buffer = new Uint8Array(analyser.frequencyBinCount);

      const built: AudioGraph = { audio, context, gain, analyser, buffer };
      graphRef.current = built;
      return built;
    } catch (error) {
      console.warn("[VoctAudio] Web Audio graph unavailable:", (error as Error)?.message ?? error);
      return null;
    }
  }, []);

  const fadeTo = useCallback((target: number, duration = FADE_MS): Promise<void> => {
    const graph = graphRef.current;
    if (!graph) return Promise.resolve();
    const clamped = Math.max(0, Math.min(1, target));
    return new Promise((resolve) => {
      const t0 = graph.context.currentTime;
      const tEnd = t0 + Math.max(0.05, duration / 1000);
      graph.gain.gain.cancelScheduledValues(t0);
      graph.gain.gain.setValueAtTime(graph.gain.gain.value, t0);
      graph.gain.gain.linearRampToValueAtTime(clamped, tEnd);
      window.setTimeout(resolve, duration);
    });
  }, []);

  const tickReactive = useCallback(() => {
    const graph = graphRef.current;
    const knots = reactiveKnotsRef.current;
    if (!graph || !knots || !isOnRef.current) {
      knots?.forEach((el) => el.style.setProperty("--knot-intensity", "0"));
      reactiveRafRef.current = null;
      return;
    }
    graph.analyser.getByteFrequencyData(graph.buffer);
    let sum = 0;
    for (let i = 0; i < graph.buffer.length; i++) sum += graph.buffer[i];
    const avg = sum / graph.buffer.length / 255;
    const intensity = Math.min(1, Math.pow(avg, 0.7) * 1.4).toFixed(3);
    knots.forEach((el) => el.style.setProperty("--knot-intensity", intensity));
    // Throttle to ~30Hz by skipping every other frame; smoothingTimeConstant masks the gap.
    reactiveRafRef.current = window.requestAnimationFrame(() => {
      reactiveRafRef.current = window.requestAnimationFrame(tickReactive);
    });
  }, []);

  const startReactive = useCallback(() => {
    if (reactiveRafRef.current !== null) return;
    if (isReducedMotion()) return;
    if (!reactiveKnotsRef.current) {
      reactiveKnotsRef.current = document.querySelectorAll<HTMLElement>(".aether-knot");
    }
    if (!reactiveKnotsRef.current.length) return;
    reactiveRafRef.current = window.requestAnimationFrame(tickReactive);
  }, [tickReactive]);

  const stopReactive = useCallback(() => {
    if (reactiveRafRef.current !== null) {
      window.cancelAnimationFrame(reactiveRafRef.current);
      reactiveRafRef.current = null;
    }
    reactiveKnotsRef.current?.forEach((el) => el.style.setProperty("--knot-intensity", "0"));
  }, []);

  const start = useCallback(async () => {
    isOnRef.current = true;
    document.body.classList.add("audio-on");
    setState("loading");
    const graph = buildGraph();
    if (!graph) {
      isOnRef.current = false;
      document.body.classList.remove("audio-on");
      setState("silent");
      return;
    }
    try {
      if (graph.context.state === "suspended") await graph.context.resume();
      await graph.audio.play();
      startReactive();
      await fadeTo(TARGET_GAIN);
      setState("playing");
    } catch (error) {
      console.warn("[VoctAudio] play failed:", (error as Error)?.message ?? error);
      isOnRef.current = false;
      document.body.classList.remove("audio-on");
      stopReactive();
      setState("silent");
    }
  }, [buildGraph, fadeTo, startReactive, stopReactive]);

  const stop = useCallback(async () => {
    isOnRef.current = false;
    document.body.classList.remove("audio-on");
    const graph = graphRef.current;
    if (graph) {
      await fadeTo(0);
      graph.audio.pause();
    }
    stopReactive();
    setState("silent");
  }, [fadeTo, stopReactive]);

  const toggle = useCallback(async () => {
    if (isOnRef.current) {
      await stop();
    } else {
      resumeAbortRef.current?.abort();
      await start();
    }
  }, [start, stop]);

  const armAutoResume = useCallback(() => {
    resumeAbortRef.current?.abort();
    const ac = new AbortController();
    resumeAbortRef.current = ac;
    let starting = false;
    const tryResume = async () => {
      if (starting) return;
      starting = true;
      ac.abort();
      // The saved "voice" choice IS the prior expressed intent — restore "on" intent
      // synchronously so the rest of the pipeline behaves as if start() ran. (Without this
      // the `!isOnRef.current` early-out aborted every gesture-driven resume after reload,
      // so returning "voice" users always landed muted.)
      isOnRef.current = true;
      document.body.classList.add("audio-on");
      setState("loading");
      try {
        const graph = buildGraph();
        if (!graph) throw new Error("No audio graph");
        if (graph.context.state === "suspended") await graph.context.resume();
        await graph.audio.play();
        startReactive();
        await fadeTo(TARGET_GAIN);
        setState("playing");
      } catch (error) {
        console.warn("[VoctAudio] resume deferred:", (error as Error)?.message ?? error);
        isOnRef.current = false;
        document.body.classList.remove("audio-on");
        setState("silent");
        starting = false;
        armAutoResume();
      }
    };
    const events: readonly (keyof WindowEventMap)[] = [
      "pointerdown", "pointerup", "mousedown", "click", "keydown",
      "touchstart", "touchend", "wheel", "scroll", "focusin",
    ];
    const opts: AddEventListenerOptions = { signal: ac.signal, passive: true, capture: true };
    events.forEach((evt) => window.addEventListener(evt, tryResume, opts));
  }, [buildGraph, fadeTo, startReactive]);

  // Auto-pause when tab hidden; rehydrate when visible again.
  useEffect(() => {
    const onVis = () => {
      const graph = graphRef.current;
      if (!graph || !isOnRef.current) return;
      if (document.hidden) {
        graph.audio.pause();
        stopReactive();
      } else {
        if (graph.context.state === "suspended") {
          graph.context.resume().catch(() => {});
        }
        graph.audio
          .play()
          .then(() => {
            startReactive();
            void fadeTo(TARGET_GAIN);
          })
          .catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [fadeTo, startReactive, stopReactive]);

  // On unmount, fully tear the graph down. AudioController is mounted ONLY on "/", and Astro
  // unmounts islands on a View Transition swap (astro-island → astro:after-swap → astro:unmount →
  // root.unmount()), so this fires when leaving the landing for a subpage. The detached <audio>
  // element keeps playing unless we stop it, and a fresh AudioController on return would otherwise
  // build a SECOND graph (double audio) — so pause, close the context, and drop the ref here.
  useEffect(() => {
    return () => {
      resumeAbortRef.current?.abort();
      if (reactiveRafRef.current !== null) {
        window.cancelAnimationFrame(reactiveRafRef.current);
      }
      isOnRef.current = false;
      document.body.classList.remove("audio-on");
      const graph = graphRef.current;
      if (graph) {
        try {
          graph.audio.pause();
          graph.audio.src = "";
        } catch {
          /* element may already be detached */
        }
        if (graph.context.state !== "closed") {
          void graph.context.close().catch(() => {});
        }
        graphRef.current = null;
      }
    };
  }, []);

  return {
    state,
    isOn: state !== "silent",
    start,
    stop,
    toggle,
    armAutoResume,
    fadeGain: fadeTo,
  };
}
