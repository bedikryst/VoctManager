/**
 * @file ConversationGate.tsx
 * @description What a conversation shows before it has a conversation to show —
 * and, either way, the way back out of it.
 *
 * Two states, never one. `checking` is a history still in flight; `failed` is a
 * request that came back with nothing. On a desktop the difference is a detail
 * in a pane beside an inbox that is still there; on a phone the conversation
 * owns the display, so a loader that also stands in for a dead request is the
 * whole app spinning with no answer and no exit. The back band renders first,
 * from the same markup the loaded header uses, so the chrome does not jump when
 * the data lands.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/components
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, CircleAlert, RotateCw } from "lucide-react";

import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { Button } from "@/shared/ui/primitives/Button";

export type ConversationGateStatus = "checking" | "failed";

interface ConversationGateProps {
  status: ConversationGateStatus;
  /** Names what is being waited for — the one line that differs by kind. */
  loadingMessage: string;
  onRetry: () => void;
  onBack?: () => void;
}

export const ConversationGate: React.FC<ConversationGateProps> = ({
  status,
  loadingMessage,
  onRetry,
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

      {status === "failed" ? (
        <StatePanel
          variant="inline"
          tone="danger"
          icon={<CircleAlert size={24} strokeWidth={1.5} />}
          title={t("messages.conversation.load_failed", "Nie udało się wczytać rozmowy")}
          description={t(
            "messages.conversation.load_failed_desc",
            "Sprawdź połączenie i spróbuj ponownie.",
          )}
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetry}
              leftIcon={<RotateCw size={14} />}
            >
              {t("messages.conversation.retry", "Spróbuj ponownie")}
            </Button>
          }
          className="px-6"
        />
      ) : (
        <EtherealLoader fullHeight={false} message={loadingMessage} />
      )}
    </div>
  );
};

ConversationGate.displayName = "ConversationGate";
