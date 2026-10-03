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
 */

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

/** Resolves once every element is settled, or after RESYNC_SETTLE_MAX_MS. */
const settle = (elements: HTMLAudioElement[]): Promise<void> =>
  new Promise((resolve) => {
    if (elements.every(isSettled)) {
      resolve();
      return;
    }
    const watch = new AbortController();
    const timer = window.setTimeout(() => {
      watch.abort();
      resolve();
    }, RESYNC_SETTLE_MAX_MS);
    const check = (): void => {
      if (!elements.every(isSettled)) return;
      window.clearTimeout(timer);
      watch.abort();
      resolve();
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

export class PracticePlayerEngine {
  private elements = new Map<string, HTMLAudioElement>();
  private tickHandle: number | null = null;
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
    const rate = isPractice ? (pref?.rate ?? this.snapshot.rate) : 1;

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
      this.reconcile();
      return;
    }

    this.cancelResync();
    this.allowImmediateResync();
    const token = this.syncToken;
    const position = this.snapshot.position;
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
    const position = this.transportPosition();
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
    if (this.snapshot.isPlaying) {
      this.resync(clamped);
      return;
    }
    // Parked voices move now, so they are buffered there by the next play().
    this.participants().forEach((el) => {
      el.currentTime = clamped;
    });
    this.commit({ ...this.snapshot, position: clamped });
  }

  setRate(rate: number): void {
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

  /** The transport clock: the first sounding voice. Never a silent one — a
   *  muted voice that stalls must not drag the voices someone hears. */
  private clock(): HTMLAudioElement | null {
    return this.participants()[0] ?? null;
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

  /** Starts one voice at `position`; resolves whether it is playing. */
  private startVoice(el: HTMLAudioElement, position: number): Promise<boolean> {
    this.placeAt(el, position);
    return el.play().then(
      () => true,
      () => false,
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
    let joined = false;
    this.elements.forEach((el, id) => {
      if (!sounding.has(id)) {
        if (!el.paused) el.pause();
        return;
      }
      if (!el.paused) return;
      if (this.resyncing) {
        // The pending resync starts every sounding voice when it releases.
        this.placeAt(el, position);
        return;
      }
      joined = true;
      void this.startVoice(el, position);
    });
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
  private resync(position: number): void {
    this.cancelResync();
    const voices = this.participants();
    if (voices.length <= 1) {
      const [voice] = voices;
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
    voices.forEach((el) => el.pause());
    voices.forEach((el) => {
      el.currentTime = position;
    });
    this.commit({ ...this.snapshot, position, isBuffering: true });

    void settle(voices).then(() => {
      if (token !== this.syncToken) return;
      this.resyncing = false;
      if (!this.snapshot.isPlaying) return;
      // Re-read: the mix may have changed while the voices were held.
      this.participants().forEach((el) => {
        this.placeAt(el, position);
        void el.play().catch(() => undefined);
      });
      this.commit({ ...this.snapshot, isBuffering: false });
    });
  }

  private cancelResync(): void {
    this.syncToken += 1;
    this.resyncing = false;
  }

  /** Whether a running, settled voice has slipped off the clock. Voices still
   *  seeking or buffering are left alone: their time is not where they sound. */
  private hasDrifted(clock: HTMLAudioElement, position: number): boolean {
    if (clock.paused || !isSettled(clock)) return false;
    return this.participants().some(
      (el) =>
        el !== clock &&
        !el.paused &&
        isSettled(el) &&
        Math.abs(el.currentTime - position) > DRIFT_TOLERANCE_S,
    );
  }

  /** Lazily builds the shared context + master gain (once per engine life). */
  private ensureContext(): void {
    if (this.audioCtx) return;
    const Ctor = resolveAudioContextCtor();
    if (!Ctor) return; // No Web Audio → applyMix falls back to element.volume.
    try {
      this.audioCtx = new Ctor();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = 1;
      this.masterGain.connect(this.audioCtx.destination);
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
      this.resync(loop.a);
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
  }

  private stopTick(): void {
    if (this.tickHandle !== null) {
      window.clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }

  private tick = (): void => {
    if (this.resyncing) return;
    const clock = this.clock();
    if (!clock) return;

    const position = clock.currentTime;
    const { loop } = this.snapshot;

    if (loop.a !== null && loop.b !== null && position >= loop.b) {
      this.resync(loop.a);
      return;
    }

    const sinceResync = performance.now() - this.lastResyncAt;
    if (sinceResync > RESYNC_BACKOFF_RESET_MS) {
      this.resyncBackoffMs = RESYNC_COOLDOWN_MS;
    }
    if (sinceResync >= this.resyncBackoffMs && this.hasDrifted(clock, position)) {
      this.resyncBackoffMs *= 2;
      this.resync(position);
      return;
    }

    this.commit({ ...this.snapshot, position });
  };

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
