/**
 * @file practicePlayerEngine.ts
 * @description Framework-agnostic multitrack practice engine for the Songbook.
 *
 * Plays every voice track of a piece simultaneously through a pool of streaming
 * HTMLAudioElements (NOT decoded Web Audio buffers) so that:
 *  - audio streams instead of waiting for full downloads (mobile data),
 *  - playbackRate keeps pitch (preservesPitch) — slow practice stays in tune.
 *
 * Mixing runs through a single shared AudioContext: each element feeds a
 * MediaElementAudioSourceNode → per-voice GainNode → master → destination.
 * This is deliberate, not decoration:
 *  - iOS Safari refuses to play several independent <audio> elements from one
 *    gesture; unifying them into ONE AudioContext output (resumed on the tap)
 *    is what makes the choir sound on iPhone at all;
 *  - mute/solo/volume set gain, never element.volume, so a "silenced" voice
 *    keeps decoding at full level and never drifts — killing the force-seek
 *    stutter mobile Chrome hit when muted elements were throttled then yanked
 *    back into sync.
 * Where Web Audio is unavailable the engine degrades to element.volume mixing.
 *
 * The first track acts as the transport master clock; a 250 ms tick is a rare
 * safety net for residual drift and enforces the A–B practice loop.
 * Consumed by React via useSyncExternalStore (subscribe/getSnapshot).
 */

export interface PracticeTrackSource {
  id: string;
  /** Raw voice-line code (S1, A2, …) — matches casting.voice_line. */
  voicePart: string;
  /** Human label, e.g. "Sopran 1". */
  label: string;
  url: string;
  isMine: boolean;
}

export interface PracticePieceSource {
  pieceId: string;
  projectId: string;
  title: string;
  composer: string;
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

// With gain-based mixing every voice keeps decoding in sync, so drift is tiny
// and this safety net rarely fires; a slightly looser bound avoids an audible
// micro-seek when a phone does briefly slip.
const DRIFT_TOLERANCE_S = 0.12;
const TICK_INTERVAL_MS = 250;
// Short gain ramp on mute/volume changes — a hard jump clicks ("zipper noise").
const GAIN_RAMP_S = 0.015;
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

interface PersistedPref {
  rate?: number;
  preset?: PracticePreset | null;
}

/** Mute map for a preset given the piece's tracks (used on load + on tap). */
const mutedForPreset = (
  tracks: PracticeTrackSource[],
  preset: PracticePreset,
): Record<string, boolean> => {
  const muted: Record<string, boolean> = {};
  tracks.forEach((track) => {
    muted[track.id] =
      preset === "blend"
        ? false
        : preset === "solo-mine"
          ? !track.isMine
          : track.isMine; // minus-mine
  });
  return muted;
};

type Listener = () => void;

export class PracticePlayerEngine {
  private elements = new Map<string, HTMLAudioElement>();
  private masterId: string | null = null;
  private tickHandle: number | null = null;
  private listeners = new Set<Listener>();
  private snapshot: PracticePlayerSnapshot = EMPTY_SNAPSHOT;

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
   */
  load(
    piece: PracticePieceSource,
    tracks: PracticeTrackSource[],
    options?: { soloTrackId?: string | null; autoplay?: boolean },
  ): void {
    this.disposeElements();
    // Created inside the tap that triggered load() → allowed to start on iOS.
    this.ensureContext();

    const pref = this.readPref(piece.pieceId);
    const rate = pref?.rate ?? this.snapshot.rate;

    const hasMine = tracks.some((track) => track.isMine);
    // A solo/minus preset is meaningless without the chorister's own track.
    const activePreset: PracticePreset | null =
      pref?.preset && (pref.preset === "blend" || hasMine) ? pref.preset : null;

    const volumes: Record<string, number> = {};
    const muted: Record<string, boolean> = activePreset
      ? mutedForPreset(tracks, activePreset)
      : {};

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
      // Element level stays at full so muted voices keep decoding in sync;
      // silence is applied downstream on the GainNode (see applyMix).
      el.volume = 1;
      this.elements.set(track.id, el);
      this.connectToGraph(track.id, el);
      volumes[track.id] = 1;
      muted[track.id] ??= false;
    });

    this.masterId = tracks[0]?.id ?? null;
    const master = this.master();

    if (master) {
      master.addEventListener("loadedmetadata", this.handleMetadata);
      master.addEventListener("ended", this.handleEnded);
      master.addEventListener("waiting", this.handleWaiting);
      master.addEventListener("playing", this.handlePlaying);
    }

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
    const master = this.master();
    if (!master || !this.snapshot.piece) return;

    // A context created while suspended emits no sound; resume it on the same
    // gesture that reached play() so the graph is live before the elements are.
    if (this.audioCtx?.state === "suspended") {
      void this.audioCtx.resume();
    }

    const startAt = master.currentTime;
    const plays: Promise<void>[] = [];
    this.elements.forEach((el) => {
      el.currentTime = startAt;
      plays.push(el.play().catch(() => undefined));
    });
    await Promise.all(plays);

    this.startTick();
    this.commit({ ...this.snapshot, isPlaying: true });
  }

  pause(): void {
    this.elements.forEach((el) => el.pause());
    this.stopTick();
    this.commit({
      ...this.snapshot,
      isPlaying: false,
      position: this.master()?.currentTime ?? this.snapshot.position,
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
    this.elements.forEach((el) => {
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

  /** Solo is exclusive; passing the active solo id (or null) clears it. */
  setSolo(trackId: string | null): void {
    const soloTrackId =
      trackId && this.snapshot.soloTrackId !== trackId ? trackId : null;
    this.commit({ ...this.snapshot, soloTrackId, activePreset: null });
    this.applyMix();
  }

  setLoopPointA(): void {
    const position = this.master()?.currentTime ?? this.snapshot.position;
    const b = this.snapshot.loop.b;
    this.commit({
      ...this.snapshot,
      loop: { a: position, b: b !== null && b <= position ? null : b },
    });
  }

  setLoopPointB(): void {
    const position = this.master()?.currentTime ?? this.snapshot.position;
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

  private master(): HTMLAudioElement | null {
    return this.masterId ? (this.elements.get(this.masterId) ?? null) : null;
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
    const pieceId = this.snapshot.piece?.pieceId;
    if (!pieceId || typeof localStorage === "undefined") return;
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

  private handleMetadata = (): void => {
    this.commit({ ...this.snapshot, duration: this.master()?.duration ?? 0 });
  };

  private handleEnded = (): void => {
    const { loop } = this.snapshot;
    if (loop.a !== null && loop.b !== null) {
      this.seek(loop.a);
      void this.play();
      return;
    }
    this.stopTick();
    this.elements.forEach((el) => el.pause());
    this.commit({ ...this.snapshot, isPlaying: false, position: 0 });
    this.elements.forEach((el) => {
      el.currentTime = 0;
    });
  };

  private handleWaiting = (): void => {
    this.commit({ ...this.snapshot, isBuffering: true });
  };

  private handlePlaying = (): void => {
    if (this.snapshot.isBuffering) {
      this.commit({ ...this.snapshot, isBuffering: false });
    }
  };

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
    const master = this.master();
    if (!master) return;

    const position = master.currentTime;
    const { loop } = this.snapshot;

    if (loop.a !== null && loop.b !== null && position >= loop.b) {
      this.seek(loop.a);
      this.commit({ ...this.snapshot, position: loop.a });
      return;
    }

    // Re-align slaves that drifted away from the master clock.
    this.elements.forEach((el, id) => {
      if (id === this.masterId || el.paused) return;
      if (Math.abs(el.currentTime - position) > DRIFT_TOLERANCE_S) {
        el.currentTime = position;
      }
    });

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
        // Ramp on the graph; element stays at full volume so it never throttles.
        gain.gain.setTargetAtTime(level, now, GAIN_RAMP_S);
      } else {
        el.volume = level; // Fallback: no Web Audio graph for this track.
      }
    });
  }

  private disposeElements(): void {
    this.stopTick();
    const master = this.master();
    if (master) {
      master.removeEventListener("loadedmetadata", this.handleMetadata);
      master.removeEventListener("ended", this.handleEnded);
      master.removeEventListener("waiting", this.handleWaiting);
      master.removeEventListener("playing", this.handlePlaying);
    }
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
    this.masterId = null;
  }

  private commit(next: PracticePlayerSnapshot): void {
    this.snapshot = next;
    this.listeners.forEach((listener) => listener());
  }
}
