/**
 * @file ContractsEmptyState.tsx
 * @description Empty state for a selected project that has no cast or crew yet —
 * settlements only become possible once personnel are assigned in the project hub.
 * @architecture Enterprise SaaS 2026
 * @module features/contracts/components/ContractsEmptyState
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Users } from "lucide-react";

import { StatePanel } from "@/shared/ui/composites/StatePanel";

interface ContractsEmptyStateProps {
  mode: "no-personnel";
}

export function ContractsEmptyState(
  _props: ContractsEmptyStateProps,
): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <StatePanel
      tone="warning"
      icon={<Users size={28} strokeWidth={1.5} />}
      eyebrow={t("contracts.empty.no_personnel_eyebrow", "Brak obsady")}
      title={t(
        "contracts.empty.no_personnel_title",
        "Ten projekt nie ma przypisanej obsady ani ekipy.",
      )}
      description={t(
        "contracts.empty.no_personnel_description",
        "Najpierw przypisz osoby w panelu projektu. Gdy pojawią się tutaj rekordy, ustalisz honoraria, oznaczysz płatności i wygenerujesz umowy PDF.",
      )}
    />
  );
}
