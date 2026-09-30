/**
 * @file press-goals.ts
 * @description The two Plausible goals /press reports (lib/plausible): `press+pobranie` when a
 *  file link on the page is clicked, `press+kopiuj` when a Kopiuj lands in the clipboard.
 *  Imported for its side effect by PressPage. The composer's archive, saved through a link it
 *  builds outside the page's `<main>`, reports the same download goal itself (press-basket.ts).
 *
 *  NOT THE `tagged-events` CLASS. On a tagged link in the current window the Plausible script
 *  cancels the click and follows the link itself through `window.location`, which drops the
 *  `download` attribute: a PDF would open in the tab instead of saving. Listening beside the
 *  click, never cancelling it, leaves the browser's download exactly as it was.
 *
 *  A COPY COUNTS WHEN IT LANDED: copy-fields.ts announces `voct:copied` only after the clipboard
 *  accepted the text.
 *
 *  DOCUMENT-DELEGATED and installed once per document, behind the guard `copy-fields.ts` uses,
 *  so a ClientRouter navigation back to /press finds it live.
 * @architecture Astro islands 2026
 * @module scripts/press-goals
 */
import { GOALS, track } from "../lib/plausible";

/** The /press `<main>`: only a download or a copy inside it counts. */
const PRESS_ROOT = "[data-basket-root]";

interface PressGoalsGuard {
  __voctPressGoals?: boolean;
}

if (!(window as unknown as PressGoalsGuard).__voctPressGoals) {
  (window as unknown as PressGoalsGuard).__voctPressGoals = true;

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest(`${PRESS_ROOT} a[download]`)) {
      track(GOALS.pressDownload);
    }
  });

  document.addEventListener("voct:copied", (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest(PRESS_ROOT)) track(GOALS.pressCopy);
  });
}
