/**
 * @file ProgramWidget.tsx
 * @description Dashboard widget displaying the concert program and casting fulfillment status.
 * @architecture
 * Evaluates piece requirements against current piece castings to calculate readiness indicators.
 * Provides micro-casting quick access.
 * @module project/widgets/ProgramWidget
 * @author Krystian Bugalski
 */

import React, { useContext, useMemo } from 'react';
import { ListOrdered, Music } from 'lucide-react';

import { ProjectDataContext, IProjectDataContext } from '../ProjectDashboard';
import type { Project, Piece, Participation, VoiceRequirement } from '../../../../types';

interface ProgramWidgetProps {
  project: Project;
}

/**
 * Parses duration into a human-readable format.
 * @param {number} totalSeconds - The total duration in seconds.
 * @returns {string | null}
 */
const formatTotalDuration = (totalSeconds: number): string | null => {
  if (!totalSeconds || totalSeconds === 0) return null;
  const minutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  
  if (hours > 0) return `~ ${hours}h ${remainingMins}min muzyki`;
  return `~ ${minutes} min muzyki`;
};

/**
 * ProgramWidget Component
 * @param {ProgramWidgetProps} props - Component properties.
 * @returns {React.JSX.Element | null}
 */
export default function ProgramWidget({ project }: ProgramWidgetProps): React.JSX.Element | null {
  const context = useContext(ProjectDataContext) as IProjectDataContext;

  if (!context) {
    console.error("[ProgramWidget] Must be used within a ProjectDataContext.Provider");
    return null;
  }

  const { pieces, pieceCastings, participations, openPanel } = context;

  // --- Derived Data (Memoized) ---
  const projectParticipations = useMemo<Participation[]>(() => {
    return participations?.filter((p) => p.project === project.id) || [];
  }, [participations, project.id]);

  const totalConcertDurationSeconds = useMemo<number>(() => {
    return project.program?.reduce((sum, item) => {
      const pieceId = item.piece_id || item.piece;
      const pieceObj = pieces.find((p) => String(p.id) === String(pieceId));
      return sum + (pieceObj?.estimated_duration || 0);
    }, 0) || 0;
  }, [project.program, pieces]);

  /**
   * Invokes the parent's panel controller to open the Program configuration tab.
   */
  const handleOpenProgram = (): void => {
    openPanel(project, 'PROGRAM');
  };

  /**
   * Opens the detailed Micro-Casting (Divisi) panel.
   * @param {React.MouseEvent<HTMLButtonElement>} e - Click event.
   */
  const handleOpenMicroCast = (e: React.MouseEvent<HTMLButtonElement>): void => {
    e.stopPropagation();
    openPanel(project, 'MICRO_CAST');
  };

  return (
    <div 
      onClick={handleOpenProgram} 
      className="bg-white border border-stone-200/80 p-5 rounded-2xl shadow-sm flex flex-col justify-between cursor-pointer hover:border-[#002395]/40 hover:shadow-md transition-all group min-h-[220px]"
      role="button"
      aria-label="Manage Concert Program"
    >
      <div className="flex items-center justify-between border-b border-stone-100 pb-3 mb-4">
        <h4 className="flex items-center gap-2 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 group-hover:text-[#002395] transition-colors">
          <ListOrdered size={16} className="text-[#002395] group-hover:scale-110 transition-transform" aria-hidden="true" /> 
          Program Koncertu
        </h4>
        <button 
          onClick={handleOpenMicroCast} 
          className="text-[9px] uppercase font-bold antialiased tracking-widest text-[#002395] opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
        >
          Divisi
        </button>
      </div>
      
      {project.program && project.program.length > 0 ? (
        <div className="flex flex-col h-full justify-between">
            <ul className="space-y-2 flex-1 mb-3">
            {[...project.program].sort((a,b) => a.order - b.order).slice(0, 5).map((item, index) => {
                const pieceId = item.piece_id || item.piece;
                const pieceObj: Piece | undefined = pieces.find((p) => String(p.id) === String(pieceId));
                const requirements: VoiceRequirement[] = pieceObj?.voice_requirements || [];
                const safeCastings = pieceCastings || [];
                
                let statusColor = "bg-stone-50 border-stone-100";
                let textColor = "text-stone-500";
                let statusText = "Brak wymagań";
                
                if (requirements.length > 0) {
                    let missingTotal = 0;
                    requirements.forEach((req) => {
                        const assignedCount = safeCastings.filter((c) => 
                            String(c.piece) === String(pieceId) && 
                            c.voice_line === req.voice_line && 
                            projectParticipations.some((p) => String(p.id) === String(c.participation))
                        ).length;
                        
                        if (assignedCount < req.quantity) {
                            missingTotal += (req.quantity - assignedCount);
                        }
                    });
                    
                    if (missingTotal > 0) {
                        statusColor = "bg-red-50 border-red-200";
                        textColor = "text-red-600";
                        statusText = "Nieobsadzony";
                    } else {
                        statusColor = "bg-emerald-50 border-emerald-200";
                        textColor = "text-emerald-700";
                        statusText = "Obsadzony";
                    }
                }

                return (
                    <li key={item.id || index} className={`text-[11px] flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${statusColor}`}>
                      <span className={`truncate pr-2 font-bold ${textColor}`}>
                          <strong className="opacity-40 w-4 inline-block font-bold">{index + 1}.</strong> {item.title || item.piece_title}
                      </span>
                      <span className={`text-[8px] font-bold antialiased uppercase tracking-widest ${textColor}`}>{statusText}</span>
                    </li>
                );
            })}
            
            {project.program.length > 5 && (
              <li className="text-[10px] font-bold antialiased text-stone-400 uppercase text-center pt-2">
                ...i {project.program.length - 5} więcej
              </li>
            )}
            </ul>
            
            <div className="mt-auto border-t border-stone-100 pt-3 text-center">
                {totalConcertDurationSeconds > 0 ? (
                    <span className="inline-flex items-center gap-1.5 text-[9px] font-bold antialiased uppercase tracking-widest text-[#002395] bg-blue-50 px-3 py-1.5 rounded-md border border-blue-100">
                        <Music size={12} aria-hidden="true" /> {formatTotalDuration(totalConcertDurationSeconds)}
                    </span>
                ) : (
                    <span className="text-[9px] uppercase tracking-widest font-bold antialiased text-stone-400">Czas nieznany</span>
                )}
            </div>
        </div>
      ) : (
        <p className="text-xs text-stone-500 italic flex-1 flex items-center justify-center py-4">
          Setlista jest pusta.
        </p>
      )}
    </div>
  );
}