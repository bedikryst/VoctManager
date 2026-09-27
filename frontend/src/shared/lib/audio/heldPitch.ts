/**
 * @file heldPitch.ts
 * @description Finds the one note a singer holds in a stream of pitch frames.
 * Pure and clock-free: the caller feeds each frame with its own timestamp, so
 * the rules below are testable without a microphone.
 *
 *  - A frame is a pitch in MIDI units, or null when the detector rejected it
 *    (unclear, or outside the window the caller listens in).
 *  - The pitch the rules judge is smoothed over about one vibrato cycle. A
 *    trained voice swings up to a semitone around its note five or six times a
 *    second, so raw frames of a perfectly steady note do not stay within 40
 *    cents of each other; their average over a cycle does.
 *  - A hold is a run of smoothed pitches within the tolerance of the run's
 *    mean, lasting the hold time. A pitch outside the tolerance starts a new
 *    run from itself, so a scoop into the note costs only its own length.
 *  - A short dropout (a breath of noise, a consonant) does not break the run;
 *    a longer one does.
 *
 * The result is the run's mean snapped to the nearest semitone. A run reports
 * when it reaches the hold time, and again only if its mean settles on another
 * semitone; a new run reports anew, so a singer who moves on to another note
 * is followed. It names the note sung; it never judges whether the note was
 * easy.
 * @module shared/lib/audio/heldPitch
 */

export interface HeldPitchOptions {
  /** How long the pitch must stay put to count as held. */
  readonly holdMs?: number;
  /** How far a smoothed pitch may stray from the run's mean, in cents. */
  readonly toleranceCents?: number;
  /** The span each frame is averaged over, about one vibrato cycle. */
  readonly smoothingMs?: number;
  /** The longest run of rejected frames a hold survives. */
  readonly gapMs?: number;
}

export interface HeldPitchStep {
  /** The smoothed pitch now, in MIDI units, or null while nothing is heard. */
  readonly cursor: number | null;
  /** The held note as a MIDI number, on the frame that completes the hold or
   *  moves a held run to another semitone; otherwise null. */
  readonly held: number | null;
}

export interface HeldPitchTracker {
  readonly push: (timeMs: number, midi: number | null) => HeldPitchStep;
  readonly reset: () => void;
}

const DEFAULT_HOLD_MS = 600;
const DEFAULT_TOLERANCE_CENTS = 40;
const DEFAULT_SMOOTHING_MS = 180;
const DEFAULT_GAP_MS = 150;

interface Run {
  readonly startMs: number;
  sum: number;
  count: number;
}

export const createHeldPitchTracker = ({
  holdMs = DEFAULT_HOLD_MS,
  toleranceCents = DEFAULT_TOLERANCE_CENTS,
  smoothingMs = DEFAULT_SMOOTHING_MS,
  gapMs = DEFAULT_GAP_MS,
}: HeldPitchOptions = {}): HeldPitchTracker => {
  let recent: { timeMs: number; midi: number }[] = [];
  let run: Run | null = null;
  let lastHeardMs: number | null = null;
  /** The note the current run last reported, or null before it is held. */
  let reported: number | null = null;

  const reset = (): void => {
    recent = [];
    run = null;
    lastHeardMs = null;
    reported = null;
  };

  const push = (timeMs: number, midi: number | null): HeldPitchStep => {
    if (midi === null) {
      if (lastHeardMs === null || timeMs - lastHeardMs > gapMs) {
        recent = [];
        run = null;
        return { cursor: null, held: null };
      }
      return { cursor: recent.length > 0 ? smoothed() : null, held: null };
    }

    lastHeardMs = timeMs;
    recent.push({ timeMs, midi });
    recent = recent.filter((frame) => timeMs - frame.timeMs <= smoothingMs);
    const pitch = smoothed();

    if (run === null || Math.abs(pitch - run.sum / run.count) * 100 > toleranceCents) {
      run = { startMs: timeMs, sum: pitch, count: 1 };
      reported = null;
    } else {
      run.sum += pitch;
      run.count += 1;
    }

    if (timeMs - run.startMs >= holdMs) {
      const note = Math.round(run.sum / run.count);
      if (note !== reported) {
        reported = note;
        return { cursor: pitch, held: note };
      }
    }
    return { cursor: pitch, held: null };
  };

  const smoothed = (): number =>
    recent.reduce((sum, frame) => sum + frame.midi, 0) / recent.length;

  return { push, reset };
};
