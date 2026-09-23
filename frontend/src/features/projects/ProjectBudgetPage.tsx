/**
 * @file ProjectBudgetPage.tsx
 * @description Route layout for the project's Budżet tab: the finance
 * sub-navigation above whichever of its sub-routes is open (Przegląd,
 * Kosztorys, Honoraria, Wydatki). The hub's own context — the project and the unsaved-changes
 * guard — is handed through to them unchanged.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/ProjectBudgetPage
 */

import React from "react";
import { Outlet, useOutletContext } from "react-router-dom";

import { BudgetTabs } from "@/features/finance/budget/BudgetTabs";
import type { ProjectHubContext } from "./ProjectHubLayout";

export default function ProjectBudgetPage(): React.JSX.Element {
  const context = useOutletContext<ProjectHubContext>();
  return (
    <div className="flex w-full flex-col gap-5">
      <BudgetTabs projectId={String(context.project.id)} />
      <Outlet context={context} />
    </div>
  );
}
