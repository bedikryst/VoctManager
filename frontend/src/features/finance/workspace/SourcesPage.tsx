/**
 * @file SourcesPage.tsx
 * @description Źródła — every funding source of the foundation with what it
 * carries across the projects it funds. A row opens the source's own page,
 * which lives under this section.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/workspace/SourcesPage
 */

import React from "react";

import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { SourcesCard } from "../overview/components/SourcesCard";
import { useFinanceOutlet } from "./financeOutlet";

export default function SourcesPage(): React.JSX.Element {
  const { overview } = useFinanceOutlet();

  return (
    <PageTransition>
      <div className="flex flex-col gap-5 pb-24">
        <SourcesCard sources={overview.sources} />
      </div>
    </PageTransition>
  );
}
