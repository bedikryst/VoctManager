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
import { useChantAudio } from "./hooks/useChantAudio";

export function AudioController(): React.JSX.Element {
  const audio = useChantAudio();
  const audioRef = useRef(audio);
  audioRef.current = audio;

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

  return <ThresholdGate audio={audio} />;
}
