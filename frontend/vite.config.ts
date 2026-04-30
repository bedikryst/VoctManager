/**
 * @file vite.config.ts
 * @description Production-grade Vite build pipeline.
 *  - Deterministic vendor chunking by domain (react-core, motion, maps, pdf, dnd, radix, i18n, query, forms, dates, icons).
 *  - Modern ES2022 target aligned with tsconfig (no legacy transpile cost).
 *  - Hidden source maps (debuggable from sentry-style symbol uploads, never exposed publicly).
 *  - Optional bundle visualizer in `analyze` mode (npm run build:analyze).
 *  - PWA in injectManifest mode for push-only integration.
 * @architecture Enterprise SaaS 2026
 * @module build/vite
 */

import { defineConfig } from "vite";
import type { PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { VitePWA } from "vite-plugin-pwa";
import { visualizer } from "rollup-plugin-visualizer";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  const isAnalyze = mode === "analyze";

  const plugins: PluginOption[] = [
    react(),
    tailwindcss(),
    tsconfigPaths(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectRegister: null,
      manifest: false,
      injectManifest: {
        globPatterns: [],
      },
      devOptions: {
        enabled: true,
        type: "classic",
      },
    }),
  ];

  if (isAnalyze) {
    plugins.push(
      visualizer({
        filename: "dist/stats.html",
        template: "treemap",
        gzipSize: true,
        brotliSize: true,
        open: false,
      }) as PluginOption,
    );
  }

  return {
    plugins,
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    build: {
      target: "es2022",
      cssCodeSplit: true,
      sourcemap: "hidden",
      reportCompressedSize: false,
      chunkSizeWarningLimit: 600,
      assetsInlineLimit: 4096,
      modulePreload: { polyfill: true },
      rollupOptions: {
        output: {
          manualChunks: {
            "react-core": ["react", "react-dom", "react-router-dom"],
            motion: ["framer-motion", "lenis"],
            "data-query": ["@tanstack/react-query", "axios"],
            forms: ["react-hook-form", "@hookform/resolvers", "zod"],
            i18n: [
              "i18next",
              "react-i18next",
              "i18next-browser-languagedetector",
            ],
            radix: [
              "@radix-ui/react-dialog",
              "@radix-ui/react-slot",
              "@radix-ui/react-switch",
              "@radix-ui/react-tooltip",
            ],
            dnd: ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
            dates: ["date-fns", "date-fns-tz"],
            icons: ["lucide-react"],
            maps: ["@vis.gl/react-google-maps"],
            pdf: ["react-pdf"],
            ui: [
              "sonner",
              "class-variance-authority",
              "clsx",
              "tailwind-merge",
              "usehooks-ts",
              "zustand",
            ],
          },
        },
      },
    },
  };
});
