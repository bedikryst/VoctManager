/**
 * @file gifs.mjs
 * @description The README's three animated takes, as GIFs. Both READMEs
 * embed the English takes. GIFs land in out/gifs/ as <take>-en.gif; copy them
 * to docs/assets/.
 *
 * `annotations` and `score-ingestion` are cut from the 60 fps clips that
 * clips.mjs films (see CUTS), so they touch neither the dev stack nor the
 * model: `node gifs.mjs annotations score-ingestion`.
 *
 * `plan` is recorded here with Playwright. It edits the dev data, so reseed
 * before a run:
 *   docker exec voctmanager-web-1 python manage.py seed_db --clear --seed 2026
 * then `node gifs.mjs --lang en plan`.
 */

import { mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BASE, OUT, cliArgs, glide, glideTo, injectCursor, launch, login, settle, stage, themedContext, toGif,
} from "./lib.mjs";

const DIR = join(OUT, "gifs");

/** Seconds since the recording began, for cutting the take afterwards. */
const clock = (t0) => () => (Date.now() - t0) / 1000;

/**
 * GIFs cut from the clips, as [start, end, speed] in the clip's seconds. A
 * README GIF runs about half as long as its clip: a hold is shortened by
 * cutting into it, which shows no seam because nothing moves in it, and the
 * taps between tools, the pointer's travel and the scrolls run at double
 * speed. Strokes, the pinch and every stop on the review stay at their own
 * pace.
 */
const CUTS = {
  // A singer's own layer on the stand (clips.mjs `stand-draw`).
  annotations: {
    clip: join(OUT, "clips", "stand-draw-en.mp4"),
    // The README shows it 340 px wide; 600 keeps the marks sharp on a dense
    // screen at three quarters of the weight of 680.
    width: 600,
    segments: [
      [0.6, 1.4], // the whole page
      [1.4, 2.4], // two fingers spread over the first systems
      [3.3, 5.6, 2], // the tool panel, the pen, its colour
      [5.75, 7.2], // a circle round the p
      [7.7, 8.85, 2], // the highlighter
      [8.85, 9.9], // the Latin words highlighted
      [10.8, 12.55, 2], // the shapes, the hairpin
      [12.55, 13.5], // a crescendo into the printed mf
      [13.5, 14.6, 2], // the cover
      [14.6, 16.3], // the German underlay covered
      [16.3, 17.5, 2], // browse, done
      [18.6, 21.8], // the fingers close on the whole page and its marks
    ],
  },
  // The portfolio's join of two takes at the click on "Review and approve":
  // the upload and progress of a paid run (clips.mjs `ingest`, one frame per
  // 400 ms of the run), then `ingest-review`. Made in ../bugalski-dev by
  // `npm run clips -- ingestion`; INGESTION_CLIP names another file.
  "score-ingestion": {
    clip: process.env.INGESTION_CLIP
      ?? fileURLToPath(new URL("../../../bugalski-dev/public/media/cv/vm-ingestion.mp4", import.meta.url)),
    width: 960,
    segments: [
      [1.0, 1.6], // the archive
      [1.6, 2.75, 2], // Upload PDF, the drawer opens
      [3.35, 5.2], // the score dropped, the pipeline's progress, done
      [6.3, 6.83, 2], // to Review and approve
      [6.83, 7.9], // the review: the fields still to check
      [8.95, 10.85, 2],
      [10.85, 12.05], // the sung text and its IPA
      [13.1, 14.25, 2],
      [14.25, 15.45], // the composer, matched
      [16.75, 18.5, 2], // past the edition and its licence
      [19.55, 20.9, 2],
      [20.9, 21.8], // the translation
      [22.2, 25.0], // the programme note it can write
    ],
  },
};

const TAKES = {
  // Open the editor, drag a row, lengthen another, then open the singer's
  // view of the week.
  plan: {
    size: "desktop",
    viewport: { width: 1280, height: 800 },
    async run(page, ids, now, say) {
      await page.goto(`${BASE}/panel/rehearsals?rehearsal=${ids.planned_rehearsal}`);
      await page.getByText(say("Jeśli starczy czasu", "If time allows")).first().waitFor();
      await settle(page, 400);
      const header = page.getByText(say("Plan próby", "Rehearsal plan"), { exact: true }).first();
      await header.evaluate((node) => {
        window.scrollTo({ top: node.getBoundingClientRect().top + window.scrollY - 16, behavior: "instant" });
      });
      await page.waitForTimeout(800);
      const start = now();

      // A sent plan opens read-only; the editor is one click away.
      const edit = page.getByRole("button", { name: say("Edytuj plan", "Edit plan") });
      await glide(page, edit);
      await edit.click();
      const drag = say("Przeciągnij", "Drag");
      const handle = page.getByLabel(`${drag}: Ave verum corpus`);
      const target = page.getByLabel(`${drag}: Totus Tuus`);
      await handle.waitFor();
      await page.waitForTimeout(700);
      const from = await glide(page, handle);
      const to = await target.boundingBox();
      await page.mouse.down();
      // Past dnd-kit's 5 px activation threshold first, then up to the row above.
      await glideTo(page, from.x + from.width / 2, from.y + from.height / 2 - 8, 4);
      await glideTo(page, to.x + to.width / 2, to.y + to.height / 2 - 12, 18);
      await page.waitForTimeout(250);
      await page.mouse.up();
      await page.waitForTimeout(900);

      const label = say("Minuty", "Minutes");
      const row = page.getByLabel(`${drag}: Totus Tuus`)
        .locator(`xpath=ancestor::*[.//input[@aria-label='${label}']][1]`);
      const minutes = row.getByRole("spinbutton", { name: label });
      await glide(page, minutes);
      await minutes.click({ clickCount: 3 });
      await page.keyboard.type("35", { delay: 180 });
      await page.keyboard.press("Tab");
      await page.waitForTimeout(1300);
      const edited = now();
      // The recording drops frames while the editor works, so its timeline
      // drifts from the take's clock by a second or two, either way. Still
      // padding on both sides of each cut absorbs the drift; without it the
      // loader in between lands in the GIF.
      await page.waitForTimeout(2500);

      // Leaving drops the unsaved edit, so the take never writes to the plan.
      await page.goto(`${BASE}/panel/artists/${ids.tenor_artist}/preview?tab=schedule`);
      const part = page.getByText(say("Twoja część", "Your part")).first();
      await part.waitFor({ timeout: 20_000 });
      await settle(page, 2000);
      const preview = now();
      await glide(page, part, { steps: 12 });
      await page.waitForTimeout(4000);
      return [[start, edited, 1], [preview, now(), 1]];
    },
  },

};

const { lang, names, say, suffix } = cliArgs();
const cuts = names.filter((name) => name in CUTS);
const recorded = names.filter((name) => name in TAKES);
if (!cuts.length && !recorded.length) {
  throw new Error(`name a take: ${[...Object.keys(CUTS), ...Object.keys(TAKES)].join(", ")}`);
}

mkdirSync(DIR, { recursive: true });
for (const name of cuts) {
  const { clip, width, segments } = CUTS[name];
  const gif = join(DIR, `${name}-en.gif`);
  toGif(clip, gif, { segments, width });
  console.log("gif", gif);
}

if (recorded.length) {
  const ids = await stage({ lang });
  const browser = await launch();
  try {
    const state = await login(browser, ids.admin_email, "admin123");
    for (const name of recorded) {
      const take = TAKES[name];
      const output = `${name}${suffix}`;
      const video = join(DIR, `${output}-raw`);
      rmSync(video, { recursive: true, force: true });
      const context = await themedContext(browser, {
        state, size: take.size, theme: "light", lang, video, viewport: take.viewport,
      });
      await injectCursor(context);
      const page = await context.newPage();
      const now = clock(Date.now());
      let segments;
      try {
        segments = await take.run(page, ids, now, say, suffix);
      } finally {
        // Closing writes the video, so a take that fails midway still leaves
        // its recording to cut by hand.
        await context.close();
        const [file] = readdirSync(video).filter((entry) => entry.endsWith(".webm"));
        renameSync(join(video, file), join(DIR, `${output}.webm`));
      }
      const webm = join(DIR, `${output}.webm`);
      const gif = join(DIR, `${output}.gif`);
      toGif(webm, gif, { segments });
      console.log("gif", gif, segments.map((s) => s.map((n) => Math.round(n * 10) / 10)));
    }
  } finally {
    await browser.close();
    // The two accounts go back to Polish, the language the seed gives them.
    if (lang !== "pl") await stage();
  }
}
