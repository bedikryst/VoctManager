/**
 * @file practicePlayerEngine.test.ts
 * @description How the practice engine keeps several streaming voices in time
 * on a phone that stutters after every seek. iOS plays an element stop-start
 * for up to a second after a seek without firing `waiting` (measured 2026-11
 * on iOS 26 and 27); the fake element below reproduces that, and the suites
 * check that nothing heard is seeked or held to keep time, that a newcomer
 * stays muted until it plays steadily on the clock, and that the voices it
 * replaces sound until then. Runs without Web Audio, so a voice's gain is its
 * element volume.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PracticePlayerEngine,
  type PracticePieceSource,
  type PracticeTrackSource,
} from "./practicePlayerEngine";

interface Stutter {
  /** Seconds after a seek during which the element plays stop-start. */
  window: number;
  run: number;
  freeze: number;
}

/** An HTMLAudioElement whose clock the test drives. */
class FakeAudio extends EventTarget {
  static created: FakeAudio[] = [];

  src = "";
  crossOrigin: string | null = null;
  preload = "";
  preservesPitch = false;
  volume = 1;
  playbackRate = 1;
  paused = true;
  seeking = false;
  readyState = 4;
  ended = false;
  duration = 600;
  seeks = 0;
  stutter: Stutter | null = null;
  private time = 0;
  private sinceSeek = Number.POSITIVE_INFINITY;
  private heldFor = 0;

  constructor() {
    super();
    FakeAudio.created.push(this);
  }

  get currentTime(): number {
    return this.time;
  }

  set currentTime(value: number) {
    this.time = value;
    this.seeks += 1;
    this.sinceSeek = 0;
  }

  play(): Promise<void> {
    this.paused = false;
    this.dispatchEvent(new Event("play"));
    this.dispatchEvent(new Event("playing"));
    return Promise.resolve();
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  }

  removeAttribute(): void {}

  load(): void {}

  /** Stands still for `seconds` of wall time — a slip the engine must see. */
  hold(seconds: number): void {
    this.heldFor = seconds;
  }

  advance(seconds: number): void {
    if (this.paused) return;
    this.sinceSeek += seconds;
    if (this.heldFor > 0) {
      this.heldFor = Math.max(0, this.heldFor - seconds);
      return;
    }
    const { stutter } = this;
    if (stutter && this.sinceSeek < stutter.window) {
      const phase = this.sinceSeek % (stutter.run + stutter.freeze);
      if (phase >= stutter.run) return;
    }
    this.time += seconds * this.playbackRate;
  }
}

// The stop-start measured on iOS after a seek: runs of ~0.3 s, freezes of
// ~0.2 s, for about a second.
const IOS_STUTTER: Stutter = { window: 1, run: 0.3, freeze: 0.2 };

const STEP_MS = 10;
let nowMs = 0;

/** Advances wall time, every element's clock and the engine's timers together. */
const run = async (ms: number): Promise<void> => {
  for (let elapsed = 0; elapsed < ms; elapsed += STEP_MS) {
    nowMs += STEP_MS;
    FakeAudio.created.forEach((el) => el.advance(STEP_MS / 1000));
    await vi.advanceTimersByTimeAsync(STEP_MS);
  }
};

const piece: PracticePieceSource = {
  pieceId: "os-justi",
  projectId: "concert",
  title: "Os justi",
  composer: "Anton Bruckner",
  take: "practice",
};

const track = (voicePart: string, isMine = false): PracticeTrackSource => ({
  id: voicePart,
  voicePart,
  label: voicePart,
  url: `https://media.test/${voicePart}.mp3`,
  isMine,
  description: "",
});

// A piece without a tutti take: the blend plays all four voices.
const TRACKS = [track("S"), track("A"), track("T"), track("B", true)];

const voice = (code: string): FakeAudio => {
  const el = FakeAudio.created.find((audio) => audio.src.endsWith(`/${code}.mp3`));
  if (!el) throw new Error(`no element for ${code}`);
  return el;
};

const UPPER = ["S", "A", "T"] as const;

describe("PracticePlayerEngine on a phone that stutters after seeks", () => {
  let engine: PracticePlayerEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    nowMs = 0;
    FakeAudio.created = [];
    vi.stubGlobal("window", globalThis);
    vi.stubGlobal("Audio", FakeAudio);
    vi.stubGlobal("HTMLMediaElement", { HAVE_FUTURE_DATA: 3 });
    vi.stubGlobal("performance", { now: () => nowMs });
    engine = new PracticePlayerEngine();
  });

  afterEach(() => {
    engine.destroy();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("leaves the voices still heard untouched when one leaves the mix", async () => {
    engine.load(piece, TRACKS);
    await engine.play();
    await run(2000);
    const seeksBefore = UPPER.map((code) => voice(code).seeks);

    engine.applyPreset("minus-mine");
    await run(3000);

    expect(UPPER.map((code) => voice(code).seeks)).toEqual(seeksBefore);
    UPPER.forEach((code) => {
      expect(voice(code).paused).toBe(false);
      expect(voice(code).volume).toBe(1);
    });
    expect(voice("B").volume).toBe(0);
    expect(voice("B").paused).toBe(true);
  });

  it("keeps the replaced voice heard until the newcomers play steadily in time", async () => {
    engine.load(piece, TRACKS);
    engine.applyPreset("solo-mine");
    await engine.play();
    await run(2000);
    UPPER.forEach((code) => {
      voice(code).stutter = IOS_STUTTER;
    });

    engine.applyPreset("minus-mine");
    await run(1200);

    // Still settling: the newcomers stay muted, the bass carries the sound.
    expect(voice("B").volume).toBe(1);
    expect(voice("B").paused).toBe(false);
    UPPER.forEach((code) => {
      expect(voice(code).paused).toBe(false);
      expect(voice(code).volume).toBe(0);
    });

    await run(2600);

    UPPER.forEach((code) => {
      expect(voice(code).volume).toBe(1);
      expect(voice(code).seeks).toBe(1);
      expect(Math.abs(voice(code).currentTime - voice("S").currentTime)).toBeLessThanOrEqual(0.04);
    });
    expect(voice("B").volume).toBe(0);
    expect(voice("B").paused).toBe(true);
  });

  it("joins the next newcomer closer, having learned what the first one lost", async () => {
    engine.load(piece, TRACKS);
    engine.applyPreset("solo-mine");
    await engine.play();
    await run(2000);
    FakeAudio.created.forEach((el) => {
      el.stutter = IOS_STUTTER;
    });

    engine.applyPreset("minus-mine");
    await run(4000);
    engine.applyPreset("solo-mine");

    // Placed ahead by the 0.4 s the upper voices lost, the bass lands on the
    // clock the moment it plays steadily; without the lead it would still be
    // catching up by a nudge at this point.
    await run(2100);
    expect(voice("B").volume).toBe(1);
    expect(voice("B").playbackRate).toBe(1);
    expect(voice("S").paused).toBe(true);
  });

  it("nudges a heard voice that slips back into time without seeking it", async () => {
    engine.load(piece, TRACKS);
    await engine.play();
    await run(2000);
    const seeksBefore = voice("A").seeks;

    voice("A").hold(0.15);
    await run(1000);
    expect(voice("A").playbackRate).toBeGreaterThan(1);
    expect(voice("A").volume).toBe(1);

    await run(2500);
    expect(voice("A").playbackRate).toBe(1);
    expect(voice("A").seeks).toBe(seeksBefore);
    expect(Math.abs(voice("A").currentTime - voice("S").currentTime)).toBeLessThanOrEqual(0.04);
  });

  it("takes a heard voice that slips too far out and brings it back in time", async () => {
    engine.load(piece, TRACKS);
    await engine.play();
    await run(2000);

    // Measured only once it plays steadily again, 0.75 s after the slip.
    voice("A").hold(0.5);
    await run(1500);
    expect(voice("A").volume).toBe(0);

    await run(3000);
    expect(voice("A").volume).toBe(1);
    expect(Math.abs(voice("A").currentTime - voice("S").currentTime)).toBeLessThanOrEqual(0.04);
  });

  it("drops the handover deadline when the replaced voice is wanted again", async () => {
    engine.load(piece, TRACKS);
    engine.applyPreset("solo-mine");
    await engine.play();
    await run(2000);
    engine.applyPreset("minus-mine");
    // A long first stall: the upper voices are re-placed and still nudging
    // toward the bass when the abandoned handover's deadline would fall.
    UPPER.forEach((code) => voice(code).hold(1.5));
    await run(500);
    engine.applyPreset("blend");
    await run(3700);

    expect(voice("B").volume).toBe(1);
    UPPER.forEach((code) => {
      expect(voice(code).volume).toBe(0);
    });

    await run(3000);
    UPPER.forEach((code) => {
      expect(voice(code).volume).toBe(1);
      expect(Math.abs(voice(code).currentTime - voice("B").currentTime)).toBeLessThanOrEqual(0.04);
    });
  });

  it("lets the replaced voice go at the deadline when a newcomer never settles", async () => {
    engine.load(piece, TRACKS);
    engine.applyPreset("solo-mine");
    await engine.play();
    await run(2000);
    UPPER.forEach((code) => {
      voice(code).stutter = { window: 100, run: 0.1, freeze: 0.2 };
    });

    engine.applyPreset("minus-mine");
    await run(3500);
    expect(voice("B").volume).toBe(1);

    await run(1000);
    expect(voice("B").volume).toBe(0);
    expect(voice("B").paused).toBe(true);
    UPPER.forEach((code) => {
      expect(voice(code).volume).toBe(0);
    });
  });
});
