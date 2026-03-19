/**
 * @file RehearsalsWidget.tsx
 * @description Dashboard widget displaying upcoming rehearsals and progress for a specific project.
 * @architecture
 * Consumes global state via ProjectDataContext to maintain decoupling from the parent layout.
 * Memoizes derived arrays (past/upcoming rehearsals) to minimize recalculations.
 * @module project/widgets/RehearsalsWidget
 * @author Krystian Bugalski
 */

import React, { useContext, useMemo } from 'react';
import { Calendar } from 'lucide-react';

// Context & Types
import { ProjectDataContext, IProjectDataContext } from '../ProjectDashboard';
import type { Project, Rehearsal, Participation } from '../../../../types';

/**
 * @interface RehearsalsWidgetProps
 * @property {Project} project - The parent project object to which these rehearsals belong.
 */
interface RehearsalsWidgetProps {
  project: Project;
}

/**
 * RehearsalsWidget Component
 * @param {RehearsalsWidgetProps} props - Component properties.
 * @returns {React.JSX.Element | null} The rendered widget or null if context is missing.
 */
export default function RehearsalsWidget({ project }: RehearsalsWidgetProps): React.JSX.Element | null {
  const context = useContext(ProjectDataContext) as IProjectDataContext;

  if (!context) {
    console.error("[RehearsalsWidget] Must be used within a ProjectDataContext.Provider");
    return null;
  }

  const { rehearsals, participations, openPanel } = context;

  // --- Derived Data (Memoized) ---
  
  const projectRehearsals = useMemo<Rehearsal[]>(() => {
    return rehearsals
      .filter((r) => r.project === project.id)
      .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());
  }, [rehearsals, project.id]);

  const pastRehearsals = useMemo<Rehearsal[]>(() => {
    const now = new Date();
    return projectRehearsals.filter((r) => new Date(r.date_time) < now);
  }, [projectRehearsals]);

  const upcomingRehearsals = useMemo<Rehearsal[]>(() => {
    const now = new Date();
    return projectRehearsals.filter((r) => new Date(r.date_time) >= now).slice(0, 3);
  }, [projectRehearsals]);

  const projectParticipations = useMemo<Participation[]>(() => {
    return participations?.filter((p) => p.project === project.id) || [];
  }, [participations, project.id]);

  const progressPercentage: number = projectRehearsals.length > 0 
    ? (pastRehearsals.length / projectRehearsals.length) * 100 
    : 0;

  // --- Handlers ---

  /**
   * Invokes the parent's panel controller to open the Rehearsals configuration tab.
   */
  const handleOpenRehearsals = (): void => {
    openPanel(project, 'REHEARSALS');
  };

  return (
    <div 
      onClick={handleOpenRehearsals} 
      className="bg-white border border-stone-200/80 p-5 rounded-2xl shadow-sm flex flex-col justify-between cursor-pointer hover:border-[#002395]/40 hover:shadow-md transition-all group min-h-[220px]"
      role="button"
      aria-label="Manage Rehearsals"
    >
      {/* Widget Header */}
      <div className="flex items-center justify-between border-b border-stone-100 pb-3 mb-4">
        <h4 className="flex items-center gap-2 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 group-hover:text-[#002395] transition-colors">
          <Calendar size={16} className="text-[#002395] group-hover:scale-110 transition-transform" aria-hidden="true" /> 
          Najbliższe Próby
        </h4>
        <button className="text-[9px] uppercase font-bold antialiased tracking-widest text-[#002395] opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100">
          Edytuj
        </button>
      </div>
      
      {/* Widget Body */}
      {projectRehearsals.length > 0 ? (
        <>
          <div className="mb-4" aria-label={`Progress: ${pastRehearsals.length} out of ${projectRehearsals.length} completed`}>
            <div className="flex justify-between text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-2">
              <span>Postęp</span>
              <span>{pastRehearsals.length} / {projectRehearsals.length}</span>
            </div>
            <div className="w-full bg-stone-100 rounded-full h-1.5">
              <div 
                className="bg-[#002395] h-1.5 rounded-full transition-all duration-500 ease-out" 
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
          
          <ul className="space-y-3 flex-1 mt-2">
            {upcomingRehearsals.map((reh) => {
              const invitedCount: number = reh.invited_participations?.length || 0;
              const isTutti: boolean = invitedCount === 0 || invitedCount === projectParticipations.length;

              return (
                <li key={reh.id} className="text-[11px] text-stone-600 flex flex-col gap-1 border-b border-stone-50 last:border-0 pb-2 last:pb-0">
                    <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2.5">
                        <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 shadow-sm ${reh.is_mandatory ? 'bg-[#002395]' : 'bg-orange-400'}`} aria-hidden="true" />
                        <div className="flex flex-col">
                        <span>
                            <strong className="text-stone-800">
                              {new Date(reh.date_time).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </strong>
                            <span className="text-stone-400 ml-1">({reh.location})</span>
                        </span>
                        {reh.focus && <span className="text-[10px] text-stone-500 italic line-clamp-1 mt-0.5">{reh.focus}</span>}
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <span className={`text-[8px] uppercase tracking-widest font-bold antialiased px-1.5 py-0.5 rounded ${isTutti ? 'bg-emerald-50 text-emerald-700' : 'bg-purple-50 text-purple-700'}`}>
                            {isTutti ? 'TUTTI' : 'SEKCYJNA'}
                        </span>
                        {!reh.is_mandatory && <span className="text-[8px] text-orange-600 font-bold antialiased uppercase tracking-widest">Opcjonalna</span>}
                    </div>
                    </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="text-xs text-stone-400 italic flex-1 flex items-center justify-center py-4">
          Brak zaplanowanych prób.
        </p>
      )}
    </div>
  );
}