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
 * `flows` — jsdom, and every suite that renders the panel goes through
 * `src/test/harness.tsx`.
 *
 * ON THE SIZE OF `flows`: it covers five flows and a few hooks only — publishing
 * a project (which mails the whole cast and cannot be recalled), a chorister's
 * RSVP, a conductor's roll-call, account activation, the score marks' writes
 * (the read-back that leaves a singer's own markings on their device, the write
 * rules, undo, and the "new marks" baseline), and the microphone capture behind
 * the vocal-range screen. The rest of the panel has no component tests, and that is
 * a decision, not a gap someone forgot to close. These are the ones where a
 * regression sends mail, marks the wrong person absent, burns a single-use
 * invitation link, hands somebody blank paper at a rehearsal, or leaves a
 * singer's microphone open — the places where `tsc`, a build and a look at the
 * screen genuinely are not evidence. A pass that wants broader coverage should
 * argue for it on its own terms rather than reading this ceiling as an
 * oversight.
 *
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
          // A whole page rendered in jsdom takes one to two seconds alone, and
          // several times that while every jsdom file boots in parallel; the
          // default five seconds then fails a passing flow on load alone.
          testTimeout: 15_000,
        },
      },
    ],
  },
});
