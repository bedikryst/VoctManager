/**
 * @file MessageTextSizeControl.tsx
 * @description The reading-size chooser, as a fragment of menu content that both
 * conversation overflow menus mount.
 *
 * It is set where the problem is felt — inside the conversation, not in app
 * settings: you adjust a reading size while reading, and the menu deliberately
 * stays open so the stream behind it can be compared step by step. Each entry is
 * drawn at the size it sets, which is the whole explanation the labels need.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/components
 */

import React from "react";
import { useTranslation } from "react-i18next";

import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/shared/ui/composites/DropdownMenu";
import { Text } from "@/shared/ui/primitives/typography";
import {
  MESSAGE_TEXT_STEPS,
  isMessageTextStep,
  setMessageTextStep,
  useMessageTextStep,
  type MessageTextStepId,
} from "../lib/messageTextScale";

export const MessageTextSizeControl: React.FC = () => {
  const { t } = useTranslation();
  const step = useMessageTextStep();

  const labels: Record<MessageTextStepId, string> = {
    small: t("messages.text_size.small", "Mniejszy"),
    default: t("messages.text_size.default", "Standardowy"),
    large: t("messages.text_size.large", "Większy"),
  };

  return (
    <>
      <DropdownMenuLabel>
        {t("messages.text_size.label", "Rozmiar tekstu")}
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={step}
        onValueChange={(value) => {
          if (isMessageTextStep(value)) setMessageTextStep(value);
        }}
      >
        {MESSAGE_TEXT_STEPS.map((candidate) => (
          <DropdownMenuRadioItem key={candidate.id} value={candidate.id} keepOpen>
            {/* The sample rides over `Text`'s own size, the way a message body
                does — the menu is portalled, so it cannot inherit the step. */}
            <Text
              as="span"
              weight="medium"
              color="inherit"
              className={candidate.sample}
            >
              {labels[candidate.id]}
            </Text>
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
};

MessageTextSizeControl.displayName = "MessageTextSizeControl";
