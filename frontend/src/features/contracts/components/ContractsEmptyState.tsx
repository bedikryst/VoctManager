/**
 * @file ContractsEmptyState.tsx
 * @description Empty-state surface for the contracts workflow.
 * Supports both idle portfolio mode and project-without-personnel scenarios.
 * @architecture Enterprise SaaS 2026
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Layers3, Users } from "lucide-react";

import { StatePanel } from "@/shared/ui/composites/StatePanel";

interface ContractsEmptyStateProps {
  mode: "idle" | "no-personnel";
}

export function ContractsEmptyState({
  mode,
}: ContractsEmptyStateProps): React.JSX.Element {
  const { t } = useTranslation();

  if (mode === "no-personnel") {
    return (
      <StatePanel
        tone="warning"
        icon={<Users size={28} strokeWidth={1.5} />}
        eyebrow={t("contracts.empty.no_personnel_eyebrow", "No records yet")}
        title={t(
          "contracts.empty.no_personnel_title",
          "This project has no assigned cast or crew.",
        )}
        description={t(
          "contracts.empty.no_personnel_description",
          "Assign personnel in the project workspace first. Once records exist here, you can define remunerations and generate PDF contracts.",
        )}
      />
    );
  }

  return (
    <StatePanel
      icon={<Layers3 size={28} strokeWidth={1.5} />}
      eyebrow={t("contracts.empty.idle_eyebrow", "Portfolio view")}
      title={t(
        "contracts.empty.idle_title",
        "Select a project to open the settlement ledger.",
      )}
      description={t(
        "contracts.empty.idle_description",
        "The finance cockpit is ready. Pick an event above to inspect coverage, update remuneration values, and prepare exportable contract packages.",
      )}
    />
  );
}
