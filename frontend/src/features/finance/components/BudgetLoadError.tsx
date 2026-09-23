/**
 * @file BudgetLoadError.tsx
 * @description What a budget sub-tab shows when the budget could not be
 * read: the failure in one sentence and the one thing to do about it.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/components/BudgetLoadError
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Button } from "@/shared/ui/primitives/Button";

interface BudgetLoadErrorProps {
  readonly onRetry: () => void;
}

export function BudgetLoadError({ onRetry }: BudgetLoadErrorProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <StatePanel
      tone="danger"
      icon={<AlertTriangle size={28} strokeWidth={1.5} />}
      title={t("finance.load_error.title", "Nie udało się wczytać budżetu.")}
      description={t(
        "finance.load_error.description",
        "Serwer nie odpowiedział. Spróbuj ponownie za chwilę.",
      )}
      actions={
        <Button
          variant="secondary"
          onClick={onRetry}
          leftIcon={<RefreshCw size={14} aria-hidden="true" />}
        >
          {t("common.actions.retry", "Ponów")}
        </Button>
      }
    />
  );
}
