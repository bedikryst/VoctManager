#!/usr/bin/env node
/**
 * @file shots.mjs
 * @description Screenshots and box measurements of the marketing site through system Edge.
 * Used to judge a page by how it renders before reading its source. Procedure and flags:
 * `.claude/skills/zrzuty/SKILL.md`.
 *
 *   node web/scripts/shots.mjs --width 360,390,1440 /koncerty/pochwala-stworzenia
 *   node web/scripts/shots.mjs --width 390 --pages /koncerty/pochwala-stworzenia
 *   node web/scripts/shots.mjs --width 390 --at .kd-ianua --probe ".kd-hero,.kd-hero-title" /
 */
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

// What a device shows on arrival, browser toolbars up, because a hero sized in `svh` is only judged
// at the height it meets: a 390×844 iPhone gives Safari 664.
const HEIGHTS = { 320: 568, 360: 640, 390: 664, 430: 746, 820: 1100, 844: 390, 980: 600, 1366: 768, 1440: 900, 1920: 1080 };
const PHONE_MAX_WIDTH = 980;

const parseArgs = (argv) => {
  const flags = { base: "http://localhost:4341", width: "390,1440", motion: "full", out: join(tmpdir(), "voct-shots") };
  const paths = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) paths.push(arg);
    else if (arg === "--pages") flags.pages = true;
    else flags[arg.slice(2)] = argv[(i += 1)];
  }
  return { flags, paths: paths.length ? paths : ["/"] };
};

const slug = (path) => path.replace(/\?.*$/, "").replace(/^\/|\/$/g, "").replace(/\//g, "-") || "home";

const probe = (page, selectors) =>
  page.evaluate((list) => {
    const lines = [`viewport ${innerWidth}x${innerHeight}, document width ${document.documentElement.scrollWidth}`];
    for (const selector of list) {
      const el = document.querySelector(selector);
      if (!el) {
        lines.push(`${selector}: absent`);
        continue;
      }
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      lines.push(
        `${selector}: x ${Math.round(box.left)}..${Math.round(box.right)}, y ${Math.round(box.top + scrollY)}..${Math.round(box.bottom + scrollY)}, font ${style.fontSize}/${style.lineHeight}`,
      );
    }
    return lines.join("\n");
  }, selectors);

const main = async () => {
  const { flags, paths } = parseArgs(process.argv.slice(2));
  rmSync(flags.out, { recursive: true, force: true });
  mkdirSync(flags.out, { recursive: true });

  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const widthText of flags.width.split(",")) {
      const width = Number(widthText);
      const height = Number(flags.height) || HEIGHTS[width] || Math.round(width * 0.625);
      const isPhone = width <= PHONE_MAX_WIDTH;
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: isPhone ? 2 : 1,
        hasTouch: isPhone,
        isMobile: isPhone,
        reducedMotion: flags.motion === "full" ? "no-preference" : "reduce",
        locale: flags.locale ?? "pl-PL",
      });
      const page = await context.newPage();
      for (const path of paths) {
        await page.goto(new URL(path, flags.base).href, { waitUntil: "load" });
        // `load` does not wait for decoding, and dev renders an image on first request: without this
        // a full-bleed hero is shot as its black ground.
        await page.evaluate(async () => {
          await document.fonts.ready;
          const eager = [...document.images].filter((image) => image.loading !== "lazy");
          await Promise.all(eager.map((image) => image.decode().catch(() => undefined)));
        });
        if (flags.css) await page.addStyleTag({ content: flags.css });
        await page.waitForTimeout(flags.motion === "full" ? 1800 : 300);
        const stem = join(flags.out, `${slug(path)}-${width}`);

        if (flags.pages) {
          const total = await page.evaluate(() => document.documentElement.scrollHeight);
          for (let index = 0, y = 0; y < total; index += 1, y += height) {
            await page.evaluate((top) => scrollTo(0, top), y);
            await page.waitForTimeout(350);
            const file = `${stem}-${String(index + 1).padStart(2, "0")}.png`;
            await page.screenshot({ path: file });
            console.log(file);
          }
        } else {
          if (flags.at) {
            await page.locator(flags.at).first().scrollIntoViewIfNeeded();
            await page.waitForTimeout(350);
          }
          await page.screenshot({ path: `${stem}.png` });
          console.log(`${stem}.png`);
        }
        if (flags.probe) console.log(await probe(page, flags.probe.split(",")));
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
};

await main();
