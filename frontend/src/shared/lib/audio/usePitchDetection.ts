/**
 * @file usePitchDetection.ts
 * @description Listens to a singer through the microphone until the caller
 * stops it, and reports every note held along the way as a MIDI number
 * (McLeod pitch method, via `pitchy`). Nothing is recorded or sent: each
 * 2048-sample frame is read, measured and overwritten.
 *
 *  - The capture has echo cancellation, noise suppression and automatic gain
 *    off. All three reshape a sung tone, and the singer is alone with the
 *    phone, not on a call.
 *  - A frame counts only when it is clear (clarity ≥ 0.9) and lies inside the
 *    caller's window. The window is the first defence against octave errors: a
 *    bass's d read an octave up, or a soprano's a² an octave down, falls
 *    outside it.
 *  - `heldPitch` decides when a note is held. A held note does not end the
 *    capture: the singer may settle, move on and hold another, and `onHeld`
 *    runs for each. The caller plays nothing until it has called `cancel`, so
 *    no sound is heard through a live microphone, which on iOS ducks
 *    playback, and none is taken for the singer's voice.
 *  - The capture ends on `cancel`, after a stretch with no voice, at a hard
 *    cap however much is sung (a radio in the room must not hold it open), on
 *    unmount, on a track the system ends (a call, Siri, a revoked permission),
 *    on a failure while wiring the analysis, and when the page is hidden. A
 *    microphone is never left open behind the app.
 *
 * The analysis runs on the panel's one tone context (see `toneContext` for why
 * there is only one), so `start` must be called synchronously inside the tap
 * that asks for it: the context resumes only in a gesture.
 * @module shared/lib/audio/usePitchDetection
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { createHeldPitchTracker } from "@/shared/lib/audio/heldPitch";
import {
  openToneContext,
  releaseToneSession,
} from "@/shared/lib/audio/toneContext";

const FRAME_SIZE = 2048;
const MIN_CLARITY = 0.9;
/** Below this the frame is room noise, not a voice. */
const MIN_VOLUME_DB = -50;
/** A capture that hears no voice for this long ends by itself. */
const SILENCE_TIMEOUT_MS = 20000;
/** No capture outlives this, voice or not. */
const MAX_CAPTURE_MS = 120000;
/** The cursor moves at most this often: the whole screen re-renders with it,
 *  and the keyboard eases its cursor over the same span. */
const CURSOR_INTERVAL_MS = 80;
/** A cursor move smaller than this is not worth a render. */
const CURSOR_STEP = 0.03;

export type PitchDetectionStatus =
  /** Not listening. */
  | "idle"
  /** Waiting for the microphone, possibly on the permission prompt. */
  | "starting"
  | "listening"
  /** The reader refused the microphone. Not asked again in this mount. */
  | "denied"
  /** No microphone, or no Web Audio. */
  | "unavailable"
  /** The capture ended by itself without a single held note. */
  | "timedOut";

export interface PitchDetectionWindow {
  /** Inclusive MIDI bounds of the pitches that count. */
  readonly low: number;
  readonly high: number;
}

export interface PitchDetection {
  /** False where the browser has no `getUserMedia`; hide the control then. */
  readonly supported: boolean;
  readonly status: PitchDetectionStatus;
  /** The pitch heard now, in MIDI units, while listening; otherwise null. */
  readonly cursor: number | null;
  /** The semitone nearest the voice, while listening. It stays through a
   *  breath and clears when listening ends; null before the first sound. */
  readonly note: number | null;
  /** Call synchronously inside the tap. */
  readonly start: () => void;
  /** Stop listening, returning to `idle`. Safe when not listening. Notes
   *  already reported stay reported. */
  readonly cancel: () => void;
}

const hzToMidi = (hz: number): number => 69 + 12 * Math.log2(hz / 440);

const isSupported = (): boolean =>
  typeof navigator !== "undefined" &&
  typeof navigator.mediaDevices?.getUserMedia === "function";

/** One capture's resources, filled in as they are acquired, so a teardown at
 *  any moment releases exactly what exists. */
interface Capture {
  stream: MediaStream | null;
  readonly nodes: AudioNode[];
  frame: number | null;
  timeout: number | null;
}

export const usePitchDetection = (
  listenWindow: PitchDetectionWindow,
  onHeld: (midi: number) => void,
): PitchDetection => {
  const [status, setStatus] = useState<PitchDetectionStatus>("idle");
  const [cursor, setCursor] = useState<number | null>(null);
  const [note, setNote] = useState<number | null>(null);
  const [supported] = useState(isSupported);

  // Read through refs, so a caller's inline values never restart a capture.
  const windowRef = useRef(listenWindow);
  const onHeldRef = useRef(onHeld);
  useLayoutEffect(() => {
    windowRef.current = listenWindow;
    onHeldRef.current = onHeld;
  });

  /** Bumped by every start and stop; a late `getUserMedia` answer for an
   *  older capture closes its own stream and does nothing else. */
  const generation = useRef(0);
  const capture = useRef<Capture | null>(null);

  const teardown = useCallback((): void => {
    generation.current += 1;
    const current = capture.current;
    capture.current = null;
    setCursor(null);
    setNote(null);
    if (!current) return;
    // The tracks stop first, so nothing failing below can keep the
    // microphone open.
    current.stream?.getTracks().forEach((track) => track.stop());
    if (current.frame !== null) cancelAnimationFrame(current.frame);
    if (current.timeout !== null) window.clearTimeout(current.timeout);
    current.nodes.forEach((node) => node.disconnect());
    releaseToneSession();
  }, []);

  const cancel = useCallback((): void => {
    teardown();
    setStatus((current) =>
      current === "starting" || current === "listening" ? "idle" : current,
    );
  }, [teardown]);

  const start = useCallback((): void => {
    if (!supported) return;
    teardown();
    const ctx = openToneContext();
    if (!ctx) {
      setStatus("unavailable");
      return;
    }
    const mine = generation.current;
    // Holds the tone session from here, so every exit path releases it.
    const current: Capture = {
      stream: null,
      nodes: [],
      frame: null,
      timeout: null,
    };
    capture.current = current;
    setStatus("starting");
    // Read by the watch below and written by the frames: when a voice was
    // last heard, and whether anything was held since the grant.
    let lastVoiceAt = 0;
    let heldAny = false;

    navigator.mediaDevices
      .getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      })
      .then((stream) => {
        if (generation.current !== mine) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        // Held before any graph call: when wiring the graph throws, the
        // `catch` below still reaches the tracks.
        current.stream = stream;
        // A call, Siri or a revoked permission ends the track without a word;
        // the screen must not go on saying it listens.
        const onTrackEnded = (): void => {
          if (generation.current !== mine) return;
          teardown();
          setStatus("idle");
        };
        stream
          .getTracks()
          .forEach((track) => track.addEventListener("ended", onTrackEnded));
        // Counted from the grant, so a slow load below counts against it too.
        // One timer, re-armed for whatever is left of the silence allowed,
        // rather than one per heard frame.
        const grantedAt = performance.now();
        lastVoiceAt = grantedAt;
        const watch = (): void => {
          if (generation.current !== mine) return;
          const now = performance.now();
          const silenceLeft = SILENCE_TIMEOUT_MS - (now - lastVoiceAt);
          const capLeft = MAX_CAPTURE_MS - (now - grantedAt);
          if (silenceLeft <= 0 || capLeft <= 0) {
            teardown();
            setStatus(heldAny ? "idle" : "timedOut");
            return;
          }
          current.timeout = window.setTimeout(
            watch,
            Math.min(silenceLeft, capLeft),
          );
        };
        current.timeout = window.setTimeout(watch, SILENCE_TIMEOUT_MS);

        // Loaded with the first capture, not with the panel: every account
        // loads the shell that mounts this screen, and few ever sing into it.
        return import("pitchy").then(({ PitchDetector }) => ({
          stream,
          PitchDetector,
        }));
      })
      .then((granted) => {
        if (!granted || generation.current !== mine) return;
        const { stream, PitchDetector } = granted;

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        // Wired to the destination through silence: older Safari processes
        // only nodes that reach it.
        const mute = ctx.createGain();
        current.nodes.push(source, analyser, mute);
        analyser.fftSize = FRAME_SIZE;
        mute.gain.value = 0;
        source.connect(analyser).connect(mute).connect(ctx.destination);

        const detector = PitchDetector.forFloat32Array(FRAME_SIZE);
        detector.minVolumeDecibels = MIN_VOLUME_DB;
        const buffer = new Float32Array(FRAME_SIZE);
        const tracker = createHeldPitchTracker();
        let shownCursor: number | null = null;
        let shownAt = 0;
        let shownNote: number | null = null;

        const tick = (now: number): void => {
          if (generation.current !== mine) return;
          analyser.getFloatTimeDomainData(buffer);
          const [hz, clarity] = detector.findPitch(buffer, ctx.sampleRate);
          const { low, high } = windowRef.current;
          const midi = hz > 0 ? hzToMidi(hz) : null;
          const heard =
            midi !== null &&
            clarity >= MIN_CLARITY &&
            midi >= low - 0.5 &&
            midi <= high + 0.5
              ? midi
              : null;
          const step = tracker.push(now, heard);
          if (heard !== null) lastVoiceAt = performance.now();

          if (step.held !== null) {
            heldAny = true;
            onHeldRef.current(step.held);
            // The caller may have stopped the capture from inside `onHeld`.
            if (generation.current !== mine) return;
          }

          if (step.cursor !== null) {
            const nearest = Math.round(step.cursor);
            if (nearest !== shownNote) {
              shownNote = nearest;
              setNote(nearest);
            }
          }

          const moved =
            step.cursor === null || shownCursor === null
              ? step.cursor !== shownCursor
              : Math.abs(step.cursor - shownCursor) >= CURSOR_STEP;
          if (moved && now - shownAt >= CURSOR_INTERVAL_MS) {
            shownCursor = step.cursor;
            shownAt = now;
            setCursor(step.cursor);
          }
          current.frame = requestAnimationFrame(tick);
        };

        current.frame = requestAnimationFrame(tick);
        setStatus("listening");
      })
      .catch((error: unknown) => {
        if (generation.current !== mine) return;
        teardown();
        const refused =
          error instanceof DOMException &&
          (error.name === "NotAllowedError" || error.name === "SecurityError");
        setStatus(refused ? "denied" : "unavailable");
      });
  }, [supported, teardown]);

  // Never listen behind the app, and never outlive the screen.
  useEffect(() => {
    const onVisibility = (): void => {
      if (document.visibilityState === "hidden") cancel();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      teardown();
    };
  }, [cancel, teardown]);

  return { supported, status, cursor, note, start, cancel };
};
