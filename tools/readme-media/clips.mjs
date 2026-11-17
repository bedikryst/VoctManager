/**
 * @file clips.mjs
 * @description The portfolio's moving captures: 60 fps H.264 MP4 clips with
 * a WebP poster, recorded frame by frame on a virtual clock (film.mjs), so no
 * frame is dropped however busy the page is. A clip shows its feature at the
 * pace a viewer can follow and runs as long as that takes, held still for a
 * moment at both ends so its loop joins. Each take sets its device scale: 1
 * is already sharp in the portfolio's frame, about 520 px wide on screen, and
 * every frame at scale 2 costs four times the pixels. Clips are encoded for
 * quality, not weight: the portfolio loads a clip only when it is shown.
 *
 * Needs the dev stack up and a fresh seed, since takes edit the data:
 *   docker exec voctmanager-web-1 python manage.py seed_db --clear --seed 2026
 * then `node clips.mjs --lang en <take> ...`. Clips land in out/clips/.
 *
 * `comment` and `copydesk` need the corpus on the dev desk, and `comment` the
 * Astro dev server too (see shots.mjs); README_MEDIA_SITE names the server.
 * `ingest` runs the real pipeline on a score the archive does not hold, which
 * needs ANTHROPIC_API_KEY in the dev stack and costs $0.04–0.20 a run.
 * INGEST_PDF swaps the score; a PDF already in the archive is matched by its
 * SHA-256 and never reaches the model, which makes a free rehearsal, though it
 * leaves a second edition awaiting review, so reseed before the paid run. The
 * dev `web` runs runserver (WSGI), which buffers the progress stream whole, so
 * the drawer reads "Queued" until the end; for the paid run start `web` under
 * uvicorn with a throwaway override holding
 *   services: { web: { command: uvicorn config.asgi:application --host 0.0.0.0 --port 8000 } }
 *   docker compose -f docker-compose.yml -f docker-compose.dev.yml -f <override> up -d --no-deps --no-build web
 * and run the same command without the override afterwards.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Film, filmable } from "./film.mjs";
import {
  BASE, OUT, cliArgs, django, injectCursor, launch, login, settle, settleReports, stage, themedContext,
} from "./lib.mjs";

const DIR = join(OUT, "clips");
const SITE = process.env.README_MEDIA_SITE ?? "http://localhost:4321";
// Giovanni Priuli, Ave dulcissima Maria (Mutopia Project, CC BY-SA 3.0): a
// piece the seed does not hold, so the pipeline catalogues it from nothing.
const INGEST_URL = "https://www.mutopiaproject.org/ftp/PriuliG/Ave_dulcissima_Maria/Ave_dulcissima_Maria-a4.pdf";

// A real exchange from production, translated and cut to its first question:
// the agent cannot see the ensemble's data and says where a manager finds it.
const FEE_QUESTION = "Please tell me who got the highest fee for the last concert.";
const FEE_REPLY = [
  "I can't see the ensemble's data, so I won't give a name. You'll find it here: Projects → the last "
  + "concert → Budget → Fees. That tab shows each person's fee, split into Cast, Crew and Outside the cast.",
  "The list doesn't sort by amount, so the highest fee has to be read off the rows. If you'd rather sort "
  + "the amounts, go to Budget → Overview → \"Settlement (CSV)\". That file opens in Excel.",
].join("\n\n");

/**
 * Answer the newest report of `email` as the support agent would, through its
 * own delivery path, with a written reply instead of a paid run.
 */
function answerAsAgent(email, reply) {
  django(`
from django.utils import timezone
from core.models import FeedbackReport
from support.delivery import _send_reply
from support.models import SupportRun, SupportRunResult, SupportRunTrigger
report = FeedbackReport.objects.filter(reporter__email=${JSON.stringify(email)}).order_by("-created_at").first()
record = SupportRun.objects.create(report=report, trigger=SupportRunTrigger.AUTO)
channel, thread = _send_reply(report, record, ${JSON.stringify(reply)})
record.result = SupportRunResult.SENT
record.reply = ${JSON.stringify(reply)}
record.channel = channel
record.thread = thread
record.finished_at = timezone.now()
record.save()
`);
}

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

/** Open the showcase piece's score on the stand. */
async function openScore(page, ids, say) {
  await page.goto(`${BASE}/panel/materials/${ids.showcase}/${ids.piece}`);
  await page.getByRole("button", { name: say("Otwórz partyturę", "Open score") }).first().click();
  await page.locator(".react-pdf__Page__canvas").first().waitFor({ timeout: 30_000 });
  await settle(page, 1500);
}

/**
 * A function that turns fractions of the score's page into window points, at
 * the page's present zoom and scroll.
 */
async function pageAt(page) {
  const box = await page.locator(".react-pdf__Page__canvas").first().boundingBox();
  return (fx, fy) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy });
}

// PdfViewer's WHEEL_ZOOM_SENSITIVITY (frontend/src/shared/ui/composites/PdfViewer/constants.ts).
const WHEEL_ZOOM = 0.0022;

/**
 * Two fingers spreading (factor > 1) or closing on the stand. The stand reads a
 * ctrl+wheel as the same gesture: the page scales round the point under it as
 * the fingers move, and the zoom commits once they rest. The hold lets the
 * commit fire and the page render sharp at its new size.
 */
async function pinch(page, film, focal, factor, seconds = 0.8) {
  const total = -Math.log(factor) / WHEEL_ZOOM;
  const steps = Math.round(seconds * 60);
  await page.mouse.move(focal.x, focal.y);
  await page.keyboard.down("Control");
  let done = 0;
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const ease = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
    const to = total * ease;
    await page.mouse.wheel(0, to - done);
    done = to;
    await film.frame();
  }
  await page.keyboard.up("Control");
  await film.hold(0.6);
}

/** Points along a straight line, for a drag drawn one step per frame. */
function line(from, to, steps) {
  return Array.from({ length: steps + 1 }, (_, i) => ({
    x: from.x + ((to.x - from.x) * i) / steps,
    y: from.y + ((to.y - from.y) * i) / steps,
  }));
}

/** A finger drawn through the points, one point per frame. */
async function stroke(page, film, points) {
  await page.mouse.move(points[0].x, points[0].y);
  await film.frame(3);
  await page.mouse.down();
  for (const point of points.slice(1)) {
    await page.mouse.move(point.x, point.y);
    await film.frame();
  }
  await page.mouse.up();
  await film.frame(2);
}

/** A tap on the page at a point. */
async function tapAt(page, film, point) {
  await page.mouse.move(point.x, point.y);
  await film.frame(3);
  await film.press();
}

/**
 * A seed keeps the desk's corpus but not what earlier takes proposed on it, so
 * the words a take rewrites are the site's own again.
 */
function clearDesk() {
  django("from copydesk.models import CopyProposal\nCopyProposal.objects.all().delete()\n");
}

/**
 * Scroll a scrolling element to `top` along an eased path, one step per frame.
 * Set directly rather than wheeled: a wheel over a field that scrolls itself
 * (a long text) would move the field before the form.
 */
async function scrollWithin(film, locator, top, seconds = 1.4) {
  const from = await locator.evaluate((node) => node.scrollTop);
  const steps = Math.max(1, Math.round(seconds * 60));
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const ease = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
    await locator.evaluate((node, y) => { node.scrollTop = y; }, Math.round(from + (top - from) * ease));
    await film.frame();
  }
}

/** Scroll the window so the element sits `offset` px from the top, before filming. */
async function bringTo(locator, offset) {
  await locator.evaluate((node, top) => {
    window.scrollTo({ top: node.getBoundingClientRect().top + window.scrollY - top, behavior: "instant" });
  }, offset);
}

const TAKES = {
  // The conductor asks the app something only the data can answer; the
  // agent's reply arrives in Messages a few minutes later (cut).
  agent: {
    size: "desktop",
    scale: 2,
    theme: "light",
    showFeedback: true,
    async run(page, film, ids, say) {
      await page.goto(`${BASE}/panel`);
      await settle(page, 1500);
      await film.begin();
      await film.hold(1.6);
      await film.click(page.getByRole("button", { name: say("Zgłoś problem lub pomysł", "Report a problem or an idea") }));
      const unclear = page.getByRole("tab", { name: say("Nie rozumiem", "Unclear") });
      await film.see(unclear);
      await film.hold(0.8);
      await film.click(unclear, { seconds: 0.45 });
      await film.hold(0.4);
      await film.click(page.getByLabel(say("Co się wydarzyło?", "What happened?")), { seconds: 0.4 });
      await film.type(FEE_QUESTION, { cps: 20 });
      await film.hold(1);
      await film.click(page.getByRole("button", { name: say("Wyślij", "Send") }).last(), { seconds: 0.45 });
      await film.hold(2);

      answerAsAgent(ids.admin_email, FEE_REPLY);
      await page.goto(`${BASE}/panel/messages`);
      const thread = page.getByText(FEE_QUESTION).first();
      await thread.waitFor({ timeout: 20_000 });
      await settle(page, 800);
      await film.begin();
      await film.hold(1.4);
      await film.click(thread);
      await film.see(page.getByText("I can't see the ensemble's data", { exact: false }).last());
      await film.hold(6);
    },
  },

  // The funding sources, then the grant still being drawn on: awarded,
  // received and remaining, the rules it sets, and what each project has
  // charged to it.
  finance: {
    size: "desktop",
    scale: 2,
    theme: "dark",
    async run(page, film, ids, say) {
      await page.goto(`${BASE}/panel/finance/sources`);
      const grant = page.getByText("Kultura Mazowsza").first();
      await grant.waitFor({ timeout: 20_000 });
      await settle(page, 1000);
      await film.begin();
      await film.hold(1.8);
      await film.click(grant);
      await film.see(page.getByText(say("Źródło finansowania", "Funding source")).first());
      await film.hold(2.8);
      await film.glideTo(760, 560, 0.5);
      await film.hold(0.4);
      await film.scroll(420, 1.6);
      await film.hold(2.2);
      await film.scroll(480, 1.6);
      await film.hold(3.4);
    },
  },

  // The stand, first half: a singer's own marks, on the layer only he reads,
  // in any ink but the conductor's red. Two fingers bring the music close; a
  // circle round the p, the words of a phrase highlighted, a crescendo hairpin
  // into the printed mf, and the German underlay covered so only the Latin he
  // sings is left. The fingers close again on the whole page with its marks.
  "stand-draw": {
    size: "tablet",
    viewport: { width: 834, height: 1194 },
    scale: 1,
    theme: "light",
    touch: true,
    as: "tenor",
    async run(page, film, ids, say) {
      await openScore(page, ids, say);
      await film.begin();
      await film.hold(1.4);
      // Spread round the page's top right corner, so the first two systems
      // fill the screen below the tool panel, which opens over the top left.
      const whole = await pageAt(page);
      const focal = whole(0.92, 0.01);
      await pinch(page, film, focal, 1.5);
      await film.hold(0.6);
      const at = await pageAt(page);
      await film.tap(page.getByRole("button", { name: say(/^Narzędzia adnotacji/, /^Annotation tools/) }));
      await film.hold(0.8);
      await film.tap(await tool(page, /^(Rysuj|Draw):/));
      await film.hold(0.7);
      await film.tap(page.getByRole("group", { name: say("Kolor", "Ink colour") }).getByRole("button").first());
      await film.hold(0.6);
      // A circle round the p over the second system.
      const centre = at(0.664, 0.218);
      const rx = at(0.69, 0).x - at(0.664, 0).x;
      const ry = at(0, 0.235).y - at(0, 0.218).y;
      await stroke(page, film, Array.from({ length: 61 }, (_, i) => {
        const a = -Math.PI / 2 + (i / 60) * Math.PI * 2.15;
        return { x: centre.x + Math.cos(a) * rx, y: centre.y + Math.sin(a) * ry };
      }));
      await film.hold(1);
      await film.tap(await tool(page, say("Zakreślacz", "Highlighter")));
      await film.hold(0.7);
      // The second system's Latin words, from "in cruce" to the barline.
      await stroke(page, film, line(at(0.35, 0.264), at(0.945, 0.264), 54));
      await film.hold(1);
      await film.tap(await tool(page, say("Kształty", "Shapes")));
      await film.hold(0.8);
      await film.tap(await tool(page, say("Widełki crescendo", "Crescendo hairpin")));
      await film.hold(0.6);
      // Under the second system's lower staff, into the printed mf.
      await stroke(page, film, line(at(0.707, 0.341), at(0.833, 0.341), 36));
      await film.hold(1);
      await film.tap(await tool(page, say("Korektor (zakryj druk)", "Cover (hide the print)")));
      await film.hold(0.6);
      // The first system's German line, from the window's edge to the barline;
      // the zoom has already pushed its start off the screen.
      await stroke(page, film, line({ x: 2, y: at(0, 0.1405).y }, at(0.948, 0.1535), 44));
      await film.hold(1.2);
      // Browse first: a tool still armed would name itself on the closed bar.
      await film.tap(await tool(page, say("Przeglądaj", "Browse")));
      await film.hold(0.4);
      await film.tap(page.getByRole("button", { name: say("Gotowe", "Done"), exact: true }));
      await film.hold(1);
      await pinch(page, film, focal, 1 / 1.5);
      await film.hold(3.4);
    },
  },

  // The stand, second half: opened from the concert's materials, where the
  // conductor may tell the choir. Two fingers bring the music close; a caesura,
  // a note, a jump back to the top, and the choir told about the new marks.
  "stand-insert": {
    size: "tablet",
    viewport: { width: 834, height: 1194 },
    scale: 1,
    theme: "light",
    touch: true,
    async run(page, film, ids, say) {
      // The showcase is the first upcoming project, so its row comes first.
      await page.goto(`${BASE}/panel/materials`);
      const piece = page.getByText("Ave verum corpus", { exact: true }).first();
      await piece.waitFor({ timeout: 20_000 });
      const score = piece
        .locator('xpath=ancestor::*[.//button[normalize-space()="Score"]][1]')
        .getByRole("button", { name: "Score" });
      await settle(page, 1200);
      await film.begin();
      await film.hold(1.4);
      await film.tap(score);
      const canvas = page.locator(".react-pdf__Page__canvas").first();
      await film.see(canvas, { every: 120 });
      await film.hold(1.2);
      // Every system of the music stays on screen, its left edge given up,
      // with room under it for the note and its editor; a closer zoom would
      // push the editor under the bottom band and scroll the music away.
      const whole = await pageAt(page);
      const focal = whole(0.92, 0.333);
      await pinch(page, film, focal, 1.35);
      await film.hold(0.5);
      const at = await pageAt(page);
      await film.tap(page.getByRole("button", { name: say(/^Narzędzia adnotacji/, /^Annotation tools/) }));
      await film.hold(0.8);
      await film.tap(await tool(page, /^(Wstaw|Insert):/));
      await film.hold(0.6);
      await film.tap(await tool(page, "Symbol"));
      await film.hold(1);
      await film.tap(await tool(page, say("Cezura", "Caesura")));
      await film.hold(0.6);
      await tapAt(page, film, at(0.44, 0.515));
      await film.hold(1.1);
      await film.tap(await tool(page, say("Notatka", "Note")));
      await film.hold(0.5);
      await tapAt(page, film, at(0.8, 0.69));
      const text = page.getByLabel(say("Treść notatki", "Note text"));
      await film.see(text);
      await film.hold(0.7);
      await film.type(say("Oddech ", "Breathe "), { cps: 10 });
      await film.tap(page.getByRole("button", { name: say("razem", "together"), exact: true }).first());
      await film.hold(1);
      await film.tap(page.getByRole("button", { name: "OK", exact: true }).first());
      await film.hold(1.1);
      await film.tap(await tool(page, say("Skok", "Jump")));
      await film.hold(0.7);
      await tapAt(page, film, at(0.92, 0.62));
      await film.hold(1.4);
      await tapAt(page, film, at(0.5, 0.115));
      await film.hold(1.4);
      const notify = page.getByRole("button", { name: say(/^Powiadom chór/, /^Notify the choir/) }).first();
      await film.see(notify);
      await film.hold(1);
      await film.tap(notify);
      await film.hold(1.2);
      const send = page.getByRole("button", { name: say(/^Wyślij do/, /^Send to/) }).first();
      await film.see(send);
      await film.tap(send);
      await film.hold(2.4);
      await film.tap(await tool(page, say("Przeglądaj", "Browse")));
      await film.hold(0.4);
      await film.tap(page.getByRole("button", { name: say("Gotowe", "Done"), exact: true }));
      await film.hold(0.8);
      await pinch(page, film, focal, 1 / 1.35);
      await film.hold(3);
    },
  },

  // Upload a score the archive does not hold. The model reads it while the
  // drawer reports each step (a time-lapse here), the composer and the work
  // are matched against MusicBrainz and Wikidata, and the conductor's review
  // opens with the fields to check.
  ingest: {
    size: "desktop",
    scale: 1.5,
    theme: "dark",
    async run(page, film, ids, say) {
      await page.goto(`${BASE}/panel/archive-management`);
      await settle(page, 1000);
      await film.begin();
      await film.hold(1.6);
      await film.click(page.getByRole("button", { name: say("Wgraj PDF", "Upload PDF") }));
      await film.hold(1.2);
      await page.locator('input[type="file"]').first().setInputFiles(ids.ingest_pdf);
      const drawer = page.getByRole("dialog").filter({ has: page.locator('input[type="file"]') });
      const finished = drawer.getByText(say(
        /^(AI zakończył pracę|Zatwierdzone|Przetwarzanie nie powiodło się|Błąd wysyłki)$/,
        /^(AI has finished|Approved|Processing failed|Upload failed)$/,
      )).first();
      // One frame every 400 ms of real time: the pipeline's minutes pass in seconds.
      await film.until(() => finished.isVisible().catch(() => false), { seconds: 40, every: 400 });
      await film.hold(2);
      const review = drawer.getByRole("link", { name: say("Sprawdź i zatwierdź", "Review and approve") }).first();
      await film.click(review);
      // The review is a route of the same page, so the clock stays stopped and
      // the wait is filmed; the score's PDF loads in real time between frames.
      await film.see(page.getByText(say("Zatwierdź i opublikuj", "Approve & publish")).first());
      await film.see(page.locator(".react-pdf__Page__canvas").first(), { every: 150 });
      await film.hold(2.6);
      await film.glideTo(2140 / 2, 1100 / 2, 0.5);
      await film.scroll(380, 1.6);
      await film.hold(2.4);
      await film.scroll(420, 1.6);
      await film.hold(3.4);
    },
  },

  // The conductor's review of the piece `ingest` catalogued, alone, from the
  // frame it opens on: the portfolio cuts it onto that take's upload and
  // progress at the click on "Review and approve", so the pointer starts where
  // that click left it. Down the form, what the model did beyond reading the
  // page: the fields still to check, the sung text and its IPA, the composer
  // matched in MusicBrainz and Wikidata, the edition and its licence, then the
  // translation, a new one offered in another language, and the programme note
  // it can write. Needs the piece in the database, so no reseed after `ingest`.
  "ingest-review": {
    size: "desktop",
    scale: 1.5,
    theme: "dark",
    async run(page, film, ids, say) {
      if (!ids.ingested_piece) throw new Error("no catalogued piece awaiting review: record `ingest` first");
      await page.goto(`${BASE}/panel/archive-management/${ids.ingested_piece}`);
      await page.getByText(say("Zatwierdź i opublikuj", "Approve & publish")).first().waitFor({ timeout: 30_000 });
      await page.locator(".react-pdf__Page__canvas").first().waitFor({ timeout: 30_000 });
      await settle(page, 1500);
      const click = { x: 1241, y: 516 };
      await page.mouse.move(click.x, click.y);
      film.pointer = click;
      // The drawn pointer eases to the mouse; it must stand there by the first frame.
      await settle(page, 800);
      const form = page.locator("div.min-h-0.flex-1.space-y-4.overflow-y-auto").first();
      await film.begin();
      await film.hold(2.2);
      await film.glideTo(1070, 550, 0.5);
      // The sung text and its IPA.
      await scrollWithin(film, form, 640);
      await film.hold(2.2);
      // The composer, matched.
      await scrollWithin(film, form, 1150, 1.2);
      await film.hold(2.4);
      // The edition and its licence.
      await scrollWithin(film, form, 1950);
      await film.hold(1.4);
      // The translation, and another language to translate into.
      await scrollWithin(film, form, await form.evaluate((node) => node.scrollHeight - node.clientHeight));
      await film.hold(1.2);
      await film.click(page.getByRole("button", { name: say("Notka programowa", "Programme note") }).first());
      await film.see(page.getByRole("button", { name: say("Generuj notkę programową", "Generate programme note") }).first());
      await scrollWithin(film, form, await form.evaluate((node) => node.scrollHeight - node.clientHeight), 0.8);
      await film.hold(3.2);
    },
  },

  // The rehearsal plan: the editor opened on the evening's clock, a piece
  // dragged up, another given more minutes, a note for the sopranos, a piece
  // added from the programme and a break, then saved and sent to the singers.
  plan: {
    size: "desktop",
    scale: 2,
    theme: "light",
    async run(page, film, ids, say) {
      await page.goto(`${BASE}/panel/rehearsals?rehearsal=${ids.planned_rehearsal}`);
      await page.getByText(say("Jeśli starczy czasu", "If time allows")).first().waitFor();
      await settle(page, 600);
      await bringTo(page.getByText(say("Plan próby", "Rehearsal plan"), { exact: true }).first(), 16);
      await settle(page, 600);
      await film.begin();
      await film.hold(1.8);
      await film.click(page.getByRole("button", { name: say("Edytuj plan", "Edit plan") }));
      const drag = say("Przeciągnij", "Drag");
      const handle = page.getByLabel(`${drag}: Ave verum corpus`);
      await film.see(handle);
      await film.hold(1.2);
      const from = await film.glide(handle);
      const to = await page.getByLabel(`${drag}: Totus Tuus`).boundingBox();
      await page.mouse.down();
      await film.frame(4);
      await film.glideTo(from.x + from.width / 2, from.y + from.height / 2 - 8, 0.1);
      await film.glideTo(to.x + to.width / 2, to.y + to.height / 2 - 12, 0.9);
      await film.frame(8);
      await page.mouse.up();
      await film.hold(1.2);
      const row = (piece, label) => page.getByLabel(`${drag}: ${piece}`)
        .locator(`xpath=ancestor::*[.//input[@aria-label='${label}']][1]`)
        .getByRole("textbox", { name: label })
        .or(page.getByLabel(`${drag}: ${piece}`)
          .locator(`xpath=ancestor::*[.//input[@aria-label='${label}']][1]`)
          .getByRole("spinbutton", { name: label }));
      const minutes = say("Minuty", "Minutes");
      const totus = row("Totus Tuus", minutes).first();
      await film.glide(totus);
      await totus.click({ clickCount: 3 });
      await film.frame(6);
      await film.type("35", { cps: 5 });
      await page.keyboard.press("Tab");
      await film.hold(1.2);
      const note = row("Ave verum corpus", say("Notatka", "Note")).first();
      await film.click(note, { seconds: 0.45 });
      await film.type(say("od t. 40, same soprany", "from bar 40, sopranos alone"), { cps: 16 });
      await film.hold(1.2);
      await film.click(page.getByRole("button", { name: /^(Dodaj do planu|Add to the plan):/ }).first(), { seconds: 0.5 });
      await film.hold(1.2);
      await film.click(page.getByRole("button", { name: say("Przerwa", "Break"), exact: true }).first(), { seconds: 0.5 });
      await film.hold(1.4);
      await film.click(page.getByRole("button", { name: say("Zapisz i wyślij zmiany", "Save and send changes") }), { seconds: 0.5 });
      await film.hold(4);
    },
  },

  // The copy desk: the site's pages, then one line of the home page reworded
  // in Polish, English and French, the publisher told, and the review queue
  // where the three diffs wait.
  copydesk: {
    desk: true,
    size: "desktop",
    scale: 2,
    theme: "light",
    async run(page, film, ids, say) {
      await page.goto(`${BASE}/panel/redakcja`);
      const home = page.getByText("Strona główna").first();
      await home.waitFor({ timeout: 20_000 });
      await settle(page, 1000);
      await film.begin();
      await film.hold(2);
      await film.click(home);
      const field = (lang) => page.getByLabel(`Hero · odpowiedź · ${lang}`);
      await film.see(field("PL"));
      await film.hold(1.4);
      await film.click(page.getByText("+EN +FR", { exact: true }));
      await film.see(field("FR"));
      await film.hold(1);
      await film.glideTo(720, 600, 0.4);
      const box = await field("PL").boundingBox();
      await film.scroll(Math.round(box.y - 330), 1.6);
      await film.hold(1);
      for (const [lang, words, replacement] of [
        ["PL", "kamiennej", "ciemnej"],
        ["EN", "stone", "dark"],
        ["FR", "de pierre", "obscure"],
      ]) {
        const target = field(lang);
        await film.click(target, { dx: 0.3, seconds: 0.5 });
        // The word is selected in place, as a double click would, so the
        // replacement is typed over it.
        await target.evaluate((node, needle) => {
          const at = node.value.indexOf(needle);
          node.focus();
          node.setSelectionRange(at, at + needle.length);
        }, words);
        await film.frame(14);
        await film.type(replacement, { cps: 10 });
        await film.hold(0.8);
      }
      await film.hold(0.6);
      await film.click(page.getByRole("button", { name: say("Skończyłem", "I'm finished") }), { seconds: 0.6 });
      await film.hold(2.4);
      // The review queue is reached from the contents, as the publisher would.
      await film.click(page.getByRole("link", { name: say("Spis treści", "Contents") }).first(), { seconds: 0.6 });
      const queue = page.getByRole("link", { name: say("Przegląd zmian", "Review queue") }).first();
      await film.see(queue, { every: 120 });
      await film.hold(1.6);
      await film.click(queue, { seconds: 0.6 });
      await film.see(page.getByText("Hero · odpowiedź").first(), { every: 120 });
      await film.hold(4);
    },
  },

  // The public site in comment mode: tap a line, reword it, add a note, save
  // it as a proposal, and from the bar's menu tell the reviewers.
  comment: {
    desk: true,
    size: "desktop",
    viewport: { width: 1440, height: 820 },
    // The portfolio cuts the reworded line out of this take at its own size,
    // so it needs the pixels of a sharp screen, not of a scaled frame.
    scale: 2,
    theme: "light",
    async run(page, film, ids, say) {
      await page.addInitScript(() => {
        localStorage.setItem("voct.demo.audio", JSON.stringify({ choice: "silence", timestamp: Date.now() }));
        sessionStorage.setItem("voct.preloader.seen", "1");
      });
      await page.goto(`${SITE}${say("/", "/en/")}?uwagi`);
      await page.getByText(say("Kliknij tekst, który chcesz poprawić.", "Click the text you want to correct."))
        .waitFor({ timeout: 60_000 });
      const line = page.getByText(say("Z tego głosu", "Out of that voice")).first();
      await bringTo(line, 260);
      await settle(page, 1200);
      await film.begin();
      await film.hold(1.8);
      // Comment mode takes a press longer than 500 ms for a hold, not a tap.
      await film.click(line, { dx: 0.3, quick: true });
      const editor = page.locator('[contenteditable="true"]').first();
      await film.see(editor);
      await film.hold(1);
      const [from, to] = say([" — ", " zostaje "], ["Out of", "From"]);
      await film.glide(editor, { dx: 0.15, seconds: 0.45 });
      await editor.evaluate((root, needle) => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const at = node.data.indexOf(needle);
          if (at === -1) continue;
          root.focus();
          window.getSelection().setBaseAndExtent(node, at, node, at + needle.length);
          return;
        }
        throw new Error(`"${needle}" is not in the editor`);
      }, from);
      await film.frame(14);
      await film.type(to, { cps: 8 });
      await film.hold(0.8);
      await film.click(page.getByLabel(say("Uwaga", "Note")), { seconds: 0.45 });
      await film.type(say("Pełnym zdaniem, bez myślnika.", "Closer to the French."), { cps: 16 });
      await film.hold(0.9);
      await film.click(
        page.getByRole("button", { name: say("Zapisz", "Save"), exact: true }).filter({ visible: true }).last(),
        { seconds: 0.5 },
      );
      await film.hold(2);
      await film.click(page.getByRole("button", { name: "Menu", exact: true }).filter({ visible: true }).first(), { seconds: 0.6 });
      await film.hold(2.2);
      await film.click(
        page.getByRole("button", { name: say(/^Gotowe/, /^Done/) }).filter({ visible: true }).first(),
        { seconds: 0.6 },
      );
      await film.hold(4);
    },
  },

  // A singer on the app's home screen opens the feedback bubble, picks Idea,
  // writes one and sends it.
  feedback: {
    size: "phone",
    as: "tenor",
    theme: "dark",
    showFeedback: true,
    touch: true,
    async run(page, film, ids, say) {
      await page.goto(`${BASE}/panel`);
      await settle(page, 1500);
      await film.begin();
      await film.hold(1.8);
      await page.mouse.move(195, 600);
      await film.scroll(260, 1.2);
      await film.hold(1);
      await film.tap(page.getByRole("button", { name: say("Zgłoś problem lub pomysł", "Report a problem or an idea") }));
      const idea = page.getByRole("tab", { name: say("Pomysł", "Idea") });
      await film.see(idea);
      await film.hold(1);
      await film.tap(idea);
      await film.hold(0.5);
      await film.tap(page.getByLabel(say("Co się wydarzyło?", "What happened?")));
      await film.type(say(
        "Czy odtwarzacz mógłby pamiętać tempo dla każdego utworu? Mozarta ćwiczę na trzech czwartych.",
        "Could the player remember the speed for each piece? I practise the Mozart at three-quarters.",
      ), { cps: 18 });
      await film.hold(1.2);
      await film.tap(page.getByRole("button", { name: say("Wyślij", "Send") }).last());
      await film.hold(3.5);
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
const browser = await launch({ args: ["--disable-smooth-scrolling"] });
try {
  const sessions = {
    admin: await login(browser, ids.admin_email, "admin123"),
    tenor: await login(browser, ids.tenor_email, "password123"),
  };
  for (const name of wanted) {
    const take = TAKES[name];
    if (take.desk) clearDesk();
    const context = await themedContext(browser, {
      state: sessions[take.as ?? "admin"], size: take.size, theme: take.theme ?? "light", lang, motion: true,
      viewport: take.viewport, scale: take.scale, showFeedback: take.showFeedback, ids,
    });
    await filmable(context);
    if (!take.touch) await injectCursor(context);
    const page = await context.newPage();
    const output = `${name}${suffix}`;
    const film = new Film(page, join(DIR, `${output}-frames`));
    const started = Date.now();
    try {
      await take.run(page, film, ids, say);
    } catch (error) {
      await page.screenshot({ path: join(DIR, `${output}-failed.png`) }).catch(() => {});
      throw error;
    } finally {
      await context.close();
      settleReports();
    }
    const result = film.encode(join(DIR, `${output}.mp4`), { poster: join(DIR, `${output}.webp`) });
    console.log("clip", output, result, `${Math.round((Date.now() - started) / 1000)} s to record`);
  }
} finally {
  await browser.close();
  if (lang !== "pl") await stage();
}
