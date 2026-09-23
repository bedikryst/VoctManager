/**
 * @file useIsOnline.ts
 * @description Whether the browser believes it has a network, as a render
 * value. For surfaces whose writes are never queued: they disable the control
 * and say why, rather than letting a click fail. `navigator.onLine === true`
 * only means a network interface is up, so a write can still fail on a dead
 * uplink — this decides what is offered, not what will succeed.
 * @module shared/lib/dom/useIsOnline
 */

import { useSyncExternalStore } from "react";

const subscribe = (onChange: () => void): (() => void) => {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
};

const getSnapshot = (): boolean => navigator.onLine;

const getServerSnapshot = (): boolean => true;

export const useIsOnline = (): boolean =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
