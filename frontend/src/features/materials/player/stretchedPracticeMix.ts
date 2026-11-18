/**
 * @file stretchedPracticeMix.ts
 * @description The practice take as decoded audio on one AudioContext clock —
 * how iPhone and iPad play it.
 *
 * WebKit stalls a media element routed through MediaElementAudioSourceNode for
 * a few hundred milliseconds after play(), after every seek and after every
 * playbackRate change (lsegal/zvid #1112, polandy/glissando #98; the iPhone
 * logs of 17–18.11 show the same). Keeping several such elements aligned needs
 * exactly those operations, so on Apple touch devices no element plays at all:
 * the take is downloaded whole, decoded, and folded into at most three mono
 * stems — the recorded Tutti take, the chorister's own line, and the sum of
 * every other line. One Signalsmith Stretch AudioWorklet node plays the stems
 * as its channels: tempo is the node's rate (pitch untouched), position is the
 * node's input time, and a channel splitter feeds one gain per stem. A preset
 * is a gain change — instant, sample-accurate, nothing to seek or align.
 *
 * The worklet module is the package file itself, emitted unminified as an
 * asset: the package's own loader would rebuild it from Function.toString()
 * of the minified bundle, which renames the free variables it relies on.
 * The main thread speaks the processor's small message protocol directly.
 *
 * Cost: the first load downloads every voice (the service worker caches the
 * files after that) and the node holds ~35 MB per stem per three minutes of
 * 48 kHz audio while the piece is loaded.
 */

import stretchModuleUrl from "signalsmith-stretch?url";

import type { PracticePreset } from "./practicePlayerEngine";

/** What one stem carries. */
export type StemRole = "tutti" | "mine" | "rest";

export interface StemSource {
  role: StemRole;
  url: string;
  /** Voice code for the diagnostics log. */
  label: string;
}

export interface PracticeStems {
  roles: StemRole[];
  /** One mono channel per role, all the same length. */
  channels: Float32Array<ArrayBuffer>[];
  duration: number;
}

export interface StemLoadOptions {
  signal: AbortSignal;
  /** Called after each source is decoded and folded in. */
  onProgress: (done: number, total: number) => void;
  /** Diagnostics: one line per finished source. */
  onDecoded: (line: string) => void;
}

export interface PracticeLoop {
  start: number;
  end: number;
}

/** The name the package's processor registers under. */
const PROCESSOR_NAME = "signalsmith-stretch";
const GAIN_RAMP_S = 0.015;
// Added to the node's own latency so a change scheduled from the main thread
// still reaches the audio thread before its start time.
const SCHEDULE_MARGIN_S = 0.03;
// Compiling the processor's WebAssembly takes well under a second on a phone;
// past this it is not coming, and the take should fail rather than load forever.
const PROCESSOR_READY_TIMEOUT_MS = 15000;
// Fixed order of the node's channels; absent stems are left out.
const ROLE_ORDER: readonly StemRole[] = ["tutti", "mine", "rest"];

/** AudioWorklet and WebAssembly — the two things the stems path cannot do without. */
export const supportsStretchedMix = (): boolean =>
  typeof AudioWorkletNode !== "undefined" && typeof WebAssembly === "object";

interface AudioSessionHost {
  audioSession?: { type: string };
}

/**
 * Web Audio without a media element follows the ring/silent switch on iOS, so
 * an element-free mix would be mute on a silenced phone. "playback" is the
 * category a playing media element gets by itself. Safari 17+; elsewhere the
 * property does not exist and nothing happens.
 */
export const preferPlaybackAudioSession = (): void => {
  const session = (navigator as Navigator & AudioSessionHost).audioSession;
  if (!session) return;
  try {
    session.type = "playback";
  } catch {
    // A browser that exposes the session but refuses the category.
  }
};

/** Level of each stem under a preset. Without a Tutti take the whole choir is
 *  the chorister's line plus the rest. */
export const stemLevel = (
  role: StemRole,
  roles: readonly StemRole[],
  preset: PracticePreset,
): number => {
  switch (preset) {
    case "blend":
      return roles.includes("tutti") ? Number(role === "tutti") : Number(role !== "tutti");
    case "solo-mine":
      return Number(role === "mine");
    case "minus-mine":
      return Number(role === "rest");
  }
};

const fetchBytes = async (url: string, signal: AbortSignal): Promise<ArrayBuffer> => {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`);
  return response.arrayBuffer();
};

/** `stem` at least `length` samples long, zero-padded; the same array when it
 *  already is. */
const grown = (
  stem: Float32Array<ArrayBuffer> | undefined,
  length: number,
): Float32Array<ArrayBuffer> => {
  if (stem && stem.length >= length) return stem;
  const next = new Float32Array(length);
  if (stem) next.set(stem);
  return next;
};

/** Adds a decoded take into `stem` as mono: channels averaged, not summed, so
 *  a stereo take sits at the level of a mono one. */
const foldInto = (stem: Float32Array, buffer: AudioBuffer): void => {
  const weight = 1 / buffer.numberOfChannels;
  for (let c = 0; c < buffer.numberOfChannels; c += 1) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i += 1) {
      stem[i] += data[i] * weight;
    }
  }
};

/**
 * Downloads every source at once and decodes them one at a time, folding each
 * into its stem straight away: peak memory is the stems plus one decoded take,
 * never every take decoded side by side.
 */
export const loadStems = async (
  ctx: BaseAudioContext,
  sources: readonly StemSource[],
  { signal, onProgress, onDecoded }: StemLoadOptions,
): Promise<PracticeStems> => {
  const downloads = sources.map((source) => fetchBytes(source.url, signal));
  // A later download may fail while an earlier one is still decoding; its
  // rejection is read in turn below, never reported as unhandled.
  downloads.forEach((download) => download.catch(() => undefined));

  const stems = new Map<StemRole, Float32Array<ArrayBuffer>>();
  let length = 0;
  for (const [index, source] of sources.entries()) {
    const startedAt = performance.now();
    const bytes = await downloads[index];
    const size = bytes.byteLength;
    const fetchedAt = performance.now();
    const buffer = await ctx.decodeAudioData(bytes);
    signal.throwIfAborted();
    const stem = grown(stems.get(source.role), buffer.length);
    foldInto(stem, buffer);
    stems.set(source.role, stem);
    length = Math.max(length, buffer.length);
    onDecoded(
      `decoded ${source.label}→${source.role} ${(size / 1048576).toFixed(1)}MB ` +
        `wait ${Math.round(fetchedAt - startedAt)}ms decode ${Math.round(performance.now() - fetchedAt)}ms ` +
        `${buffer.numberOfChannels}ch ${buffer.duration.toFixed(1)}s`,
    );
    onProgress(index + 1, sources.length);
  }

  const roles = ROLE_ORDER.filter((role) => stems.has(role));
  return {
    roles,
    channels: roles.map((role) => grown(stems.get(role), length)),
    duration: length / ctx.sampleRate,
  };
};

const workletModules = new WeakMap<BaseAudioContext, Promise<void>>();

/** Registers the processor once per context; a failed attempt may be retried. */
const loadStretchModule = (ctx: AudioContext): Promise<void> => {
  const known = workletModules.get(ctx);
  if (known) return known;
  const pending = ctx.audioWorklet.addModule(stretchModuleUrl);
  workletModules.set(ctx, pending);
  pending.catch(() => workletModules.delete(ctx));
  return pending;
};

/**
 * The processor's message protocol: `[id, method, ...args]` in, `[id, result]`
 * out, `["ready", …]` once its WebAssembly is running (calls made before that
 * are queued by the processor), `["time", …]` every 100 ms — unused here, the
 * position is derived from the schedule on the main thread.
 */
class StretchPort {
  private nextId = 0;
  private replies = new Map<number, (value: unknown) => void>();
  readonly ready: Promise<void>;

  constructor(private readonly port: MessagePort) {
    let markReady: () => void = () => undefined;
    this.ready = new Promise<void>((resolve) => {
      markReady = resolve;
    });
    port.onmessage = (event: MessageEvent<unknown>) => {
      const data = event.data;
      if (!Array.isArray(data)) return;
      const [id, value] = data as [unknown, unknown];
      if (id === "ready") {
        markReady();
        return;
      }
      if (typeof id !== "number") return;
      const reply = this.replies.get(id);
      if (!reply) return;
      this.replies.delete(id);
      reply(value);
    };
  }

  call(method: string, args: unknown[], transfer: Transferable[] = []): Promise<unknown> {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve) => {
      this.replies.set(id, resolve);
      this.port.postMessage([id, method, ...args], transfer);
    });
  }

  close(): void {
    this.replies.clear();
    this.port.onmessage = null;
    this.port.close();
  }
}

/** Where the node reads its input from `output` (context time) on. */
interface Segment {
  active: boolean;
  input: number;
  output: number;
  rate: number;
}

/** Moves a gain to `value` from `at` on, with a short ramp — a hard jump clicks. */
const rampTo = (param: AudioParam, value: number, at: number, now: number): void => {
  param.cancelScheduledValues(now);
  param.setTargetAtTime(value, at, GAIN_RAMP_S);
};

export class StretchedMix {
  private segment: Segment = { active: false, input: 0, output: 0, rate: 1 };
  private loop: PracticeLoop | null = null;

  private constructor(
    private readonly ctx: AudioContext,
    private readonly node: AudioWorkletNode,
    private readonly port: StretchPort,
    private readonly splitter: ChannelSplitterNode,
    private readonly stemGains: ReadonlyMap<StemRole, GainNode>,
    private readonly output: GainNode,
    private readonly roles: readonly StemRole[],
    /** How far ahead a change is scheduled: the node's latency plus a margin. */
    readonly lead: number,
  ) {}

  /**
   * Builds the node, hands it the stems (transferred, not copied) and wires
   * node → splitter → one gain per stem → output → `destination`. The output
   * starts closed; play() opens it. Rejects when the processor fails or its
   * WebAssembly does not come up; `onFailure` reports a processor that fails
   * later, which leaves the node silent for good.
   */
  static async create(
    ctx: AudioContext,
    destination: AudioNode,
    stems: PracticeStems,
    preset: PracticePreset,
    onFailure: () => void,
  ): Promise<StretchedMix> {
    await loadStretchModule(ctx);
    const channelCount = stems.channels.length;
    // One input although nothing is connected: the processor reads its input
    // list even while inactive, and with no input at all it throws.
    const node = new AudioWorkletNode(ctx, PROCESSOR_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [channelCount],
    });
    const port = new StretchPort(node.port);

    let reportFailure: () => void = () => undefined;
    let timer = 0;
    const failed = new Promise<never>((_, reject) => {
      node.addEventListener("processorerror", () => {
        reject(new Error("stretch processor error"));
        reportFailure();
      });
      timer = window.setTimeout(
        () => reject(new Error("stretch processor not ready")),
        PROCESSOR_READY_TIMEOUT_MS,
      );
    });
    failed.catch(() => undefined);
    const setUp = async (): Promise<unknown> => {
      await port.ready;
      await port.call(
        "addBuffers",
        [stems.channels],
        stems.channels.map((channel) => channel.buffer),
      );
      return port.call("latency", []);
    };
    let latency: unknown;
    try {
      latency = await Promise.race([setUp(), failed]);
    } catch (error) {
      port.close();
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
    reportFailure = onFailure;

    const splitter = ctx.createChannelSplitter(channelCount);
    const output = ctx.createGain();
    output.gain.value = 0;
    node.connect(splitter);
    const stemGains = new Map<StemRole, GainNode>();
    stems.roles.forEach((role, channel) => {
      const gain = ctx.createGain();
      gain.gain.value = stemLevel(role, stems.roles, preset);
      splitter.connect(gain, channel);
      gain.connect(output);
      stemGains.set(role, gain);
    });
    output.connect(destination);

    const lead = (typeof latency === "number" ? latency : 0) + SCHEDULE_MARGIN_S;
    return new StretchedMix(ctx, node, port, splitter, stemGains, output, stems.roles, lead);
  }

  get isPlaying(): boolean {
    return this.segment.active;
  }

  /** The input time heard at context time `at` (now by default). A change
   *  scheduled ahead reports its start position until it begins. */
  position(at: number = this.ctx.currentTime): number {
    const { active, input, output, rate } = this.segment;
    if (!active || at <= output) return input;
    const raw = input + (at - output) * rate;
    const loop = this.loop;
    // The node wraps its input at the loop end the same way.
    if (loop && raw >= loop.end) {
      return loop.start + ((raw - loop.start) % (loop.end - loop.start));
    }
    return raw;
  }

  play(position: number, rate: number): void {
    const now = this.ctx.currentTime;
    const at = now + this.lead;
    this.schedule({ active: true, input: position, output: at, rate });
    rampTo(this.output.gain, 1, at, now);
  }

  /** Stops at once (the output closes now, the node goes idle) and returns
   *  where it stopped. */
  pause(): number {
    const now = this.ctx.currentTime;
    const position = this.position(now);
    rampTo(this.output.gain, 0, now, now);
    this.schedule({ active: false, input: position, output: now, rate: this.segment.rate });
    return position;
  }

  /** A jump while playing: the output closes, the node moves, the output
   *  reopens when the new place sounds — no smear of the old place into it. */
  seek(position: number): void {
    if (!this.segment.active) return;
    const now = this.ctx.currentTime;
    const at = now + this.lead;
    rampTo(this.output.gain, 0, now, now);
    this.schedule({ active: true, input: position, output: at, rate: this.segment.rate });
    this.output.gain.setTargetAtTime(1, at, GAIN_RAMP_S);
  }

  /** Tempo change while playing, continuous in position; stored by the
   *  engine and passed to the next play() otherwise. */
  setRate(rate: number): void {
    if (!this.segment.active) return;
    const at = this.ctx.currentTime + this.lead;
    this.schedule({ active: true, input: this.position(at), output: at, rate });
  }

  /** Sets or clears the A–B loop; the node wraps at its end sample-accurately. */
  setLoop(loop: PracticeLoop | null): void {
    if (!this.segment.active) {
      this.loop = loop;
      return;
    }
    const at = this.ctx.currentTime + this.lead;
    // Read under the old loop: that is what plays until `at`.
    const input = this.position(at);
    this.loop = loop;
    this.schedule({ active: true, input, output: at, rate: this.segment.rate });
  }

  setPreset(preset: PracticePreset): void {
    const now = this.ctx.currentTime;
    this.stemGains.forEach((gain, role) => {
      rampTo(gain.gain, stemLevel(role, this.roles, preset), now, now);
    });
  }

  /** Releases the stems held by the node and takes it out of the graph. */
  dispose(): void {
    this.output.gain.value = 0;
    void this.port.call("schedule", [{ active: false, output: this.ctx.currentTime }]);
    // The port stays open until the processor has let go of the stems.
    void this.port.call("dropBuffers", []).then(() => this.port.close());
    try {
      this.output.disconnect();
      this.stemGains.forEach((gain) => gain.disconnect());
      this.splitter.disconnect();
      this.node.disconnect();
    } catch {
      // Already detached — nothing to release.
    }
  }

  private schedule(segment: Segment): void {
    this.segment = segment;
    const loop = this.loop;
    void this.port.call("schedule", [
      {
        active: segment.active,
        input: segment.input,
        output: segment.output,
        rate: segment.rate,
        loopStart: loop?.start ?? 0,
        loopEnd: loop?.end ?? 0,
      },
    ]);
  }
}
