/**
 * @file pushNudge.ts
 * @description The contextual "enable push on this device" offer: a request
 * channel that any feature can call at the moment push would have helped, and
 * the per-device pacing that keeps the offer from turning into a nag.
 *
 * The offer is raised by a moment, never by a timer. A member who has just asked
 * for leave, confirmed an evening or said yes to a project has something riding
 * on what happens next, which is the one time the question "tell you the moment
 * it changes?" is about them rather than about the app. All moments share one
 * pacing budget, so adding a frequent one (an RSVP) raises the chance of an
 * offer without raising how many a device can ever see. The shell owns the push controller and renders the offer
 * (`usePushNudgeHost`); callers only name the moment.
 *
 * Pacing is per device because push permission is: a "not now" on the laptop
 * says nothing about the phone. Every offer that ends unanswered starts a 14-day
 * cooldown, but only a refusal — the close button or a swipe — counts towards
 * the three that end the contextual offer for good on that device. An offer
 * that simply timed out may never have been read. The quiet row in the
 * notification centre and the settings tab remain, and neither interrupts
 * anything.
 * @module features/notifications/lib/pushNudge
 */

export type PushNudgeMoment = "absence" | "presence" | "participation";

type PushNudgeListener = (moment: PushNudgeMoment) => void;

const listeners = new Set<PushNudgeListener>();

/** Ask the shell to offer push now. A no-op when no shell is listening. */
export const requestPushNudge = (moment: PushNudgeMoment): void => {
  listeners.forEach((listener) => listener(moment));
};

export const subscribePushNudge = (listener: PushNudgeListener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const STORAGE_KEY = "voct.push.nudge";
const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_DISMISSALS = 3;

interface NudgeRecord {
  readonly dismissedAt: number;
  readonly dismissals: number;
}

const readRecord = (): NudgeRecord | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as NudgeRecord).dismissedAt === "number" &&
      typeof (parsed as NudgeRecord).dismissals === "number"
    ) {
      return parsed as NudgeRecord;
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Whether this device may show the contextual offer now. Storage that cannot be
 * read (private mode, blocked site data) answers yes: the worst case is an offer
 * per moment, and each one still has to be earned by the member acting.
 */
export const isPushNudgeDue = (now: number = Date.now()): boolean => {
  const record = readRecord();
  if (!record) return true;
  if (record.dismissals >= MAX_DISMISSALS) return false;
  return now - record.dismissedAt >= COOLDOWN_MS;
};

/**
 * Records an offer that ended without being taken. `strike` is true for a
 * refusal (close button, swipe) and false for a timeout: both start the
 * cooldown, only a refusal counts towards the limit.
 */
export const recordPushNudgeDismissal = ({
  strike,
  now = Date.now(),
}: {
  strike: boolean;
  now?: number;
}): void => {
  const previous = readRecord();
  const next: NudgeRecord = {
    dismissedAt: now,
    dismissals: (previous?.dismissals ?? 0) + (strike ? 1 : 0),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Best-effort: without storage the cooldown simply does not hold.
  }
};
