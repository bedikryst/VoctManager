/**
 * @file setup.ts
 * @description Per-file bootstrap for the `flows` vitest project: the browser
 * APIs jsdom omits, the real i18n instance pinned to Polish, and the msw
 * lifecycle. Runs before every `.test.tsx` file.
 *
 * The i18n instance here is the application's own, not a test copy. The flow
 * tests find buttons by the Polish words a chorister reads, so a second
 * instance seeded with test strings would let the locale files rot while the
 * suite stayed green — and react-i18next keeps a single default instance
 * anyway, so two `initReactI18next` calls would race.
 * @architecture Enterprise SaaS 2026
 * @module test/setup
 */

import { afterAll, afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";

import { server } from "./server";

// jsdom ships neither of these, and both are reached during an ordinary render:
// framer-motion queries the reduced-motion preference on mount, and the
// composites that size themselves observe their box. Absent, they surface as a
// constructor TypeError from inside a library rather than as a failed
// assertion.
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

// Assigned through `globalThis`, not `window`: TypeScript takes the `in` guard
// as proof the property is absent and narrows `window` itself to `never`, so the
// obvious spelling does not compile.
if (!("ResizeObserver" in window)) {
  (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver =
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver;
}

// The language detector reads this key first and jsdom's navigator reports
// en-US, so seed it before i18n initialises — afterwards the bundle is already
// chosen. Polish is the panel's primary locale and the one the tests assert.
window.localStorage.setItem("voctmanager_lang", "pl");

const { default: i18n, i18nReady } = await import("@/shared/config/i18n");
await i18nReady;
if (i18n.language !== "pl") {
  await i18n.changeLanguage("pl");
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => server.close());
