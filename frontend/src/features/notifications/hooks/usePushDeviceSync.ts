/**
 * @file usePushDeviceSync.ts
 * @description Mounts the once-per-session repair of this browser's push
 * subscription (see lib/pushDeviceSync). Belongs in the panel shell rather than
 * in the settings tab: a member whose device row went inactive stops receiving
 * push everywhere, and the settings tab is precisely the page they have no
 * reason to open while everything *looks* enabled.
 * @architecture Enterprise SaaS 2026
 * @module notifications/hooks/usePushDeviceSync
 */
import { useEffect } from "react";

import { syncPushDevice } from "../lib/pushDeviceSync";

export const usePushDeviceSync = (): void => {
  useEffect(() => {
    void syncPushDevice();
  }, []);
};
