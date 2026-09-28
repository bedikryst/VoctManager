/**
 * @file PushInboxRow.tsx
 * @description One quiet line at the top of the notification centre, saying
 * whether this device can receive push and offering the one step that changes
 * it. It is the permanent counterpart of the contextual offer: it never
 * interrupts, it is only there when the member is already looking at their
 * notifications, so it carries no pacing and no dismissal.
 *
 * Each "off" state names its own remedy, because they are fixed in different
 * places: not yet enabled is one tap here, blocked is the browser's own site
 * settings, and an Apple device in a browser tab needs the Home Screen app first.
 * The not-yet-enabled line names what the member is missing rather than the
 * technology: "push" means nothing to most of the choir.
 * @module features/notifications/components/PushInboxRow
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { BellOff, BellRing, Smartphone } from "lucide-react";

import { Button } from "@/shared/ui/primitives/Button";
import { Text } from "@/shared/ui/primitives/typography";
import { usePushDeviceSummary } from "../api/devices";
import { usePushNotifications } from "../hooks/usePushNotifications";

type RowState =
  | { kind: "enable"; elsewhere: boolean }
  | { kind: "blocked" }
  | { kind: "install" }
  | null;

interface PushInboxRowProps {
  /** Closes the notification surface before a route change takes the member away. */
  readonly onNavigate: () => void;
}

export const PushInboxRow = ({ onNavigate }: PushInboxRowProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { availability, permission, isSubscribed, isResolved, isLoading, subscribe, sendTest } =
    usePushNotifications();

  const offersEnable =
    isResolved && availability.kind === "ready" && permission !== "denied" && !isSubscribed;
  const { data: summary } = usePushDeviceSummary(offersEnable);

  const state: RowState = (() => {
    if (!isResolved) return null;
    if (availability.kind === "unsupported" && availability.reason === "ios-not-standalone") {
      return { kind: "install" };
    }
    if (availability.kind !== "ready" || isSubscribed) return null;
    if (permission === "denied") return { kind: "blocked" };
    return { kind: "enable", elsewhere: (summary?.active_devices ?? 0) > 0 };
  })();

  if (state === null) return null;

  const goTo = (path: string): void => {
    onNavigate();
    navigate(path);
  };

  const message =
    state.kind === "enable"
      ? state.elsewhere
        ? t("notifications.push.inbox.elsewhere")
        : t("notifications.push.inbox.off")
      : state.kind === "blocked"
        ? t("notifications.push.inbox.blocked")
        : t("notifications.push.inbox.install");

  return (
    <div className="mb-2 mt-1 flex items-center gap-3 rounded-nested border border-ethereal-gold/20 bg-ethereal-gold/5 px-3 py-2.5">
      <BellOff size={16} className="shrink-0 text-ethereal-gold" aria-hidden="true" />
      <Text size="sm" className="min-w-0 flex-1 leading-snug">
        {message}
      </Text>
      {state.kind === "enable" ? (
        <Button
          variant="secondary"
          size="sm"
          className="shrink-0"
          isLoading={isLoading}
          leftIcon={!isLoading ? <BellRing size={14} aria-hidden="true" /> : undefined}
          onClick={() => {
            void subscribe().then((enabled) => {
              if (enabled) void sendTest();
            });
          }}
        >
          {t("notifications.push.nudge.enable")}
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          leftIcon={state.kind === "install" ? <Smartphone size={14} aria-hidden="true" /> : undefined}
          onClick={() =>
            goTo(state.kind === "install" ? "/panel/settings/app" : "/panel/settings/notifications")
          }
        >
          {state.kind === "install"
            ? t("notifications.push.nudge.show_how")
            : t("notifications.push.inbox.how_to_unblock")}
        </Button>
      )}
    </div>
  );
};
