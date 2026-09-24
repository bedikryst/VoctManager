/**
 * @file PayablesPage.tsx
 * @description Do zapłaty — what the foundation still owes, across projects, a
 * server page at a time. The first page is the shell's own overview entry;
 * paging past it asks for the next one under its own key, and a page that
 * fails to arrive leaves the shell's first page on screen rather than nothing.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/workspace/PayablesPage
 */

import React, { useState } from "react";

import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { useFinanceOverview } from "../api/finance.queries";
import { PayablesCard } from "../overview/components/PayablesCard";
import { useFinanceOutlet } from "./financeOutlet";

export default function PayablesPage(): React.JSX.Element {
  const { overview: shellOverview } = useFinanceOutlet();
  const [offset, setOffset] = useState(0);
  const overview = useFinanceOverview(offset);

  return (
    <PageTransition>
      <div className="flex flex-col gap-5 pb-24">
        <PayablesCard
          page={(overview.data ?? shellOverview).payables}
          isFetching={overview.isFetching}
          onPageChange={setOffset}
        />
      </div>
    </PageTransition>
  );
}
