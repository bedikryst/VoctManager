/**
 * @file gifs.mjs
 * @description The README's three animated takes, recorded with Playwright
 * and cut into GIFs with ffmpeg. Each take edits the dev data, so reseed
 * before a run:
 *   docker exec voctmanager-web-1 python manage.py seed_db --clear --seed 2026
 * then `node gifs.mjs plan annotations` (and `ingest` on its own, see below).
 * `--lang en` records the same takes in the English interface, into
 * <take>-en.gif. Both READMEs embed the English takes; one set to keep current
 * is half the paid ingest runs.
 *
 * `ingest` runs the real AI pipeline: it needs ANTHROPIC_API_KEY in the dev
 * stack and costs $0.04–0.20 a run, with a different result each time. Record
 * it once and keep the GIF. `INGEST_PDF=<path>` swaps the score it uploads; a
 * PDF already in the archive is matched by its SHA-256 and never reaches the
 * model, which makes a free rehearsal of the take:
 *   INGEST_PDF=out/scores/ave-verum-mozart.pdf node gifs.mjs ingest
 * The rehearsal leaves a second edition of that piece awaiting review, so
 * reseed before the paid run. The rehearsal cannot show one more trap: the
 * dev `web` runs runserver (WSGI), which buffers the progress stream whole, so
 * the row reads "Queued" until the end. For the paid run, start `web` under
 * uvicorn with a throwaway override holding
 *   services: { web: { command: uvicorn config.asgi:application --host 0.0.0.0 --port 8000 } }
 *   docker compose -f docker-compose.yml -f docker-compose.dev.yml -f <override> up -d --no-deps --no-build web
 * and run the same command without the override afterwards.
 */

import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  BASE, OUT, cliArgs, glide, glideTo, injectCursor, launch, login, settle, stage, themedContext, toGif,
} from "./lib.mjs";

const DIR = join(OUT, "gifs");
// Giovanni Priuli, Ave dulcissima Maria (Mutopia Project, CC BY-SA 3.0): a
// piece the seed does not hold, so the pipeline catalogues it from nothing.
const INGEST_URL = "https://www.mutopiaproject.org/ftp/PriuliG/Ave_dulcissima_Maria/Ave_dulcissima_Maria-a4.pdf";

/** Seconds since the recording began, for cutting the take afterwards. */
const clock = (t0) => () => (Date.now() - t0) / 1000;

/**
 * A toolbar control by its accessible name. Placed marks are buttons named
 * after their stamp too ("Crescendo"), so anything inside a mark is skipped.
 */
async function tool(page, name) {
  for (const candidate of await page.getByRole("button", { name, exact: true }).all()) {
    const onPage = await candidate.evaluate((node) => node.closest("[data-annotation-mark]") !== null);
    if (!onPage && (await candidate.isVisible())) return candidate;
  }
  throw new Error(`no visible toolbar control named ${name}`);
}

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

  // Stamp a crescendo, open it, and hand it up from the choir to the leader.
  annotations: {
    size: "tablet",
    viewport: { width: 820, height: 1180 },
    gifWidth: 720,
    async run(page, ids, now, say) {
      await page.goto(`${BASE}/panel/materials/${ids.showcase}/${ids.piece}`);
      await page.getByRole("button", { name: say("Otwórz partyturę", "Open score") }).first().click();
      const canvas = page.locator(".react-pdf__Page__canvas").first();
      await canvas.waitFor({ timeout: 30_000 });
      await settle(page, 800);
      const start = now();

      const toolbar = page.getByRole("button", { name: say("Narzędzia adnotacji", "Annotation tools") });
      if (await toolbar.isVisible().catch(() => false)) {
        await glide(page, toolbar);
        await toolbar.click();
        await page.waitForTimeout(400);
      }
      for (const name of ["Symbol", say("Dynamika", "Dynamics"), "Crescendo"]) {
        const control = await tool(page, name);
        await glide(page, control);
        await control.click();
        await page.waitForTimeout(350);
      }
      // Over the last system's opening bars, high enough on the page that the
      // mark's card opens below it in full.
      const box = await canvas.boundingBox();
      const spot = { x: box.x + box.width * 0.22, y: box.y + box.height * 0.487 };
      await glideTo(page, spot.x, spot.y, 14);
      await page.mouse.click(spot.x, spot.y);
      await page.waitForTimeout(600);

      const browse = await tool(page, say("Przeglądaj", "Browse"));
      await glide(page, browse);
      await browse.click();
      await page.waitForTimeout(300);
      await glideTo(page, spot.x, spot.y, 14);
      await page.mouse.click(spot.x, spot.y);
      const ladder = page.getByRole("group", { name: say("Kto to widzi", "Who sees this") });
      await ladder.waitFor();
      await page.waitForTimeout(600);
      const leader = ladder.getByRole("button", {
        name: say("Dla prowadzącego próbę", "For whoever runs the rehearsal"),
      });
      await glide(page, leader);
      await leader.click();
      await page.waitForTimeout(1600);
      return [[start, now(), 1]];
    },
  },

  // Upload, the pipeline's live progress, then the review cockpit.
  // A narrower window than the other takes: the upload sheet's progress line
  // is small print, and this keeps it legible at 960 px.
  ingest: {
    size: "desktop",
    viewport: { width: 1120, height: 720 },
    async run(page, ids, now, say, suffix) {
      await page.goto(`${BASE}/panel/archive-management`);
      await settle(page, 600);
      const start = now();
      const upload = page.getByRole("button", { name: say("Wgraj PDF", "Upload PDF") });
      await glide(page, upload);
      await upload.click();
      await page.waitForTimeout(700);
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(ids.ingest_pdf);
      const sent = now();
      // A still of the live progress for the README, taken mid-run.
      await page.waitForTimeout(15_000);
      await page.screenshot({
        path: join(DIR, `score-compiler-upload${suffix}-light.png`),
        style: "#readme-media-cursor { display: none !important; }",
      });
      // Any end state, so a failed run stops the take rather than hanging it.
      // Read inside the upload drawer only: the archive list behind it shows
      // the same "Approved" status on its own rows.
      const drawer = page.getByRole("dialog").filter({ has: page.locator('input[type="file"]') });
      const finished = drawer.getByText(say(
        /^(AI zakończył pracę|Zatwierdzone|Przetwarzanie nie powiodło się|Błąd wysyłki)$/,
        /^(AI has finished|Approved|Processing failed|Upload failed)$/,
      )).first();
      await finished.waitFor({ timeout: 15 * 60_000 });
      const done = now();
      console.log(`ingest: pipeline ended "${await finished.textContent()}" after ${Math.round(done - sent)} s`);
      await page.waitForTimeout(1200);
      const review = drawer.getByRole("link", { name: say("Sprawdź i zatwierdź", "Review and approve") }).first();
      if (!(await review.isVisible())) {
        await page.screenshot({ path: join(DIR, `ingest${suffix}-ended.png`) });
        throw new Error(`the run ended without a review to open; see out/gifs/ingest${suffix}-ended.png`);
      }
      await glide(page, review);
      const pointed = now();
      // As in the plan take, the recording drifts from the take's clock by a
      // second or two, so each cut is padded with stillness on both sides:
      // the cursor rests on the link before the click, and the cockpit holds
      // before and after its segment.
      await page.waitForTimeout(2500);
      await review.click();
      await page.getByText(say("Zatwierdź i opublikuj", "Approve & publish")).first().waitFor({ timeout: 30_000 });
      await page.locator(".react-pdf__Page__canvas").first().waitFor({ timeout: 30_000 });
      await settle(page, 2000);
      const cockpit = now();
      await page.waitForTimeout(5000);
      const end = now();
      // The pipeline's minutes pass in about three seconds, and the loader
      // between the click and the cockpit is cut.
      const speed = Math.max(1, (done + 1.2 - (sent + 2)) / 3);
      return [
        [start, sent + 2, 1],
        [sent + 2, done + 1.2, speed],
        [pointed, pointed + 1, 1],
        [cockpit, end - 1.5, 1],
      ];
    },
  },
};

const { lang, names, say, suffix } = cliArgs();
const wanted = names.filter((name) => name in TAKES);
if (!wanted.length) throw new Error(`name a take: ${Object.keys(TAKES).join(", ")}`);

mkdirSync(DIR, { recursive: true });
const ids = await stage({ lang });
if (wanted.includes("ingest")) {
  ids.ingest_pdf = process.env.INGEST_PDF
    ? resolve(process.env.INGEST_PDF)
    : join(OUT, "scores", "priuli-ave-dulcissima.pdf");
  if (!process.env.INGEST_PDF) {
    const response = await fetch(INGEST_URL);
    if (!response.ok) throw new Error(`score download failed: ${response.status}`);
    writeFileSync(ids.ingest_pdf, Buffer.from(await response.arrayBuffer()));
  }
}
const browser = await launch();
try {
  const state = await login(browser, ids.admin_email, "admin123");
  for (const name of wanted) {
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
      // Closing writes the video, so a take that fails after a paid pipeline
      // run still leaves its recording to cut by hand.
      await context.close();
      const [recorded] = readdirSync(video).filter((file) => file.endsWith(".webm"));
      renameSync(join(video, recorded), join(DIR, `${output}.webm`));
    }
    const webm = join(DIR, `${output}.webm`);
    const gif = join(DIR, `${output}.gif`);
    toGif(webm, gif, { segments, width: take.gifWidth ?? 960 });
    console.log("gif", gif, segments.map((s) => s.map((n) => Math.round(n * 10) / 10)));
  }
} finally {
  await browser.close();
  // The two accounts go back to Polish, the language the seed gives them.
  if (lang !== "pl") await stage();
}
