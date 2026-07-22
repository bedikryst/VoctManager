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
import sitemap from "@astrojs/sitemap";

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
  integrations: [
    react(),
    // Auto-generated sitemap — replaces the hand-maintained public/sitemap.xml, which listed
    // 6 URLs while the build emits 13 indexable pages (every concert detail page, /kolofon and
    // the /en|/fr translations were missing). Regenerates on every build, so adding a concert
    // can no longer leave the sitemap stale.
    //  - `filter`: drop /press — it ships `<meta name="robots" content="noindex,follow">`, so it
    //    must not be advertised for indexing (the integration does NOT read the noindex tag itself).
    //  - `i18n`: emit `<xhtml:link rel="alternate" hreflang>` groups. Only pages that actually
    //    exist in a locale are grouped (currently just /o-nas → pl/en/fr); Polish-only pages get a
    //    single self-referential entry. Mirrors the per-page hreflang already set in BaseLayout.
    // Output lives at /sitemap-index.xml (NOT /sitemap.xml) — robots.txt points there.
    sitemap({
      filter: (page) => page !== "https://voctensemble.com/press",
      // The privacy policy is a hand-authored static file (public/polityka-prywatnosci.html),
      // not an Astro route, so the integration can't discover it — declare it explicitly or it
      // silently drops out of the sitemap (it was present in the old hand-maintained one).
      customPages: ["https://voctensemble.com/polityka-prywatnosci"],
      i18n: {
        defaultLocale: "pl",
        locales: { pl: "pl", en: "en", fr: "fr" },
      },
    }),
  ],
});
