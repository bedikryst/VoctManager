// @ts-check
/**
 * @file astro.config.mjs
 * @description Public marketing site build pipeline.
 *  - `build.format: "file"` emits `kontakt.html` / `o-nas.html` / `index.html` so the
 *    existing nginx `try_files /<page>.html` routing (infra/nginx/prod.conf) keeps working
 *    when this dist/ replaces the hand-authored HTML mount. Localized pages emit under a
 *    locale folder (`en/o-nas.html`, `fr/o-nas.html`) — the same `$uri.html` rule serves them.
 *  - React integration enables hydrated islands (donation Vault, audio gate) lifted from
 *    the old SPA — static pages ship zero JS.
 *  - `i18n`: Polish is the un-prefixed default (`/o-nas`); English and French live under
 *    `/en/*` and `/fr/*`. `prefixDefaultLocale: false` keeps every existing Polish URL byte-
 *    identical, so translation is opt-in per page (a route file under `src/pages/en|fr/`).
 *    NOTE: routing is done with PHYSICAL route files, not by this block — there is no `[locale]`
 *    param and no middleware, so Astro auto-generates nothing here; the config only registers the
 *    locale set (and populates `Astro.currentLocale`). See `src/i18n/config.ts` for the path
 *    helpers that keep un-translated links pointing at the Polish original instead of 404-ing
 *    into an empty locale folder.
 *  - Prefetch + ClientRouter (set in BaseLayout) give Awwwards-grade cross-page transitions
 *    without a CSR shell.
 * @architecture Astro islands 2026
 * @module build/astro
 */
import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  site: "https://voctensemble.com",
  build: {
    format: "file",
  },
  i18n: {
    defaultLocale: "pl",
    locales: ["pl", "en", "fr"],
    routing: {
      prefixDefaultLocale: false,
    },
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "viewport",
  },
  integrations: [react()],
});
