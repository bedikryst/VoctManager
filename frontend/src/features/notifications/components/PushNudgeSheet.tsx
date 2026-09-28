/**
 * @file PushNudgeSheet.tsx
 * @description The contextual push offer: one question tied to what the member
 * just did, one action, and "not now". A sheet that waits for an answer — the
 * member's eyes are on the button they have just pressed, and an offer that
 * leaves on its own before they look up was never made. Every way of closing it
 * without the action is a refusal.
 * @module features/notifications/components/PushNudgeSheet
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { BellRing, Smartphone } from "lucide-react";

import { BottomSheet } from "@/shared/ui/composites/BottomSheet";
import { Button } from "@/shared/ui/primitives/Button";
import { Text } from "@/shared/ui/primitives/typography";

export interface PushNudgeOffer {
  /** The question, in the words of the moment that raised it. */
  readonly question: string;
  /** `enable` subscribes this device; `install` leads to the Home Screen guide. */
  readonly action: "enable" | "install";
}

interface PushNudgeSheetProps {
  readonly offer: PushNudgeOffer | null;
  readonly onAccept: () => void;
  readonly onRefuse: () => void;
}

export const PushNudgeSheet = ({
  offer,
  onAccept,
  onRefuse,
}: PushNudgeSheetProps): React.JSX.Element => {
  const { t } = useTranslation();
  const install = offer?.action === "install";

  return (
    <BottomSheet
      isOpen={offer !== null}
      onClose={onRefuse}
      subtitle={t("notifications.push.nudge.eyebrow")}
      title={offer?.question ?? ""}
      className="sm:max-w-md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onRefuse}>
            {t("notifications.push.nudge.not_now")}
          </Button>
          <Button
            variant="primary"
            onClick={onAccept}
            leftIcon={
              install ? (
                <Smartphone size={16} aria-hidden="true" />
              ) : (
                <BellRing size={16} aria-hidden="true" />
              )
            }
          >
            {install
              ? t("notifications.push.nudge.show_how")
              : t("notifications.push.nudge.enable_cta")}
          </Button>
        </div>
      }
    >
      <Text color="muted" className="leading-relaxed">
        {install
          ? t("notifications.push.nudge.install")
          : t("notifications.push.nudge.enable_body")}
      </Text>
    </BottomSheet>
  );
};
