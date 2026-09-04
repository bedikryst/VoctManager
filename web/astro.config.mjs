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
 *  - Prefetch + ClientRouter (set in BaseLayout)
 * @architecture Astro islands 2026
 * @module build/astro
 */
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";

import { registerAudit } from "./audit/index.mjs";
import { pruneOrphanAssets } from "./prune-orphan-assets.mjs";
import { staticTypography } from "./typography-static.mjs";

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
    //  - `filter`: drop pages that ship `<meta name="robots" content="noindex">` — the integration
    //    does NOT read the tag itself, so every noindex route must be listed here by hand.
    //    /press is the permanent EPK; /404 is the not-found body. A URL in the sitemap that then
    //    answers `noindex` is a contradiction Search Console reports as an error, so this list and
    //    the pages' own robots meta have to be kept in agreement in BOTH directions — which is how
    //    the hand-added /polityka-prywatnosci entry below came to be wrong.
    //    /polityka-prywatnosci is now a real route in three locales and the integration DOES
    //    discover it, so the exclusion has moved into the filter — one test over the three URLs.
    //  - `i18n`: emit `<xhtml:link rel="alternate" hreflang>` groups. Only pages that actually
    //    exist in a locale are grouped (currently just /o-nas → pl/en/fr); Polish-only pages get a
    //    single self-referential entry. Mirrors the per-page hreflang already set in BaseLayout.
    // Output lives at /sitemap-index.xml (NOT /sitemap.xml) — robots.txt points there.
    sitemap({
      filter: (page) =>
        page !== "https://voctensemble.com/press" &&
        page !== "https://voctensemble.com/404" &&
        !/\/polityka-prywatnosci$/.test(new URL(page).pathname),
      // NO customPages. The privacy policy used to be declared here — it was a hand-authored
      // static file the integration could not discover — but it serves
      // `<meta name="robots" content="noindex,follow">`, so the sitemap was submitting a URL the
      // page itself refuses to be indexed at. It is a real route in three locales now and the
      // integration finds all three, so the exclusion is a filter test instead. If the policy
      // SHOULD be indexed (it is a public legal document, and most sites do index theirs), drop
      // the noindex from PrivacyPage.astro first and then this clause — in that order.
      i18n: {
        defaultLocale: "pl",
        locales: { pl: "pl", en: "en", fr: "fr" },
      },
    }),
    // Micro-typography over the finished HTML — the orphan/abbreviation/dash rules in
    // src/lib/typo.ts, applied to every page including the copied public/*.html. `astro dev`
    // gets the same pass through src/middleware.ts. See typography-static.mjs.
    staticTypography(),
    // The eager image glob in src/lib/photos.ts makes Vite emit every camera original
    // next to the optimized renditions, unreferenced. Runs last so it sees the finished
    // output of every integration above it. See prune-orphan-assets.mjs.
    pruneOrphanAssets(),
    // Conformance gate for the entrance-register language. It reads the FINISHED artifact,
    // because Astro's `[data-astro-cid-…]` scoping is what decides most of the cascade contests
    // it checks and that attribute exists nowhere in the source. Last, so it sees what shipped.
    // See audit/index.mjs; `VOCT_AUDIT_SOFT=1` downgrades its errors to a report.
    registerAudit(),
  ],
});
