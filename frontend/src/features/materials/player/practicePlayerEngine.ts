/**
 * @file practicePlayerEngine.ts
 * @description Framework-agnostic multitrack practice engine for the Songbook.
 *
 * One transport and one snapshot over two ways of playing a take:
 *  - decoded stems — the practice take on iPhone and iPad ([presetsOnly]).
 *    WebKit stalls a routed media element after play(), after every seek and
 *    after every tempo change, which is everything aligning several voices
 *    needs. There the take loads whole behind a loading state and plays as
 *    three stems on the mixing context's clock (stretchedPracticeMix); only
 *    the three presets exist, as gain changes — no per-voice mixer;
 *  - streaming elements — everywhere else, and every tempo giusto take. The
 *    rest of this header describes that path.
 *
 * Plays the voice tracks of a piece together through a pool of streaming
 * HTMLAudioElements (NOT decoded Web Audio buffers) so that:
 *  - audio streams instead of waiting for full downloads (mobile data),
 *  - playbackRate keeps pitch (preservesPitch) — slow practice stays in tune.
 *
 * Only the voices the chorister can hear run. A muted voice, or one silenced
 * by a solo, is paused and rejoins at the transport position when it sounds
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
 * The first sounding voice is the transport clock. When several voices sound,
 * a 250 ms tick watches their drift and realigns them by resync: hold every
 * voice, seek them all to one position, start them together in one task once
 * each can play. Seeking one voice to the clock's current time while the rest
 * play on cannot converge where a seek outlasts the tolerance (iOS) — the voice
 * lands late by its own seek latency, is seeked again, and stutters and drops
 * out indefinitely. The tick also enforces the A–B practice loop.
 * Consumed by React via useSyncExternalStore (subscribe/getSnapshot).
 *
 * Every decision and every media event can be written to the opt-in
 * diagnostics log (practicePlayerDiagnostics) for measuring a real phone;
 * with the log off those calls return at once.
 */

import { isAppleTouchDevice } from "@/shared/pwa/platform";

import { practiceDiagnostics as diag } from "./practicePlayerDiagnostics";
import {
  StretchedMix,
  loadStems,
  preferPlaybackAudioSession,
  supportsStretchedMix,
  type PracticeLoop,
  type StemSource,
} from "./stretchedPracticeMix";

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
  /** The stems path is downloading and decoding the take; nothing can sound
   *  yet. `isPlaying` meanwhile says whether it starts once ready. */
  isLoading: boolean;
  /** Share of the take's recordings decoded so far, 0–1. */
  loadProgress: number;
  /** The stems path could not load the take; play() tries again. */
  loadFailed: boolean;
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
  isLoading: false,
  loadProgress: 0,
  loadFailed: false,
};

// Voices started together stay within a few milliseconds of each other; this
// is the slip at which two of them begin to sound like a flam.
const DRIFT_TOLERANCE_S = 0.12;
const TICK_INTERVAL_MS = 250;
// Short gain ramp on mute/volume changes — a hard jump clicks ("zipper noise").
const GAIN_RAMP_S = 0.015;
// A voice this close to where it should be is left alone: a seek flushes the
// decoder, and on iOS it is slow.
const POSITION_EPSILON_S = 0.05;
// How long a resync waits for its slowest voice before starting anyway — one
// stuck stream must not hold the whole choir.
const RESYNC_SETTLE_MAX_MS = 1500;
// Spacing of drift resyncs. Each one the tick triggers doubles the wait before
// the next, so a phone that keeps slipping a voice ends up with a mix slightly
// apart, never one chopped every few seconds; a quiet half-minute or any tap
// that moves the transport starts over from the base.
const RESYNC_COOLDOWN_MS = 2000;
const RESYNC_BACKOFF_RESET_MS = 30000;
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

type ResyncReason = "seek" | "loop" | "drift";

const errorName = (error: unknown): string =>
  error instanceof Error ? error.name : String(error);

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

/**
 * The recordings the stems path loads, by the same rules as [mutedForPreset]:
 * the first tutti take alone carries the whole choir, every take of the
 * chorister's line goes into "mine", every other take into "rest". A second
 * tutti take is never heard by any preset and is not downloaded.
 */
const stemSourcesOf = (tracks: PracticeTrackSource[]): StemSource[] => {
  const tutti = tracks.find((track) => track.voicePart === TUTTI_VOICE_PART);
  const sources: StemSource[] = tutti
    ? [{ role: "tutti", url: tutti.url, label: tutti.voicePart }]
    : [];
  tracks.forEach((track) => {
    if (track.voicePart === TUTTI_VOICE_PART) return;
    sources.push({
      role: track.isMine ? "mine" : "rest",
      url: track.url,
      label: track.voicePart,
    });
  });
  return sources;
};

const stemLoopOf = ({ a, b }: PracticeLoopRange): PracticeLoop | null =>
  a !== null && b !== null ? { start: a, end: b } : null;

/**
 * This device plays the practice take as decoded stems with the three presets
 * only — iPhone and iPad. A fact about the device, fixed for the page's life,
 * so surfaces outside the engine's subscription can read it too.
 */
export const playsPresetsOnly = (): boolean =>
  isAppleTouchDevice() && supportsStretchedMix();

/** True when the engine holds this piece's `take` — and so its transport is
 *  the one a surface for that take should show and drive. */
export const holdsTake = (
  snapshot: PracticePlayerSnapshot,
  pieceId: string,
  take: PracticeTake,
): boolean => snapshot.piece?.pieceId === pieceId && snapshot.piece.take === take;

type Listener = () => void;

export class PracticePlayerEngine {
  /** [playsPresetsOnly] for this engine; the mixer hides its per-voice strips
   *  when it is set. */
  readonly presetsOnly: boolean = playsPresetsOnly();

  /** The loaded take runs on the stems path. */
  private onStems = false;
  /** Its stems, once loaded. */
  private mix: StretchedMix | null = null;
  /** Aborts the download of a take that was replaced while loading. */
  private stemsLoad: AbortController | null = null;

  private elements = new Map<string, HTMLAudioElement>();
  /** Voice codes (S1, A, TUTTI…) by element — the diagnostics log's names. */
  private voiceLabels = new WeakMap<HTMLAudioElement, string>();
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
  private lastResyncAt = Number.NEGATIVE_INFINITY;
  private resyncBackoffMs = RESYNC_COOLDOWN_MS;

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

    if (isPractice && this.presetsOnly && this.audioCtx && this.masterGain) {
      this.loadStemsTake(
        piece,
        tracks,
        rate,
        activePreset ?? "blend",
        options?.autoplay ?? false,
      );
      return;
    }

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
      this.voiceLabels.set(el, track.voicePart);
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
    if (this.onStems) {
      this.playStems();
      return;
    }
    if (!this.snapshot.piece || this.elements.size === 0) return;

    // On the same gesture that reached play(): every voice runs through the
    // graph, so a context that is not rendering turns them all into silence.
    this.wakeContext();

    if (this.snapshot.isPlaying) {
      this.reconcile();
      return;
    }

    this.cancelResync();
    this.allowImmediateResync();
    const token = this.syncToken;
    const position = this.snapshot.position;
    diag.event(`play at ${position.toFixed(3)}`);
    this.commit({ ...this.snapshot, isPlaying: true });
    this.startTick();

    // Every voice starts here, inside the gesture: iOS lets an element play
    // later without one only once it has played inside one. Voices that come
    // up at different moments are aligned by the tick's first resync.
    const started = await Promise.all(
      this.participants().map((el) => this.startVoice(el, position)),
    );
    if (token === this.syncToken && this.snapshot.isPlaying && !started.some(Boolean)) {
      // Nothing would play — show a stopped transport, not a silent running one.
      this.stopTick();
      this.commit({ ...this.snapshot, isPlaying: false, isBuffering: false });
    }
  }

  pause(): void {
    const position =
      this.onStems && this.mix?.isPlaying ? this.mix.pause() : this.transportPosition();
    diag.event(`pause at ${position.toFixed(3)}`);
    this.cancelResync();
    this.elements.forEach((el) => el.pause());
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
    if (this.onStems) {
      this.seekStems(clamped);
      return;
    }
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
    diag.event(`rate ${rate}`);
    this.mix?.setRate(rate);
    this.elements.forEach((el) => {
      el.playbackRate = rate;
    });
    this.commit({ ...this.snapshot, rate });
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
    if (this.onStems) {
      // Before the stems are ready the preset waits in the snapshot.
      this.mix?.setPreset(preset);
    } else {
      this.applyMix();
    }
    this.persistPref();
  }

  setVolume(trackId: string, volume: number): void {
    if (this.onStems) return;
    const volumes = { ...this.snapshot.volumes, [trackId]: volume };
    this.commit({ ...this.snapshot, volumes });
    this.applyMix();
  }

  toggleMute(trackId: string): void {
    if (this.onStems) return;
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
    if (this.onStems) return;
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
    this.mix?.setLoop(stemLoopOf(this.snapshot.loop));
  }

  setLoopPointB(): void {
    const position = this.transportPosition();
    const a = this.snapshot.loop.a;
    if (a === null || position <= a) return;
    this.commit({ ...this.snapshot, loop: { a, b: position } });
    this.mix?.setLoop(stemLoopOf(this.snapshot.loop));
  }

  clearLoop(): void {
    this.commit({ ...this.snapshot, loop: { a: null, b: null } });
    this.mix?.setLoop(null);
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

  /** The transport clock: the first sounding voice. Never a silent one — a
   *  muted voice that stalls must not drag the voices someone hears. */
  private clock(): HTMLAudioElement | null {
    return this.participants()[0] ?? null;
  }

  /** Where the transport is now: the clock while it runs, else any running
   *  voice, else the last committed position (paused, or held by a resync). */
  private transportPosition(): number {
    if (this.onStems) {
      return this.mix?.isPlaying ? this.mix.position() : this.snapshot.position;
    }
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

  // ── decoded stems (iPhone, iPad) ─────────────────────────────────────────

  /**
   * Opens a practice take on the stems path: the snapshot is committed at
   * once — loading, and playing when the tap asked for it — the download and
   * decode run behind it, and playback starts by itself when they finish if
   * the chorister still wants it. Runs inside the tap, where iOS lets the
   * context wake and the audio session change.
   */
  private loadStemsTake(
    piece: PracticePieceSource,
    tracks: PracticeTrackSource[],
    rate: number,
    preset: PracticePreset,
    autoplay: boolean,
  ): void {
    this.onStems = true;
    preferPlaybackAudioSession();
    this.wakeContext();
    const volumes: Record<string, number> = {};
    tracks.forEach((track) => {
      volumes[track.id] = 1;
    });
    this.commit({
      ...EMPTY_SNAPSHOT,
      piece,
      tracks,
      rate,
      volumes,
      muted: mutedForPreset(tracks, preset),
      activePreset: preset,
      isPlaying: autoplay,
      isBuffering: autoplay,
      isLoading: true,
    });
    const sources = stemSourcesOf(tracks);
    if (diag.enabled) {
      const plan = sources.map((source) => `${source.label}→${source.role}`).join(",");
      diag.event(`load stems ${plan} rate=${rate} preset=${preset}`);
      this.logContext();
    }
    const loading = new AbortController();
    this.stemsLoad = loading;
    void this.prepareStems(sources, loading.signal);
  }

  private async prepareStems(sources: StemSource[], signal: AbortSignal): Promise<void> {
    const ctx = this.audioCtx;
    const master = this.masterGain;
    if (!ctx || !master) return;
    const startedAt = performance.now();
    try {
      if (sources.length === 0) throw new Error("no recordings");
      const stems = await loadStems(ctx, sources, {
        signal,
        onProgress: (done, total) => {
          if (!signal.aborted) this.commit({ ...this.snapshot, loadProgress: done / total });
        },
        onDecoded: (line) => diag.event(line),
      });
      const heldMb = (stems.channels.length * stems.duration * ctx.sampleRate * 4) / 1048576;
      let created: StretchedMix | null = null;
      const mix = await StretchedMix.create(
        ctx,
        master,
        stems,
        this.snapshot.activePreset ?? "blend",
        () => {
          if (created === null || this.mix !== created) return;
          diag.event("stems processor error");
          this.pause();
          this.commit({ ...this.snapshot, loadFailed: true });
        },
      );
      created = mix;
      if (signal.aborted) {
        mix.dispose();
        return;
      }
      mix.setLoop(stemLoopOf(this.snapshot.loop));
      this.mix = mix;
      this.stemsLoad = null;
      diag.event(
        `stems ready ${stems.roles.join(",")} ${stems.duration.toFixed(1)}s ${heldMb.toFixed(0)}MB lead=${mix.lead.toFixed(3)}s in ${this.since(startedAt)}`,
      );
      this.commit({
        ...this.snapshot,
        isLoading: false,
        loadProgress: 1,
        duration: stems.duration,
      });
      if (this.snapshot.isPlaying) this.startStems();
    } catch (error) {
      if (signal.aborted) return;
      this.stemsLoad = null;
      diag.event(`stems failed ${errorName(error)}: ${error instanceof Error ? error.message : ""}`);
      this.commit({
        ...this.snapshot,
        isLoading: false,
        loadFailed: true,
        isPlaying: false,
        isBuffering: false,
      });
    }
  }

  /** play() on the stems path: starts at once when the stems are ready, else
   *  records the wish for prepareStems; after a failed load, loads again. */
  private playStems(): void {
    this.wakeContext();
    const { piece, tracks, isPlaying, loadFailed } = this.snapshot;
    if (loadFailed && piece) {
      this.load(piece, tracks, { autoplay: true });
      return;
    }
    if (isPlaying) return;
    if (!this.mix) {
      this.commit({ ...this.snapshot, isPlaying: true, isBuffering: true });
      return;
    }
    this.startStems();
  }

  private startStems(): void {
    const mix = this.mix;
    if (!mix) return;
    const { position: held, duration, rate } = this.snapshot;
    const position = duration > 0 && held >= duration ? 0 : held;
    diag.event(`play at ${position.toFixed(3)} rate=${rate}`);
    mix.play(position, rate);
    this.commit({ ...this.snapshot, isPlaying: true, isBuffering: false, position });
    this.startTick();
  }

  private seekStems(position: number): void {
    const { a, b } = this.snapshot.loop;
    // At or past the loop's end the loop starts over, as on reaching it.
    const target = a !== null && b !== null && position >= b ? a : position;
    diag.event(`seek to ${target.toFixed(3)}`);
    this.mix?.seek(target);
    this.commit({ ...this.snapshot, position: target });
  }

  /** The stems transport's tick: the position for the UI and the end of the
   *  take. The A–B loop needs nothing here — the node wraps by itself. */
  private tickStems(): void {
    const mix = this.mix;
    if (!mix?.isPlaying) return;
    const position = mix.position();
    const { duration, loop } = this.snapshot;
    if (stemLoopOf(loop) === null && duration > 0 && position >= duration) {
      mix.pause();
      this.stopTick();
      diag.event("ended");
      this.commit({ ...this.snapshot, isPlaying: false, isBuffering: false, position: 0 });
      return;
    }
    this.commit({ ...this.snapshot, position: Math.min(position, duration) });
  }

  /**
   * iOS interrupts the mixing context for a call, Siri or another app's audio.
   * On the stems path nothing else reports it, so the transport follows the
   * context rather than claim to play into silence. (Element voices report
   * the same through their own pause events — handlePause.)
   */
  private handleContextState(ctx: AudioContext): void {
    diag.event(`ctx ${ctx.state}`);
    if (this.onStems && this.mix?.isPlaying && ctx.state !== "running") this.pause();
  }

  /** Moves a voice to `position` unless it is already there. */
  private placeAt(el: HTMLAudioElement, position: number): void {
    if (Math.abs(el.currentTime - position) > POSITION_EPSILON_S) {
      el.currentTime = position;
    }
  }

  /** Starts one voice at `position`; resolves whether it is playing. */
  private startVoice(el: HTMLAudioElement, position: number): Promise<boolean> {
    const from = el.currentTime;
    this.placeAt(el, position);
    const askedAt = performance.now();
    return el.play().then(
      () => {
        diag.event(
          `started ${this.label(el)} ${from.toFixed(3)}→${position.toFixed(3)} in ${this.since(askedAt)}`,
        );
        return true;
      },
      (error: unknown) => {
        diag.event(`play rejected ${this.label(el)} ${errorName(error)}`);
        return false;
      },
    );
  }

  /**
   * While playing, makes the running elements exactly the sounding voices: a
   * voice that fell silent is paused, one that became audible starts at the
   * transport position. Runs inside the tap that changed the mix, so a voice
   * that never played may still start (iOS gesture rule); the tick's resync
   * then aligns it with the rest.
   */
  private reconcile(): void {
    if (!this.snapshot.isPlaying) return;
    const position = this.transportPosition();
    const sounding = new Set(this.participantIds());
    const stopped: string[] = [];
    const started: string[] = [];
    let joined = false;
    this.elements.forEach((el, id) => {
      if (!sounding.has(id)) {
        if (!el.paused) {
          el.pause();
          stopped.push(this.label(el));
        }
        return;
      }
      if (!el.paused) return;
      if (this.resyncing) {
        // The pending resync starts every sounding voice when it releases.
        this.placeAt(el, position);
        return;
      }
      joined = true;
      started.push(this.label(el));
      void this.startVoice(el, position);
    });
    if (stopped.length > 0 || started.length > 0) {
      diag.event(
        `reconcile at ${position.toFixed(3)} stop=${stopped.join(",") || "-"} start=${started.join(",") || "-"}`,
      );
    }
    // A voice the chorister just brought in is aligned at once, not after the
    // wait that paces automatic resyncs.
    if (joined) this.allowImmediateResync();
  }

  private allowImmediateResync(): void {
    this.lastResyncAt = Number.NEGATIVE_INFINITY;
    this.resyncBackoffMs = RESYNC_COOLDOWN_MS;
  }

  /**
   * Realigns every sounding voice on `position`: hold them all, seek them all,
   * then start them in the same task once each is settled — so they leave the
   * line together however long each seek took. A single voice has nothing to
   * align with and simply seeks.
   */
  private resync(position: number, reason: ResyncReason): void {
    this.cancelResync();
    const voices = this.participants();
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
    this.lastResyncAt = performance.now();
    diag.noteResync();
    diag.event(
      `resync ${reason} to ${position.toFixed(3)} hold ${this.labelsOf(voices)} next-gap=${this.resyncBackoffMs}ms`,
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
        this.placeAt(el, position);
        void el.play().then(
          () => diag.event(`resumed ${this.label(el)} in ${this.since(releasedAt)}`),
          (error: unknown) =>
            diag.event(`play rejected ${this.label(el)} ${errorName(error)}`),
        );
      });
      this.commit({ ...this.snapshot, isBuffering: false });
    });
  }

  private cancelResync(): void {
    this.syncToken += 1;
    this.resyncing = false;
  }

  /** How far each running, settled voice sits from the clock, in seconds.
   *  Voices still seeking or buffering are left out: their time is not where
   *  they sound. */
  private driftsFrom(
    clock: HTMLAudioElement,
    position: number,
  ): { el: HTMLAudioElement; drift: number }[] {
    if (clock.paused || !isSettled(clock)) return [];
    return this.participants().flatMap((el) =>
      el !== clock && !el.paused && isSettled(el)
        ? [{ el, drift: el.currentTime - position }]
        : [],
    );
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
      ctx.addEventListener("statechange", () => this.handleContextState(ctx));
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
    this.elements.forEach((voice) => voice.pause());
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
    if (this.onStems) {
      this.tickStems();
      return;
    }
    if (this.resyncing) return;
    const clock = this.clock();
    if (!clock) return;

    const position = clock.currentTime;
    const { loop } = this.snapshot;

    if (loop.a !== null && loop.b !== null && position >= loop.b) {
      this.resync(loop.a, "loop");
      return;
    }

    const sinceResync = performance.now() - this.lastResyncAt;
    if (sinceResync > RESYNC_BACKOFF_RESET_MS) {
      this.resyncBackoffMs = RESYNC_COOLDOWN_MS;
    }
    const drifts = this.driftsFrom(clock, position);
    const worst = drifts.reduce((max, { drift }) => Math.max(max, Math.abs(drift)), 0);
    const drifted = worst > DRIFT_TOLERANCE_S;
    if (diag.enabled && drifts.length > 0) {
      const readings = drifts
        .map(({ el, drift }) => `${this.label(el)}${drift >= 0 ? "+" : ""}${drift.toFixed(3)}`)
        .join(" ");
      diag.sample(`tick ${this.describe(clock)} drift ${readings}${drifted ? " OVER" : ""}`);
      if (drifted) diag.noteOverTolerance(worst);
    }
    if (drifted && sinceResync >= this.resyncBackoffMs && !diag.observeOnly) {
      this.resyncBackoffMs *= 2;
      this.resync(position, "drift");
      return;
    }

    this.commit({ ...this.snapshot, position });
  };

  /** Diagnostics: one line with every sounding voice's clock and the mixing
   *  context's, so currentTime's real resolution shows between ticks. */
  private sampleVoices = (): void => {
    const ctx = this.audioCtx ? `  ctx ${this.audioCtx.currentTime.toFixed(3)}` : "";
    if (this.onStems) {
      diag.sample(`stems ${this.mix?.position().toFixed(3) ?? "-"}${ctx}`);
      return;
    }
    const voices = this.participants()
      .map((el) => this.describe(el))
      .join("  ");
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
    return this.voiceLabels.get(el) ?? "?";
  }

  private labelsOf(elements: HTMLAudioElement[]): string {
    return elements.map((el) => this.label(el)).join(",") || "-";
  }

  /** A voice as the log shows it: its time, then p paused, s seeking, r<n>
   *  for a readyState below HAVE_FUTURE_DATA. */
  private describe(el: HTMLAudioElement): string {
    const flags =
      (el.paused ? "p" : "") +
      (el.seeking ? "s" : "") +
      (el.readyState < HTMLMediaElement.HAVE_FUTURE_DATA ? `r${el.readyState}` : "");
    return `${this.label(el)} ${el.currentTime.toFixed(3)}${flags}`;
  }

  private since(start: number): string {
    return `${Math.round(performance.now() - start)}ms`;
  }

  private applyMix(): void {
    const { volumes, muted, soloTrackId } = this.snapshot;
    const now = this.audioCtx?.currentTime ?? 0;
    this.elements.forEach((el, id) => {
      const soloSilenced = soloTrackId !== null && soloTrackId !== id;
      const level = soloSilenced || muted[id] ? 0 : (volumes[id] ?? 1);
      const gain = this.gains.get(id);
      if (gain && this.audioCtx) {
        gain.gain.setTargetAtTime(level, now, GAIN_RAMP_S);
      } else {
        el.volume = level; // Fallback: no Web Audio graph for this track.
      }
    });
    this.reconcile();
  }

  /** Unloads the current take, whichever path it plays on. */
  private disposeElements(): void {
    this.stemsLoad?.abort();
    this.stemsLoad = null;
    this.mix?.dispose();
    this.mix = null;
    this.onStems = false;
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
    this.elements.forEach((el) => {
      el.pause();
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
