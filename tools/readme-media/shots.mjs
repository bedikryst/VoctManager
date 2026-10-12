/**
 * @file shots.mjs
 * @description The README and portfolio stills, each in light and dark.
 * Needs the dev stack up (`make up`) and a fresh seed:
 *   docker exec voctmanager-web-1 python manage.py seed_db --clear --seed 2026
 * then `npm run shots` (or `node shots.mjs <name> ...` for a subset). Raw
 * captures land in out/shots/; copy the chosen ones to docs/assets/.
 * `--lang en` retakes the shots README.md embeds in the English interface.
 * `locations-map` needs the Vite dev origin, see its entry. `comment-mode`
 * needs the Astro dev server (`npm run dev` in web/), because the docker image
 * serves the site build baked into it; the panel's login cookies carry over,
 * since cookies do not isolate ports. It also needs the corpus on the dev desk,
 * which a seed leaves empty (the mode then finds no text to open). `web/.env`
 * points the desk scripts at production, so override it, in web/:
 *   COPYDESK_API=http://localhost COPYDESK_EMAIL=admin@admin.admin COPYDESK_PASSWORD=admin123 npm run copy:sync
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { BASE, OUT, cliArgs, launch, login, settle, stage, themedContext } from "./lib.mjs";

const DIR = join(OUT, "shots");
const SITE = process.env.README_MEDIA_SITE ?? "http://localhost:4321";

const SHOTS = [
  {
    name: "admin-dashboard",
    size: "desktop",
    langs: ["pl", "en"],
    go: async (page, ids, say) => {
      await page.goto(`${BASE}/panel`);
      await page.getByText(say("Główny Pulpit Dyrygenta", "Conductor's Main Dashboard")).waitFor();
    },
  },
  {
    name: "finance-overview",
    size: "desktop",
    go: async (page) => {
      await page.goto(`${BASE}/panel/finance`);
      await page.getByText("Dzisiaj w finansach").waitFor();
    },
  },
  {
    name: "project-fees",
    size: "desktop",
    go: async (page, ids) => {
      await page.goto(`${BASE}/panel/projects/${ids.showcase}/budget/people`);
      await page.getByText("Koszt honorariów").waitFor();
    },
  },
  {
    name: "funding-grant",
    size: "desktop",
    langs: ["pl", "en"],
    go: async (page, ids, say) => {
      await page.goto(`${BASE}/panel/finance/sources/${ids.grant}`);
      await page.getByText(say("Źródło finansowania", "Funding source")).waitFor();
    },
  },
  {
    // `my_plan_window` is answered for the signed-in reader only, so this one
    // logs in as the tenor rather than through the artist preview.
    name: "rehearsal-singer",
    size: "phone",
    as: "tenor",
    langs: ["pl", "en"],
    go: async (page, ids, say) => {
      await page.goto(`${BASE}/panel/schedule/rehearsal/${ids.planned_rehearsal}`);
      await page.getByText(say("Twoja część", "Your part")).first().waitFor();
    },
  },
  {
    // The tenor's practice console for the showcase piece: his own line
    // soloed, the other voices' faders, speed and the A/B loop below.
    name: "materials-singer",
    size: "phone",
    as: "tenor",
    langs: ["pl", "en"],
    go: async (page, ids, say) => {
      await page.goto(`${BASE}/panel/materials/${ids.showcase}/${ids.piece}`);
      const mine = page.getByRole("button", { name: say("Tylko mój głos", "Only my voice") }).first();
      await mine.waitFor();
      await settle(page);
      await mine.click();
      // A playhead part-way through reads as a take in use. The length is only
      // known once playback has loaded the takes, so play first, then seek.
      await page.getByRole("button", { name: say("Odtwarzaj", "Play") }).first().click();
      const playhead = page.getByRole("slider", { name: say("Przewiń", "Seek") }).first();
      await page.waitForFunction(
        (node) => Number(node.max) > 60, await playhead.elementHandle(), { timeout: 15_000 },
      );
      await playhead.fill("74");
      await mine.evaluate((node) => {
        window.scrollTo({ top: node.getBoundingClientRect().top + window.scrollY - 150, behavior: "instant" });
      });
      await page.waitForTimeout(500);
    },
  },
  {
    // The whole plan does not fit a 900 px viewport, and the reserve divider
    // at its foot is the point, so this one is the plan panel cut out whole.
    name: "rehearsal-plan-editor",
    size: "desktop",
    go: async (page, ids) => {
      await page.setViewportSize({ width: 1440, height: 2600 });
      await page.goto(`${BASE}/panel/rehearsals?rehearsal=${ids.planned_rehearsal}`);
      await page.getByText("Jeśli starczy czasu").first().waitFor();
    },
    // From the panel's header down to the add-row controls under the reserve.
    clip: async (page) => page.evaluate(() => {
      const byText = (pattern) => [...document.querySelectorAll("body *")].find(
        (node) => node.children.length === 0 && pattern.test(node.textContent ?? ""),
      );
      const header = byText(/^Plan próby$/i);
      const end = byText(/^Dodaj przerwę$/);
      let panel = header;
      while (panel && !panel.contains(end)) panel = panel.parentElement;
      const box = panel.getBoundingClientRect();
      const top = header.getBoundingClientRect().top - 28;
      const bottom = end.getBoundingClientRect().bottom + 28;
      return { x: box.left, y: top + window.scrollY, width: box.width, height: bottom - top };
    }),
  },
  {
    name: "rehearsal-plan-grid",
    size: "desktop",
    go: async (page, ids) => {
      await page.goto(`${BASE}/panel/projects/${ids.showcase}/rehearsals`);
      await page.getByRole("tab", { name: "Utwory" }).click();
      await page.locator("table").first().waitFor();
    },
  },
  {
    name: "music-stand",
    size: "tablet",
    go: async (page, ids) => {
      await page.goto(`${BASE}/panel/materials/${ids.showcase}/${ids.piece}`);
      await page.getByRole("button", { name: "Otwórz partyturę" }).first().click();
      await page.locator(".react-pdf__Page__canvas").first().waitFor({ timeout: 30_000 });
      await settle(page, 1200);
      // The leader's fermata: tapping a mark opens its card with the audience ladder.
      await page.locator("[data-annotation-mark] button").first().click();
      await page.getByRole("group", { name: "Kto to widzi" }).waitFor();
    },
  },
  {
    // The newest edition waiting for review: the piece the recorded ingest
    // take catalogued (`node gifs.mjs ingest`), else the seed's own.
    name: "score-compiler-review",
    size: "desktop",
    needs: "ingested_piece",
    langs: ["pl", "en"],
    go: async (page, ids, say) => {
      await page.goto(`${BASE}/panel/archive-management/${ids.ingested_piece}`);
      await page.getByText(say("Zatwierdź i opublikuj", "Approve & publish")).first().waitFor();
      await page.locator(".react-pdf__Page__canvas").first().waitFor({ timeout: 30_000 });
    },
  },
  {
    // The Maps key admits only the Vite dev origin, so this one needs
    // `npm run dev` in frontend/ and README_MEDIA_BASE=http://localhost:5173;
    // on the docker panel the map stays blank (RefererNotAllowedMapError).
    name: "locations-map",
    size: "desktop",
    go: async (page) => {
      await page.goto(`${BASE}/panel/locations`);
      const legend = page.getByText("Legenda kategorii").first();
      await legend.waitFor();
      await settle(page);
      await legend.evaluate((node) => {
        window.scrollTo({ top: node.getBoundingClientRect().top + window.scrollY - 40, behavior: "instant" });
      });
      // Tiles stream in after the scroll; the network never quite idles on a map.
      await page.waitForTimeout(5000);
    },
  },
  {
    name: "cast-by-section",
    size: "desktop",
    go: async (page, ids) => {
      await page.goto(`${BASE}/panel/projects/${ids.showcase}/cast`);
      await page.getByText("Obsada projektu").waitFor();
    },
  },
  {
    // The line to the developer, open over the tenor's rehearsal page with a
    // sample idea typed in. The only shot that keeps the button. The note is
    // invented, so it asks for nothing the README tells as a real request.
    name: "feedback-sheet",
    size: "phone",
    as: "tenor",
    langs: ["pl", "en"],
    showFeedback: true,
    go: async (page, ids, say) => {
      await page.goto(`${BASE}/panel/schedule/rehearsal/${ids.planned_rehearsal}`);
      await page.getByText(say("Twoja część", "Your part")).first().waitFor();
      await settle(page);
      await page.getByRole("button", { name: say("Zgłoś problem lub pomysł", "Report a problem or an idea") })
        .click();
      await page.getByRole("tab", { name: say("Pomysł", "Idea") }).click();
      await page.getByLabel(say("Co się wydarzyło?", "What happened?")).fill(say(
        "Czy odtwarzacz mógłby pamiętać tempo dla każdego utworu? Mozarta zawsze ćwiczę na trzech czwartych i co wieczór ustawiam je od nowa.",
        "Could the player remember the speed for each piece? I always practise the Mozart at three-quarters and set it again every evening.",
      ));
    },
  },
  {
    // The public site in comment mode: the landing page's Imagines line open
    // in the sheet, a sample proposal typed around its italic (which the
    // editor keeps as one locked mark) and previewed in place on the page.
    // The site has no dark theme. The proposal is invented and never saved.
    name: "comment-mode",
    size: "desktop",
    langs: ["pl", "en"],
    themes: ["light"],
    go: async (page, ids, say) => {
      // Past the preloader and the sound gate, as on a visitor's second page:
      // in comment mode a click on the gate would open its text instead.
      await page.addInitScript(() => {
        localStorage.setItem("voct.demo.audio", JSON.stringify({ choice: "silence", timestamp: Date.now() }));
        sessionStorage.setItem("voct.preloader.seen", "1");
      });
      await page.goto(`${SITE}${say("/", "/en/")}?uwagi`);
      await page.getByText(say("Kliknij tekst, który chcesz poprawić.", "Click the text you want to correct."))
        .waitFor({ timeout: 30_000 });
      // The line at this height tucks the film's caption above it under the header.
      const line = page.getByText(say("Z tego głosu", "Out of that voice")).first();
      await line.evaluate((node) => {
        window.scrollTo({ top: node.getBoundingClientRect().top + window.scrollY - 260, behavior: "instant" });
      });
      await settle(page);
      // The spellchecker underlines the French quote, and more besides. Fields
      // the sheet creates inherit the attribute from the root.
      await page.evaluate(() => document.documentElement.setAttribute("spellcheck", "false"));
      const box = await line.boundingBox();
      await page.mouse.click(box.x + box.width * 0.3, box.y + box.height / 2);
      const editor = page.locator('[contenteditable="true"]').first();
      await editor.waitFor();
      // Replace the words before the italic; a DOM selection is what the editor
      // reads, and typing over it leaves the locked mark where it is.
      const [from, to] = say([" — ", " zostaje "], ["Out of", "From"]);
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
      await page.keyboard.type(to);
      await page.getByLabel(say("Uwaga", "Note")).fill(say(
        "Pełnym zdaniem, bez myślnika.",
        "Closer to the French “De cette voix”.",
      ));
    },
  },
];

// `--lang en` takes the shots that have English waits, into <name>-en-<theme>.png.
const { lang, names, say, suffix } = cliArgs();
const only = new Set(names);
const wanted = SHOTS.filter((shot) => (only.size ? only.has(shot.name) : true)
  && (lang === "pl" || shot.langs?.includes(lang)));

mkdirSync(DIR, { recursive: true });
const ids = await stage({ lang });
const browser = await launch();
try {
  const sessions = {
    admin: await login(browser, ids.admin_email, "admin123"),
    tenor: await login(browser, ids.tenor_email, "password123"),
  };
  for (const shot of wanted) {
    if (shot.needs && !ids[shot.needs]) {
      console.log("skip", shot.name, `(no ${shot.needs} yet)`);
      continue;
    }
    for (const theme of shot.themes ?? ["light", "dark"]) {
      const context = await themedContext(browser, {
        state: sessions[shot.as ?? "admin"], size: shot.size, theme, lang, showFeedback: shot.showFeedback,
      });
      const page = await context.newPage();
      await shot.go(page, ids, say);
      await settle(page);
      const file = join(DIR, `${shot.name}${suffix}-${theme}.png`);
      const clip = shot.clip ? await shot.clip(page) : undefined;
      await page.screenshot({ path: file, ...(clip ? { clip, fullPage: true } : {}) });
      console.log("shot", file);
      await context.close();
    }
  }
} finally {
  await browser.close();
  // The two accounts go back to Polish, the language the seed gives them.
  if (lang !== "pl") await stage();
}
