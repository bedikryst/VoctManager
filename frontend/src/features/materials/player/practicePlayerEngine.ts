/**
 * @file practicePlayerEngine.ts
 * @description Framework-agnostic multitrack practice engine for the Songbook.
 *
 * Plays the voice tracks of a piece together through a pool of streaming
 * HTMLAudioElements (NOT decoded Web Audio buffers) so that:
 *  - audio streams instead of waiting for full downloads (mobile data),
 *  - playbackRate keeps pitch (preservesPitch) — slow practice stays in tune.
 *
 * Only the voices the chorister can hear run. A muted voice, or one silenced
 * by a solo, is paused and joins again as a newcomer (below) when it sounds
 * again. The blend over a tutti take and solo-mine therefore run exactly one
 * element: the everyday practice modes need no synchronisation at all, which
 * is the part phones get wrong.
 *
 * Mixing runs through a single shared AudioContext: each element feeds a
 * MediaElementAudioSourceNode → per-voice GainNode → master → destination.
 *  - iOS Safari refuses to play several independent <audio> elements from one
 *    gesture; unifying them into ONE AudioContext output (resumed on the tap)
 *    is what makes the choir sound on iPhone at all. iOS parks that context in
 *    "interrupted", not "suspended", after a call, Siri or another app's audio,
 *    so play() wakes it from any state short of running;
 *  - volume is gain, never element.volume, which iOS ignores outright.
 * Where Web Audio is unavailable the engine degrades to element.volume mixing.
 *
 * Nothing the chorister hears is ever seeked to keep time. After any seek iOS
 * plays an element stop-start for up to a second, with no `waiting` event and
 * readyState unchanged (measured 2026-11 on iOS 26 and 27): realigning a
 * running mix by seeking is a hole followed by a stutter, and the stutter
 * leaves the voices apart again, so it never converges.
 *  - A voice that joins a running mix (a preset tap, an unmute) starts muted,
 *    placed ahead by what the previous newcomers lost while settling. Once it
 *    has played steadily for a second it is brought onto the clock by a brief
 *    tempo nudge (pitch preserved) and faded in. The voices it replaces keep
 *    sounding until then — a handover — so a switch never drops to silence.
 *  - A heard voice that slips is nudged back the same way; one that slips
 *    past REJOIN_DRIFT_S fades out and comes back in as a newcomer.
 *  - Only a jump — the slider, the A–B loop — moves every voice at once (hold,
 *    seek, start together). The stutter that follows is the platform's; the
 *    nudges close the spread it leaves.
 * The transport clock is the first heard voice that plays steadily. A 250 ms
 * tick measures steadiness and drift and enforces the A–B practice loop.
 * Consumed by React via useSyncExternalStore (subscribe/getSnapshot).
 *
 * Every decision and every media event can be written to the opt-in
 * diagnostics log (practicePlayerDiagnostics) for measuring a real phone;
 * with the log off those calls return at once.
 */

import { practiceDiagnostics as diag } from "./practicePlayerDiagnostics";

export interface PracticeTrackSource {
  id: string;
  /** Raw voice-line code (S1, A2, …) — matches casting.voice_line. */
  voicePart: string;
  /** Human label, e.g. "Sopran 1" — or plain "Sopran" where the piece has one
   *  soprano line. Server-rendered inside this concert's arrangement. */
  label: string;
  url: string;
  isMine: boolean;
  /** Manager's note on this take, e.g. "od taktu 34, tempo 90". May be empty. */
  description: string;
}

/** The voice-line code of a take that already holds the whole choir. */
const TUTTI_VOICE_PART = "TUTTI";

/**
 * Which recording set of a piece is loaded. `practice` is the synced voice
 * set (Tutti + voices) the mixer works on; `tempo-giusto` is the conductor's
 * target-tempo take, played alone. Surfaces claim the engine only for their
 * own take — see [holdsTake].
 */
export type PracticeTake = "practice" | "tempo-giusto";

export interface PracticePieceSource {
  pieceId: string;
  projectId: string;
  title: string;
  composer: string;
  take: PracticeTake;
}

export interface PracticeLoopRange {
  a: number | null;
  b: number | null;
}

/**
 * One-tap mixing intents the chorister actually reaches for:
 *  - blend       → hear the whole choir balanced (every voice unmuted),
 *  - solo-mine   → only my voice, to learn the notes,
 *  - minus-mine  → everyone but me, to sing my line against the choir.
 * `null` means the mix was hand-tuned and no preset is active.
 */
export type PracticePreset = "blend" | "solo-mine" | "minus-mine";

export interface PracticePlayerSnapshot {
  piece: PracticePieceSource | null;
  tracks: PracticeTrackSource[];
  isPlaying: boolean;
  isBuffering: boolean;
  position: number;
  duration: number;
  rate: number;
  volumes: Readonly<Record<string, number>>;
  muted: Readonly<Record<string, boolean>>;
  soloTrackId: string | null;
  loop: PracticeLoopRange;
  activePreset: PracticePreset | null;
}

const EMPTY_SNAPSHOT: PracticePlayerSnapshot = {
  piece: null,
  tracks: [],
  isPlaying: false,
  isBuffering: false,
  position: 0,
  duration: 0,
  rate: 1,
  volumes: {},
  muted: {},
  soloTrackId: null,
  loop: { a: null, b: null },
  activePreset: null,
};

// A voice within this of the clock is in time — well inside the spread of a
// live choir, well above the noise of currentTime readings.
const ALIGN_TOLERANCE_S = 0.04;
// A heard voice this far off fades out and joins again: a tempo nudge would
// take seconds to close the gap, a muted newcomer's seek goes unheard.
const REJOIN_DRIFT_S = 0.3;
// A newcomer this far off is placed again rather than nudged.
const RESEEK_DRIFT_S = 1;
const TICK_INTERVAL_MS = 250;
// After a seek iOS plays stop-start for up to ~1 s, in runs of at most 0.36 s
// between freezes. A voice counts as steady after this many consecutive ticks
// (0.75 s, twice the longest run) of advancing at its own rate, and only then
// is it measured.
const STEADY_TICKS = 3;
const STEADY_RATIO_MIN = 0.7;
const STEADY_RATIO_MAX = 1.3;
// A tempo nudge closes |drift| over `horizonS`, clamped to [NUDGE_MIN, max].
// A heard voice moves gently (≤ 8 %); a muted newcomer nobody hears moves at
// up to half again or half its tempo, so a switch is not held up by it.
const NUDGE_HEARD = { horizonS: 1.5, max: 0.08 } as const;
const NUDGE_MUTED = { horizonS: 0.4, max: 0.5 } as const;
const NUDGE_MIN = 0.02;
// The ahead-placement of newcomers is learned from what they lose while
// settling (nothing on a desktop, ~0.5 s on iOS) and capped here.
const MAX_JOIN_LEAD_S = 1;
// Longest the replaced voices keep sounding while newcomers settle.
const HANDOVER_DEADLINE_MS = 4000;
// Gain ramps (time constants): a hard jump clicks ("zipper noise"). An
// entrance is softer than a mute so a voice arriving mid-phrase does not pop.
const GAIN_RAMP_S = 0.015;
const FADE_IN_S = 0.03;
// When a fading voice is silent enough (six time constants) to pause or seek.
const FADE_OUT_MS = 90;
// A voice this close to where it should be is left alone: a seek flushes the
// decoder, and on iOS it is slow.
const POSITION_EPSILON_S = 0.05;
// How long a resync waits for its slowest voice before starting anyway — one
// stuck stream must not hold the whole choir.
const RESYNC_SETTLE_MAX_MS = 1500;
const PREF_KEY_PREFIX = "voct.practice.pref.";
// Diagnostics only: a clock sample this often shows how coarsely each voice's
// currentTime advances, which the 250 ms tick cannot.
const DIAG_SAMPLE_INTERVAL_MS = 50;
const DIAG_MEDIA_EVENTS = [
  "play",
  "playing",
  "pause",
  "waiting",
  "stalled",
  "seeking",
  "seeked",
  "canplay",
  "canplaythrough",
  "ended",
  "error",
] as const;

type ResyncReason = "seek" | "loop";

const errorName = (error: unknown): string =>
  error instanceof Error ? error.name : String(error);

/** Seconds with an explicit sign, for drift in the diagnostics log. */
const signed = (seconds: number): string =>
  `${seconds >= 0 ? "+" : ""}${seconds.toFixed(3)}`;

/**
 * The practice tempos the mixer offers. A choir practises just under tempo —
 * 90 % and 95 % are the steps a rehearsal actually uses — and below ~85 %
 * pitch-preserving time-stretch audibly smears the voices.
 */
export const PRACTICE_RATES = [0.85, 0.9, 0.95, 1] as const;

/** The offered tempo closest to `rate` — a remembered tempo from an older
 *  set of steps must still land on a step the mixer can show as active. */
const nearestPracticeRate = (rate: number): number =>
  PRACTICE_RATES.reduce<number>(
    (best, step) => (Math.abs(step - rate) < Math.abs(best - rate) ? step : best),
    1,
  );

type AudioContextCtor = typeof AudioContext;

/** Resolves the (possibly webkit-prefixed) AudioContext constructor, or null. */
const resolveAudioContextCtor = (): AudioContextCtor | null => {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor })
      .webkitAudioContext ??
    null
  );
};

/** Done seeking and holding enough data to play on — the only state in which
 *  an element's currentTime is where it will actually sound. */
const isSettled = (el: HTMLAudioElement): boolean =>
  !el.seeking && el.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA;

/** Resolves true once every element is settled, false when
 *  RESYNC_SETTLE_MAX_MS runs out first. */
const settle = (elements: HTMLAudioElement[]): Promise<boolean> =>
  new Promise((resolve) => {
    if (elements.every(isSettled)) {
      resolve(true);
      return;
    }
    const watch = new AbortController();
    const timer = window.setTimeout(() => {
      watch.abort();
      resolve(false);
    }, RESYNC_SETTLE_MAX_MS);
    const check = (): void => {
      if (!elements.every(isSettled)) return;
      window.clearTimeout(timer);
      watch.abort();
      resolve(true);
    };
    elements.forEach((el) => {
      el.addEventListener("seeked", check, { signal: watch.signal });
      el.addEventListener("canplay", check, { signal: watch.signal });
    });
  });

interface PersistedPref {
  rate?: number;
  preset?: PracticePreset | null;
}

/**
 * Mute map for a preset given the piece's tracks (used on load + on tap).
 *
 * A tutti take is the whole choir already recorded together, so where one
 * exists it IS the blend — stacking the per-voice takes on top of it would
 * double every line against a mix that is usually the better-balanced take.
 * Only the first tutti plays; a second one is an alternative take, not a
 * second choir. For the same reason a tutti carries the chorister's own line
 * and has to go silent in minus-mine.
 */
const mutedForPreset = (
  tracks: PracticeTrackSource[],
  preset: PracticePreset,
): Record<string, boolean> => {
  const blendTrackId =
    tracks.find((track) => track.voicePart === TUTTI_VOICE_PART)?.id ?? null;
  const muted: Record<string, boolean> = {};
  tracks.forEach((track) => {
    const isTutti = track.voicePart === TUTTI_VOICE_PART;
    muted[track.id] =
      preset === "blend"
        ? blendTrackId !== null && track.id !== blendTrackId
        : preset === "solo-mine"
          ? !track.isMine
          : track.isMine || isTutti; // minus-mine
  });
  return muted;
};

/** True when the engine holds this piece's `take` — and so its transport is
 *  the one a surface for that take should show and drive. */
export const holdsTake = (
  snapshot: PracticePlayerSnapshot,
  pieceId: string,
  take: PracticeTake,
): boolean => snapshot.piece?.pieceId === pieceId && snapshot.piece.take === take;

type Listener = () => void;

/**
 * Where a voice stands in the running mix:
 *  - idle     — paused, silent;
 *  - live     — running and heard at its mix level;
 *  - joining  — running muted until it plays steadily on the clock;
 *  - leaving  — replaced, still heard until the newcomers are in (handover),
 *               or fading out once `fadeTimer` is set.
 */
type VoicePhase = "idle" | "live" | "joining" | "leaving";

interface VoiceState {
  id: string;
  /** Voice code (S1, A, TUTTI…) — the diagnostics log's name for it. */
  label: string;
  phase: VoicePhase;
  /** Consecutive ticks this voice advanced at its own rate. */
  steadyTicks: number;
  lastSampleMs: number | null;
  lastSampleTime: number;
  /** Restores the base tempo when a nudge has closed the drift. */
  nudgeTimer: number | null;
  /** Pauses (leaving) or re-places (rejoining) the voice once faded out. */
  fadeTimer: number | null;
  /** Ahead-placement of a newcomer, until its first steady reading. */
  lead: number | null;
}

type NudgeProfile = { readonly horizonS: number; readonly max: number };

export class PracticePlayerEngine {
  private elements = new Map<string, HTMLAudioElement>();
  private states = new WeakMap<HTMLAudioElement, VoiceState>();
  private tickHandle: number | null = null;
  private sampleHandle: number | null = null;
  private listeners = new Set<Listener>();
  private snapshot: PracticePlayerSnapshot = EMPTY_SNAPSHOT;

  /** Detaches every media-event listener of the loaded piece at once. */
  private elementEvents: AbortController | null = null;
  /** Bumped by anything that supersedes a pending start — pause, a newer
   *  resync, another piece — so a late-settling resync never starts voices. */
  private syncToken = 0;
  private resyncing = false;
  /** How far ahead newcomers are placed — learned from what they lose. */
  private joinLeadS = 0;
  private hasLearnedLead = false;
  /** When replaced voices stop waiting for newcomers (performance.now ms). */
  private handoverDeadline: number | null = null;

  // Web Audio mixing graph — one shared context reused across every load()
  // (browsers cap live AudioContexts, and iOS counts each as an audio channel).
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sources = new Map<string, MediaElementAudioSourceNode>();
  private gains = new Map<string, GainNode>();

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): PracticePlayerSnapshot => this.snapshot;

  /**
   * Replaces the loaded piece. Restores the chorister's remembered tempo and
   * preset for this piece (falling back to the global rate between pieces), so
   * reopening a piece drops them straight back into how they last practised it.
   *
   * The tempo giusto take is exempt: it IS the target tempo, so it always
   * plays at 1x and neither reads nor overwrites the practice prefs.
   */
  load(
    piece: PracticePieceSource,
    tracks: PracticeTrackSource[],
    options?: { soloTrackId?: string | null; autoplay?: boolean },
  ): void {
    this.disposeElements();
    // Created inside the tap that triggered load() → allowed to start on iOS.
    this.ensureContext();

    const isPractice = piece.take === "practice";
    const pref = isPractice ? this.readPref(piece.pieceId) : null;
    const rate = isPractice
      ? nearestPracticeRate(pref?.rate ?? this.snapshot.rate)
      : 1;

    const hasMine = tracks.some((track) => track.isMine);
    // A solo/minus preset is meaningless without the chorister's own track.
    // With nothing remembered the practice take opens on the blend, so a piece
    // with a tutti take plays that take alone instead of every track stacked.
    const rememberedPreset: PracticePreset | null =
      pref?.preset && (pref.preset === "blend" || hasMine) ? pref.preset : null;
    const activePreset: PracticePreset | null =
      rememberedPreset ?? (isPractice ? "blend" : null);

    const volumes: Record<string, number> = {};
    const muted: Record<string, boolean> = activePreset
      ? mutedForPreset(tracks, activePreset)
      : {};

    const events = new AbortController();
    this.elementEvents = events;
    const { signal } = events;

    tracks.forEach((track) => {
      const el = new Audio();
      // MediaElementSource silences cross-origin media without CORS; anonymous
      // is harmless same-origin (prod nginx /media) and correct when it isn't.
      el.crossOrigin = "anonymous";
      el.src = track.url;
      el.preload = "auto";
      // Pitch-preserving tempo change is the whole point of slow practice.
      el.preservesPitch = true;
      el.playbackRate = rate;
      // Element level stays at full; the mix is applied on the GainNode.
      el.volume = 1;
      el.addEventListener("loadedmetadata", this.handleMetadata, { signal });
      el.addEventListener("ended", () => this.handleEnded(el), { signal });
      el.addEventListener("waiting", () => this.handleWaiting(el), { signal });
      el.addEventListener("playing", () => this.handlePlaying(el), { signal });
      el.addEventListener("play", () => this.handlePlay(el), { signal });
      el.addEventListener("pause", () => this.handlePause(el), { signal });
      DIAG_MEDIA_EVENTS.forEach((type) => {
        el.addEventListener(type, () => this.logMediaEvent(el, type), { signal });
      });
      this.states.set(el, {
        id: track.id,
        label: track.voicePart,
        phase: "idle",
        steadyTicks: 0,
        lastSampleMs: null,
        lastSampleTime: 0,
        nudgeTimer: null,
        fadeTimer: null,
        lead: null,
      });
      this.elements.set(track.id, el);
      this.connectToGraph(track.id, el);
      volumes[track.id] = 1;
      muted[track.id] ??= false;
    });

    this.commit({
      ...EMPTY_SNAPSHOT,
      piece,
      tracks,
      rate,
      volumes,
      muted,
      soloTrackId: options?.soloTrackId ?? null,
      activePreset,
    });
    if (diag.enabled) {
      const voices = tracks
        .map((track) => `${track.voicePart}${track.isMine ? "*" : ""}`)
        .join(",");
      diag.event(
        `load ${piece.take} ${voices} rate=${rate} preset=${activePreset ?? "-"}`,
      );
      this.logContext();
    }
    this.applyMix();

    if (options?.autoplay) {
      void this.play();
    }
  }

  async play(): Promise<void> {
    if (!this.snapshot.piece || this.elements.size === 0) return;

    // On the same gesture that reached play(): every voice runs through the
    // graph, so a context that is not rendering turns them all into silence.
    this.wakeContext();

    if (this.snapshot.isPlaying) {
      this.applyMix();
      return;
    }

    this.cancelResync();
    const token = this.syncToken;
    const position = this.snapshot.position;
    diag.event(`play at ${position.toFixed(3)}`);
    this.commit({ ...this.snapshot, isPlaying: true });
    this.startTick();

    // Every voice starts here, inside the gesture: iOS lets an element play
    // later without one only once it has played inside one. A voice already
    // at the position starts clean and is heard at once; one that has to seek
    // first comes in muted behind them, as a newcomer. When every voice has to
    // seek (a slider move while paused) they all start heard: there is nothing
    // to hand over from.
    const voices = this.participants();
    const inPlace = voices.filter(
      (el) => Math.abs(el.currentTime - position) <= POSITION_EPSILON_S,
    );
    const started = await Promise.all(
      voices.map((el) =>
        inPlace.length > 0 && !inPlace.includes(el)
          ? this.join(el, position)
          : this.startLive(el, position),
      ),
    );
    if (token === this.syncToken && this.snapshot.isPlaying && !started.some(Boolean)) {
      // Nothing would play — show a stopped transport, not a silent running one.
      this.stopTick();
      this.commit({ ...this.snapshot, isPlaying: false, isBuffering: false });
    }
  }

  pause(): void {
    const position = this.transportPosition();
    diag.event(`pause at ${position.toFixed(3)}`);
    this.cancelResync();
    this.elements.forEach((el) => this.stopVoice(el));
    this.handoverDeadline = null;
    this.stopTick();
    this.commit({
      ...this.snapshot,
      isPlaying: false,
      isBuffering: false,
      position,
    });
  }

  toggle(): void {
    if (this.snapshot.isPlaying) {
      this.pause();
    } else {
      void this.play();
    }
  }

  seek(seconds: number): void {
    const clamped = Math.max(
      0,
      Math.min(seconds, this.snapshot.duration || seconds),
    );
    if (this.snapshot.isPlaying) {
      this.resync(clamped, "seek");
      return;
    }
    // Parked voices move now, so they are buffered there by the next play().
    this.participants().forEach((el) => {
      el.currentTime = clamped;
    });
    this.commit({ ...this.snapshot, position: clamped });
  }

  setRate(rate: number): void {
    // Commit first: a nudge's restore reads the base tempo from the snapshot.
    this.commit({ ...this.snapshot, rate });
    this.elements.forEach((el) => {
      this.cancelNudge(this.stateOf(el), el);
    });
    this.persistPref();
  }

  /**
   * Applies a one-tap mix intent across every voice (blend / solo-mine /
   * minus-mine). No-op for a solo/minus preset when the chorister has no own
   * track, so the UI can never tap the choir into silence.
   */
  applyPreset(preset: PracticePreset): void {
    const { tracks } = this.snapshot;
    if (tracks.length === 0) return;
    if (preset !== "blend" && !tracks.some((track) => track.isMine)) return;

    diag.mark(`preset ${preset}`);
    this.commit({
      ...this.snapshot,
      muted: mutedForPreset(tracks, preset),
      soloTrackId: null,
      activePreset: preset,
    });
    this.applyMix();
    this.persistPref();
  }

  setVolume(trackId: string, volume: number): void {
    const volumes = { ...this.snapshot.volumes, [trackId]: volume };
    this.commit({ ...this.snapshot, volumes });
    this.applyMix();
  }

  toggleMute(trackId: string): void {
    const muted = {
      ...this.snapshot.muted,
      [trackId]: !this.snapshot.muted[trackId],
    };
    // A hand-tuned mute breaks the preset abstraction — drop the badge.
    this.commit({ ...this.snapshot, muted, activePreset: null });
    this.applyMix();
    this.persistPref();
  }

  /**
   * Solo is exclusive; passing the active solo id (or null) clears it. The
   * soloed track is unmuted too: the blend mutes every voice under a tutti
   * take, and a solo on a muted voice would otherwise be silence.
   */
  setSolo(trackId: string | null): void {
    const soloTrackId =
      trackId && this.snapshot.soloTrackId !== trackId ? trackId : null;
    const muted = soloTrackId
      ? { ...this.snapshot.muted, [soloTrackId]: false }
      : this.snapshot.muted;
    this.commit({ ...this.snapshot, muted, soloTrackId, activePreset: null });
    this.applyMix();
  }

  setLoopPointA(): void {
    const position = this.transportPosition();
    const b = this.snapshot.loop.b;
    this.commit({
      ...this.snapshot,
      loop: { a: position, b: b !== null && b <= position ? null : b },
    });
  }

  setLoopPointB(): void {
    const position = this.transportPosition();
    const a = this.snapshot.loop.a;
    if (a === null || position <= a) return;
    this.commit({ ...this.snapshot, loop: { a, b: position } });
  }

  clearLoop(): void {
    this.commit({ ...this.snapshot, loop: { a: null, b: null } });
  }

  /** Stops playback and unloads the piece entirely (mini-player close). */
  close(): void {
    this.disposeElements();
    this.commit({ ...EMPTY_SNAPSHOT, rate: this.snapshot.rate });
  }

  destroy(): void {
    this.disposeElements();
    if (this.audioCtx) {
      void this.audioCtx.close();
      this.audioCtx = null;
      this.masterGain = null;
    }
    this.listeners.clear();
    this.snapshot = EMPTY_SNAPSHOT;
  }

  // ── internals ────────────────────────────────────────────────────────────

  /**
   * The voices that sound under the current mix — unmuted and not silenced by
   * a solo — in track order. With every voice silenced the first one still
   * runs, inaudibly, so the transport keeps a clock.
   */
  private participantIds(): string[] {
    const { tracks, muted, soloTrackId } = this.snapshot;
    const sounding = tracks
      .filter(
        (track) =>
          !muted[track.id] && (soloTrackId === null || soloTrackId === track.id),
      )
      .map((track) => track.id);
    if (sounding.length > 0) return sounding;
    const first = tracks[0];
    return first ? [first.id] : [];
  }

  private participants(): HTMLAudioElement[] {
    return this.participantIds().flatMap((id) => {
      const el = this.elements.get(id);
      return el ? [el] : [];
    });
  }

  /**
   * The transport clock: the first heard voice that plays steadily — a live
   * one, else one still sounding in a handover. Never a muted newcomer while
   * anything is heard: one that is still settling must not drag the voices
   * someone hears. With nothing heard (stopped, or every voice settling) the
   * first sounding voice stands in.
   */
  private clock(): HTMLAudioElement | null {
    const heard: HTMLAudioElement[] = [];
    this.participants().forEach((el) => {
      if (this.stateOf(el).phase === "live" && !el.paused) heard.push(el);
    });
    this.elements.forEach((el) => {
      const state = this.stateOf(el);
      if (state.phase === "leaving" && state.fadeTimer === null && !el.paused) {
        heard.push(el);
      }
    });
    return (
      heard.find((el) => this.isSteady(el)) ??
      heard[0] ??
      this.participants()[0] ??
      null
    );
  }

  /** Where the transport is now: the clock while it runs, else any running
   *  voice, else the last committed position (paused, or held by a resync). */
  private transportPosition(): number {
    const clock = this.clock();
    if (clock && !clock.paused) return clock.currentTime;
    for (const el of this.elements.values()) {
      if (!el.paused) return el.currentTime;
    }
    return this.snapshot.position;
  }

  /** Resumes the mixing context from "suspended" and from iOS's "interrupted"
   *  alike. Gesture-gated on iOS, so callers run it inside the tap. */
  private wakeContext(): void {
    const ctx = this.audioCtx;
    if (!ctx || ctx.state === "running" || ctx.state === "closed") return;
    void ctx.resume().catch(() => undefined);
  }

  /** Moves a voice to `position` unless it is already there. */
  private placeAt(el: HTMLAudioElement, position: number): void {
    if (Math.abs(el.currentTime - position) > POSITION_EPSILON_S) {
      el.currentTime = position;
    }
  }

  /** Starts a voice heard at once at `position`; resolves whether it plays. */
  private startLive(el: HTMLAudioElement, position: number): Promise<boolean> {
    const state = this.stateOf(el);
    state.phase = "live";
    this.setGain(el, this.levelOf(state.id), GAIN_RAMP_S);
    return this.startVoice(el, position);
  }

  /**
   * Starts a voice muted, placed ahead of `position` by the learned lead; the
   * tick fades it in once it plays steadily on the clock.
   */
  private join(el: HTMLAudioElement, position: number): Promise<boolean> {
    const state = this.stateOf(el);
    state.phase = "joining";
    state.lead = this.joinLeadS;
    this.setGain(el, 0, GAIN_RAMP_S);
    return this.startVoice(el, position + this.joinLeadS);
  }

  private startVoice(el: HTMLAudioElement, position: number): Promise<boolean> {
    const from = el.currentTime;
    this.placeAt(el, position);
    this.resetSteadiness(this.stateOf(el));
    const askedAt = performance.now();
    return el.play().then(
      () => {
        diag.event(
          `started ${this.label(el)} ${this.stateOf(el).phase} ${from.toFixed(3)}→${position.toFixed(3)} in ${this.since(askedAt)}`,
        );
        return true;
      },
      (error: unknown) => {
        diag.event(`play rejected ${this.label(el)} ${errorName(error)}`);
        return false;
      },
    );
  }

  /** Pauses a voice and returns it to idle, cancelling its nudge and fade. */
  private stopVoice(el: HTMLAudioElement): void {
    const state = this.stateOf(el);
    this.cancelNudge(state, el);
    if (state.fadeTimer !== null) {
      window.clearTimeout(state.fadeTimer);
      state.fadeTimer = null;
    }
    state.phase = "idle";
    state.lead = null;
    this.resetSteadiness(state);
    if (!el.paused) el.pause();
  }

  /** Fades a replaced voice out, then pauses it. */
  private fadeOut(el: HTMLAudioElement): void {
    const state = this.stateOf(el);
    if (state.fadeTimer !== null) return;
    state.phase = "leaving";
    this.setGain(el, 0, GAIN_RAMP_S);
    state.fadeTimer = window.setTimeout(() => {
      state.fadeTimer = null;
      this.stopVoice(el);
    }, FADE_OUT_MS);
  }

  /**
   * While playing, makes the running voices match the mix. Runs inside the tap
   * that changed it, so a voice that never played may still start (iOS
   * gesture rule).
   *  - A voice that stays in the mix is not touched: never seeked, never held.
   *  - A voice that arrives joins muted while anything is heard (see join),
   *    and starts heard when nothing is.
   *  - A voice that departs fades out at once if a heard voice stays;
   *    otherwise it keeps sounding until the newcomers are in — the handover.
   */
  private reconcile(): void {
    if (!this.snapshot.isPlaying) return;
    const position = this.transportPosition();
    const wanted = new Set(this.participantIds());
    const arriving: HTMLAudioElement[] = [];
    const departing: HTMLAudioElement[] = [];
    let carried = false;
    this.elements.forEach((el, id) => {
      const state = this.stateOf(el);
      if (wanted.has(id)) {
        if (state.phase === "leaving") {
          // Wanted again before it went: back in at its mix level.
          if (state.fadeTimer !== null) {
            window.clearTimeout(state.fadeTimer);
            state.fadeTimer = null;
          }
          state.phase = "live";
        }
        if (state.phase === "live" && !el.paused) {
          carried = true;
        } else if (state.phase !== "joining" || el.paused) {
          arriving.push(el);
        }
        return;
      }
      if (state.phase === "joining") {
        this.stopVoice(el); // Muted: nothing to fade.
      } else if (state.phase === "live" || state.phase === "leaving") {
        departing.push(el);
      }
    });

    if (this.resyncing) {
      // The pending resync starts every wanted voice when it releases.
      arriving.forEach((el) => this.placeAt(el, position));
      departing.forEach((el) => this.stopVoice(el));
      return;
    }

    const heard =
      carried ||
      departing.some((el) => !el.paused && this.stateOf(el).fadeTimer === null);
    arriving.forEach((el) => {
      void (heard ? this.join(el, position) : this.startLive(el, position));
    });
    const waiting = this.participants().some(
      (el) => this.stateOf(el).phase === "joining",
    );
    const handover = !carried && waiting;
    departing.forEach((el) => {
      if (handover) {
        this.stateOf(el).phase = "leaving";
      } else {
        this.fadeOut(el);
      }
    });
    // A heard voice that stays ends any handover: the newcomers then come in
    // only once aligned, with nothing to wait for.
    this.handoverDeadline = handover
      ? (this.handoverDeadline ?? performance.now() + HANDOVER_DEADLINE_MS)
      : null;

    if (arriving.length > 0 || departing.length > 0) {
      diag.event(
        `reconcile at ${position.toFixed(3)} ${heard ? "join" : "start"}=${this.labelsOf(arriving)} ${handover ? "hold" : "fade"}=${this.labelsOf(departing)}`,
      );
    }
  }

  /**
   * A jump: moves every wanted voice to `position` — hold them all, seek them
   * all, then start them in the same task once each reports settled, so they
   * leave the line together however long each seek took. A jump replaces
   * whatever was heard: voices on their way out go now, newcomers are heard
   * from the jump on. A single voice has nothing to align with and simply
   * seeks.
   */
  private resync(position: number, reason: ResyncReason): void {
    this.cancelResync();
    this.handoverDeadline = null;
    this.elements.forEach((el) => {
      if (this.stateOf(el).phase === "leaving") this.stopVoice(el);
    });
    const voices = this.participants();
    voices.forEach((el) => {
      const state = this.stateOf(el);
      this.cancelNudge(state, el);
      state.phase = "live";
      state.lead = null;
      this.resetSteadiness(state);
    });
    this.applyGains();
    if (voices.length <= 1) {
      const [voice] = voices;
      diag.event(`seek ${reason} ${voice ? this.label(voice) : "-"} to ${position.toFixed(3)}`);
      if (voice) {
        voice.currentTime = position;
        if (voice.paused) void voice.play().catch(() => undefined);
      }
      this.commit({ ...this.snapshot, position });
      return;
    }

    const token = this.syncToken;
    this.resyncing = true;
    diag.noteResync();
    diag.event(
      `resync ${reason} to ${position.toFixed(3)} hold ${this.labelsOf(voices)}`,
    );
    voices.forEach((el) => el.pause());
    voices.forEach((el) => {
      el.currentTime = position;
    });
    this.commit({ ...this.snapshot, position, isBuffering: true });

    const heldAt = performance.now();
    void settle(voices).then((settled) => {
      if (token !== this.syncToken) {
        diag.event(`resync superseded after ${this.since(heldAt)}`);
        return;
      }
      this.resyncing = false;
      if (!this.snapshot.isPlaying) return;
      diag.noteSettle(Math.round(performance.now() - heldAt));
      diag.event(
        `release after ${this.since(heldAt)}${settled ? "" : " TIMEOUT"} ${voices.map((el) => this.describe(el)).join(" ")}`,
      );
      const releasedAt = performance.now();
      // Re-read: the mix may have changed while the voices were held.
      this.participants().forEach((el) => {
        const state = this.stateOf(el);
        state.phase = "live";
        this.resetSteadiness(state);
        this.placeAt(el, position);
        void el.play().then(
          () => diag.event(`resumed ${this.label(el)} in ${this.since(releasedAt)}`),
          (error: unknown) =>
            diag.event(`play rejected ${this.label(el)} ${errorName(error)}`),
        );
      });
      this.applyGains();
      this.commit({ ...this.snapshot, isBuffering: false });
    });
  }

  private cancelResync(): void {
    this.syncToken += 1;
    this.resyncing = false;
  }

  /**
   * Brings every running voice onto the clock once both play steadily — a
   * reading taken while iOS still stutters after a seek says nothing about
   * where the voice will settle. A newcomer within tolerance fades in; one
   * further off is nudged (muted, so hard) or placed again. A heard voice is
   * nudged gently, or rejoins when too far off. Observe mode only measures.
   */
  private align(clock: HTMLAudioElement): void {
    if (!this.isSteady(clock)) return;
    if (this.stateOf(clock).phase === "joining") {
      // Nothing heard to align to: the first steady newcomer is the clock.
      this.admit(clock, 0);
    }
    const reference = clock.currentTime;
    const readings: string[] = [];
    this.participants().forEach((el) => {
      if (el === clock || el.paused) return;
      const state = this.stateOf(el);
      if (state.phase !== "live" && state.phase !== "joining") return;
      const drift = el.currentTime - reference;
      const steady = this.isSteady(el);
      readings.push(
        `${state.label}${state.phase === "joining" ? "~" : ""}${signed(drift)}${steady ? "" : "?"}`,
      );
      if (!steady || state.nudgeTimer !== null || state.fadeTimer !== null) return;
      const off = Math.abs(drift);
      if (state.phase === "joining") {
        this.learnLead(state, drift);
        if (off <= ALIGN_TOLERANCE_S || diag.observeOnly) {
          this.admit(el, drift);
        } else if (off > RESEEK_DRIFT_S) {
          this.place(el, reference, "reseek");
        } else {
          this.nudge(el, drift, NUDGE_MUTED);
        }
        return;
      }
      if (off <= ALIGN_TOLERANCE_S || diag.observeOnly) return;
      if (off > REJOIN_DRIFT_S) {
        this.rejoin(el, drift);
      } else {
        this.nudge(el, drift, NUDGE_HEARD);
      }
    });
    if (diag.enabled && readings.length > 0) {
      diag.sample(`tick ${this.describe(clock)} drift ${readings.join(" ")}`);
    }
  }

  /** A newcomer's first steady reading teaches the next newcomers' lead: it
   *  was placed `lead` ahead and landed `drift` off the clock. */
  private learnLead(state: VoiceState, drift: number): void {
    if (state.lead === null) return;
    const lost = Math.min(MAX_JOIN_LEAD_S, Math.max(0, state.lead - drift));
    this.joinLeadS = this.hasLearnedLead ? (this.joinLeadS + lost) / 2 : lost;
    this.hasLearnedLead = true;
    diag.event(
      `lead ${state.label} placed +${state.lead.toFixed(3)} landed ${signed(drift)} → next +${this.joinLeadS.toFixed(3)}`,
    );
    state.lead = null;
  }

  /** Fades a newcomer in. The last one in ends the handover. */
  private admit(el: HTMLAudioElement, drift: number): void {
    const state = this.stateOf(el);
    this.cancelNudge(state, el);
    state.phase = "live";
    state.lead = null;
    this.setGain(el, this.levelOf(state.id), FADE_IN_S);
    diag.event(`admit ${state.label} at ${signed(drift)}`);
    const waiting = this.participants().some(
      (voice) => this.stateOf(voice).phase === "joining",
    );
    if (!waiting) this.endHandover();
  }

  /** The replaced voices fade out: the newcomers are in, or waited too long. */
  private endHandover(): void {
    this.handoverDeadline = null;
    this.elements.forEach((el) => {
      if (this.stateOf(el).phase === "leaving") this.fadeOut(el);
    });
  }

  /** Past the deadline, steady newcomers come in as they are (heard nudges
   *  finish the alignment) and the replaced voices go. One still stuttering
   *  stays muted until it settles. */
  private expireHandover(): void {
    diag.event("handover deadline");
    const clock = this.clock();
    this.participants().forEach((el) => {
      if (this.stateOf(el).phase === "joining" && this.isSteady(el)) {
        this.admit(el, clock ? el.currentTime - clock.currentTime : 0);
      }
    });
    this.endHandover();
  }

  /**
   * Closes `drift` by a temporary tempo change (pitch preserved): slower when
   * ahead, faster when behind, back to the base tempo when the gap should be
   * closed. The next steady reading checks the result.
   */
  private nudge(el: HTMLAudioElement, drift: number, profile: NudgeProfile): void {
    const state = this.stateOf(el);
    const base = this.snapshot.rate;
    const fraction = Math.min(
      profile.max,
      Math.max(NUDGE_MIN, Math.abs(drift) / profile.horizonS),
    );
    el.playbackRate = base * (drift > 0 ? 1 - fraction : 1 + fraction);
    const closeMs = (Math.abs(drift) / (fraction * base)) * 1000;
    state.nudgeTimer = window.setTimeout(() => {
      state.nudgeTimer = null;
      el.playbackRate = this.snapshot.rate;
    }, closeMs);
    diag.noteNudge(Math.abs(drift));
    diag.event(
      `nudge ${state.label} ${signed(drift)} ×${el.playbackRate.toFixed(3)} for ${Math.round(closeMs)}ms`,
    );
  }

  private cancelNudge(state: VoiceState, el: HTMLAudioElement): void {
    if (state.nudgeTimer !== null) {
      window.clearTimeout(state.nudgeTimer);
      state.nudgeTimer = null;
    }
    if (el.playbackRate !== this.snapshot.rate) el.playbackRate = this.snapshot.rate;
  }

  /** A heard voice too far off fades out, is placed again once silent, and
   *  comes back in as a newcomer. */
  private rejoin(el: HTMLAudioElement, drift: number): void {
    const state = this.stateOf(el);
    state.phase = "joining";
    this.setGain(el, 0, GAIN_RAMP_S);
    diag.noteRejoin();
    diag.event(`rejoin ${state.label} at ${signed(drift)}`);
    state.fadeTimer = window.setTimeout(() => {
      state.fadeTimer = null;
      const clock = this.clock();
      if (clock && clock !== el) this.place(el, clock.currentTime, "rejoin");
    }, FADE_OUT_MS);
  }

  /** Seeks a muted newcomer ahead of the clock by the learned lead. */
  private place(el: HTMLAudioElement, reference: number, why: string): void {
    const state = this.stateOf(el);
    const target = reference + this.joinLeadS;
    state.lead = this.joinLeadS;
    el.currentTime = target;
    this.resetSteadiness(state);
    diag.event(`${why} ${state.label} to ${target.toFixed(3)}`);
  }

  /** Counts, per running voice, the consecutive ticks it advanced at its own
   *  rate while settled. A seek, a freeze or a starved buffer starts over. */
  private measureSteadiness(now: number): void {
    this.elements.forEach((el) => {
      const state = this.stateOf(el);
      if (el.paused) {
        this.resetSteadiness(state);
        return;
      }
      if (state.lastSampleMs !== null) {
        const expected = ((now - state.lastSampleMs) / 1000) * el.playbackRate;
        const ratio =
          expected > 0 ? (el.currentTime - state.lastSampleTime) / expected : 0;
        const steady =
          isSettled(el) && ratio >= STEADY_RATIO_MIN && ratio <= STEADY_RATIO_MAX;
        state.steadyTicks = steady ? state.steadyTicks + 1 : 0;
      }
      state.lastSampleMs = now;
      state.lastSampleTime = el.currentTime;
    });
  }

  private resetSteadiness(state: VoiceState): void {
    state.steadyTicks = 0;
    state.lastSampleMs = null;
  }

  private isSteady(el: HTMLAudioElement): boolean {
    return this.stateOf(el).steadyTicks >= STEADY_TICKS;
  }

  private stateOf(el: HTMLAudioElement): VoiceState {
    const state = this.states.get(el);
    if (!state) throw new Error("PracticePlayerEngine: element has no voice state");
    return state;
  }

  /** A voice's level in the mix: its fader, or 0 when muted or outside a solo. */
  private levelOf(id: string): number {
    const { volumes, muted, soloTrackId } = this.snapshot;
    const soloSilenced = soloTrackId !== null && soloTrackId !== id;
    return soloSilenced || muted[id] ? 0 : (volumes[id] ?? 1);
  }

  private setGain(el: HTMLAudioElement, value: number, timeConstant: number): void {
    const gain = this.gains.get(this.stateOf(el).id);
    if (gain && this.audioCtx) {
      gain.gain.setTargetAtTime(value, this.audioCtx.currentTime, timeConstant);
    } else {
      el.volume = value; // Fallback: no Web Audio graph for this track.
    }
  }

  /** Sets every voice's gain from its phase: live at its mix level, newcomers
   *  and idle voices silent. A leaving voice keeps its own — it is either
   *  still carrying a handover or already fading out. */
  private applyGains(): void {
    this.elements.forEach((el) => {
      const state = this.stateOf(el);
      if (state.phase === "leaving") return;
      this.setGain(el, state.phase === "live" ? this.levelOf(state.id) : 0, GAIN_RAMP_S);
    });
  }

  /** Lazily builds the shared context + master gain (once per engine life). */
  private ensureContext(): void {
    if (this.audioCtx) return;
    const Ctor = resolveAudioContextCtor();
    if (!Ctor) return; // No Web Audio → applyMix falls back to element.volume.
    try {
      const ctx = new Ctor();
      this.audioCtx = ctx;
      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = 1;
      this.masterGain.connect(ctx.destination);
      // iOS reports "interrupted" here, a state the DOM typings do not name.
      ctx.addEventListener("statechange", () => diag.event(`ctx ${ctx.state}`));
    } catch {
      this.audioCtx = null;
      this.masterGain = null;
    }
  }

  /**
   * Routes one element into the mixing graph. createMediaElementSource can only
   * be called once per element (fine — elements are freshly built each load).
   * Failure leaves the track out of the graph; applyMix then mixes it by volume.
   */
  private connectToGraph(id: string, el: HTMLAudioElement): void {
    if (!this.audioCtx || !this.masterGain) return;
    try {
      const source = this.audioCtx.createMediaElementSource(el);
      const gain = this.audioCtx.createGain();
      gain.gain.value = 1;
      source.connect(gain).connect(this.masterGain);
      this.sources.set(id, source);
      this.gains.set(id, gain);
    } catch {
      // Leave ungraphed — element.volume fallback keeps this voice audible.
    }
  }

  /** Remembers tempo + preset per piece so practice picks up where it left off. */
  private persistPref(): void {
    const piece = this.snapshot.piece;
    if (!piece || piece.take !== "practice" || typeof localStorage === "undefined") {
      return;
    }
    const pieceId = piece.pieceId;
    try {
      const pref: PersistedPref = {
        rate: this.snapshot.rate,
        preset: this.snapshot.activePreset,
      };
      localStorage.setItem(PREF_KEY_PREFIX + pieceId, JSON.stringify(pref));
    } catch {
      // Private mode / quota — practice prefs are best-effort, never fatal.
    }
  }

  private readPref(pieceId: string): PersistedPref | null {
    if (typeof localStorage === "undefined") return null;
    try {
      const raw = localStorage.getItem(PREF_KEY_PREFIX + pieceId);
      return raw ? (JSON.parse(raw) as PersistedPref) : null;
    } catch {
      return null;
    }
  }

  /** The clock's length once known; until then the longest known voice. iOS
   *  loads only the voices that play, so a silent one may never report. */
  private handleMetadata = (): void => {
    const clock = this.clock();
    let duration = clock && Number.isFinite(clock.duration) ? clock.duration : 0;
    if (duration === 0) {
      this.elements.forEach((el) => {
        if (Number.isFinite(el.duration)) duration = Math.max(duration, el.duration);
      });
    }
    if (duration !== this.snapshot.duration) {
      this.commit({ ...this.snapshot, duration });
    }
  };

  private handleEnded(el: HTMLAudioElement): void {
    if (el !== this.clock() || !this.snapshot.isPlaying) return;
    const { loop } = this.snapshot;
    if (loop.a !== null && loop.b !== null) {
      this.resync(loop.a, "loop");
      return;
    }
    this.cancelResync();
    this.stopTick();
    this.elements.forEach((voice) => this.stopVoice(voice));
    this.handoverDeadline = null;
    this.commit({
      ...this.snapshot,
      isPlaying: false,
      isBuffering: false,
      position: 0,
    });
    this.participants().forEach((voice) => {
      voice.currentTime = 0;
    });
  }

  private handleWaiting(el: HTMLAudioElement): void {
    if (el === this.clock() && !this.snapshot.isBuffering) {
      this.commit({ ...this.snapshot, isBuffering: true });
    }
  }

  private handlePlaying(el: HTMLAudioElement): void {
    if (el === this.clock() && this.snapshot.isBuffering && !this.resyncing) {
      this.commit({ ...this.snapshot, isBuffering: false });
    }
  }

  /** The engine alone decides what plays: an element iOS restarted by itself
   *  after an interruption, while the transport is stopped or for a voice that
   *  is not sounding, is put back. */
  private handlePlay(el: HTMLAudioElement): void {
    if (this.snapshot.isPlaying && this.participants().includes(el)) return;
    el.pause();
  }

  /**
   * iOS pauses every media element of the page when an interruption begins —
   * a call, Siri, another app taking the audio. Follow it, so the transport
   * stops rather than claim to play into silence. Pauses the engine made
   * itself are already reflected in its state and fall through.
   */
  private handlePause(el: HTMLAudioElement): void {
    if (!this.snapshot.isPlaying || this.resyncing || el.ended) return;
    if (this.participants().every((voice) => voice.paused)) this.pause();
  }

  private startTick(): void {
    this.stopTick();
    this.tickHandle = window.setInterval(this.tick, TICK_INTERVAL_MS);
    if (diag.enabled) {
      this.sampleHandle = window.setInterval(this.sampleVoices, DIAG_SAMPLE_INTERVAL_MS);
    }
  }

  private stopTick(): void {
    if (this.tickHandle !== null) {
      window.clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
    if (this.sampleHandle !== null) {
      window.clearInterval(this.sampleHandle);
      this.sampleHandle = null;
    }
  }

  private tick = (): void => {
    if (this.resyncing) return;
    this.measureSteadiness(performance.now());
    const clock = this.clock();
    if (!clock) return;

    const position = clock.currentTime;
    const { loop } = this.snapshot;

    if (loop.a !== null && loop.b !== null && position >= loop.b) {
      this.resync(loop.a, "loop");
      return;
    }

    this.align(clock);
    if (this.handoverDeadline !== null && performance.now() >= this.handoverDeadline) {
      this.expireHandover();
    }
    this.commit({ ...this.snapshot, position });
  };

  /** Diagnostics: one line with every sounding voice's clock and the mixing
   *  context's, so currentTime's real resolution shows between ticks. */
  private sampleVoices = (): void => {
    const voices = this.participants()
      .map((el) => this.describe(el))
      .join("  ");
    const ctx = this.audioCtx ? `  ctx ${this.audioCtx.currentTime.toFixed(3)}` : "";
    diag.sample(`${voices}${ctx}`);
  };

  private logMediaEvent(el: HTMLAudioElement, type: string): void {
    if (!diag.enabled) return;
    const sounding = this.participants().includes(el);
    if ((type === "waiting" || type === "stalled") && !el.paused) diag.noteStall();
    diag.event(`${type} ${this.describe(el)}${sounding ? "" : " (silent)"}`);
  }

  private logContext(): void {
    const ctx = this.audioCtx;
    if (!ctx) {
      diag.event("ctx none — element.volume mixing");
      return;
    }
    // Older Safari leaves both latencies undefined despite the DOM typings.
    const latency = (value: number | undefined): string =>
      typeof value === "number" ? value.toFixed(4) : "n/a";
    diag.event(
      `ctx ${ctx.state} ${ctx.sampleRate}Hz base=${latency(ctx.baseLatency as number | undefined)} out=${latency(ctx.outputLatency as number | undefined)}`,
    );
  }

  private label(el: HTMLAudioElement): string {
    return this.states.get(el)?.label ?? "?";
  }

  private labelsOf(elements: HTMLAudioElement[]): string {
    return elements.map((el) => this.label(el)).join(",") || "-";
  }

  /** A voice as the log shows it: its time, then j joining, l leaving,
   *  p paused, s seeking, r<n> for a readyState below HAVE_FUTURE_DATA. */
  private describe(el: HTMLAudioElement): string {
    const phase = this.states.get(el)?.phase;
    const flags =
      (phase === "joining" ? "j" : phase === "leaving" ? "l" : "") +
      (el.paused ? "p" : "") +
      (el.seeking ? "s" : "") +
      (el.readyState < HTMLMediaElement.HAVE_FUTURE_DATA ? `r${el.readyState}` : "");
    return `${this.label(el)} ${el.currentTime.toFixed(3)}${flags}`;
  }

  private since(start: number): string {
    return `${Math.round(performance.now() - start)}ms`;
  }

  private applyMix(): void {
    this.reconcile();
    this.applyGains();
  }

  private disposeElements(): void {
    this.cancelResync();
    this.stopTick();
    this.elementEvents?.abort();
    this.elementEvents = null;
    // Tear the graph down before the elements so no source dangles on destination.
    this.gains.forEach((gain) => {
      try {
        gain.disconnect();
      } catch {
        // Already detached — nothing to release.
      }
    });
    this.sources.forEach((source) => {
      try {
        source.disconnect();
      } catch {
        // Already detached — nothing to release.
      }
    });
    this.gains.clear();
    this.sources.clear();
    this.handoverDeadline = null;
    this.elements.forEach((el) => {
      this.stopVoice(el);
      el.removeAttribute("src");
      el.load();
    });
    this.elements.clear();
  }

  private commit(next: PracticePlayerSnapshot): void {
    this.snapshot = next;
    this.listeners.forEach((listener) => listener());
  }
}
