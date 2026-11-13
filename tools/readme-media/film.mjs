/**
 * @file film.mjs
 * @description Frame-stepped recording for the portfolio clips: 60 fps with no
 * dropped frames, at any device scale, in a headless browser.
 *
 * Playwright's own recordVideo samples the screen at about 25 fps and drops
 * frames whenever the page is busy. Here the page runs on a virtual clock
 * instead: once `begin()` is called, timers, requestAnimationFrame, Date,
 * performance.now and every CSS or Web Animation stand still until the take
 * advances them by exactly one frame, and a screenshot is taken after each
 * step. Network replies and React renders still arrive in real time between
 * frames, so a slow request costs the clip a frame or two, never a stutter.
 *
 * The page's caret blinks on the real clock, so screenshots hide it.
 */

import { mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

/**
 * The page side, installed before any app script. Until `__film.freeze()` the
 * page keeps real time, so loading and logging in behave as usual.
 */
function virtualClock() {
  if (window.__film) return;
  const nativeNow = performance.now.bind(performance);
  const NativeDate = Date;
  const native = {
    raf: window.requestAnimationFrame.bind(window),
    cancelRaf: window.cancelAnimationFrame.bind(window),
    setTimeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
    setInterval: window.setInterval.bind(window),
    clearInterval: window.clearInterval.bind(window),
    animate: Element.prototype.animate,
  };
  const epoch = NativeDate.now() - nativeNow();
  let frozen = false;
  let vt = 0;
  const now = () => (frozen ? vt : nativeNow());

  performance.now = now;
  // eslint-disable-next-line no-global-assign
  Date = new Proxy(NativeDate, {
    construct(target, args, newTarget) {
      return Reflect.construct(target, args.length ? args : [Math.round(epoch + now())], newTarget);
    },
    apply() {
      return new NativeDate(Math.round(epoch + now())).toString();
    },
    get(target, prop, receiver) {
      if (prop === "now") return () => Math.round(epoch + now());
      return Reflect.get(target, prop, receiver);
    },
  });

  // Virtual ids live far above the browser's own, so a clear call can tell
  // which kind it holds.
  let seq = 1e9;
  const rafs = new Map();
  const timers = new Map();

  window.requestAnimationFrame = (callback) => {
    if (!frozen) return native.raf(callback);
    seq += 1;
    rafs.set(seq, callback);
    return seq;
  };
  window.cancelAnimationFrame = (id) => {
    if (!rafs.delete(id)) native.cancelRaf(id);
  };

  // A zero delay stays on the real clock: it means "after this task", and
  // holding it for a frame would stall promise chains between frames.
  const schedule = (every) => (handler, delay = 0, ...args) => {
    const ms = Number(delay) || 0;
    if (!frozen || ms <= 0 || typeof handler !== "function") {
      return (every ? native.setInterval : native.setTimeout)(handler, delay, ...args);
    }
    seq += 1;
    timers.set(seq, { due: vt + ms, every: every ? Math.max(ms, 1) : 0, handler, args });
    return seq;
  };
  const clear = (id) => {
    if (timers.delete(id)) return;
    native.clearTimeout(id);
    native.clearInterval(id);
  };
  window.setTimeout = schedule(false);
  window.setInterval = schedule(true);
  window.clearTimeout = clear;
  window.clearInterval = clear;

  // Animations the clock drives: paused, and moved on by hand each frame.
  // One the page pauses or replays itself leaves the set.
  const driven = new Set();
  const proto = Animation.prototype;
  const nativePlay = proto.play;
  const nativePause = proto.pause;
  const startTime = Object.getOwnPropertyDescriptor(proto, "startTime");
  const timelineTime = Object.getOwnPropertyDescriptor(AnimationTimeline.prototype, "currentTime");
  // Scroll-driven animations follow the scroll position, not time, and keep it.
  const onClock = (animation) => animation.timeline instanceof DocumentTimeline;
  const adopt = (animation, fromStart = false) => {
    if (driven.has(animation) || animation.playState !== "running" || !onClock(animation)) return;
    nativePause.call(animation);
    if (fromStart) animation.currentTime = 0;
    driven.add(animation);
  };
  // The document timeline runs on the real clock, ahead of the virtual one by
  // however long the frames took. A library that starts an animation at
  // "now" (framer-motion sets startTime from performance.now) would find it
  // already over, so a start time is read as the current time it implies, and
  // the timeline reports virtual time.
  Object.defineProperty(AnimationTimeline.prototype, "currentTime", {
    configurable: true,
    get() {
      return frozen ? vt : timelineTime.get.call(this);
    },
  });
  Object.defineProperty(proto, "startTime", {
    configurable: true,
    get() {
      if (!frozen || !driven.has(this)) return startTime.get.call(this);
      return vt - (this.currentTime ?? 0) / (this.playbackRate || 1);
    },
    set(value) {
      if (!frozen || typeof value !== "number" || !onClock(this)) {
        startTime.set.call(this, value);
        return;
      }
      nativePause.call(this);
      this.currentTime = (vt - value) * (this.playbackRate || 1);
      driven.add(this);
    },
  });
  // Playing an animation the clock drives keeps it driven; pausing it hands
  // it back to the page, which then holds it where it is.
  proto.play = function play() {
    if (!frozen || !onClock(this)) return nativePlay.call(this);
    if (driven.has(this)) return undefined;
    nativePlay.call(this);
    adopt(this);
    return undefined;
  };
  proto.pause = function pause() {
    driven.delete(this);
    return nativePause.call(this);
  };
  const scan = () => {
    for (const animation of document.getAnimations()) adopt(animation);
  };
  Element.prototype.animate = function animate(...args) {
    const animation = native.animate.apply(this, args);
    if (frozen) adopt(animation, true);
    return animation;
  };
  // A transition or keyframe animation is caught the moment it is created, so
  // it starts from its first frame rather than from where real time took it.
  window.addEventListener("transitionrun", (event) => {
    if (!frozen || !(event.target instanceof Element)) return;
    for (const animation of event.target.getAnimations()) {
      if (animation.transitionProperty === event.propertyName) adopt(animation, true);
    }
  }, true);
  window.addEventListener("animationstart", (event) => {
    if (!frozen || !(event.target instanceof Element)) return;
    for (const animation of event.target.getAnimations()) {
      if (animation.animationName === event.animationName) adopt(animation, true);
    }
  }, true);

  const stepAnimations = (ms) => {
    scan();
    for (const animation of driven) {
      if (animation.playState !== "paused") {
        driven.delete(animation);
        continue;
      }
      const rate = animation.playbackRate || 1;
      const end = animation.effect?.getComputedTiming().endTime ?? Infinity;
      const next = (animation.currentTime ?? 0) + ms * rate;
      if (rate > 0 ? next >= end : next <= 0) {
        // Finishing for real fires animationend and resolves `finished`,
        // which is what dialogs wait for before they unmount.
        driven.delete(animation);
        animation.finish();
      } else {
        animation.currentTime = next;
      }
    }
  };

  window.__film = {
    freeze() {
      if (frozen) return;
      vt = nativeNow();
      frozen = true;
      scan();
    },
    advance(ms) {
      const target = vt + ms;
      for (;;) {
        let id;
        let timer;
        for (const [key, entry] of timers) {
          if (entry.due <= target && (!timer || entry.due < timer.due)) {
            id = key;
            timer = entry;
          }
        }
        if (!timer) break;
        vt = Math.max(vt, timer.due);
        if (timer.every) timer.due += timer.every;
        else timers.delete(id);
        try {
          timer.handler(...timer.args);
        } catch (error) {
          console.error(error);
        }
      }
      vt = target;
      stepAnimations(ms);
      const queue = [...rafs.values()];
      rafs.clear();
      for (const callback of queue) {
        try {
          callback(vt);
        } catch (error) {
          console.error(error);
        }
      }
    },
  };
}

/**
 * Install the virtual clock in every page the context opens. The caret blinks
 * on the real clock and would flicker from frame to frame, and the
 * spellchecker underlines whatever a take types, so both are switched off.
 */
export async function filmable(context) {
  await context.addInitScript(virtualClock);
  await context.addInitScript(() => {
    const quiet = () => {
      document.documentElement.setAttribute("spellcheck", "false");
      const style = document.createElement("style");
      // Fields that ask for spellchecking themselves still get no squiggles.
      style.textContent = "* { caret-color: transparent !important; }"
        + " ::spelling-error, ::grammar-error { text-decoration: none !important; }";
      document.head.appendChild(style);
    };
    if (document.head) quiet();
    else document.addEventListener("DOMContentLoaded", quiet);
  });
}

/**
 * One clip: frames written to `dir` as numbered JPEGs, then cut into an MP4.
 * Every helper that moves something records the frames it takes.
 */
export class Film {
  constructor(page, dir, { fps = 60 } = {}) {
    this.page = page;
    this.dir = dir;
    this.fps = fps;
    this.dt = 1000 / fps;
    this.count = 0;
    this.pointer = undefined;
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
  }

  /** Stop the page's clock; from here on time passes only frame by frame. */
  async begin() {
    await this.page.evaluate(() => window.__film.freeze());
  }

  /** Advance the page by one frame per count and keep each picture. */
  async frame(count = 1) {
    for (let i = 0; i < count; i += 1) {
      await this.page.evaluate((ms) => window.__film?.advance(ms), this.dt);
      // Playwright's own capture, because it renders at the context's device
      // scale; the protocol's bare captureScreenshot returns CSS pixels.
      await this.page.screenshot({
        path: join(this.dir, `f${String(this.count).padStart(5, "0")}.jpg`),
        type: "jpeg",
        quality: 95,
        scale: "device",
      });
      this.count += 1;
    }
  }

  /** Stillness on screen (animations already under way still play out). */
  async hold(seconds) {
    await this.frame(Math.round(seconds * this.fps));
  }

  /** Record frames until `predicate` (Node side, async) holds. */
  async until(predicate, { seconds = 30, every = 0 } = {}) {
    const limit = Math.round(seconds * this.fps);
    for (let i = 0; i < limit; i += 1) {
      if (await predicate()) return;
      if (every) await new Promise((resolve) => setTimeout(resolve, every));
      await this.frame();
    }
    throw new Error(`film.until: still waiting after ${seconds} s of clip`);
  }

  /** Until the locator is visible. */
  async see(locator, options) {
    await this.until(() => locator.isVisible().catch(() => false), options);
  }

  /** Move the pointer to a point along an eased path, one step per frame. */
  async glideTo(x, y, seconds = 0.55) {
    const from = this.pointer ?? { x: x - 140, y: y + 90 };
    const steps = Math.max(1, Math.round(seconds * this.fps));
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      const ease = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      await this.page.mouse.move(from.x + (x - from.x) * ease, from.y + (y - from.y) * ease);
      await this.frame();
    }
    this.pointer = { x, y };
  }

  /** Glide to a locator's box (at a fraction of it) and return the box. */
  async glide(locator, { dx = 0.5, dy = 0.5, seconds } = {}) {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    if (!box) throw new Error("film.glide: target has no box");
    await this.glideTo(box.x + box.width * dx, box.y + box.height * dy, seconds);
    return box;
  }

  /** A press the viewer can see: down, a few frames, up. */
  async press() {
    await this.page.mouse.down();
    await this.frame(4);
    await this.page.mouse.up();
    await this.frame(2);
  }

  /** Glide to a locator and click it. */
  async click(locator, options) {
    await this.glide(locator, options);
    await this.frame(6);
    await this.press();
  }

  /** A tap on a touch screen: no pointer travel, a short dot where the finger lands. */
  async tap(locator, { dx = 0.5, dy = 0.5 } = {}) {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    if (!box) throw new Error("film.tap: target has no box");
    const x = box.x + box.width * dx;
    const y = box.y + box.height * dy;
    await this.page.mouse.move(x, y);
    this.pointer = { x, y };
    await this.frame(3);
    await this.press();
  }

  /**
   * Scroll by `dy` px under the pointer along an eased path, one wheel step
   * per frame. The browser is launched without smooth scrolling, so each step
   * lands where it is sent.
   */
  async scroll(dy, seconds = 0.8) {
    const steps = Math.max(1, Math.round(seconds * this.fps));
    let done = 0;
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      const ease = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      const to = Math.round(dy * ease);
      await this.page.mouse.wheel(0, to - done);
      done = to;
      await this.frame();
    }
  }

  /** Type at a human pace, a few characters per second, frames between keys. */
  async type(text, { cps = 14 } = {}) {
    const gap = Math.max(1, Math.round(this.fps / cps));
    for (const char of text) {
      await this.page.keyboard.type(char);
      await this.frame(char === " " ? gap + 1 : gap);
    }
  }

  /**
   * Cut the frames into an H.264 MP4 at `width` px (the frames' own width by
   * default) and a WebP poster from the first frame. Quality comes before
   * weight: the page loads a clip only when it is shown.
   */
  encode(mp4, { width, crf = 18, poster } = {}) {
    if (!readdirSync(this.dir).length) throw new Error("film.encode: no frames");
    const input = join(this.dir, "f%05d.jpg");
    const scale = width ? `scale=${width}:-2:flags=lanczos,` : "";
    execFileSync("ffmpeg", [
      "-y", "-loglevel", "error", "-framerate", String(this.fps), "-i", input,
      "-vf", `${scale}format=yuv420p`, "-c:v", "libx264", "-preset", "slow", "-tune", "animation",
      "-crf", String(crf), "-movflags", "+faststart", "-an", mp4,
    ]);
    const size = statSync(mp4).size;
    if (poster) {
      execFileSync("ffmpeg", [
        "-y", "-loglevel", "error", "-i", join(this.dir, "f00000.jpg"),
        "-vf", `${width ? `scale=${width}:-2:flags=lanczos` : "null"}`, "-c:v", "libwebp", "-quality", "82", poster,
      ]);
    }
    return { bytes: size, crf, frames: this.count, seconds: this.count / this.fps };
  }
}
