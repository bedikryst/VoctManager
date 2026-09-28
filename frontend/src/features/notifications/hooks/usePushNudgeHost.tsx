/**
 * @file usePushNudgeHost.tsx
 * @description Shell-side half of the contextual push offer (see
 * `lib/pushNudge.ts`). Owns the one push controller the offer needs, listens for
 * moments raised anywhere in the panel, decides whether this device gets an
 * offer at all, and returns the sheet that asks. Offered only when push is
 * possible here, not yet on, not blocked, the device's pacing allows it, and no
 * other offer has been shown this session.
 *
 * The sheet opens once the member has paused rather than at the first moment,
 * so confirming a run of evenings is not interrupted at the first one, and it
 * never opens over another dialog — an invitation queue, an absence form.
 *
 * Enabling fires a test push straight away, so the member sees the system
 * notification land instead of trusting a sheet that says it will.
 * @module features/notifications/hooks/usePushNudgeHost
 */
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { pushDeviceSummaryQuery } from "../api/devices";
import { PushNudgeSheet, type PushNudgeOffer } from "../components/PushNudgeSheet";
import { syncPushDevice } from "../lib/pushDeviceSync";
import {
  isPushNudgeDue,
  recordPushNudgeDismissal,
  subscribePushNudge,
  type PushNudgeMoment,
} from "../lib/pushNudge";
import { usePushNotifications } from "./usePushNotifications";

/** Quiet time after the last moment before the offer opens. */
const SETTLE_MS = 3_000;
/** How long a raised offer may wait for other dialogs to close before it lapses. */
const MAX_WAIT_MS = 60_000;

const isAnotherDialogOpen = (): boolean =>
  document.querySelector('[role="dialog"], [role="alertdialog"]') !== null;

export const usePushNudgeHost = (): React.ReactNode => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const push = usePushNotifications();
  const [offer, setOffer] = useState<PushNudgeOffer | null>(null);
  // The open offer, read by the answer handlers. A sheet still animating out
  // can be tapped again; only the first answer counts.
  const openOffer = useRef<PushNudgeOffer | null>(null);

  // The listener is registered once; it reads the controller through a ref so a
  // re-render never tears the subscription down mid-moment.
  const latest = useRef({ push, t, queryClient });
  useEffect(() => {
    latest.current = { push, t, queryClient };
  });

  useEffect(() => {
    // One offer per page session. Confirming five evenings in a row is one
    // moment, not five.
    let offered = false;
    let pendingMoment: PushNudgeMoment | null = null;
    let lastMomentAt = 0;
    let timer: number | undefined;

    const open = (next: PushNudgeOffer): void => {
      openOffer.current = next;
      setOffer(next);
    };

    const present = async (moment: PushNudgeMoment): Promise<void> => {
      if (offered || !isPushNudgeDue()) return;
      const { push: controller, t: translate, queryClient: client } = latest.current;

      const { availability } = controller;
      const install =
        availability.kind === "unsupported" && availability.reason === "ios-not-standalone";
      if (!install && (availability.kind !== "ready" || Notification.permission === "denied")) {
        return;
      }
      // Claimed before the first await, so a settle racing this one cannot
      // also pass the guard.
      offered = true;

      // Read live rather than from the controller: it mounted with the shell, and
      // the member may have switched push on in the settings tab since.
      if (!install && (await syncPushDevice())) return;

      const summary = await client.fetchQuery(pushDeviceSummaryQuery).catch(() => null);
      const elsewhere = (summary?.active_devices ?? 0) > 0;

      if (install) {
        // A member another device already reaches is not worth interrupting for
        // the Home Screen ritual; the notification centre row still names it.
        if (elsewhere) return;
        open({ question: translate(`notifications.push.nudge.moment.${moment}`), action: "install" });
        return;
      }

      open({
        question: elsewhere
          ? translate("notifications.push.nudge.elsewhere")
          : translate(`notifications.push.nudge.moment.${moment}`),
        action: "enable",
      });
    };

    const settle = (): void => {
      timer = undefined;
      const moment = pendingMoment;
      if (moment === null || offered) return;
      if (isAnotherDialogOpen()) {
        // Nothing is recorded when the wait runs out: the member was never
        // asked, so the next moment may try again.
        if (Date.now() - lastMomentAt >= MAX_WAIT_MS) {
          pendingMoment = null;
          return;
        }
        timer = window.setTimeout(settle, SETTLE_MS);
        return;
      }
      pendingMoment = null;
      void present(moment);
    };

    const unsubscribe = subscribePushNudge((moment) => {
      if (offered || !isPushNudgeDue()) return;
      // An absence has an answer on its way, which makes it the strongest reason
      // to ask; a later confirmation in the same run does not replace it.
      if (pendingMoment !== "absence") pendingMoment = moment;
      lastMomentAt = Date.now();
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, SETTLE_MS);
    });

    return () => {
      unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);

  const take = (): PushNudgeOffer | null => {
    const current = openOffer.current;
    openOffer.current = null;
    setOffer(null);
    return current;
  };

  const handleRefuse = (): void => {
    if (take()) recordPushNudgeDismissal();
  };

  const handleAccept = (): void => {
    const current = take();
    if (!current) return;
    if (current.action === "install") {
      navigate("/panel/settings/app");
      return;
    }
    void push.subscribe().then((enabled) => {
      if (enabled) void push.sendTest();
    });
  };

  return <PushNudgeSheet offer={offer} onAccept={handleAccept} onRefuse={handleRefuse} />;
};
