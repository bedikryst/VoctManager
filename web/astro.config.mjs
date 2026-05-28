// @ts-check
/**
 * @file astro.config.mjs
 * @description Public marketing site build pipeline.
 *  - `build.format: "file"` emits `kontakt.html` / `o-nas.html` / `index.html` so the
 *    existing nginx `try_files /<page>.html` routing (infra/nginx/prod.conf) keeps working
 *    when this dist/ replaces the hand-authored HTML mount.
 *  - React integration enables hydrated islands (donation Vault, audio gate) lifted from
 *    the old SPA — static pages ship zero JS.
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
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "viewport",
  },
  integrations: [react()],
});
