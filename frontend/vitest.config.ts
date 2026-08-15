/**
 * @file vitest.config.ts
 * @description Unit-test runner. Reuses the project's tsconfig path aliases
 * (`@/*`) via vite-tsconfig-paths and runs in a Node environment — the suites
 * cover pure domain helpers, so no DOM is required.
 * @architecture Enterprise SaaS 2026
 * @module build/vitest
 */
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  // `__APP_BUILD__` is a build-time constant the app config injects. Vitest loads
  // its own config, so without this any suite that reaches code stamping the
  // build identity dies on an undefined global rather than on its assertion.
  define: {
    __APP_BUILD__: JSON.stringify("test"),
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
