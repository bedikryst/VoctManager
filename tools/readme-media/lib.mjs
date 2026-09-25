/**
 * @file lib.mjs
 * @description Shared plumbing for the README media takes: staging the dev
 * database, logging in once, opening themed browser contexts on system Edge,
 * a visible cursor for recorded takes, and the ffmpeg GIF conversion.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

export const HERE = dirname(fileURLToPath(import.meta.url));
export const OUT = join(HERE, "out");
export const BASE = process.env.README_MEDIA_BASE ?? "http://localhost";
// Where the API answers: behind the same nginx as the docker panel, on the
// published :8000 when the panel comes from the Vite dev server.
const API = process.env.README_MEDIA_API ?? (BASE.includes(":5173") ? "http://localhost:8000" : BASE);
const CONTAINER = "voctmanager-web-1";

// Mozart, Ave verum corpus, arr. Reinecke. Engraved by the Mutopia Project,
// CC BY 4.0; the README credits it wherever the stand is shown.
const SCORE_URL = "https://www.mutopiaproject.org/ftp/MozartWA/AveverumM/AveverumM-a4.pdf";

export const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  phone: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  // An iPad upright on a music stand: one page, top to bottom.
  tablet: {
    viewport: { width: 820, height: 1180 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
};

/**
 * Stage the seeded database and return the ids the takes navigate to. `lang`
 * is the interface language the signed-in accounts get (see prepare.py).
 */
export async function stage({ lang = "pl" } = {}) {
  mkdirSync(join(OUT, "scores"), { recursive: true });
  const score = join(OUT, "scores", "ave-verum-mozart.pdf");
  if (!existsSync(score)) {
    const response = await fetch(SCORE_URL);
    if (!response.ok) throw new Error(`score download failed: ${response.status}`);
    writeFileSync(score, Buffer.from(await response.arrayBuffer()));
  }
  execFileSync("docker", ["cp", score, `${CONTAINER}:/tmp/readme-media-score.pdf`]);
  // The seed's practice tracks are one-second placeholders, which the player
  // reads out as "0:01". Silence as long as the piece stands in for them.
  const silence = join(OUT, "scores", "silence-3m05.mp3");
  if (!existsSync(silence)) {
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=22050:cl=mono",
      "-t", "185", "-b:a", "16k", silence]);
  }
  execFileSync("docker", ["cp", silence, `${CONTAINER}:/tmp/readme-media-silence.mp3`]);
  const output = execFileSync(
    "docker",
    ["exec", "-i", "-e", `READMEMEDIA_LANG=${lang}`, CONTAINER, "python", "manage.py", "shell"],
    { input: readFileSync(join(HERE, "prepare.py")) },
  ).toString();
  const line = output.split("\n").find((row) => row.startsWith("READMEMEDIA "));
  if (!line) throw new Error(`prepare.py printed no ids:\n${output}`);
  return JSON.parse(line.slice("READMEMEDIA ".length));
}

export async function launch() {
  return chromium.launch({ channel: "msedge", headless: true });
}

/**
 * Log in and hand back the cookie jar every themed context reuses. Sessions
 * are kept in out/sessions/ and reused while the API still accepts them: a
 * login spends about five anonymous requests against DRF's 10/minute budget,
 * so two runs in a row would otherwise be refused with 429.
 */
export async function login(browser, email, password) {
  const saved = join(OUT, "sessions", `${email}.json`);
  if (existsSync(saved)) {
    const state = JSON.parse(readFileSync(saved, "utf8"));
    const probe = await browser.newContext({ storageState: state });
    const me = await probe.request.get(`${API}/api/users/me/`);
    const body = me.ok() ? await me.json().catch(() => ({})) : {};
    const valid = body.email?.toLowerCase() === email.toLowerCase();
    await probe.close();
    if (valid) return state;
  }
  const state = await freshLogin(browser, email, password);
  mkdirSync(dirname(saved), { recursive: true });
  writeFileSync(saved, JSON.stringify(state));
  return state;
}

async function freshLogin(browser, email, password) {
  const context = await browser.newContext(VIEWPORTS.desktop);
  const page = await context.newPage();
  await page.goto(`${BASE}/login`);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await Promise.all([
    page.waitForURL(/\/panel/, { timeout: 30_000 }),
    page.locator('button[type="submit"]').click(),
  ]);
  const state = await context.storageState();
  await context.close();
  return state;
}

/** The localStorage the panel reads on boot: theme, language, no install prompt. */
function panelStorage(theme, lang, extra) {
  return {
    "voct.theme": theme,
    voctmanager_lang: lang,
    "voct.pwa.install.dismissed-at": String(Date.now()),
    "voct:last-workspace": "panel",
    ...extra,
  };
}

// The feedback button floats over every panel screen; it is a line to the
// developer, not a feature, so the takes leave it out.
const HIDE_CSS = [
  '[aria-label="Zgłoś problem lub pomysł"]',
  '[aria-label="Report a problem or an idea"]',
].join(", ") + " { display: none !important; }";

/** A context for one theme at one size, sharing the logged-in cookie jar. */
export async function themedContext(browser, {
  state, size, theme, lang = "pl", storage = {}, video, viewport,
}) {
  const frame = viewport ?? VIEWPORTS[size].viewport;
  const context = await browser.newContext({
    ...VIEWPORTS[size],
    viewport: frame,
    storageState: state,
    colorScheme: theme,
    locale: lang === "en" ? "en-GB" : "pl-PL",
    timezoneId: "Europe/Warsaw",
    serviceWorkers: "block",
    reducedMotion: video ? "no-preference" : "reduce",
    ...(video ? { recordVideo: { dir: video, size: frame } } : {}),
  });
  await context.addInitScript(([entries, css]) => {
    try {
      for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
    } catch {
      // Storage can be unavailable on about:blank; the app's own origin gets it.
    }
    const style = () => {
      const tag = document.createElement("style");
      tag.textContent = css;
      document.head.appendChild(tag);
    };
    if (document.head) style();
    else document.addEventListener("DOMContentLoaded", style);
  }, [panelStorage(theme, lang, storage), HIDE_CSS]);
  return context;
}

/** Wait for data to land and motion to settle before a still. */
export async function settle(page, extra = 600) {
  await page.waitForLoadState("networkidle").catch(() => {});
  // Every EtherealLoader carries aria-busy while its data is in flight.
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 20_000 })
    .catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(extra);
}

/**
 * Headless Edge draws no pointer, so recorded takes get one: a dot that
 * follows mouse events and pulses on press.
 */
export async function injectCursor(context) {
  await context.addInitScript(() => {
    const mount = () => {
      if (document.getElementById("readme-media-cursor")) return;
      const dot = document.createElement("div");
      dot.id = "readme-media-cursor";
      Object.assign(dot.style, {
        position: "fixed",
        left: "0",
        top: "0",
        width: "22px",
        height: "22px",
        marginLeft: "-11px",
        marginTop: "-11px",
        borderRadius: "50%",
        background: "rgba(20, 20, 20, 0.35)",
        border: "2px solid rgba(255, 255, 255, 0.9)",
        boxShadow: "0 1px 4px rgba(0, 0, 0, 0.35)",
        pointerEvents: "none",
        zIndex: "2147483647",
        transition: "transform 120ms ease-out",
        transform: "translate(-100px, -100px)",
      });
      document.documentElement.appendChild(dot);
      let x = -100;
      let y = -100;
      let scale = 1;
      const paint = () => {
        dot.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
      };
      const follow = (event) => {
        x = event.clientX;
        y = event.clientY;
        paint();
      };
      window.addEventListener("pointermove", follow, true);
      window.addEventListener("pointerdown", (event) => {
        follow(event);
        scale = 0.7;
        paint();
      }, true);
      window.addEventListener("pointerup", () => {
        scale = 1;
        paint();
      }, true);
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", mount);
    } else {
      mount();
    }
  });
}

const pointer = new WeakMap();

/**
 * Move the mouse to a point in eased steps so the take shows the path. Each
 * step is a round trip to the browser (~40 ms while recording), which is
 * what paces the glide; ten steps take about half a second.
 */
export async function glideTo(page, x, y, steps = 10) {
  const from = pointer.get(page) ?? { x: x - 120, y: y + 80 };
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    await page.mouse.move(from.x + (x - from.x) * ease, from.y + (y - from.y) * ease);
  }
  pointer.set(page, { x, y });
}

/** Glide the mouse to an element's centre (or an offset in it). */
export async function glide(page, target, { dx = 0.5, dy = 0.5, steps = 10 } = {}) {
  const box = await target.boundingBox();
  if (!box) throw new Error("glide target has no box");
  await glideTo(page, box.x + box.width * dx, box.y + box.height * dy, steps);
  return box;
}

/**
 * Turn a recorded .webm into a README GIF: the chosen segments of the take
 * (each played at its own speed, so a pipeline's minutes can pass in seconds),
 * ~960 px wide, 12 fps, one palette per take so the gradients do not band.
 * Segments are [startSeconds, endSeconds, speed].
 */
export function toGif(webm, gif, { segments, width = 960, fps = 12 } = {}) {
  const parts = segments.map(([start, end, speed = 1], index) =>
    `[0:v]trim=start=${start}:end=${end},setpts=(PTS-STARTPTS)/${speed}[s${index}]`);
  const joined = segments.map((_, index) => `[s${index}]`).join("");
  const graph = `${parts.join(";")};${joined}concat=n=${segments.length}:v=1:a=0,`
    + `fps=${fps},scale=${width}:-1:flags=lanczos,split[a][b];`
    + "[a]palettegen=stats_mode=diff[p];"
    + "[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle";
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", webm, "-filter_complex", graph, "-loop", "0", gif]);
}
