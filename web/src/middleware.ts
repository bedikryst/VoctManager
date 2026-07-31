/**
 * @file middleware.ts
 * @description DEV parity for the micro-typography pass (lib/typoHtml): what the developer
 *  proofreads in the browser is what will ship. The built output is handled by the
 *  `voct:typography` integration instead — it also reaches `public/*.html`, which is copied
 *  rather than rendered and so never passes through here. Same function on both paths; this one
 *  steps aside in production so the pass is not run twice over the same page.
 *
 *  Guarded to HTML: `next()` also returns the sitemap, the manifest and dev-server assets, and a
 *  no-break space has no business in any of them.
 *
 *  Two things to know when proofreading in `astro dev`:
 *   - `public/*.html` (the privacy policy) is served straight off disk by the static handler,
 *     never through a route — so it looks unpinned in dev and is pinned in the build. Read that
 *     one from `npm run preview`.
 *   - a dev server that was already running when this file (or lib/typo.ts) changed can keep
 *     serving the module it loaded at startup. Restart it after touching a rule.
 * @architecture Astro islands 2026
 * @module middleware
 */

import type { MiddlewareHandler } from "astro";

import { typographyHtml } from "./lib/typoHtml";

export const onRequest: MiddlewareHandler = async (_context, next) => {
  const response = await next();
  if (!import.meta.env.DEV) return response;
  if (!response.headers.get("content-type")?.includes("text/html")) return response;

  const html = await response.text();
  return new Response(typographyHtml(html), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};
