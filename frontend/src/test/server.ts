/**
 * @file server.ts
 * @description The one HTTP interceptor the flow tests run against. It starts
 * with no handlers on purpose: every suite declares the endpoints its flow is
 * allowed to touch, and `setup.ts` runs the server with
 * `onUnhandledRequest: "error"`. In a suite whose whole subject is writes that
 * cannot be undone, a request nobody stubbed is the finding — not noise to be
 * silenced by a permissive fallback.
 * @architecture Enterprise SaaS 2026
 * @module test/server
 */

import { setupServer } from "msw/node";

export const server = setupServer();
