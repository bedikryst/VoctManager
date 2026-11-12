/**
 * @file clips.mjs
 * @description The portfolio's moving captures: 60 fps H.264 MP4 clips with
 * a WebP poster, recorded frame by frame on a virtual clock (film.mjs), so no
 * frame is dropped however busy the page is. Each clip shows one action,
 * held still for about a second at both ends so its loop joins.
 *
 * Needs the dev stack up and a fresh seed, since takes edit the data:
 *   docker exec voctmanager-web-1 python manage.py seed_db --clear --seed 2026
 * then `node clips.mjs --lang en <take> ...`. Clips land in out/clips/.
 */

import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { Film, filmable } from "./film.mjs";
import {
  BASE, OUT, cliArgs, django, injectCursor, launch, login, settle, settleReports, stage, themedContext,
} from "./lib.mjs";

const DIR = join(OUT, "clips");
const SITE = process.env.README_MEDIA_SITE ?? "http://localhost:4321";

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

const TAKES = {
  // The conductor asks the app something only the data can answer; the
  // agent's reply arrives in Messages a few minutes later (cut).
  agent: {
    size: "desktop",
    scale: 1,
    theme: "light",
    showFeedback: true,
    async run(page, film, ids, say) {
      await page.goto(`${BASE}/panel`);
      await settle(page, 1200);
      await film.begin();
      await film.hold(0.8);
      await film.click(page.getByRole("button", { name: say("Zgłoś problem lub pomysł", "Report a problem or an idea") }));
      const unclear = page.getByRole("tab", { name: say("Niejasne", "Unclear") });
      await film.see(unclear);
      await film.hold(0.3);
      await film.click(unclear, { seconds: 0.35 });
      await film.click(page.getByLabel(say("Co się wydarzyło?", "What happened?")), { seconds: 0.35 });
      await film.type(FEE_QUESTION, { cps: 26 });
      await film.hold(0.4);
      await film.click(page.getByRole("button", { name: say("Wyślij", "Send") }).last(), { seconds: 0.4 });
      await film.hold(1);

      answerAsAgent(ids.admin_email, FEE_REPLY);
      await page.goto(`${BASE}/panel/messages`);
      const thread = page.getByText(FEE_QUESTION).first();
      await thread.waitFor({ timeout: 20_000 });
      await settle(page, 800);
      await film.begin();
      await film.hold(0.6);
      await film.click(thread);
      await film.see(page.getByText("I can't see the ensemble's data", { exact: false }).last());
      await film.hold(3.2);
    },
  },

  // From the funding sources into the grant still being drawn on: awarded,
  // received and remaining, then down to what each project has spent of it.
  finance: {
    size: "desktop",
    scale: 1,
    theme: "dark",
    async run(page, film, ids, say) {
      await page.goto(`${BASE}/panel/finance/sources`);
      const grant = page.getByText("Kultura Mazowsza").first();
      await grant.waitFor({ timeout: 20_000 });
      await settle(page, 1000);
      await film.begin();
      await film.hold(0.8);
      await film.click(grant);
      await film.see(page.getByText(say("Źródło finansowania", "Funding source")).first());
      await film.hold(1.6);
      await film.glideTo(720, 520, 0.4);
      await film.scroll(520, 1.2);
      await film.hold(2.2);
    },
  },

  // Draw a phrase arc on the score with the pen, open it and hand it up from
  // the choir to whoever runs the rehearsal.
  annotations: {
    size: "tablet",
    viewport: { width: 834, height: 1194 },
    scale: 1,
    theme: "light",
    touch: true,
    async run(page, film, ids, say) {
      await page.goto(`${BASE}/panel/materials/${ids.showcase}/${ids.piece}`);
      await page.getByRole("button", { name: say("Otwórz partyturę", "Open score") }).first().click();
      const canvas = page.locator(".react-pdf__Page__canvas").first();
      await canvas.waitFor({ timeout: 30_000 });
      await settle(page, 1200);
      await film.begin();
      await film.hold(0.8);
      const toolbar = page.getByRole("button", { name: say("Narzędzia adnotacji", "Annotation tools") });
      if (await toolbar.isVisible().catch(() => false)) {
        await film.tap(toolbar);
        await film.hold(0.3);
      }
      await film.tap(await tool(page, say("Rysuj: Pióro", "Draw: Pen")));
      await film.hold(0.4);
      // An arc over the last system's opening phrase, drawn in about a second.
      const box = await canvas.boundingBox();
      const from = { x: box.x + box.width * 0.4, y: box.y + box.height * 0.51 };
      const to = { x: box.x + box.width * 0.7, y: from.y };
      const rise = box.height * 0.028;
      await page.mouse.move(from.x, from.y);
      await film.frame(3);
      await page.mouse.down();
      const steps = 54;
      for (let step = 1; step <= steps; step += 1) {
        const t = step / steps;
        await page.mouse.move(from.x + (to.x - from.x) * t, from.y - Math.sin(Math.PI * t) * rise);
        await film.frame();
      }
      await page.mouse.up();
      await film.hold(0.7);
      await film.tap(await tool(page, say("Przeglądaj", "Browse")));
      await film.hold(0.3);
      await page.mouse.move((from.x + to.x) / 2, from.y - rise);
      await film.frame(3);
      await film.press();
      const ladder = page.getByRole("group", { name: say("Kto to widzi", "Who sees this") });
      await film.see(ladder);
      await film.hold(0.7);
      await film.tap(ladder.getByRole("button", {
        name: say("Dla prowadzącego próbę", "For whoever runs the rehearsal"),
      }));
      await film.hold(1.8);
    },
  },

  // Upload a score PDF; the pipeline reads it and the conductor's review
  // opens. The pipeline's minutes pass as a time-lapse. A PDF already in the
  // archive is matched by its SHA-256 and never reaches the model, so the take
  // is free unless INGEST_PDF names a new score.
  ingest: {
    size: "desktop",
    scale: 1,
    theme: "dark",
    async run(page, film, ids, say) {
      await page.goto(`${BASE}/panel/archive-management`);
      await settle(page, 1000);
      await film.begin();
      await film.hold(0.8);
      await film.click(page.getByRole("button", { name: say("Wgraj PDF", "Upload PDF") }));
      await film.hold(0.6);
      await page.locator('input[type="file"]').first().setInputFiles(ids.ingest_pdf);
      const drawer = page.getByRole("dialog").filter({ has: page.locator('input[type="file"]') });
      const finished = drawer.getByText(say(
        /^(AI zakończył pracę|Zatwierdzone|Przetwarzanie nie powiodło się|Błąd wysyłki)$/,
        /^(AI has finished|Approved|Processing failed|Upload failed)$/,
      )).first();
      // One frame every half second of real time: minutes become seconds.
      await film.until(() => finished.isVisible().catch(() => false), { seconds: 20, every: 500 });
      await film.hold(0.8);
      const review = drawer.getByRole("link", { name: say("Sprawdź i zatwierdź", "Review and approve") }).first();
      await film.click(review);
      // The review is a route of the same page, so the clock stays stopped and
      // the wait is filmed; the score's PDF loads in real time between frames.
      await film.see(page.getByText(say("Zatwierdź i opublikuj", "Approve & publish")).first());
      await film.see(page.locator(".react-pdf__Page__canvas").first(), { every: 150 });
      await film.hold(3);
    },
  },

  // Open the rehearsal plan's editor, drag a piece up and give another more
  // time, against the evening's clock. Leaving drops the edit unsaved.
  plan: {
    size: "desktop",
    scale: 1,
    theme: "light",
    async run(page, film, ids, say) {
      await page.goto(`${BASE}/panel/rehearsals?rehearsal=${ids.planned_rehearsal}`);
      await page.getByText(say("Jeśli starczy czasu", "If time allows")).first().waitFor();
      await settle(page, 600);
      const header = page.getByText(say("Plan próby", "Rehearsal plan"), { exact: true }).first();
      await header.evaluate((node) => {
        window.scrollTo({ top: node.getBoundingClientRect().top + window.scrollY - 16, behavior: "instant" });
      });
      await settle(page, 600);
      await film.begin();
      await film.hold(0.8);
      await film.click(page.getByRole("button", { name: say("Edytuj plan", "Edit plan") }));
      const drag = say("Przeciągnij", "Drag");
      const handle = page.getByLabel(`${drag}: Ave verum corpus`);
      await film.see(handle);
      await film.hold(0.5);
      const from = await film.glide(handle);
      const to = await page.getByLabel(`${drag}: Totus Tuus`).boundingBox();
      await page.mouse.down();
      await film.frame(3);
      await film.glideTo(from.x + from.width / 2, from.y + from.height / 2 - 8, 0.08);
      await film.glideTo(to.x + to.width / 2, to.y + to.height / 2 - 12, 0.7);
      await film.frame(6);
      await page.mouse.up();
      await film.hold(0.8);
      const label = say("Minuty", "Minutes");
      const minutes = page.getByLabel(`${drag}: Totus Tuus`)
        .locator(`xpath=ancestor::*[.//input[@aria-label='${label}']][1]`)
        .getByRole("spinbutton", { name: label });
      await film.glide(minutes);
      await minutes.click({ clickCount: 3 });
      await film.frame(4);
      await film.type("35", { cps: 6 });
      await page.keyboard.press("Tab");
      await film.hold(2.4);
    },
  },

  // The copy desk: one line of the site's home page reworded in Polish,
  // English and French, each edit left as a proposal with its diff for the
  // publisher. Needs the corpus on the dev desk (see shots.mjs).
  copydesk: {
    size: "desktop",
    scale: 1,
    theme: "light",
    async run(page, film) {
      await page.goto(`${BASE}/panel/redakcja`);
      await page.getByText("Strona główna").first().click();
      await page.getByText("+EN +FR", { exact: true }).click();
      const field = (lang) => page.getByLabel(`Hero · odpowiedź · ${lang}`);
      await field("FR").waitFor();
      await settle(page, 800);
      await field("PL").evaluate((node) => {
        window.scrollTo({ top: node.getBoundingClientRect().top + window.scrollY - 330, behavior: "instant" });
      });
      await settle(page, 600);
      await film.begin();
      await film.hold(0.8);
      for (const [lang, words, replacement] of [
        ["PL", "kamiennej", "ciemnej"],
        ["EN", "stone", "dark"],
        ["FR", "de pierre", "obscure"],
      ]) {
        const target = field(lang);
        await film.click(target, { dx: 0.3, seconds: 0.45 });
        // The word is selected in place, as a double click would, so the
        // replacement is typed over it.
        await target.evaluate((node, needle) => {
          const at = node.value.indexOf(needle);
          node.focus();
          node.setSelectionRange(at, at + needle.length);
        }, words);
        await film.frame(10);
        await film.type(replacement, { cps: 12 });
        await film.hold(0.5);
      }
      await page.mouse.move(720, 120);
      await film.hold(2.4);
    },
  },

  // The public site in comment mode: tap a line, reword it, add a note and
  // send it to the desk as a proposal. Needs the Astro dev server and the
  // corpus on the dev desk (see shots.mjs); SITE names the server.
  comment: {
    size: "desktop",
    viewport: { width: 1440, height: 820 },
    scale: 1,
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
      await line.evaluate((node) => {
        window.scrollTo({ top: node.getBoundingClientRect().top + window.scrollY - 260, behavior: "instant" });
      });
      await settle(page, 1200);
      await film.begin();
      await film.hold(0.8);
      await film.click(line, { dx: 0.3 });
      const editor = page.locator('[contenteditable="true"]').first();
      await film.see(editor);
      await film.hold(0.5);
      const [from, to] = say([" — ", " zostaje "], ["Out of", "From"]);
      await film.glide(editor, { dx: 0.15, seconds: 0.4 });
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
      await film.frame(10);
      await film.type(to, { cps: 10 });
      await film.hold(0.4);
      await film.click(page.getByLabel(say("Uwaga", "Note")), { seconds: 0.4 });
      await film.type(say("Pełnym zdaniem, bez myślnika.", "Closer to the French."), { cps: 22 });
      await film.hold(0.5);
      await film.click(
        page.getByRole("button", { name: say("Zapisz", "Save"), exact: true }).filter({ visible: true }).last(),
        { seconds: 0.45 },
      );
      await film.hold(2.2);
    },
  },

  // A singer opens the feedback sheet, picks Idea, writes one and sends it.
  feedback: {
    size: "phone",
    as: "tenor",
    theme: "dark",
    width: 780,
    showFeedback: true,
    touch: true,
    async run(page, film, ids, say) {
      await page.goto(`${BASE}/panel/schedule/rehearsal/${ids.planned_rehearsal}`);
      await page.getByText(say("Twoja część", "Your part")).first().waitFor();
      await settle(page, 800);
      await film.begin();
      await film.hold(1);
      await film.tap(page.getByRole("button", { name: say("Zgłoś problem lub pomysł", "Report a problem or an idea") }));
      const idea = page.getByRole("tab", { name: say("Pomysł", "Idea") });
      await film.see(idea);
      await film.hold(0.5);
      await film.tap(idea);
      await film.hold(0.3);
      await film.tap(page.getByLabel(say("Co się wydarzyło?", "What happened?")));
      await film.type(say(
        "Czy odtwarzacz mógłby pamiętać tempo dla każdego utworu?",
        "Could the player remember the speed for each piece?",
      ));
      await film.hold(0.6);
      await film.tap(page.getByRole("button", { name: say("Wyślij", "Send") }).last());
      await film.hold(2);
    },
  },
};

const { lang, names, say, suffix } = cliArgs();
const wanted = names.filter((name) => name in TAKES);
if (!wanted.length) throw new Error(`name a take: ${Object.keys(TAKES).join(", ")}`);

mkdirSync(DIR, { recursive: true });
const ids = await stage({ lang });
ids.ingest_pdf = resolve(process.env.INGEST_PDF ?? join(OUT, "scores", "ave-verum-mozart.pdf"));
const browser = await launch({ args: ["--disable-smooth-scrolling"] });
try {
  const sessions = {
    admin: await login(browser, ids.admin_email, "admin123"),
    tenor: await login(browser, ids.tenor_email, "password123"),
  };
  for (const name of wanted) {
    const take = TAKES[name];
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
    const result = film.encode(join(DIR, `${output}.mp4`), {
      width: take.width, poster: join(DIR, `${output}.webp`),
    });
    console.log("clip", output, result, `${Math.round((Date.now() - started) / 1000)} s to record`);
  }
} finally {
  await browser.close();
  if (lang !== "pl") await stage();
}
