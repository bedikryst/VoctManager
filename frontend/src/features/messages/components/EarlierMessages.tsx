/**
 * @file EarlierMessages.tsx
 * @description The top of a windowed conversation: the way back into history
 * the API no longer sends in full.
 *
 * An explicit control rather than a fetch on scroll-to-top. The stream is a
 * bounded box inside a portalled surface, and an infinite scroll there is a
 * reader who cannot reach the beginning of a day without triggering a request
 * they did not ask for — while a phone on mobile data pays for each one.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/components
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { ChevronUp } from "lucide-react";

import { Button } from "@/shared/ui/primitives/Button";

interface EarlierMessagesProps {
  isLoading: boolean;
  onLoad: () => void;
}

export const EarlierMessages: React.FC<EarlierMessagesProps> = ({ isLoading, onLoad }) => {
  const { t } = useTranslation();

  return (
    <div className="flex shrink-0 justify-center pb-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onLoad}
        disabled={isLoading}
        leftIcon={<ChevronUp size={14} />}
      >
        {isLoading
          ? t("messages.conversation.older_loading", "Wczytuję…")
          : t("messages.conversation.older", "Wcześniejsze wiadomości")}
      </Button>
    </div>
  );
};

EarlierMessages.displayName = "EarlierMessages";
