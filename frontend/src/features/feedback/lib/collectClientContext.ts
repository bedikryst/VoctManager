/**
 * @file collectClientContext.ts
 * @description Snapshots the client environment at the moment a report is
 * written. This is the part that makes a report actionable: free text alone
 * reliably produces "nie działa", and the difference between that and a fixable
 * defect is knowing which build, which viewport and which connection it
 * happened on.
 *
 * Every key here has a matching entry in the backend's `_CONTEXT_SPEC`
 * whitelist — anything sent without one is dropped server-side, silently. Add
 * to both or to neither.
 * @module features/feedback/lib/collectClientContext
 */

import type { FeedbackContext } from "../types/feedback.dto";
import { readLastError } from "./errorTrail";

/** `standalone` means the installed PWA, where the SW may be serving a stale shell. */
const resolveDisplayMode = (): string => {
  if (typeof window.matchMedia !== "function") return "unknown";
  const modes = ["standalone", "minimal-ui", "fullscreen"] as const;
  const active = modes.find((mode) => window.matchMedia(`(display-mode: ${mode})`).matches);
  return active ?? "browser";
};

/** Non-standard and absent on Safari — read defensively, report "unknown". */
const resolveConnection = (): string => {
  const connection = (
    navigator as Navigator & { connection?: { effectiveType?: string } }
  ).connection;
  return connection?.effectiveType ?? "unknown";
};

export const collectClientContext = (technicalDetail?: string): FeedbackContext => {
  // The boundary's own detail wins over the ambient trail: when a view just
  // crashed, that stack is the report's subject, not whatever preceded it.
  const lastError = technicalDetail ?? readLastError() ?? undefined;

  return {
    user_agent: navigator.userAgent,
    platform: navigator.platform,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    screen: `${window.screen.width}x${window.screen.height}`,
    pixel_ratio: String(window.devicePixelRatio),
    locale: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    display_mode: resolveDisplayMode(),
    connection: resolveConnection(),
    online: navigator.onLine,
    app_version: __APP_BUILD__,
    // Stamped client-side so a report that waited in the offline queue still
    // says when it was actually written, not when it finally reached us.
    captured_at: new Date().toISOString(),
    ...(lastError ? { last_error: lastError } : {}),
  };
};
