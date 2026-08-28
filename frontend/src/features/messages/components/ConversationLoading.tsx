/**
 * @file ConversationLoading.tsx
 * @description The gate a conversation shows while its history is on the way —
 * and, crucially, the way back out of it.
 *
 * On a desktop the loader sits in a pane beside an inbox that is still there. On
 * a phone the conversation owns the whole screen, so a bare loader is a screen
 * with no exit: a slow network, or a request that never resolves, leaves the
 * member with nothing to press. The back band renders first and from the same
 * markup the loaded header uses, so the chrome does not jump when the data lands.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/components
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";

import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { Button } from "@/shared/ui/primitives/Button";

interface ConversationLoadingProps {
  message: string;
  onBack?: () => void;
}

export const ConversationLoading: React.FC<ConversationLoadingProps> = ({
  message,
  onBack,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex h-full min-h-0 flex-col">
      {onBack && (
        <div className="flex shrink-0 items-center border-b border-hairline-strong px-3 py-3 sm:px-5 sm:py-4 md:hidden">
          <Button
            variant="icon"
            size="icon"
            type="button"
            onClick={onBack}
            aria-label={t("common.back", "Wstecz")}
            className="-ml-2 shrink-0"
          >
            <ArrowLeft size={18} />
          </Button>
        </div>
      )}
      <EtherealLoader fullHeight={false} message={message} />
    </div>
  );
};

ConversationLoading.displayName = "ConversationLoading";
