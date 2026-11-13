/**
 * @file site.mjs
 * @description The portfolio's captures of the live voctensemble.com: stills
 * of the home page, the printed invitation, the About page and one section in
 * three languages side by side, and the donation clip, which stops before any
 * payment. The site is public and holds no member data, so these are taken
 * from production. A visitor who has already chosen silence and seen the
 * preloader, as on a second page, meets no sound gate.
 *
 *   node site.mjs                 # everything
 *   node site.mjs donate triptych # only the named ones
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

/** A visitor's context past the preloader and the sound gate. */
async function visitor(browser, { viewport = WINDOW, scale = 2, motion = false, locale = "en-GB" } = {}) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: scale,
    locale,
    timezoneId: "Europe/Warsaw",
    colorScheme: "dark",
    reducedMotion: motion ? "no-preference" : "reduce",
  });
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
};

const wanted = process.argv.slice(2);
mkdirSync(DIR, { recursive: true });
const browser = await launch({ args: ["--disable-smooth-scrolling"] });
try {
  const stills = wanted.filter((name) => name in STILLS);
  if (!wanted.length || stills.length) await JOBS.stills(browser, stills);
  if (!wanted.length || wanted.includes("triptych")) await JOBS.triptych(browser);
  if (!wanted.length || wanted.includes("donate")) await JOBS.donate(browser);
} finally {
  await browser.close();
}
