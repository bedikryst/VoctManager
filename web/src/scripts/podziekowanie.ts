/**
 * @file podziekowanie.ts
 * @description The motion on /podziekowanie that CSS cannot time on its own.
 *
 *  THE COVER'S ONE MOVEMENT: the invitation's hands reach as they did on /zaproszenie while the
 *  light dawns between them (`styles/podziekowanie.css`, `pdz-reach` / `pdz-dawn`). The contract is
 *  the invitation's entrance (`scripts/invitation.ts`): the cover waits (`data-entrance="waiting"`)
 *  while the hands decode, within a bounded window, and plays only when they are ready, the cover
 *  is in view, the tab is visible and motion is allowed. Otherwise, and once the movement ends, it
 *  is composed: the hands at rest under the light, which is also what CSS draws without
 *  JavaScript. The hands' breathing stays on /zaproszenie.
 *
 *  THE ATMOSPHERE RESTS WHERE NOBODY SEES IT, as on the invitation: the cover's light while the
 *  cover is out of view, each cloud bank while it is, everything in a hidden tab or under reduced
 *  motion (`data-motion-paused`), and everything while a guest writes in the list's card
 *  (`data-writing`), whose foot the clouds stand beside.
 * @module scripts/podziekowanie
 */

/** The reach and the dawn, both `1.8s` in `styles/podziekowanie.css`. */
const PLAY_MS = 1800;
/** How long the hands may take to decode before the cover is composed without them moving. */
const DECODE_WINDOW_MS = 500;

export function setupThanks(): (() => void) | undefined {
  const sheet = document.querySelector<HTMLElement>(".pdz");
  const cover = sheet?.querySelector<HTMLElement>(".pdz-cover");
  if (!sheet || !cover) return;

  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  const listeners = new AbortController();
  let active = true;
  let finishTimer: number | undefined;
  let readinessTimer: number | undefined;

  const compose = (): void => {
    cover.dataset.entrance = "composed";
    window.clearTimeout(finishTimer);
    window.clearTimeout(readinessTimer);
  };
  const canPlay = (): boolean => {
    const box = cover.getBoundingClientRect();
    return (
      document.documentElement.classList.contains("voct-motion") &&
      !media.matches &&
      !document.hidden &&
      box.bottom > 0 &&
      box.top < window.innerHeight
    );
  };

  // ── The atmosphere ──
  const syncPaused = (): void => {
    sheet.toggleAttribute("data-motion-paused", media.matches || document.hidden);
  };
  const syncWriting = (): void => {
    const field = document.activeElement;
    sheet.toggleAttribute(
      "data-writing",
      field instanceof HTMLElement && sheet.contains(field) && field.matches("input, textarea, select"),
    );
  };
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      (entry.target as HTMLElement).dataset.atmosphere = entry.isIntersecting ? "running" : "paused";
    }
  });
  for (const node of [cover, ...Array.from(sheet.querySelectorAll<HTMLElement>(".inv-cloud"))]) {
    node.dataset.atmosphere = "paused";
    observer.observe(node);
  }
  sheet.addEventListener("focusin", syncWriting, { signal: listeners.signal });
  sheet.addEventListener(
    "focusout",
    () =>
      queueMicrotask(() => {
        if (active) syncWriting();
      }),
    { signal: listeners.signal },
  );
  document.addEventListener("visibilitychange", syncPaused, { signal: listeners.signal });
  media.addEventListener("change", syncPaused, { signal: listeners.signal });
  syncPaused();
  syncWriting();

  // ── The cover's entrance ──
  const hands = Array.from(cover.querySelectorAll<HTMLImageElement>(".pdz-hand"));
  if (cover.dataset.entrance === "waiting") {
    if (hands.length === 0 || !canPlay()) {
      compose();
    } else {
      const decoded = Promise.all(
        hands.map((image) =>
          image.decode().then(
            () => image.naturalWidth > 0,
            () => false,
          ),
        ),
      ).then((results) => results.every(Boolean));
      const deadline = new Promise<boolean>((resolve) => {
        readinessTimer = window.setTimeout(() => resolve(false), DECODE_WINDOW_MS);
      });
      void Promise.race([decoded, deadline]).then((ready) => {
        window.clearTimeout(readinessTimer);
        if (!active || cover.dataset.entrance !== "waiting") return;
        if (!ready || !canPlay()) {
          compose();
          return;
        }
        cover.dataset.entrance = "play";
        finishTimer = window.setTimeout(compose, PLAY_MS);
      });
    }
  }

  return () => {
    active = false;
    listeners.abort();
    observer.disconnect();
    compose();
  };
}
