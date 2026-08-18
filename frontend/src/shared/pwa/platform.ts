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
 * Which *instruction* to show is a separate question — {@link detectAppleBrowser}.
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

/** Which app is rendering the page — each one reaches the home screen its own way. */
export type AppleBrowser = "safari" | "other-browser" | "in-app";

/**
 * A WebView embedded in a native app — a link opened inside Messenger, Gmail,
 * Instagram, LinkedIn. It renders the page but has no Add-to-Home-Screen entry
 * at all, so the Safari steps are a dead end there; the only instruction that
 * leads anywhere is "reopen this in Safari". Two signals, because neither alone
 * covers the field: the vendor tokens the large apps append, and the missing
 * `Safari/` token that plain WKWebViews have — real browsers, Chrome and
 * Firefox on iOS included, always keep that token.
 */
const IN_APP_TOKENS =
  /FBAN|FBAV|FB_IAB|Instagram|Messenger|LinkedInApp|Line\/|Twitter|MicroMessenger|Snapchat|Pinterest|GSA\//i;

/**
 * iOS browsers that reach Add-to-Home-Screen through the same share sheet as
 * Safari (iOS 16.4 opened it to them) but keep the Share button in the address
 * bar rather than the toolbar, and sit further down the sheet. Same route, two
 * different things to point at.
 */
const OTHER_BROWSER_TOKENS = /CriOS|EdgiOS|FxiOS|OPiOS|OPT\/|DuckDuckGo|YaBrowser/i;

/**
 * Best effort, and knowingly so: iPadOS "Request Desktop Website" strips the
 * CriOS / FxiOS tokens, so a Chrome user can still be read as Safari. That is
 * why the Safari copy carries the "can't see the icon? open ••• " fallback —
 * it has to survive being shown to the wrong browser.
 */
export const detectAppleBrowser = (): AppleBrowser => {
  if (typeof navigator === "undefined") return "safari";
  const ua = navigator.userAgent;
  if (IN_APP_TOKENS.test(ua) || !/Safari\//i.test(ua)) return "in-app";
  if (OTHER_BROWSER_TOKENS.test(ua)) return "other-browser";
  return "safari";
};

/**
 * The one instruction this member needs, device and app folded together. Only
 * the in-app WebView is a genuinely different route; the rest share the sheet
 * and differ in where the Share button sits — top toolbar on an iPad, hidden
 * under "•••" in the compact layout iOS 26 made the iPhone default, in the
 * address bar in Chrome and its kin.
 *
 * `null` = nothing to explain (not an Apple touch device).
 */
export type AppleInstallGuide =
  | "safari-iphone"
  | "safari-ipad"
  | "other-browser"
  | "in-app";

export const resolveAppleInstallGuide = (): AppleInstallGuide | null => {
  const device = detectAppleTouchDevice();
  if (device === null) return null;

  const browser = detectAppleBrowser();
  if (browser !== "safari") return browser;
  return device === "ipad" ? "safari-ipad" : "safari-iphone";
};

/**
 * Launched as an installed app. `display-mode` covers every platform; the legacy
 * `navigator.standalone` flag is kept because iOS reports home-screen launches
 * there and older versions answer nothing else.
 */
export const isStandaloneDisplay = (): boolean =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);
