/**
 * @file CopyDeskAccessRefusal.tsx
 * @description What the desk shows when its own gate does not open.
 *
 * Two outcomes, and they are not the same screen. A REFUSAL is settled — the
 * capability is granted from the admin and never by the account itself, so the
 * screen states that and offers the way back rather than a retry that would
 * refuse identically. Anything else (offline, a server that did not answer) is
 * a failure the reader can try again, so that branch keeps the control.
 *
 * No alarm colour on the refusal: crimson is the panel's alarm, and being
 * outside a capability two people hold is not something going wrong.
 * @architecture Enterprise SaaS 2026
 * @module features/copydesk/components/CopyDeskAccessRefusal
 */

import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { KeyRound, PlugZap } from "lucide-react";

import { parseApiError } from "@/shared/api/errors";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Button } from "@/shared/ui/primitives/Button";

interface CopyDeskAccessRefusalProps {
  readonly error: unknown;
  readonly onRetry: () => void;
}

export const CopyDeskAccessRefusal = ({
  error,
  onRetry,
}: CopyDeskAccessRefusalProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { kind, serverMessage } = parseApiError(error);
  const isRefused = kind === "permission" || kind === "auth";

  if (isRefused) {
    return (
      <StatePanel
        icon={<KeyRound size={22} aria-hidden="true" />}
        eyebrow={t("copy_desk.eyebrow", "Redakcja")}
        title={t("copy_desk.refused.title", "To nie jest twoje biurko")}
        description={t(
          "copy_desk.refused.description",
          "Redakcja tekstów serwisu jest osobnym uprawnieniem — przyznaje je administrator, nie rola w zespole.",
        )}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/panel">
              {t("copy_desk.back_to_panel", "Wróć do panelu")}
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <StatePanel
      tone="warning"
      icon={<PlugZap size={22} aria-hidden="true" />}
      eyebrow={t("copy_desk.eyebrow", "Redakcja")}
      title={t("copy_desk.unreachable.title", "Desk się nie otworzył")}
      description={
        serverMessage ??
        t(
          "copy_desk.unreachable.description",
          "Nie udało się pobrać spisu treści. Spróbuj ponownie za chwilę.",
        )
      }
      actions={
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t("copy_desk.unreachable.retry", "Spróbuj ponownie")}
        </Button>
      }
    />
  );
};
