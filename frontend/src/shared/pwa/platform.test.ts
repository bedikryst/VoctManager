/**
 * @file platform.test.ts
 * @description Guards the one detection that decides whether an Apple member
 * ever sees an install instruction. The user agents below are real strings, and
 * the iPadOS one is the reason this file exists: it says "Macintosh" and carries
 * no iPad token, so a UA-only check silently classified every tablet as a
 * desktop and hid both the install nudge and the push explanation from it.
 * @architecture Enterprise SaaS 2026
 * @module shared/pwa/platform.test
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { detectAppleTouchDevice } from "@/shared/pwa/platform";

const UA = {
  /** iPadOS 13+ Safari — desktop-class UA, no iPad token anywhere. */
  ipadOS:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  /** iPad running the legacy mobile UA (older iPadOS, or "Request Mobile"). */
  ipadLegacy:
    "Mozilla/5.0 (iPad; CPU OS 12_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1",
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  /** Chrome on iOS — WebKit underneath, Add-to-Home-Screen available. */
  chromeIOS:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/122.0 Mobile/15E148 Safari/604.1",
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  android:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Mobile Safari/537.36",
} as const;

const asDevice = (userAgent: string, maxTouchPoints: number): void => {
  vi.stubGlobal("navigator", { userAgent, maxTouchPoints });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("detectAppleTouchDevice", () => {
  it("recognises an iPad behind the desktop-class iPadOS user agent", () => {
    asDevice(UA.ipadOS, 5);
    expect(detectAppleTouchDevice()).toBe("ipad");
  });

  it("does not mistake a Mac for a tablet — the same UA with no touch points", () => {
    asDevice(UA.macSafari, 0);
    expect(detectAppleTouchDevice()).toBeNull();
  });

  it("still recognises the legacy iPad user agent", () => {
    asDevice(UA.ipadLegacy, 5);
    expect(detectAppleTouchDevice()).toBe("ipad");
  });

  it("recognises an iPhone", () => {
    asDevice(UA.iphone, 5);
    expect(detectAppleTouchDevice()).toBe("iphone");
  });

  it("covers non-Safari iOS browsers, which can also add to the home screen", () => {
    asDevice(UA.chromeIOS, 5);
    expect(detectAppleTouchDevice()).toBe("iphone");
  });

  it("leaves Android to the native install prompt", () => {
    asDevice(UA.android, 5);
    expect(detectAppleTouchDevice()).toBeNull();
  });
});
