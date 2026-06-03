/**
 * @file ProjectBudgetPage.tsx
 * @description Route wrapper for the budget / fee work area.
 * Mounts the existing BudgetTab with the project resolved by the hub layout.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/ProjectBudgetPage
 */

import React from "react";
import { useOutletContext } from "react-router-dom";

import type { ProjectHubContext } from "./ProjectHubLayout";
import { BudgetTab } from "./editors/tabs/BudgetTab";

export default function ProjectBudgetPage(): React.JSX.Element {
  const { project, setDirty } = useOutletContext<ProjectHubContext>();
  return <BudgetTab projectId={project.id} onDirtyStateChange={setDirty} />;
}
