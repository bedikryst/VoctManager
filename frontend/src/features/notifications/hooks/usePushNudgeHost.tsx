/**
 * @file usePushNudgeHost.tsx
 * @description Shell-side half of the contextual push offer (see
 * `lib/pushNudge.ts`). Owns the one push controller the offer needs, listens for
 * moments raised anywhere in the panel, and decides whether this device gets an
 * offer at all: only when push is possible here, not yet on, not blocked, the
 * device's pacing allows it, and no other offer has been shown this session.
 *
 * Enabling fires a test push straight away, so the member sees the system
 * notification land instead of trusting a toast that says it will.
 * @module features/notifications/hooks/usePushNudgeHost
 */
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { pushDeviceSummaryQuery } from "../api/devices";
import { PushNudgeToast } from "../components/PushNudgeToast";
import { syncPushDevice } from "../lib/pushDeviceSync";
import {
  isPushNudgeDue,
  recordPushNudgeDismissal,
  subscribePushNudge,
  type PushNudgeMoment,
} from "../lib/pushNudge";
import { usePushNotifications } from "./usePushNotifications";

const NUDGE_DURATION_MS = 15_000;

export const usePushNudgeHost = (): void => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const push = usePushNotifications();

  // The listener is registered once; it reads the controller through a ref so a
  // re-render never tears the subscription down mid-moment.
  const latest = useRef({ push, t, navigate, queryClient });
  useEffect(() => {
    latest.current = { push, t, navigate, queryClient };
  });

  useEffect(() => {
    const show = (
      message: string,
      action: "enable" | "install",
      onAction: () => void,
    ): void => {
      // Every way a toast can end without its action is recorded once. The
      // close button and a swipe are the member saying "not now" and count as a
      // strike; the timer only starts the cooldown, since an offer that ran out
      // may never have been read.
      let settled = false;
      const dismissed = (strike: boolean): void => {
        if (settled) return;
        settled = true;
        recordPushNudgeDismissal({ strike });
      };

      toast.custom(
        (id) => (
          <PushNudgeToast
            message={message}
            action={action}
            onAction={() => {
              settled = true;
              toast.dismiss(id);
              onAction();
            }}
            onClose={() => {
              dismissed(true);
              toast.dismiss(id);
            }}
          />
        ),
        {
          duration: NUDGE_DURATION_MS,
          onDismiss: () => dismissed(true),
          onAutoClose: () => dismissed(false),
        },
      );
    };

    // One offer per page session. Confirming five evenings in a row is one
    // moment, not five: stacked offers would each spend a dismissal of their own
    // and use up the device's whole budget in a single sitting.
    let offered = false;

    const handle = async (moment: PushNudgeMoment): Promise<void> => {
      if (offered || !isPushNudgeDue()) return;
      const { push: controller, t: translate, navigate: go, queryClient: client } =
        latest.current;

      const { availability } = controller;
      const install =
        availability.kind === "unsupported" && availability.reason === "ios-not-standalone";
      if (!install && (availability.kind !== "ready" || Notification.permission === "denied")) {
        return;
      }
      // Claimed before the first await, so moments raised in quick succession
      // cannot both pass the guard.
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
        show(translate("notifications.push.nudge.install"), "install", () =>
          go("/panel/settings/app"),
        );
        return;
      }

      const message = elsewhere
        ? translate("notifications.push.nudge.elsewhere")
        : translate(`notifications.push.nudge.moment.${moment}`);

      show(message, "enable", () => {
        void latest.current.push.subscribe().then((enabled) => {
          if (enabled) void latest.current.push.sendTest();
        });
      });
    };

    return subscribePushNudge((moment) => {
      void handle(moment);
    });
  }, []);
};
