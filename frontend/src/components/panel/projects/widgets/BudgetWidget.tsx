/**
 * @file BudgetWidget.tsx
 * @description Dashboard widget displaying the high-level estimated production cost.
 * @architecture
 * Aggregates fees from both vocal participations and crew assignments.
 * Ensures robust number parsing to prevent concatenation errors.
 * @module project/widgets/BudgetWidget
 * @author Krystian Bugalski
 */

import React, { useContext, useMemo } from 'react';
import { Banknote, Loader2 } from 'lucide-react';

import { ProjectDataContext, IProjectDataContext } from '../ProjectDashboard';
import { useProjectData } from '../../../../hooks/useProjectData';
import type { Project } from '../../../../types';

interface BudgetWidgetProps {
  project: Project;
}

/**
 * BudgetWidget Component
 * @param {BudgetWidgetProps} props - Component properties.
 * @returns {React.JSX.Element | null}
 */
export default function BudgetWidget({ project }: BudgetWidgetProps): React.JSX.Element | null {
  const context = useContext(ProjectDataContext) as IProjectDataContext;

  const { participations, crewAssignments, isLoading } = useProjectData(String(project.id));

  if (!context) {
    console.error("[BudgetWidget] Must be used within a ProjectDataContext.Provider");
    return null;
  }

  const { openPanel } = context;

// --- Derived Data (Memoized) ---
  const totalBudget = useMemo<number>(() => {
    const totalArtistsCost: number = participations.reduce((sum, p) => sum + (Number(p.fee) || 0), 0);
    const totalCrewCost: number = crewAssignments.reduce((sum, c) => sum + (Number(c.fee) || 0), 0);
    
    return totalArtistsCost + totalCrewCost;
  }, [participations, crewAssignments]);

  /**
   * Invokes the parent's panel controller to open the Budget configuration tab.
   */
  const handleOpenBudget = (): void => {
    openPanel(project, 'BUDGET');
  };

  return (
    <div 
      onClick={handleOpenBudget} 
      className="bg-white border border-stone-200/80 p-5 rounded-2xl shadow-sm flex flex-col justify-between cursor-pointer hover:border-[#002395]/40 hover:shadow-md transition-all group min-h-[220px]"
      role="button"
      aria-label="Manage Project Budget"
    >
      <div className="flex items-center justify-between border-b border-stone-100 pb-3 mb-4">
        <h4 className="flex items-center gap-2 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 group-hover:text-[#002395] transition-colors">
          <Banknote size={16} className="text-[#002395] group-hover:scale-110 transition-transform" aria-hidden="true" /> 
          Kosztorys
        </h4>
        <button className="text-[9px] uppercase font-bold antialiased tracking-widest text-[#002395] opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100">
          Edytuj
        </button>
      </div>
      
      <div className="flex-1 flex flex-col justify-center items-center py-4">
        {isLoading ? (
            <Loader2 size={24} className="animate-spin text-stone-300" aria-hidden="true" />
        ) : (
            <>
                <div className="text-4xl font-bold text-[#002395] mb-2 tracking-tight">
                {totalBudget.toLocaleString('pl-PL')} PLN
                </div>
                <div className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400">
                Estymowany Koszt
                </div>
            </>
        )}
      </div>
    </div>
  );
}