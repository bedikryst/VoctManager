/**
 * @file CastWidget.tsx
 * @description Dashboard widget displaying the vocal cast (artists) assigned to a project.
 * Strictly consumes pre-fetched aggregations from the React Query cache via useProjectData 
 * to prevent the N+1 network request anti-pattern and mute layout shifts.
 * @module panel/projects/ProjectCard/widgets/CastWidget
 */

import React from 'react';
import { Users } from 'lucide-react';

import type { Project, Artist } from '../../../../../types';
import { useProjectData } from '../../hooks/useProjectData';
import { GlassCard } from '../../../../../shared/ui/GlassCard';

interface CastWidgetProps {
    project: Project;
    onEdit?: () => void;
}

export default function CastWidget({ project, onEdit }: CastWidgetProps): React.JSX.Element {
    // Inherits instant cache data populated by the parent ProjectCard
    const { participations: projectParticipations, artists } = useProjectData(String(project.id));

    const displayLimit = 9;
    const visibleParticipations = projectParticipations.slice(0, displayLimit);
    const overflowCount = projectParticipations.length - displayLimit;

    return (
        <GlassCard 
            variant="solid"
            onClick={onEdit} 
            className={`p-5 flex flex-col justify-between transition-all group min-h-[220px] ${onEdit ? 'cursor-pointer hover:border-[#002395]/40 hover:shadow-md' : ''}`}
            role={onEdit ? "button" : "region"}
            aria-label="Manage vocal cast"
        >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3 mb-4">
                <h4 className="flex items-center gap-2 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 group-hover:text-[#002395] transition-colors">
                    <Users size={16} className="text-[#002395] group-hover:scale-110 transition-transform" aria-hidden="true" /> 
                    Obsada Wokalna
                </h4>
                {onEdit && (
                    <button className="text-[9px] uppercase font-bold antialiased tracking-widest text-[#002395] opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100">
                        Edytuj
                    </button>
                )}
            </div>

            <div className="flex-1 flex flex-col justify-center items-center py-2">
                <div className="flex flex-wrap justify-center gap-2 mb-2">
                    {visibleParticipations.map((part) => {
                        const artist: Artist | undefined = artists?.find((a) => String(a.id) === String(part.artist));
                        if (!artist) return null;
                        
                        return (
                            <span key={part.id} className="px-2.5 py-1 bg-stone-50 text-stone-700 text-[10px] font-bold antialiased uppercase tracking-widest rounded-md border border-stone-200 shadow-sm">
                                {artist.first_name} {artist.last_name.charAt(0)}.
                            </span>
                        );
                    })}
                    
                    {overflowCount > 0 && (
                        <span className="px-2.5 py-1 bg-blue-50 text-[#002395] text-[10px] font-bold antialiased uppercase tracking-widest rounded-md border border-blue-200 shadow-sm">
                            +{overflowCount}
                        </span>
                    )}
                    
                    {projectParticipations.length === 0 && (
                        <span className="text-xs text-stone-400 italic">Brak obsady wokalnej.</span>
                    )}
                </div>
            </div>
            
            <div className="text-center text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mt-auto border-t border-stone-100 pt-3">
                Zatrudnionych: {projectParticipations.length}
            </div>
        </GlassCard>
    );
}