/**
 * @file errorTrail.ts
 * @description Remembers the last uncaught error the page saw, so a report
 * written a minute later still carries it.
 *
 * The error boundaries only see faults thrown during render. The ones members
 * actually hit — a rejected request, an audio node that refused to start, a
 * chunk that failed to load — surface as a stuck spinner and reach no boundary
 * at all. Those arrive here.
 *
 * Deliberately one slot, not a ring buffer: the report is about the thing that
 * just happened, and a scrollback of earlier noise makes triage slower, not
 * faster. Nothing is transmitted until the member writes a report and sends it.
 * @module features/feedback/lib/errorTrail
 */

const MAX_DETAIL_LENGTH = 1800;

let lastError: string | null = null;
let isInstalled = false;

/** A rejection is often a plain object, which stringifies to "[object Object]". */
const describe = (detail: unknown): string => {
  if (detail instanceof Error) {
    return `${detail.name}: ${detail.message}\n${detail.stack ?? ""}`;
  }
  if (detail !== null && typeof detail === "object") {
    try {
      return JSON.stringify(detail);
    } catch {
      return Object.prototype.toString.call(detail);
    }
  }
  return String(detail);
};

const record = (label: string, detail: unknown): void => {
  // Stamped, because the trail outlives the fault: a report written twenty
  // minutes later still carries the last error, and without a time triage reads
  // an unrelated stack as the cause of whatever the member is describing.
  const at = new Date().toISOString().slice(11, 19);
  lastError = `[${label} @ ${at}] ${describe(detail)}`.slice(0, MAX_DETAIL_LENGTH);
};

/**
 * Installs the global listeners. Idempotent, and safe to call from a component
 * effect — a second mount (StrictMode, remount) will not double-register.
 */
export const installErrorTrail = (): void => {
  if (isInstalled || typeof window === "undefined") return;
  isInstalled = true;

  window.addEventListener("error", (event) => {
    record("uncaught", event.error ?? event.message);
  });
  window.addEventListener("unhandledrejection", (event) => {
    record("promise", event.reason);
  });
};

export const readLastError = (): string | null => lastError;
