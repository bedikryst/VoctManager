/**
 * @file AudioController.tsx
 * @description Always-mounted owner of the chant audio graph (useChantAudio) for the landing.
 *  It must persist for the whole session — the ThresholdGate modal removes itself, so it can't
 *  hold the audio. Bridges cross-island state over `window` events: broadcasts `voct:audio-state`
 *  ({ isOn }) on every change (+ mirrors it to `window.__voctAudioOn` for mount-race-proof reads
 *  by the StickyHeader), and toggles on `voct:toggle-audio` (dispatched synchronously inside the
 *  header's click handler, preserving the user gesture WebAudio needs). Renders the gate modal.
 * @architecture Astro islands 2026
 * @module islands/landing/AudioController
 */

import { useEffect, useRef } from "react";

import { ThresholdGate } from "./ThresholdGate";
import { useAudioChoice } from "./hooks/useAudioChoice";
import { useChantAudio } from "./hooks/useChantAudio";

export function AudioController(): React.JSX.Element {
  const audio = useChantAudio();
  const audioRef = useRef(audio);
  audioRef.current = audio;
  const { write } = useAudioChoice();
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

  // Toggle requests from anywhere (header button) — same call stack as the user gesture.
  useEffect(() => {
    const onToggle = (): void => {
      void audioRef.current.toggle();
    };
    window.addEventListener("voct:toggle-audio", onToggle);
    return () => window.removeEventListener("voct:toggle-audio", onToggle);
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

  return <ThresholdGate audio={audio} />;
}
