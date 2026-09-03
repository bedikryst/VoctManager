// @ts-check
/**
 * @file render.mjs
 * @description Renders `rite.html` to a frame-accurate master for video work.
 *
 *  WHY NOT SCREEN CAPTURE. The obvious way to get this animation into a video is to record the
 *  browser, and it is the wrong way: a real-time capture is at the mercy of the compositor, so
 *  the 180ms note beat lands on a different frame every take, and the 900ms pen stroke picks up
 *  dropped and duplicated frames that read as stutter on a hairline. This renderer never lets
 *  the animation run. It PAUSES every animation on the page and steps `currentTime` frame by
 *  frame, screenshotting each position — so the output is deterministic to the millisecond,
 *  identical between runs, and as slow to produce as it needs to be without affecting timing.
 *  A 4K frame taking 400ms to capture costs wall-clock, not motion.
 *
 *  WHY IT IS STILL THE SITE'S ANIMATION. The seek target is the browser's own CSS animation
 *  timeline, so every easing curve, delay and keyframe is evaluated by the same engine that
 *  runs it on the landing page. Nothing here re-implements a curve, which is the usual way an
 *  "extracted" animation quietly drifts from its original.
 *
 *  PLAYWRIGHT is not a dependency of this site (it would pull a browser download into every
 *  `npm i` in web/ for a tool almost nobody runs). Resolve it from wherever it exists:
 *    npm i -D playwright && npx playwright install chromium      — the clean way, or
 *    PLAYWRIGHT_DIR=<path to a project that has it> node rite/render.mjs
 *  `--channel=msedge` uses the system Edge instead and needs no browser download at all.
 *
 * @module rite/render
 */

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Encoder recipes. An `alpha` recipe over an opaque background just wastes a channel. */
const FORMATS = {
  /** Opaque editorial master. What a plate should be: 10-bit 4:2:2, cheap to scrub. */
  prores422: {
    ext: "mov",
    alpha: false,
    args: ["-c:v", "prores_ks", "-profile:v", "3", "-pix_fmt", "yuv422p10le", "-qscale:v", "9"],
  },
  /** Alpha master, for compositing the mark over other footage. Large files. */
  prores4444: {
    ext: "mov",
    alpha: true,
    args: ["-c:v", "prores_ks", "-profile:v", "4444", "-pix_fmt", "yuva444p10le", "-qscale:v", "5"],
  },
  /** Alpha at a fraction of the size, at the cost of a codec some NLEs still dislike. */
  webm: {
    ext: "webm",
    alpha: true,
    args: ["-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-crf", "18", "-b:v", "0", "-row-mt", "1"],
  },
  /** Flat delivery / preview. CRF 14 rather than a default 23: the plate is a near-black frame
   *  with a wide low-amplitude gradient across it, which is the exact signal 8-bit H.264 bands
   *  on. Tagged bt709 so nothing downstream has to guess the primaries. */
  h264: {
    ext: "mp4",
    alpha: false,
    args: [
      "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p",
      "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
      "-movflags", "+faststart",
    ],
  },
  /** No encode at all — hand the PNG sequence over and let the editor's own pipeline own it. */
  png: { ext: null, alpha: true, args: [] },
};

/** The shapes actually being ordered. Any flag after `--preset=…` overrides that preset. */
const PRESETS = {
  /** The deliverable: 4K plate, exactly as the site's threshold looks. */
  intro: { width: 3840, height: 2160, format: "prores422", bg: "plate" },
  "intro-hd": { width: 1920, height: 1080, format: "prores422", bg: "plate" },
  /** A file to watch and send around, not to cut from. */
  "intro-mp4": { width: 1920, height: 1080, format: "h264", bg: "plate" },
  /** Flat brand ground, bloom removed. For placing type or other elements around the mark. */
  "intro-black": { width: 3840, height: 2160, format: "prores422", bg: "dark" },
  /** The mark alone on transparency, for compositing over footage. */
  "intro-alpha": { width: 3840, height: 2160, format: "prores4444", bg: "alpha" },
  /** 9:16. Smaller mark, lifted: the bottom third of a Short is covered by platform chrome. */
  shorts: { width: 1080, height: 1920, format: "prores422", bg: "plate", mark: "960", shift: "-0.05" },
};

const DEFAULTS = {
  width: "3840", height: "2160", fps: "30",
  format: "prores422", bg: "plate",
  // The opening, not the nib, is the default anticipation: it plays under the writing instead
  // of delaying it, so it costs the cadence nothing and cannot be left behind by the pen.
  nib: "0", open: "1200", exit: "0", dur: "3500", stroke: "8",
};

function parseArgs(argv) {
  /** @type {Record<string,string>} */
  const out = {};
  for (const arg of argv) {
    const m = /^--([\w-]+)(?:=(.*))?$/.exec(arg);
    if (!m) continue;
    out[m[1]] = m[2] ?? "1";
  }
  return out;
}

async function loadPlaywright(dir) {
  for (const base of [...(dir ? [dir] : []), path.resolve(HERE, ".."), process.cwd()]) {
    try {
      const require = createRequire(pathToFileURL(path.join(base, "package.json")).href);
      return require("playwright");
    } catch { /* next candidate */ }
  }
  try {
    return await import("playwright");
  } catch {
    throw new Error(
      "Nie znaleziono Playwrighta.\n" +
      "  npm i -D playwright && npx playwright install chromium\n" +
      "albo wskaz projekt, ktory go ma:  PLAYWRIGHT_DIR=<sciezka> node rite/render.mjs",
    );
  }
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "inherit", "inherit"] });
    p.on("error", (e) => reject(
      /** @type {NodeJS.ErrnoException} */ (e).code === "ENOENT"
        ? new Error(`Nie znaleziono \`${cmd}\`. Zainstaluj ffmpeg i dodaj go do PATH.`)
        : e,
    ));
    p.on("close", (c) => (c === 0 ? resolve(undefined) : reject(new Error(`${cmd} zakonczyl sie kodem ${c}`))));
  });
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));

  if (flags.preset && !PRESETS[flags.preset]) {
    throw new Error(`Nieznany --preset=${flags.preset}. Dostepne: ${Object.keys(PRESETS).join(", ")}`);
  }
  const cfg = { ...DEFAULTS, ...(PRESETS[flags.preset] ?? {}), ...flags };

  const width = Number(cfg.width);
  const height = Number(cfg.height);
  const fps = Number(cfg.fps);
  const bg = cfg.bg;
  const recipe = FORMATS[cfg.format];
  if (!recipe) throw new Error(`Nieznany --format=${cfg.format}. Dostepne: ${Object.keys(FORMATS).join(", ")}`);
  if (recipe.alpha && bg !== "alpha" && cfg.format !== "png") {
    console.warn(`! --format=${cfg.format} niesie kanal alfa, ale --bg=${bg} zamaluje go na krycie.`);
  }
  if (!recipe.alpha && bg === "alpha") {
    console.warn(`! --bg=alpha, ale --format=${cfg.format} nie zapisuje alfy — tlo wyjdzie czarne.`);
  }

  // The mark's height inside the frame. 62% of frame height by default: the stem needs headroom
  // or the cadence starts hard against the top edge.
  const markH = Math.round(Number(cfg.mark ?? height * 0.62));
  // Samples per output frame, and how much of the frame interval the shutter is open for. The
  // ink bead REQUIRES a shutter — it is a tracked object crossing a quarter of the frame between
  // samples — so turning it on turns this on, unless the caller says otherwise. Without the bead
  // nothing here is a moving object (a growing line and a rising gradient do not strobe), so the
  // default stays 1 and renders stay eight times faster.
  const blur = Math.max(1, Math.round(Number(cfg.blur ?? (cfg.nib === "1" ? 8 : 1))));
  const shutter = Math.min(1, Math.max(0.05, Number(cfg.shutter ?? 0.5)));
  const name = cfg.name ?? `${flags.preset ?? "rite"}-${width}x${height}-${fps}fps-${bg}`;
  const outDir = path.resolve(HERE, cfg.out ?? "out");

  const q = new URLSearchParams({
    render: "1", h: String(markH), bg,
    stroke: String(cfg.stroke), nib: cfg.nib === "1" ? "1" : "0",
    exit: cfg.exit === "1" ? "1" : "0", dur: String(cfg.dur), open: String(cfg.open),
  });
  for (const k of ["hold", "exitdur", "lead", "shift", "ground", "bloom", "drawease"]) {
    if (cfg[k] !== undefined) q.set(k, String(cfg[k]));
  }
  const url = `${pathToFileURL(path.join(HERE, "rite.html")).href}?${q}`;

  const { chromium } = await loadPlaywright(cfg.playwright ?? process.env.PLAYWRIGHT_DIR);
  const browser = await chromium.launch({
    headless: true,
    ...(cfg.channel ? { channel: cfg.channel } : {}),
    // The plate is a near-black frame carrying a wide, very low-amplitude gradient — the exact
    // signal a GPU's own dithering makes a moving pattern out of. Force sRGB and take the CPU
    // path so the noise floor is identical on every frame and every machine.
    args: ["--force-color-profile=srgb", "--disable-lcd-text", "--disable-gpu-vsync"],
  });

  const frameDir = path.join(outDir, `${name}.frames`);
  await rm(frameDir, { recursive: true, force: true });
  await mkdir(frameDir, { recursive: true });

  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
    colorScheme: "dark",
  });
  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction(() => window.riteReady === true);

  const timing = await page.evaluate(() => window.riteTiming);
  const total = timing.total;
  // NOT `+ 1`. A clip of N frames at F fps lasts N/F — the last frame is held to the end, it does
  // not need a twin sitting exactly on it. Rendering the endpoint as an extra frame makes every
  // file one frame longer than the duration its own sidecar claims, which is the kind of drift an
  // editor discovers after conforming.
  const frames = Math.max(1, Math.round((total / 1000) * fps));
  const realMs = (frames / fps) * 1000;
  const s = (ms) => `${(ms / 1000).toFixed(2)}s`;
  console.log(
    `${name}\n  ${width}×${height} · ${fps} fps · tlo ${bg} · znak ${markH}px` +
    `${cfg.nib === "1" ? " · z zaplonem" : ""}` +
    `${Number(cfg.open) > 0 ? ` · otwarcie ${s(Number(cfg.open))}` : ""}` +
    `${blur > 1 ? ` · shutter ${Math.round(shutter * 360)}° z ${blur} probek` : " · BEZ rozmycia ruchu"}\n` +
    `  kadencja do ${s(timing.cadenceEnd)} · spoczynek ${s(timing.hold)}` +
    `${cfg.exit === "1" ? ` · wygaszenie od ${s(timing.exitAt)}` : ""}\n` +
    `  ${s(realMs)} → ${frames} klatek` +
    (Math.abs(realMs - total) > 0.5 ? `  (zamowiono ${s(total)}; ${fps} kl/s nie dzieli tego rowno)` : ""),
  );
  // The cadence is a fixed 2600ms and the finished mark is the payoff; a duration that leaves
  // no rest cuts on the frame the light lands, which is the one frame worth holding.
  // An open shutter averages a window that starts at the frame's own instant, so a cadence that
  // begins at t=0 puts motion inside frame zero and the file opens mid-stroke. The still head has
  // to outlast one shutter window for the first frame to be the plate alone.
  const shutterMs = (shutter * 1000) / fps;
  if (blur > 1 && timing.lead < shutterMs) {
    console.warn(
      `! Glowa ${timing.lead}ms jest krotsza niz okno migawki (${shutterMs.toFixed(1)}ms)` +
      ` — pierwsza klatka bedzie juz zawierac ruch. Ustaw --lead=${Math.ceil(shutterMs / 10) * 10} lub wiecej.`,
    );
  }
  // The bead's stretch stops are calibrated to the default pen curve's velocity peak (48%).
  // Another curve moves that peak and the ink then thickens where the stroke is not fastest.
  if (cfg.nib === "1" && cfg.drawease !== undefined && cfg.drawease !== "pen") {
    console.warn(
      `! --nib=1 z --drawease=${cfg.drawease}: rozciagniecie atramentu jest skalibrowane pod` +
      ` krzywa "pen" i przy innej wypadnie w zlym miejscu.`,
    );
  }
  if (timing.hold < 200) {
    console.warn(
      `! Spoczynek ${timing.hold}ms — gotowy znak nie ma kiedy wybrzmiec.` +
      ` Podnies --dur do co najmniej ${timing.cadenceEnd + 500 + (cfg.exit === "1" ? Number(cfg.exitdur ?? 700) : 0)}.`,
    );
  }

  // Sub-frame sampling — a real shutter, and the only honest fix for the fast beats. The pen's
  // easing puts ~30% of the stem inside the first 33ms, so at 30fps anything TRACKED as an object
  // (the ink bead above all) jumps a quarter of the frame between samples. A growing line
  // survives that, because the eye reads growth as speed; a travelling object strobes. Averaging
  // `blur` instantaneous samples across an open shutter is what a camera does, and stepping the
  // timeline makes it exact rather than approximate.
  const total_shots = frames * blur;
  let shot = 0;
  for (let i = 0; i < frames; i++) {
    for (let k = 0; k < blur; k++) {
      // Samples sit INSIDE the shutter's open window, which starts at the frame's own instant —
      // a 0.5 shutter is the 180° convention.
      const offset = blur === 1 ? 0 : (((k + 0.5) / blur) * shutter * 1000) / fps;
      await page.evaluate((ms) => window.riteSeek(ms), (i / fps) * 1000 + offset);
      // Two frames, not one: the first commits the new style, the second guarantees the compositor
      // has drawn it. A single rAF captured the PREVIOUS position on roughly one frame in thirty.
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(undefined)))),
      );
      await page.screenshot({
        path: path.join(frameDir, `f${String(shot).padStart(5, "0")}.png`),
        omitBackground: bg === "alpha",
      });
      if (shot % 15 === 0) process.stdout.write(`\r  ${shot}/${total_shots}`);
      shot++;
    }
  }
  process.stdout.write(`\r  ${total_shots}/${total_shots}\n`);
  await browser.close();

  // The spec travels WITH the frames: a sequence handed over without its frame rate is a
  // sequence someone will conform at 30 and wonder why the note beat drifted.
  await writeFile(
    path.join(outDir, `${name}.json`),
    JSON.stringify(
      {
        name, width, height, fps, frames,
        durationMs: realMs, requestedMs: total, timing,
        markH, bg, format: cfg.format, blur, shutter, url,
      },
      null, 2,
    ),
    "utf8",
  );

  if (!recipe.ext) {
    console.log(`✓ sekwencja PNG: ${frameDir}`);
    return;
  }

  const outFile = path.join(outDir, `${name}.${recipe.ext}`);
  // With a shutter, the sequence is `blur`× the output rate: `tmix` averages each group and the
  // `select` keeps the last member of every group — which already carries the right PTS spacing,
  // so nothing has to be retimed afterwards.
  const blurFilter = blur > 1
    ? ["-vf", `tmix=frames=${blur},select='not(mod(n+1\\,${blur}))'`]
    : [];
  await run("ffmpeg", [
    "-y", "-loglevel", "error", "-framerate", String(fps * blur),
    "-i", path.join(frameDir, "f%05d.png"),
    ...blurFilter, ...recipe.args, "-r", String(fps), outFile,
  ]);
  if (cfg.keepframes !== "1") await rm(frameDir, { recursive: true, force: true });
  console.log(`✓ ${outFile}`);
}

main().catch((err) => {
  console.error(`\n${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
