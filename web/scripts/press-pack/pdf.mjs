/**
 * @file pdf.mjs
 * @description HTML → PDF through the Edge already installed on this machine.
 *
 *  `playwright-core` carries no browser and downloads none; it drives the system's Microsoft Edge
 *  (`channel: "msedge"`), the same arrangement as the `vm-shot` harness. `PRESS_PDF_CHANNEL`
 *  overrides the channel — "chrome" on a machine with Chrome and no Edge.
 *
 *  THE TEXT IS REAL TEXT. Chromium's PDF output keeps every glyph selectable and mapped to its
 *  character, so an editor copies a sentence out of the release rather than retyping it. The
 *  site's fonts are variable, which Chromium embeds as outlines with a Unicode map — pdf.js and
 *  Acrobat read "ż" back as "ż"; some minimal PDF libraries do not, and that is theirs to fix.
 *
 *  Each document is written to a temporary file and opened from there, because the templates load
 *  the site's fonts from `web/public/fonts` over `file://` and a page set from a string has no
 *  origin allowed to read them.
 * @architecture Astro islands 2026
 * @module scripts/press-pack/pdf
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright-core";

/**
 * Render every `{ name, html }` job to a PDF buffer, in one browser session.
 * @param {readonly { name: string, html: string }[]} jobs
 * @returns {Promise<Map<string, Buffer>>}
 */
export async function renderPdfs(jobs) {
  const channel = process.env.PRESS_PDF_CHANNEL || "msedge";
  let browser;
  try {
    browser = await chromium.launch({ channel });
  } catch (error) {
    throw new Error(
      `cannot start the "${channel}" browser for the PDFs (${error.message.split("\n")[0]}). ` +
        'Install Microsoft Edge, or set PRESS_PDF_CHANNEL to an installed channel such as "chrome".',
    );
  }
  const dir = mkdtempSync(path.join(tmpdir(), "press-pdf-"));
  const out = new Map();
  try {
    const page = await browser.newPage();
    for (const job of jobs) {
      const file = path.join(dir, `${job.name}.html`);
      writeFileSync(file, job.html, "utf8");
      await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      out.set(job.name, await page.pdf({ preferCSSPageSize: true, printBackground: true }));
    }
  } finally {
    await browser.close();
    rmSync(dir, { recursive: true, force: true });
  }
  return out;
}
