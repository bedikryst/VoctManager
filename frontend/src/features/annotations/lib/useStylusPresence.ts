/**
 * @file useStylusPresence.ts
 * @description Does this device write with a real stylus? An active pen (S-Pen,
 * Apple Pencil, EMR) reports `pointerType: "pen"`; a capacitive stick and a bare
 * finger both report `"touch"`, indistinguishable from a resting palm.
 *
 * The answer decides who owns a single touch on the score. With a stylus present
 * the finger keeps panning, which is the palm rejection a writer expects. With
 * no stylus, the finger has to be allowed to draw — otherwise arming the pencil
 * on that tablet does nothing at all, and the pen tool looks like it is missing.
 *
 * Once seen, a stylus is remembered for the device: a pen is not always in hand,
 * and the score must not change its input rules between two openings.
 * @module features/annotations/lib
 */

import { useEffect, useState } from "react";

const STORAGE_KEY = "voct.annotations.stylus_seen";

export const readStylusSeen = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

export const useStylusPresence = (): boolean => {
  const [seen, setSeen] = useState<boolean>(readStylusSeen);

  useEffect(() => {
    if (seen || typeof window === "undefined") return;
    const onPointerDown = (event: PointerEvent): void => {
      if (event.pointerType !== "pen") return;
      setSeen(true);
      try {
        window.localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        // Private-mode / storage-disabled: detection still holds for the session.
      }
    };
    // Capture, so a stylus is recognised even where the target stops the event.
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [seen]);

  return seen;
};
