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
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
