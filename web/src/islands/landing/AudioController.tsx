/**
 * @file AudioController.tsx
 * @description Always-mounted owner of the chant audio graph (useChantAudio) for the landing.
 *  It must persist for the whole session — the threshold choice UI (now the Preloader's final
 *  beat) removes itself, so it can't hold the audio. Bridges cross-island state over `window`
 *  events: broadcasts `voct:audio-state` ({ isOn }) on every change (+ mirrors it to
 *  `window.__voctAudioOn` for mount-race-proof reads by the StickyHeader), toggles on
 *  `voct:toggle-audio`, and starts the ambient on `voct:audio-choice` (both dispatched
 *  synchronously inside the originating click handler, preserving the user gesture WebAudio
 *  needs). For a returning "voice" visitor it arms auto-resume on the first gesture.
 *  Renders nothing.
 * @architecture Astro islands 2026
 * @module islands/landing/AudioController
 */

import { useEffect, useRef } from "react";

import { useAudioChoice, type AudioChoice } from "./hooks/useAudioChoice";
import { TARGET_GAIN, useChantAudio } from "./hooks/useChantAudio";

export function AudioController(): null {
  const audio = useChantAudio();
  const audioRef = useRef(audio);
  audioRef.current = audio;
  const { read, write } = useAudioChoice();
  // Track the prior isOn so a swap into "playing"/"silent" overwrites the saved threshold choice
  // (latest action wins): if the user entered with silence but later toggled audio on via the
  // header, the next visit should auto-resume to "voice" — and vice versa.
  const lastIsOnRef = useRef(audio.isOn);
  useEffect(() => {
    if (audio.isOn === lastIsOnRef.current) return;
    lastIsOnRef.current = audio.isOn;
    write(audio.isOn ? "voice" : "silence");
  }, [audio.isOn, write]);

  // Broadcast the live on/off truth so the StickyHeader label tracks it.
  useEffect(() => {
    (window as Window & { __voctAudioOn?: boolean }).__voctAudioOn = audio.isOn;
    window.dispatchEvent(new CustomEvent("voct:audio-state", { detail: { isOn: audio.isOn } }));
  }, [audio.isOn]);

  // Returning "voice" visitor (the Preloader skips the question for a valid saved
  // choice): arm auto-resume so the ambient rises on the first gesture. This decision
  // used to live in the ThresholdGate's mount effect.
  useEffect(() => {
    if (read() === "voice") {
      audioRef.current.armAutoResume();
    }
    // Run once on mount — the saved choice is a mount-time fact.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toggle requests from anywhere (header button) — same call stack as the user gesture.
  useEffect(() => {
    const onToggle = (): void => {
      void audioRef.current.toggle();
    };
    window.addEventListener("voct:toggle-audio", onToggle);
    return () => window.removeEventListener("voct:toggle-audio", onToggle);
  }, []);

  // The threshold decision, made inside the Preloader's final beat. Dispatched
  // synchronously from the button's click handler, so start() still runs within the
  // user gesture. Silence needs no action — the graph simply never starts.
  useEffect(() => {
    const onChoice = (event: Event): void => {
      const choice = (event as CustomEvent<{ choice?: AudioChoice }>).detail?.choice;
      if (choice === "voice") {
        void audioRef.current.start();
      }
    };
    window.addEventListener("voct:audio-choice", onChoice);
    return () => window.removeEventListener("voct:audio-choice", onChoice);
  }, []);

  // Duck the ambient bed while a foreground video (VoxMoment / VideoLightbox, via VideoPlayer)
  // plays, then restore. Non-invasive: never flips the saved threshold choice or the header
  // label — this is a temporary gain dip, not a state change, so the ambient on/off intent is
  // preserved. No-ops when the ambient is off, so the video can also play standalone.
  useEffect(() => {
    const onDuck = (event: Event): void => {
      if (!audioRef.current.isOn) return;
      const gain = (event as CustomEvent<{ gain?: number }>).detail?.gain ?? 0.05;
      void audioRef.current.fadeGain(gain, 600);
    };
    const onRestore = (): void => {
      if (!audioRef.current.isOn) return;
      void audioRef.current.fadeGain(TARGET_GAIN, 900);
    };
    window.addEventListener("voct:audio-duck", onDuck);
    window.addEventListener("voct:audio-restore", onRestore);
    return () => {
      window.removeEventListener("voct:audio-duck", onDuck);
      window.removeEventListener("voct:audio-restore", onRestore);
    };
  }, []);

  // Soft fade before an Astro view-transition swap. AudioController is mounted only on "/", so
  // navigation to a subpage triggers an unmount whose cleanup pauses + closes the audio context
  // synchronously — which is audible. Listening for `astro:before-preparation` lets us ramp gain
  // to zero ahead of the swap; by the time cleanup runs, the audio is already inaudible. The
  // saved "voice" choice in localStorage is untouched, so armAutoResume on return still works.
  useEffect(() => {
    const onBeforeSwap = (): void => {
      if (!audioRef.current.isOn) return;
      void audioRef.current.fadeGain(0, 450);
    };
    document.addEventListener("astro:before-preparation", onBeforeSwap);
    return () => document.removeEventListener("astro:before-preparation", onBeforeSwap);
  }, []);

  return null;
}
