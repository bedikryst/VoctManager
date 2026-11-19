/**
 * @file site.mjs
 * @description The portfolio's captures of the live voctensemble.com: stills
 * of the home page, the printed invitation, the About page and one section in
 * three languages side by side, and the donation clip: in a desk window up to
 * the currency, and on a phone through the whole sheet to the thank-you, with
 * no request ever reaching the bank; and the press counter's composer, three
 * photographs ticked and saved as one archive. The site is public and holds no
 * member data, so these are taken from production. A visitor who has already
 * chosen silence and seen the preloader, as on a second page, meets no sound
 * gate.
 *
 *   node site.mjs                        # everything
 *   node site.mjs donate donate-mobile   # only the named ones
 *
 * Files land in out/site/.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { Film, filmable } from "./film.mjs";
import { OUT, injectCursor, launch } from "./lib.mjs";

const DIR = join(OUT, "site");
const SITE = process.env.README_MEDIA_SITE ?? "https://voctensemble.com";
const WINDOW = { width: 1440, height: 820 };

/**
 * A visitor's context past the preloader and the sound gate. The foundation's
 * analytics never count a capture: every page opened here would be a visit, and
 * the thank-you a donation.
 */
async function visitor(browser, { viewport = WINDOW, scale = 2, motion = false, locale = "en-GB", touch = false } = {}) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: scale,
    isMobile: touch,
    hasTouch: touch,
    locale,
    timezoneId: "Europe/Warsaw",
    colorScheme: "dark",
    reducedMotion: motion ? "no-preference" : "reduce",
  });
  await context.route("https://plausible.io/**", (route) => route.abort());
  await context.addInitScript(() => {
    localStorage.setItem("voct.demo.audio", JSON.stringify({ choice: "silence", timestamp: Date.now() }));
    sessionStorage.setItem("voct.preloader.seen", "1");
  });
  return context;
}

async function open(page, path) {
  await page.goto(`${SITE}${path}`, { waitUntil: "load", timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(2500);
}

const STILLS = {
  home: "/en",
  invitation: "/zaproszenie",
  about: "/en/o-nas",
};

const JOBS = {
  async stills(browser, wanted) {
    const context = await visitor(browser);
    const page = await context.newPage();
    for (const [name, path] of Object.entries(STILLS)) {
      if (wanted.length && !wanted.includes(name)) continue;
      await open(page, path);
      await page.screenshot({ path: join(DIR, `ve-${name}.png`) });
      console.log("still", name);
    }
    await context.close();
  },

  // The home page's opening in Polish, English and French, each at a narrow
  // window, set side by side into one browser-sized picture.
  async triptych(browser) {
    const width = WINDOW.width / 3;
    const parts = [];
    for (const [lang, path] of [["pl", "/"], ["en", "/en"], ["fr", "/fr"]]) {
      const context = await visitor(browser, { viewport: { width, height: WINDOW.height }, locale: lang });
      const page = await context.newPage();
      await open(page, path);
      const file = join(DIR, `triptych-${lang}.png`);
      await page.screenshot({ path: file });
      parts.push(file);
      await context.close();
    }
    execFileSync("ffmpeg", [
      "-y", "-loglevel", "error", ...parts.flatMap((file) => ["-i", file]),
      "-filter_complex", "[0][1][2]hstack=inputs=3", join(DIR, "ve-languages.png"),
    ]);
    console.log("still triptych");
  },

  // Open the donation sheet, pick an amount, switch the currency; no further.
  async donate(browser) {
    const context = await visitor(browser, { motion: true });
    await filmable(context);
    await injectCursor(context);
    const page = await context.newPage();
    const film = new Film(page, join(DIR, "donate-frames"));
    await open(page, "/en");
    await film.begin();
    await film.hold(1.8);
    await film.click(page.getByText("Support us", { exact: true }).first());
    // The amounts and currencies are radio buttons, so they are found by tag and text.
    const amount = page.locator("button", { hasText: /^\s*200\s*PLN\s*$/ }).filter({ visible: true }).first();
    await film.see(amount);
    await film.hold(1.8);
    await film.click(amount, { seconds: 0.6 });
    await film.hold(1.2);
    await film.click(page.locator("button", { hasText: /^\s*EUR\s*$/ }).filter({ visible: true }).first(), { seconds: 0.5 });
    await film.hold(3.5);
    await context.close();
    const result = film.encode(join(DIR, "ve-donate.mp4"), { poster: join(DIR, "ve-donate.webp") });
    console.log("clip donate", result);
  },

  // A whole donation on a phone, by touch: the home page's opening, "Support us"
  // in its header, the sheet over the whole screen, an amount, the currency, the
  // sheet down to its foot and back, an address made up for the take, the
  // consent, the gift, and the thank-you the site opens on the return from the
  // bank. The take answers the donation request itself with that return, so
  // nothing reaches the foundation's server or the bank, and the clip cuts from
  // the pressed button straight to the home page under the thank-you. The window
  // is what a large phone's browser leaves the page with its bars showing, 430 by
  // 740, so the screen stands wider than the app's full-screen 390 by 844.
  async donateMobile(browser) {
    const phone = { width: 430, height: 740 };
    const context = await visitor(browser, { viewport: phone, motion: true, touch: true });
    await filmable(context);
    await context.route("**/api/payments/donations/initiate/", (route) => route.fulfill({
      json: { redirectUrl: `${SITE}/en?donated=success` },
    }));
    const page = await context.newPage();
    const film = new Film(page, join(DIR, "donate-mobile-frames"));
    await open(page, "/en");
    await film.begin();
    await film.hold(1.8);
    await film.tap(page.getByText("Support us", { exact: true }).filter({ visible: true }).first());
    const amount = page.locator("button", { hasText: /^\s*200\s*PLN\s*$/ }).filter({ visible: true }).first();
    await film.see(amount);
    await film.hold(1.8);
    await film.tap(amount);
    await film.hold(1.0);
    await film.tap(page.locator("button", { hasText: /^\s*EUR\s*$/ }).filter({ visible: true }).first());
    await film.hold(1.2);

    // The wheel scrolls the sheet under the finger's last place, which lies on it.
    const sheet = page.locator(".vault-sheet");
    const depth = await sheet.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop);
    if (depth < 200) throw new Error(`donate-mobile: the sheet scrolls only ${depth} px`);
    await film.scroll(depth, 2.6);
    await film.hold(1.2);
    // Back up until the button sits above the window's lower edge, with the
    // address and the consent over it.
    const give = page.locator("button.give-submit");
    const bottom = await give.evaluate((el) => el.getBoundingClientRect().bottom);
    await film.scroll(bottom - (phone.height - 64), 1.8);
    await film.hold(0.5);

    await film.tap(page.locator("#giveEmail"));
    await film.type("anna.nowak@example.com");
    await film.hold(0.5);
    await film.tap(page.locator(".give-consent-box"));
    await film.hold(0.9);

    // The press as tap() draws it, with the release outside a frame: the page
    // leaves for the thank-you the moment the answer arrives.
    const box = await give.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await film.frame(3);
    await page.mouse.down();
    await film.frame(4);
    const back = page.waitForURL(/donated=success/, { waitUntil: "commit" });
    await page.mouse.up();
    await back;
    // The new page's clock stands still before its scripts run, so the
    // thank-you's wait and its fade play in the take.
    await film.begin();
    await page.waitForLoadState("load");
    await page.evaluate(() => document.fonts.ready);
    await film.see(page.locator("#gratitude.is-visible"), { seconds: 6 });
    await film.hold(4.5);
    await context.close();
    const result = film.encode(join(DIR, "ve-donate-mobile.mp4"), { poster: join(DIR, "ve-donate-mobile.webp") });
    console.log("clip donate-mobile", result);
  },

  // The press counter in a desk window, with the site's own cursor: the head,
  // down to the press photographs, two of the first row and one of the second
  // ticked while the bar at the foot counts them, "Pobierz wybrane", and the
  // archive built in the browser until the bar counts the selection again. The
  // composer reports a saved archive to Plausible, which `visitor` aborts, so
  // the board's download numbers stay clean.
  async press(browser) {
    const context = await visitor(browser, { motion: true, locale: "pl-PL" });
    await filmable(context);
    const page = await context.newPage();
    const film = new Film(page, join(DIR, "press-frames"));
    await open(page, "/press");
    // The page scrolls natively (BaseLayout's `nativeScroll`). A deploy that predates it still
    // mounts Lenis, which eases each wheel step away from where the take sends it.
    await page.evaluate(() => window.__lenis?.destroy());
    // The site's cursor trails the pointer, so it is given time to settle between the head's
    // two columns before the clock stops.
    await page.mouse.move(820, 430);
    await page.waitForTimeout(1200);
    film.pointer = { x: 820, y: 430 };
    await film.begin();
    await film.hold(1.6);

    // A tile's box shows under the pointer, and on every tile once one is ticked. With the
    // group's heading 160 px down, its first row stands whole and the second row's boxes
    // clear the bar that rises at the foot.
    const box = (group, n) => page.locator(`label.press-pick--tile:has(input[data-basket-group="${group}"])`).nth(n);
    const heading = page.locator("#zdjecia h3").first();
    const under = await heading.evaluate((el) => el.getBoundingClientRect().top);
    await film.scroll(under - 160, 1.4);
    await film.hold(0.7);
    await film.click(box("landscape", 0));
    await film.hold(0.8);
    await film.click(box("landscape", 2), { seconds: 0.7 });
    await film.hold(0.6);
    await film.click(box("landscape", 4), { seconds: 0.6 });
    await film.hold(1.0);

    // The archive fetches its files one after another and the bar shows the share that
    // has arrived. A frame here takes real time, so the line is slowed until those bytes
    // take about 1.4 s of clip, measured against the frames just recorded.
    const bytes = await page.evaluate(() => {
      const manifest = JSON.parse(document.getElementById("press-basket-data").textContent);
      const ticked = [...document.querySelectorAll("input[data-basket-item]:checked")];
      return ticked.reduce(
        (sum, input) => sum + manifest.items[input.dataset.basketItem].reduce((n, file) => n + file.bytes, 0),
        manifest.readme.bytes,
      );
    });
    const started = Date.now();
    await film.hold(0.5);
    const perFrame = (Date.now() - started) / 30;
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 0,
      uploadThroughput: -1,
      downloadThroughput: Math.round(bytes / ((1.4 * film.fps * perFrame) / 1000)),
    });
    const get = page.locator("[data-basket-get]");
    await film.click(get, { seconds: 0.6 });
    await film.until(() => page.locator("[data-basket-bar]").evaluate((el) => !el.hasAttribute("aria-busy")), { seconds: 20 });
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, uploadThroughput: -1, downloadThroughput: -1 });
    await film.hold(2.4);
    await context.close();
    const result = film.encode(join(DIR, "ve-press.mp4"), { poster: join(DIR, "ve-press.webp") });
    console.log("clip press", result, { bytes, perFrame });
  },
};

const wanted = process.argv.slice(2);
mkdirSync(DIR, { recursive: true });
const browser = await launch({ args: ["--disable-smooth-scrolling"] });
try {
  const stills = wanted.filter((name) => name in STILLS);
  if (!wanted.length || stills.length) await JOBS.stills(browser, stills);
  if (!wanted.length || wanted.includes("triptych")) await JOBS.triptych(browser);
  if (!wanted.length || wanted.includes("donate")) await JOBS.donate(browser);
  if (!wanted.length || wanted.includes("donate-mobile")) await JOBS.donateMobile(browser);
  if (!wanted.length || wanted.includes("press")) await JOBS.press(browser);
} finally {
  await browser.close();
}
