/**
 * @file useAppUpdate.ts
 * @description React binding over the build-handover controller. The controller
 * — not this hook — watches the registration, so a deploy is noticed for every
 * member rather than only while some component happens to be mounted
 * ({@link module:shared/pwa/appUpdateController}). This hook adds the one UI
 * concern the controller has no business holding: dismissal.
 *
 * Dismissal is deliberately in-memory and NOT persisted. The install nudge earns
 * its fortnight-long cooldown because declining it is a real answer; declining a
 * new version is only ever "not now", and the offer is worth re-making on the
 * next launch — by which point the waiting worker will usually have taken over
 * on its own anyway.
 * @architecture Enterprise SaaS 2026
 * @module shared/pwa/useAppUpdate
 */
import { useCallback, useState, useSyncExternalStore } from "react";

import {
  applyAppUpdate,
  getAppUpdateSnapshot,
  subscribeAppUpdate,
} from "./appUpdateController";

export interface AppUpdateState {
  /** The ambient offer should be on screen (a newer build waits, not dismissed). */
  shouldOffer: boolean;
  /** The swap is in flight — the tab is about to reload onto the new build. */
  isApplying: boolean;
  /** Release the waiting worker and reload onto it. */
  applyUpdate: () => void;
  /** Hide the offer until the next launch. */
  dismiss: () => void;
}

export const useAppUpdate = (): AppUpdateState => {
  const { isReady, isApplying } = useSyncExternalStore(
    subscribeAppUpdate,
    getAppUpdateSnapshot,
    getAppUpdateSnapshot, // server snapshot — identical, this is a CSR-only app
  );
  const [dismissed, setDismissed] = useState(false);

  const applyUpdate = useCallback(() => {
    void applyAppUpdate();
  }, []);

  const dismiss = useCallback(() => setDismissed(true), []);

  return {
    shouldOffer: isReady && !dismissed,
    isApplying,
    applyUpdate,
    dismiss,
  };
};
