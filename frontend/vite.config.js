import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url"; // Nowoczesny, bezpieczny standard ESM

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    tsconfigPaths(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      // Registration is handled manually in usePushNotifications hook.
      injectRegister: null,
      // No web app manifest needed — this is a push-only integration.
      manifest: false,
      injectManifest: {
        // No assets to precache — empty manifest is injected as self.__WB_MANIFEST = [].
        globPatterns: [],
      },
      devOptions: {
        enabled: true,
        type: "classic",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
  },
});
