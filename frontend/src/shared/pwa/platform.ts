/**
 * @file platform.ts
 * @description Single source of truth for the two platform questions every PWA
 * surface asks: "is this an Apple touch device?" and "are we already running as
 * an installed app?". Both install and push hang off the first answer — iOS and
 * iPadOS never fire `beforeinstallprompt`, and Safari exposes the Push API only
 * to a web app launched from the home screen — so a device the app fails to
 * recognise gets a dead end instead of the one instruction that would help.
 * @module shared/pwa/platform
 */

/** `null` = not an Apple touch device (desktop, Android, …). */
export type AppleTouchDevice = "iphone" | "ipad" | null;

/**
 * iPadOS 13+ answers with a *desktop* Safari user agent — "Macintosh; Intel Mac
 * OS X …", no iPad token anywhere — so matching the UA alone reports every
 * tablet as a Mac. The touch-point count is the discriminator: iPadOS reports 5,
 * macOS reports 0 (a trackpad is not a touch screen).
 *
 * The check deliberately does not insist on Safari. Every iOS browser is WebKit
 * underneath and all current ones offer Add-to-Home-Screen; the CriOS / FxiOS /
 * EdgiOS tokens also vanish in desktop-UA mode, so excluding them was both
 * unreliable and a way to hide the instructions from people who need them.
 */
export const detectAppleTouchDevice = (): AppleTouchDevice => {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  if (/ipad/i.test(ua)) return "ipad";
  if (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return "ipad";
  if (/iphone|ipod/i.test(ua)) return "iphone";
  return null;
};

export const isAppleTouchDevice = (): boolean =>
  detectAppleTouchDevice() !== null;

/**
 * Launched as an installed app. `display-mode` covers every platform; the legacy
 * `navigator.standalone` flag is kept because iOS reports home-screen launches
 * there and older versions answer nothing else.
 */
export const isStandaloneDisplay = (): boolean =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);
