/**
 * @file reviewFocus.ts
 * @description The piece card's keyboard review. `J` and `K` move focus to the
 * next or previous unchecked field's "Potwierdź" button, in document order and
 * wrapping round; Enter or Space confirms it, and a keyboard confirmation moves
 * focus on to the next one, or to the publish action once none is left. `E`
 * puts focus in the value of the field whose button has focus. Focus is native
 * throughout: the buttons are real, and nothing is highlighted by hand.
 *
 * The buttons carry `data-review-confirm` and name their field's control in
 * `data-review-control`; the record pane carries `data-review-root`. Which
 * buttons exist is decided by `usePieceFieldReview`, the same provenance test
 * `pieceReviewBreakdown` counts with, so the keys visit what the header counts.
 *
 * Keys are left alone in a field, a popover or a modal. Beside the record the
 * desk's annotator also answers letters (`E` arms the eraser, `J` the link
 * tool) when nothing has focus, so a key pressed with focus on the body belongs
 * to whichever pane the reader last clicked or focused. The desk's viewer asks
 * its `claimKey` before its own shortcuts, so the page hands it this handler.
 * @module features/archive/piece-card/reviewFocus
 */

import { useCallback, useEffect, useRef } from "react";

import { isEditableTarget } from "@/shared/lib/dom/editableTarget";

const CONFIRM_SELECTOR = "[data-review-confirm]";
const ROOT_SELECTOR = "[data-review-root]";
const APPROVE_SELECTOR = "[data-review-approve]";
/** Where a key belongs to the open layer, not to the record under it. */
const LAYER_SELECTOR = "[data-radix-popper-content-wrapper], [role='dialog'], [role='menu'], [role='listbox']";

const isShown = (element: HTMLElement): boolean => element.getClientRects().length > 0;

const isLive = (element: HTMLElement): boolean =>
  isShown(element)
  && element.getAttribute("aria-disabled") !== "true"
  && !(element instanceof HTMLButtonElement && element.disabled);

const reveal = (element: HTMLElement): void => {
  element.focus({ preventScroll: true });
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Centred, so neither the sticky index nor a bottom bar covers it.
  element.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
};

/**
 * The confirm button after (`1`) or before (`-1`) `from` in document order,
 * wrapping round. Without `from`, the first or the last.
 */
const stepReview = (root: ParentNode, from: Element | null, direction: 1 | -1): HTMLElement | null => {
  const confirms = Array.from(root.querySelectorAll<HTMLElement>(CONFIRM_SELECTOR))
    .filter((element) => element !== from && isLive(element));
  const first = confirms[0] ?? null;
  const last = confirms[confirms.length - 1] ?? null;
  if (!from) return direction === 1 ? first : last;
  const follows = (element: HTMLElement): boolean =>
    Boolean(from.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING);
  if (direction === 1) return confirms.find(follows) ?? first;
  return [...confirms].reverse().find((element) => !follows(element)) ?? last;
};

/** Focus after a keyboard confirmation: the next unchecked field, else publish. */
export const advanceReviewFocus = (confirmed: HTMLElement): void => {
  const root = confirmed.closest(ROOT_SELECTOR) ?? document;
  const next = stepReview(root, confirmed, 1)
    ?? Array.from(document.querySelectorAll<HTMLElement>(APPROVE_SELECTOR)).find(isLive);
  if (next) reveal(next);
};

/** Focus on the first unchecked field, as from the publish confirmation. */
export const focusFirstUnchecked = (): boolean => {
  const root = document.querySelector(ROOT_SELECTOR);
  const first = root ? stepReview(root, null, 1) : null;
  if (first) reveal(first);
  return first !== null;
};

const focusValue = (confirm: HTMLElement): boolean => {
  const controlId = confirm.dataset.reviewControl;
  const control = controlId ? document.getElementById(controlId) : null;
  if (!control) return false;
  reveal(control);
  return true;
};

interface ReviewKeysOptions {
  /** The record pane: the keys work while focus is in it. */
  readonly root: HTMLElement | null;
  /** The desk, whose viewer owns the keys after the reader turns to it. */
  readonly score: HTMLElement | null;
  readonly enabled: boolean;
}

/**
 * Binds the review keys to the window and returns the same handler for the
 * desk viewer's `claimKey`. It returns true, after preventing the default,
 * only for a key it acted on, so a key it passes over still reaches the
 * annotator.
 */
export const useReviewKeys = ({ root, score, enabled }: ReviewKeysOptions): ((event: KeyboardEvent) => boolean) => {
  const turnedToScore = useRef(false);

  useEffect(() => {
    const note = (event: Event): void => {
      if (!(event.target instanceof Node)) return;
      if (score?.contains(event.target)) turnedToScore.current = true;
      else if (root?.contains(event.target)) turnedToScore.current = false;
    };
    document.addEventListener("pointerdown", note, true);
    document.addEventListener("focusin", note, true);
    return () => {
      document.removeEventListener("pointerdown", note, true);
      document.removeEventListener("focusin", note, true);
    };
  }, [root, score]);

  const handle = useCallback((event: KeyboardEvent): boolean => {
    if (!enabled || !root || event.defaultPrevented) return false;
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return false;
    const key = event.key.toLowerCase();
    if (key !== "j" && key !== "k" && key !== "e") return false;
    const target = event.target;
    if (!(target instanceof HTMLElement) || isEditableTarget(target)) return false;
    if (target.closest(LAYER_SELECTOR) || document.querySelector("[aria-modal='true']")) return false;
    const onBody = target === document.body;
    if (onBody ? turnedToScore.current : !root.contains(target)) return false;

    const confirm = target.closest<HTMLElement>(CONFIRM_SELECTOR);
    const moved = key === "e"
      ? confirm !== null && focusValue(confirm)
      : (() => {
          const next = stepReview(root, onBody ? null : target, key === "j" ? 1 : -1);
          if (next) reveal(next);
          return next !== null;
        })();
    if (moved) event.preventDefault();
    return moved;
  }, [enabled, root]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      handle(event);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handle]);

  return handle;
};
