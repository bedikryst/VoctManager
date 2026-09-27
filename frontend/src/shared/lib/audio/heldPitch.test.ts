/**
 * @file heldPitch.test.ts
 * @description Pins what counts as a held note: a steady pitch held for the
 * hold time, a vibrato a semitone wide around a steady centre, a scoop into
 * the note, a dropout short enough to survive, and the snap to the nearest
 * semitone. Frames arrive every 20 ms, about what a 2048-sample window read on
 * every animation frame gives.
 * @module shared/lib/audio/heldPitch
 */

import { describe, expect, it } from "vitest";

import { createHeldPitchTracker } from "./heldPitch";

const FRAME_MS = 20;

/** Feed `pitchAt(t)` from `fromMs` for `forMs`; the first held note reported,
 *  with the time it was reported at. */
const feed = (
  tracker: ReturnType<typeof createHeldPitchTracker>,
  pitchAt: (timeMs: number) => number | null,
  forMs: number,
  fromMs = 0,
): { held: number | null; atMs: number | null } => {
  for (let t = fromMs; t < fromMs + forMs; t += FRAME_MS) {
    const step = tracker.push(t, pitchAt(t));
    if (step.held !== null) return { held: step.held, atMs: t };
  }
  return { held: null, atMs: null };
};

describe("createHeldPitchTracker", () => {
  it("reports a steady note once it has been held for the hold time", () => {
    const tracker = createHeldPitchTracker();
    const result = feed(tracker, () => 69.1, 1000);
    expect(result.held).toBe(69);
    expect(result.atMs).toBeGreaterThanOrEqual(600);
    expect(result.atMs).toBeLessThan(700);
  });

  it("does not report a note held for less than the hold time", () => {
    const tracker = createHeldPitchTracker();
    expect(feed(tracker, () => 69, 500).held).toBeNull();
  });

  it("reports a note sung with a semitone-wide vibrato as its centre", () => {
    const tracker = createHeldPitchTracker();
    const vibrato = (t: number): number =>
      57 + 0.5 * Math.sin((2 * Math.PI * 5.5 * t) / 1000);
    expect(feed(tracker, vibrato, 2000).held).toBe(57);
  });

  it("starts the hold after a scoop into the note, not from the scoop", () => {
    const tracker = createHeldPitchTracker();
    const scoop = (t: number): number => (t < 200 ? 62 + t / 100 : 64);
    const result = feed(tracker, scoop, 1500);
    expect(result.held).toBe(64);
    expect(result.atMs).toBeGreaterThanOrEqual(800);
  });

  it("survives a short dropout and breaks on a long one", () => {
    const short = createHeldPitchTracker();
    const shortGap = (t: number): number | null =>
      t >= 300 && t < 400 ? null : 45;
    expect(feed(short, shortGap, 700).held).toBe(45);

    const long = createHeldPitchTracker();
    const longGap = (t: number): number | null =>
      t >= 300 && t < 600 ? null : 45;
    expect(feed(long, longGap, 900).held).toBeNull();
  });

  it("snaps a note sung between two keys to the nearer one", () => {
    const tracker = createHeldPitchTracker();
    expect(feed(tracker, () => 71.7, 1000).held).toBe(72);
  });

  it("follows a new note after a leap and reports that one", () => {
    const tracker = createHeldPitchTracker();
    const leap = (t: number): number => (t < 400 ? 60 : 67);
    expect(feed(tracker, leap, 1500).held).toBe(67);
  });
});
