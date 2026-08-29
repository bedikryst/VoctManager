/**
 * @file messageTextScale.ts
 * @description The reading size of a conversation — the one type scale in the
 * panel the member sets themselves.
 *
 * A standalone PWA has no browser chrome, so no page zoom and no `aA` menu, and
 * iOS Dynamic Type does not reach web content: on the one screen that is pure
 * prose the reader otherwise has no way at all to make the text bigger. Three
 * steps and not a slider — type size is a scale, and a drag target inside a
 * scrolling stream would spend a phone's width on positions nobody can tell
 * apart.
 *
 * Per device rather than per account, deliberately: the setting answers a screen
 * and an eye, and the same person wants 14px on a laptop and 18px on a phone.
 * It lives in an external store rather than in a hook's state because the
 * composer has to re-measure its own height whenever the size moves, and must
 * not be handed a prop whose only job is to say "re-measure".
 * @architecture Enterprise SaaS 2026
 * @module features/messages/lib/messageTextScale
 */

import { useMemo, useSyncExternalStore, type CSSProperties } from "react";

const STORAGE_KEY = "voct.messages.textStep";

export type MessageTextStepId = "small" | "default" | "large";

export interface MessageTextStep {
  readonly id: MessageTextStepId;
  /** What the step adds to the device's base size, via `--message-text-step`. */
  readonly offset: string;
  /**
   * The same step as literal utilities, for the menu that sets it. That menu is
   * portalled out of the conversation, so the custom property never reaches it
   * and every entry has to name its own size to be drawn at it. Kept beside
   * `offset` so the two halves of one step are read together — Tailwind scans
   * source text, so neither half can be assembled at runtime.
   */
  readonly sample: string;
}

/**
 * 14 / 16 / 18 px on touch, 12 / 14 / 16 with a mouse. The default sits in the
 * MIDDLE: a scale whose resting point is its floor can only ever be corrected in
 * one direction, and the reader who finds 16px too large was the one with no
 * move to make.
 */
export const MESSAGE_TEXT_STEPS: readonly MessageTextStep[] = [
  { id: "small", offset: "-2px", sample: "text-sm fine-pointer:text-xs" },
  { id: "default", offset: "0px", sample: "text-base fine-pointer:text-sm" },
  { id: "large", offset: "2px", sample: "text-lg fine-pointer:text-base" },
];

/**
 * The type scale a message BODY uses, and the only one it may use. 16px on
 * touch, the panel's dense 14px behind `fine-pointer:`, each moved by the
 * reader's own step.
 *
 * The base stays in CSS instead of being computed into the variable: the
 * touch/pointer split is a fact about the device and the step is a choice about
 * the reader, and only the second one belongs in a store. An unset variable
 * falls back to `0px`, so a bubble the store never reaches still renders at
 * exactly the default.
 */
export const MESSAGE_BODY_TEXT =
  "text-[length:calc(1rem_+_var(--message-text-step,0px))] fine-pointer:text-[length:calc(0.875rem_+_var(--message-text-step,0px))]";

/**
 * What the COMPOSER writes at: the reading size, except that on touch it never
 * goes below 16px. Reading size is still writing size in the direction that
 * matters — the rule this feature exists for is that nobody reads a message
 * smaller than they were allowed to type it — but iOS magnifies the whole page
 * when a focused field is under 16px, and in a standalone PWA it never zooms
 * back out (`FIELD_TEXT_SCALE` in `fieldShell.ts` says why). So the floor is a
 * fact about the device, like the touch/pointer split beside it, and it belongs
 * in the same CSS expression rather than in the store: the smallest step makes
 * the conversation smaller and leaves the one line the reader types at rest.
 */
export const MESSAGE_COMPOSER_TEXT =
  "text-[length:calc(1rem_+_max(0px,var(--message-text-step,0px)))] fine-pointer:text-[length:calc(0.875rem_+_var(--message-text-step,0px))]";

export const isMessageTextStep = (value: unknown): value is MessageTextStepId =>
  MESSAGE_TEXT_STEPS.some((step) => step.id === value);

const readStored = (): MessageTextStepId => {
  if (typeof window === "undefined") return "default";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isMessageTextStep(raw) ? raw : "default";
  } catch {
    return "default";
  }
};

let current: MessageTextStepId = readStored();
const listeners = new Set<() => void>();

export const setMessageTextStep = (id: MessageTextStepId): void => {
  if (id === current) return;
  current = id;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Private mode / quota — the choice still holds for this session.
  }
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = (): MessageTextStepId => current;

/** The active step, for the menu that shows it and the field that measures it. */
export const useMessageTextStep = (): MessageTextStepId =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

/**
 * The conversation root's inline style. Scope is the conversation and nothing
 * else: moving `html { font-size }` would resize every viewport-locked box in
 * the panel — a shell-wide mechanism bought for one screen.
 */
export const useMessageTextStyle = (): CSSProperties => {
  const step = useMessageTextStep();
  return useMemo(() => {
    const offset =
      MESSAGE_TEXT_STEPS.find((candidate) => candidate.id === step)?.offset ?? "0px";
    return { "--message-text-step": offset } as CSSProperties;
  }, [step]);
};
