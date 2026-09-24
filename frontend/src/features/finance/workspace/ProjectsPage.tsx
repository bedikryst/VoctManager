/**
 * @file ProjectsPage.tsx
 * @description Projekty — each project's money in one row. A row opens that
 * project's budget in its hub, where the ledger lives.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/workspace/ProjectsPage
 */

import React from "react";

import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { ProjectRollups } from "../overview/components/ProjectRollups";
import { useFinanceOutlet } from "./financeOutlet";

export default function ProjectsPage(): React.JSX.Element {
  const { overview } = useFinanceOutlet();

  return (
    <PageTransition>
      <div className="flex flex-col gap-5 pb-24">
        <ProjectRollups rollups={overview.projects} />
      </div>
    </PageTransition>
  );
}
