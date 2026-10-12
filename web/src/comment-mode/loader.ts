/**
 * @file loader.ts
 * @description The comment mode's door on every `BaseLayout` page. Every visitor downloads this
 *  module and nothing else of the mode: it reads one flag, and only for an editor who opened the
 *  site with `?uwagi` does it import the mode, which Vite emits as a chunk of its own.
 *
 *  `?uwagi` sets the flag in `localStorage` and leaves the address at once, through
 *  `history.replaceState(history.state, …)` because the client router keeps its own state in that
 *  slot. A link copied from the address bar therefore never switches the mode on for anybody else.
 *  The flag stays until the editor presses "Zakończ".
 *
 *  NOTHING HERE MAY TOUCH THE PAGE WHEN IT FAILS. Storage that throws (a private window, blocked
 *  site data) reads as "off" and a parameter in the address still starts the mode for that load;
 *  a failed import, or a mode that throws while starting, is caught and only logged. A broken chunk
 *  costs an editor the tool and never costs a visitor the page.
 *
 *  Checked at module load and on every `astro:page-load`: a bundled script runs once per full load,
 *  and a client-router navigation can carry `?uwagi` as well.
 * @architecture Astro islands 2026
 * @module comment-mode/loader
 */

const PARAM = "uwagi";
const FLAG = "voct:comment-mode";

/** Set by `?uwagi` for this load, in case storage refuses to keep the flag. */
let armed = false;

function flagStored(): boolean {
  try {
    return window.localStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}

function storeFlag(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(FLAG, "1");
    else window.localStorage.removeItem(FLAG);
  } catch {
    // Storage refused: the mode still runs for this load through `armed`.
  }
}

function adoptParam(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(PARAM)) return;
  armed = true;
  storeFlag(true);
  url.searchParams.delete(PARAM);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

/** What "Zakończ" calls: the next page load is an ordinary visitor's again. */
function disarm(): void {
  armed = false;
  storeFlag(false);
}

function check(): void {
  try {
    adoptParam();
    if (!armed && !flagStored()) return;
    import("./mode")
      .then((mode) => mode.start({ disarm }))
      .catch((error: unknown) => console.warn("[comment mode] did not start", error));
  } catch (error) {
    console.warn("[comment mode] did not start", error);
  }
}

check();
document.addEventListener("astro:page-load", check);

// A module, not a global script: its names stay its own.
export {};
