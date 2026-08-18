/**
 * @file a11y.test.ts
 * @description Guards the boundary that makes `onActivate` safe to put on a row
 * that contains its own controls: a keystroke belonging to an inline-edit input
 * or a checkbox must pass through untouched. Swallowing the space bar there eats
 * the character the person is typing and toggles the row under them — a defect
 * that is invisible to the typecheck, the build and any static look at the JSX.
 * @architecture Enterprise SaaS 2026
 * @module shared/lib/dom/a11y.test
 */

import type { KeyboardEvent } from "react";
import { describe, expect, it, vi } from "vitest";

import { onActivate } from "@/shared/lib/dom/a11y";

const row = { id: "row" } as unknown as HTMLElement;
const innerInput = { id: "input" } as unknown as HTMLElement;

/** A keydown as React delivers it: `currentTarget` is always the row. */
const keydown = (
  key: string,
  target: HTMLElement,
): { event: KeyboardEvent<HTMLElement>; preventDefault: () => void } => {
  const preventDefault = vi.fn();
  return {
    event: {
      key,
      target,
      currentTarget: row,
      preventDefault,
    } as unknown as KeyboardEvent<HTMLElement>,
    preventDefault,
  };
};

describe("onActivate", () => {
  it.each(["Enter", " ", "Spacebar"])(
    "activates the row on %s",
    (key) => {
      const handler = vi.fn();
      const { event, preventDefault } = keydown(key, row);
      onActivate(handler)(event);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(preventDefault).toHaveBeenCalledTimes(1);
    },
  );

  it("leaves a space typed inside the row to the control that owns it", () => {
    const handler = vi.fn();
    const { event, preventDefault } = keydown(" ", innerInput);
    onActivate(handler)(event);
    expect(handler).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("ignores every other key", () => {
    const handler = vi.fn();
    const { event, preventDefault } = keydown("a", row);
    onActivate(handler)(event);
    expect(handler).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });
});
