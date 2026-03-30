/**
 * @file BudgetWidget.tsx
 * @description Dashboard widget displaying the high-level estimated production cost.
 * @architecture
 * Consumes pre-fetched, referentially stable data from the `ProjectDataContext` 
 * to completely eliminate redundant network requests (N+1 query problem).
 * Employs dependency-arrayed `useMemo` to prevent heavy budget recalculations 
 * during parent re-renders, neutralizing CPU overhead on large production rosters.
 * @module project/ProjectCard/widgets/BudgetWidget
 * @author Krystian Bugalski
 */

import React, { useContext, useMemo } from 'react';
import { Banknote } from 'lucide-react';

import { ProjectDataContext, IProjectDataContext } from '../../ProjectDashboard';
import type { Project } from '../../../../../types';

interface BudgetWidgetProps {
  project: Project;
}

export default function BudgetWidget({ project }: BudgetWidgetProps): React.JSX.Element | null {
  const context = useContext(ProjectDataContext) as IProjectDataContext;

  if (!context) {
    console.error("[BudgetWidget] Must be used within a ProjectDataContext.Provider");
    return null;
  }

  // Strictly consuming pre-fetched arrays from the Context provider.
  // No external API hooks should be invoked here.
  const { openPanel, participations, crewAssignments } = context;

  // --- Derived Data (Memoized) ---
  const totalBudget = useMemo<number>(() => {
    const totalArtistsCost: number = participations.reduce((sum, p) => sum + (Number(p.fee) || 0), 0);
    const totalCrewCost: number = crewAssignments.reduce((sum, c) => sum + (Number(c.fee) || 0), 0);
    
    return totalArtistsCost + totalCrewCost;
  }, [participations, crewAssignments]);

  return (
    <div 
      onClick={() => openPanel(project, 'BUDGET')} 
      className="bg-white border border-stone-200/80 p-5 rounded-2xl shadow-sm flex flex-col justify-between cursor-pointer hover:border-[#002395]/40 hover:shadow-md transition-all group min-h-[220px]"
      role="button"
      aria-label="Zarządzaj kosztorysem projektu"
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
        <div className="text-4xl font-bold text-[#002395] mb-2 tracking-tight">
          {totalBudget.toLocaleString('pl-PL')} PLN
        </div>
        <div className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400">
          Przewidywany Koszt
        </div>
      </div>
    </div>
  );
}