/**
 * @file toneContext.ts
 * @description The panel's ONE Web Audio context for synthesised tones (pitch
 * pipe, welcome tone, starting pitches) plus the audio-session priming iOS
 * needs to let them out of the speaker. Two iOS facts drive everything here:
 *
 *  1. Safari caps how many `AudioContext`s a page may hold, and a context that
 *     a component closes on unmount does not reliably give its slot back. A
 *     surface that builds a context per mount (a pitch pipe in a sheet opened
 *     ten times) eventually gets a context that constructs and stays mute. So
 *     the context here is created once and NEVER closed — it is suspended by
 *     the platform when idle and resumed inside the next gesture.
 *  2. A context whose graph is pure synthesis plays on the *ambient* audio
 *     session, which the ring/silent switch mutes — the tone is scheduled, the
 *     UI says it is sounding, and the phone stays quiet. Routing a playing
 *     media element through the same context moves the whole graph onto the
 *     playback session, which the switch does not touch. That is what `keeper`
 *     is: 0.4 s of true digital silence on loop.
 *
 * The keeper holds the device's audio session (it stops whatever the member
 * was listening to), so it is started inside the gesture that asks for a tone
 * and released shortly after the last one — never left running in the
 * background.
 * @module shared/lib/audio/toneContext
 */

type AudioContextCtor = typeof AudioContext;

/** Silence kept sounding after the last tone, so a run of taps renegotiates
 *  the audio session once rather than on every note. */
const SESSION_LINGER_MS = 4000;
const SILENCE_SAMPLE_RATE = 44100;
const SILENCE_SECONDS = 0.4;

let context: AudioContext | null = null;
let keeper: HTMLAudioElement | null = null;
let silenceUrl: string | null = null;
let releaseTimer: number | null = null;
/** Voices currently claiming the session. Two instruments can share a page (the
 *  piece view has both a pitch pipe and the dock's starting pitches), and the
 *  first one to finish must not mute the other. */
let holds = 0;

/** Resolves the (possibly webkit-prefixed) constructor, or null where the
 *  browser has no Web Audio at all. */
const resolveCtor = (): AudioContextCtor | null => {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor })
      .webkitAudioContext ??
    null
  );
};

/** A one-off WAV of 16-bit zeroes — true silence, not a DC offset that would
 *  click on every loop. Built rather than inlined as base64 to keep the bundle
 *  free of ~50 kB of nothing. */
const silenceObjectUrl = (): string => {
  if (silenceUrl) return silenceUrl;

  const frames = Math.round(SILENCE_SAMPLE_RATE * SILENCE_SECONDS);
  const dataBytes = frames * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const ascii = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  ascii(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, "WAVEfmt ");
  view.setUint32(16, 16, true); // PCM header length
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SILENCE_SAMPLE_RATE, true);
  view.setUint32(28, SILENCE_SAMPLE_RATE * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, "data");
  view.setUint32(40, dataBytes, true);

  silenceUrl = URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
  return silenceUrl;
};

/** Never hold the audio session while the app is in the background. */
const handleVisibility = (): void => {
  if (document.visibilityState === "hidden") keeper?.pause();
};

const startKeeper = (ctx: AudioContext): void => {
  if (!keeper) {
    const element = new Audio(silenceObjectUrl());
    element.loop = true;
    element.preload = "auto";
    // Inline playback + no AirPlay hand-off: this element is a session token,
    // not something anyone should ever be routed to.
    element.setAttribute("playsinline", "");
    element.setAttribute("x-webkit-airplay", "deny");
    try {
      ctx.createMediaElementSource(element).connect(ctx.destination);
    } catch {
      // Ungraphed the element still moves the session on its own; the tone
      // simply loses the guarantee.
    }
    document.addEventListener("visibilitychange", handleVisibility);
    keeper = element;
  }
  void keeper.play().catch(() => undefined);
};

/**
 * The shared context, resumed and with the audio session primed.
 *
 * MUST be called synchronously inside the user gesture that starts the sound —
 * both the resume and the keeper's `play()` are gesture-gated. Returns null
 * only where the browser cannot give us Web Audio at all; callers should say
 * so rather than leave a control that silently does nothing.
 *
 * Every successful call is a claim on the audio session: pair it with
 * `releaseToneSession()` when the voice it opened has stopped.
 */
export const openToneContext = (): AudioContext | null => {
  const Ctor = resolveCtor();
  if (!Ctor) return null;

  // A closed context is dead — every node built on it is silent.
  if (context?.state === "closed") context = null;
  if (!context) {
    try {
      context = new Ctor();
    } catch {
      return null;
    }
  }

  if (releaseTimer !== null) {
    window.clearTimeout(releaseTimer);
    releaseTimer = null;
  }
  holds += 1;
  startKeeper(context);
  // resume() settles asynchronously, but tones are scheduled against
  // `currentTime`, which does not advance while the context is suspended — the
  // schedule survives the wait.
  void context.resume().catch(() => undefined);

  return context;
};

/** Whether the context is actually rendering. A tone scheduled on a context
 *  that stays suspended or interrupted is a control that lies, so surfaces poll
 *  this after starting one. */
export const isToneContextRunning = (): boolean => context?.state === "running";

/**
 * Drop one claim on the audio session; the device gets it back once the last
 * voice has stopped. Safe to call when nothing was playing, and the linger
 * keeps a run of taps from renegotiating the session on every note.
 */
export const releaseToneSession = (): void => {
  holds = Math.max(0, holds - 1);
  if (!keeper || holds > 0) return;
  if (releaseTimer !== null) window.clearTimeout(releaseTimer);
  releaseTimer = window.setTimeout(() => {
    releaseTimer = null;
    keeper?.pause();
  }, SESSION_LINGER_MS);
};
