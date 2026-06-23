/**
 * @file errors.ts
 * @description Small, dependency-free helpers for classifying runtime errors so
 * the error surfaces can speak the right language. The one distinction that
 * actually changes the UX is "stale deploy" vs "genuine fault": after a new
 * build ships, clients still holding the old `index.html` request lazy chunk
 * URLs that no longer exist and the dynamic `import()` rejects. That is not a
 * crash the user caused — it just means "reload to get the fresh app".
 * @module shared/lib/errors
 * @architecture Enterprise SaaS 2026
 */

/**
 * True when an error is a failed lazy-chunk / dynamic-import load — the
 * signature of a client running against a superseded deploy. Matched by message
 * across engines (V8, SpiderMonkey, JSC) plus the Vite preload-helper and the
 * webpack `ChunkLoadError` name, so the check survives a bundler swap.
 */
export const isStaleChunkError = (error: unknown): boolean => {
  if (!error) return false;

  const name = (error as { name?: unknown }).name;
  if (name === "ChunkLoadError") return true;

  const message =
    typeof error === "string"
      ? error
      : typeof (error as { message?: unknown }).message === "string"
        ? ((error as { message: string }).message)
        : "";

  if (!message) return false;

  return [
    "failed to fetch dynamically imported module",
    "error loading dynamically imported module",
    "importing a module script failed",
    "unable to preload css",
    "loading chunk",
    "loading css chunk",
  ].some((needle) => message.toLowerCase().includes(needle));
};

/** Best-effort, human-readable one-liner for a thrown value. Never throws. */
export const describeError = (error: unknown): string => {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) {
    return error.stack || `${error.name}: ${error.message}`;
  }
  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
};
