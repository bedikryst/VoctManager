/**
 * @file vitest.config.ts
 * @description Two test projects, split by what they need rather than by where
 * they live.
 *
 * `logic` — the pure domain helpers (diacritic fold, field shell, inline
 * editing, preference groups, day timeline). No DOM, no setup file, so it stays
 * fast enough to run on every save. Its glob is `.test.ts`, which is why the
 * component suites had to be `.test.tsx`: adding a DOM to this project would
 * have taxed six fast suites to serve the new ones.
 *
 * `flows` — jsdom, and every suite goes through `src/test/harness.tsx`.
 *
 * ON THE SIZE OF `flows`: it covers four flows only — publishing a project
 * (which mails the whole cast and cannot be recalled), a chorister's RSVP, a
 * conductor's roll-call, and account activation. The rest of the panel has no
 * component tests, and that is a decision, not a gap someone forgot to close.
 * These four are the ones where a regression sends mail, marks the wrong person
 * absent, or burns a single-use invitation link — the places where `tsc`, a
 * build and a look at the screen genuinely are not evidence. A pass that wants
 * broader coverage should argue for it on its own terms rather than reading this
 * ceiling as an oversight.
 *
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
    projects: [
      {
        // `extends: true` inherits the path aliases and the build-identity
        // define above; without it each project would need its own copy.
        extends: true,
        test: {
          name: "logic",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "flows",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./src/test/setup.ts"],
        },
      },
    ],
  },
});
