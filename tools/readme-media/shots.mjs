/**
 * @file shots.mjs
 * @description The README and portfolio stills, each in light and dark.
 * Needs the dev stack up (`make up`) and a fresh seed:
 *   docker exec voctmanager-web-1 python manage.py seed_db --clear --seed 2026
 * then `npm run shots` (or `node shots.mjs <name> ...` for a subset). Raw
 * captures land in out/shots/; copy the chosen ones to docs/assets/.
 * `--lang en` retakes the shots README.md embeds in the English interface.
 * `locations-map` needs the Vite dev origin, see its entry.
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { BASE, OUT, launch, login, settle, stage, themedContext } from "./lib.mjs";

const DIR = join(OUT, "shots");

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
];

// `--lang en` takes the shots that have English waits, into <name>-en-<theme>.png.
const args = process.argv.slice(2);
const lang = args.includes("--lang") ? args[args.indexOf("--lang") + 1] : "pl";
const only = new Set(args.filter((arg, index) => arg !== "--lang" && args[index - 1] !== "--lang"));
const wanted = SHOTS.filter((shot) => (only.size ? only.has(shot.name) : true)
  && (lang === "pl" || shot.langs?.includes(lang)));
const say = (pl, en) => (lang === "en" ? en : pl);
const suffix = lang === "pl" ? "" : `-${lang}`;

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
    for (const theme of ["light", "dark"]) {
      const context = await themedContext(browser, {
        state: sessions[shot.as ?? "admin"], size: shot.size, theme, lang,
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
