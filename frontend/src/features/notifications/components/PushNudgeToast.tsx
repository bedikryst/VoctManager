/**
 * @file PushNudgeToast.tsx
 * @description The contextual push offer as a toast body: one sentence tied to
 * what the member just did, one action, and a close that counts as "not now".
 * Drawn in the same inverse card as the install prompt, because both ask the
 * member to change something about this device.
 * @module features/notifications/components/PushNudgeToast
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { BellRing, Smartphone, X } from "lucide-react";

import { Button } from "@/shared/ui/primitives/Button";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";

interface PushNudgeToastProps {
  readonly message: string;
  /** `enable` subscribes this device; `install` leads to the Home Screen guide. */
  readonly action: "enable" | "install";
  readonly onAction: () => void;
  readonly onClose: () => void;
}

export const PushNudgeToast = ({
  message,
  action,
  onAction,
  onClose,
}: PushNudgeToastProps): React.JSX.Element => {
  const { t } = useTranslation();

  return (
    <div className="flex w-full max-w-sm items-start gap-3 rounded-2xl border border-line-on-inverse bg-surface-inverse/95 p-3 shadow-glass-ethereal backdrop-blur-xl">
      <div className="min-w-0 flex-1">
        <Eyebrow color="ink-on-inverse" className="block">
          {t("notifications.push.nudge.eyebrow")}
        </Eyebrow>
        <Text color="ink-on-inverse-muted" className="mt-1 text-xs leading-snug">
          {message}
        </Text>
        <Button
          variant="primary"
          size="sm"
          className="mt-3"
          leftIcon={
            action === "enable" ? (
              <BellRing size={14} aria-hidden="true" />
            ) : (
              <Smartphone size={14} aria-hidden="true" />
            )
          }
          onClick={onAction}
        >
          {action === "enable"
            ? t("notifications.push.nudge.enable")
            : t("notifications.push.nudge.show_how")}
        </Button>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={t("notifications.push.nudge.not_now")}
        className="shrink-0 rounded-full p-1 text-ink-on-inverse/70 transition-colors hover:text-ink-on-inverse"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
};
