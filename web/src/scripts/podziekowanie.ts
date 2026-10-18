/**
 * @file podziekowanie.ts
 * @description The one movement on /podziekowanie's cover: the invitation's hands reach as they did
 *  on /zaproszenie while the light dawns between them (`styles/podziekowanie.css`, `pdz-reach` /
 *  `pdz-dawn`). The contract is the invitation's entrance (`scripts/invitation.ts`): the cover
 *  waits (`data-entrance="waiting"`) while the hands decode, within a bounded window, and plays
 *  only when they are ready, the cover is in view, the tab is visible and motion is allowed.
 *  Otherwise, and once the movement ends, it is composed: the hands at rest under the light, which
 *  is also what CSS draws without JavaScript. The invitation's breathing stays on /zaproszenie.
 * @module scripts/podziekowanie
 */

/** The reach and the dawn, both `1.8s` in `styles/podziekowanie.css`. */
const PLAY_MS = 1800;
/** How long the hands may take to decode before the cover is composed without them moving. */
const DECODE_WINDOW_MS = 500;

const motionAllowed = (): boolean =>
  document.documentElement.classList.contains("voct-motion") &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function setupThanksCover(): (() => void) | undefined {
  const cover = document.querySelector<HTMLElement>(".pdz-cover");
  if (!cover || cover.dataset.entrance !== "waiting") return;

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
    return motionAllowed() && !document.hidden && box.bottom > 0 && box.top < window.innerHeight;
  };

  const hands = Array.from(cover.querySelectorAll<HTMLImageElement>(".pdz-hand"));
  if (hands.length === 0 || !canPlay()) {
    compose();
    return () => {
      active = false;
    };
  }

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

  return () => {
    active = false;
    compose();
  };
}
