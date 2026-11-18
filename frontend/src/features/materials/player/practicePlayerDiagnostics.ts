/**
 * @file practicePlayerDiagnostics.ts
 * @description Opt-in measurement log for the practice engine: what a phone
 * actually does when several voices play together. It records every engine
 * decision (preset, reconcile and handover, each tempo nudge or rejoin with the
 * drift behind it, jumps and how long their voices took to settle), every
 * media event of every voice, and the raw currentTime of each sounding voice
 * every 50 ms.
 *
 * Off unless switched on. In a browser: `?audiodebug=1` (log) or
 * `?audiodebug=observe` in the address; `?audiodebug=0` switches it off. An app
 * started from the home screen has no address bar, so five quick taps on the
 * mixer's practice-mode label toggle it as well. The choice is kept in
 * localStorage, which on iOS belongs to that one install.
 *
 * "observe" measures the drift and never corrects it — no tempo nudges, no
 * rejoins, newcomers fade in as soon as they play steadily — so what
 * currentTime reports can be held against what the ear hears. The slider and
 * the A–B loop still move every voice together.
 *
 * PracticeDiagnosticsOverlay shows the counters and the newest events; the full
 * log leaves the phone as a text file through the share sheet. With the log off
 * every call returns at once.
 */

export type DiagnosticsMode = "off" | "log" | "observe";

export interface DiagnosticsCounters {
  /** Jumps that moved every voice at once since the last preset tap. */
  resyncs: number;
  /** Tempo nudges since the last preset tap. */
  nudges: number;
  /** Heard voices taken out and brought back in since the last preset tap. */
  rejoins: number;
  /** waiting/stalled events of running voices since the last preset tap. */
  stalls: number;
  /** |drift| the last nudge set out to close, in seconds. */
  lastDrift: number | null;
  /** How long the last resync held the voices before releasing them, in ms. */
  lastSettleMs: number | null;
}

export interface DiagnosticsSnapshot {
  mode: DiagnosticsMode;
  counters: DiagnosticsCounters;
  /** The newest event lines, oldest first. */
  recent: readonly string[];
}

const STORAGE_KEY = "voct.practice.diagnostics";
const URL_PARAM = "audiodebug";
// Twenty clock samples a second fill this in five minutes — longer than any
// one measured take, short enough to share as a single text file.
const MAX_LINES = 6000;
// Kept short: the overlay must not cover the preset buttons it is measuring.
const RECENT_LINES = 6;
const TAP_COUNT = 5;
const TAP_WINDOW_MS = 2500;

const EMPTY_COUNTERS: DiagnosticsCounters = {
  resyncs: 0,
  nudges: 0,
  rejoins: 0,
  stalls: 0,
  lastDrift: null,
  lastSettleMs: null,
};

const isMode = (value: string | null): value is DiagnosticsMode =>
  value === "off" || value === "log" || value === "observe";

const persistMode = (mode: DiagnosticsMode): void => {
  try {
    if (mode === "off") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, mode);
    }
  } catch {
    // Storage blocked — the mode still holds for this page's life.
  }
};

/** The address wins over the stored choice and replaces it. */
const readInitialMode = (): DiagnosticsMode => {
  if (typeof window === "undefined") return "off";
  const param = new URLSearchParams(window.location.search).get(URL_PARAM);
  if (param !== null) {
    const mode: DiagnosticsMode =
      param === "observe" ? "observe" : param === "0" || param === "off" ? "off" : "log";
    persistMode(mode);
    return mode;
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isMode(stored) ? stored : "off";
  } catch {
    return "off";
  }
};

const isStandalone = (): boolean =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

class PracticeDiagnostics {
  private mode: DiagnosticsMode = readInitialMode();
  private origin = typeof performance === "undefined" ? 0 : performance.now();
  private lines: string[] = [];
  private taps: number[] = [];
  private listeners = new Set<() => void>();
  private snapshot: DiagnosticsSnapshot = {
    mode: this.mode,
    counters: EMPTY_COUNTERS,
    recent: [],
  };

  get enabled(): boolean {
    return this.mode !== "off";
  }

  /** Drift is measured and logged, never corrected. */
  get observeOnly(): boolean {
    return this.mode === "observe";
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): DiagnosticsSnapshot => this.snapshot;

  /** An engine decision or a media event: logged and shown on the overlay. */
  event(text: string): void {
    if (!this.enabled) return;
    const line = this.stamp(text);
    this.push(line);
    this.publish({ recent: [...this.snapshot.recent, line].slice(-RECENT_LINES) });
  }

  /** A clock reading: logged only — twenty a second would drown the overlay. */
  sample(text: string): void {
    if (!this.enabled) return;
    this.push(this.stamp(`· ${text}`));
  }

  /** Starts a new measurement window: the counters restart at a preset tap. */
  mark(text: string): void {
    if (!this.enabled) return;
    this.publish({ counters: EMPTY_COUNTERS });
    this.event(`== ${text}`);
  }

  noteResync(): void {
    this.bump({ resyncs: this.snapshot.counters.resyncs + 1 });
  }

  noteNudge(drift: number): void {
    this.bump({ nudges: this.snapshot.counters.nudges + 1, lastDrift: drift });
  }

  noteRejoin(): void {
    this.bump({ rejoins: this.snapshot.counters.rejoins + 1 });
  }

  noteStall(): void {
    this.bump({ stalls: this.snapshot.counters.stalls + 1 });
  }

  noteSettle(ms: number): void {
    this.bump({ lastSettleMs: ms });
  }

  setMode(mode: DiagnosticsMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    persistMode(mode);
    this.publish({ mode });
    this.event(`mode ${mode}`);
  }

  /** Five quick taps flip the log on or off — the way in for a home-screen
   *  app, which has no address bar to carry `?audiodebug`. */
  tap = (): void => {
    const now = performance.now();
    this.taps = [...this.taps.filter((at) => now - at < TAP_WINDOW_MS), now];
    if (this.taps.length < TAP_COUNT) return;
    this.taps = [];
    this.setMode(this.enabled ? "off" : "log");
  };

  clear(): void {
    this.lines = [];
    this.origin = performance.now();
    this.publish({ counters: EMPTY_COUNTERS, recent: [] });
  }

  exportText(): string {
    const header = [
      "VoctManager practice diagnostics",
      `exported ${new Date().toISOString()}`,
      `mode ${this.mode}`,
      `standalone ${String(isStandalone())}`,
      `ua ${navigator.userAgent}`,
      "times: seconds since the log started; · lines are 50 ms clock samples",
      "voice flags: j joining (muted), l leaving, p paused, s seeking, r<n> readyState below HAVE_FUTURE_DATA",
      "tick drift: ~ joining, ? not yet steady",
    ];
    return [...header, "", ...this.lines].join("\n");
  }

  private stamp(text: string): string {
    const seconds = (performance.now() - this.origin) / 1000;
    return `${seconds.toFixed(3).padStart(8)} ${text}`;
  }

  private push(line: string): void {
    this.lines.push(line);
    if (this.lines.length > MAX_LINES) {
      this.lines.splice(0, this.lines.length - MAX_LINES);
    }
  }

  private bump(patch: Partial<DiagnosticsCounters>): void {
    if (!this.enabled) return;
    this.publish({ counters: { ...this.snapshot.counters, ...patch } });
  }

  private publish(patch: Partial<DiagnosticsSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }
}

/** One log per page: the engine writes it, the overlay reads it. */
export const practiceDiagnostics = new PracticeDiagnostics();
