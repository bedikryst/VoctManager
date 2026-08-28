/**
 * @file useKeyboardInset.ts
 * @description Publishes the height the on-screen keyboard covers, as a CSS
 * custom property on one element.
 *
 * A full-screen surface sized in `dvh` is correct until a keyboard opens. Chrome
 * shrinks the layout viewport for it — but only when the document asks, via
 * `interactive-widget=resizes-content` in the viewport meta (see `index.html`).
 * iOS never shrinks it: the visual viewport contracts and the layout viewport,
 * which is what `dvh` and `position: fixed` measure, stays at full height. So a
 * composer pinned to the bottom of such a surface sits behind the keyboard.
 *
 * The inset is written as a custom property rather than returned as state
 * because it changes on every frame of the keyboard's own animation, and no
 * component above the surface has anything to do with the value.
 *
 * The two mechanisms compose rather than fight: where the layout viewport
 * already shrank, `innerHeight` shrank with it and this resolves to ~0.
 * @module shared/lib/dom/useKeyboardInset
 */

import { useCallback, useEffect, useRef } from "react";

/** Name of the property the surface's own `padding-bottom` reads. */
const INSET_PROPERTY = "--keyboard-inset";

/**
 * Attach the returned callback as the `ref` of the surface that must yield to
 * the keyboard. While mounted it keeps `--keyboard-inset` on that element in
 * sync; the element consumes it itself (nothing else can see it).
 */
export const useKeyboardInset = (): ((node: HTMLElement | null) => void) => {
  const nodeRef = useRef<HTMLElement | null>(null);

  const publish = useCallback(() => {
    const node = nodeRef.current;
    if (!node) return;

    const viewport = window.visualViewport;
    // No visualViewport (or a desktop browser with no software keyboard at all):
    // the surface keeps its safe-area floor and nothing else.
    const covered = viewport
      ? window.innerHeight - (viewport.height + viewport.offsetTop)
      : 0;

    node.style.setProperty(INSET_PROPERTY, `${Math.max(0, Math.round(covered))}px`);
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    // `scroll` as well as `resize`: iOS shifts the visual viewport under the
    // layout one when it reveals a focused field, and only `offsetTop` reports it.
    viewport.addEventListener("resize", publish);
    viewport.addEventListener("scroll", publish);
    return () => {
      viewport.removeEventListener("resize", publish);
      viewport.removeEventListener("scroll", publish);
    };
  }, [publish]);

  return useCallback(
    (node: HTMLElement | null) => {
      nodeRef.current = node;
      if (node) publish();
    },
    [publish],
  );
};
