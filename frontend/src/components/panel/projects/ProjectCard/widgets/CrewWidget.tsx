/**
 * @file CrewWidget.tsx
 * @description Dashboard widget detailing technical crew assignments for the project.
 * Inherits pre-resolved assignment arrays and global crew dictionaries from the React Query cache.
 * Substring slicing ensures bounded layout constraints for technical role tags.
 * @module panel/projects/ProjectCard/widgets/CrewWidget
 */

import React from 'react';
import { Wrench } from 'lucide-react';

import type { Project, Collaborator } from '../../../../../types';
import { useProjectData } from '../../hooks/useProjectData';
import { GlassCard } from '../../../../../components/ui/GlassCard';

interface CrewWidgetProps {
    project: Project;
    onEdit?: () => void;
}

export default function CrewWidget({ project, onEdit }: CrewWidgetProps): React.JSX.Element {
    // Destructuring assignments and the global dictionary from React Query cache
    const { crewAssignments: projectCrew, crew } = useProjectData(String(project.id));

    const displayLimit = 9;
    const visibleCrew = projectCrew.slice(0, displayLimit);
    const overflowCount = projectCrew.length - displayLimit;

    return (
        <GlassCard 
            variant="solid"
            onClick={onEdit} 
            className={`p-5 flex flex-col justify-between transition-all group min-h-[220px] ${onEdit ? 'cursor-pointer hover:border-[#002395]/40 hover:shadow-md' : ''}`}
            role={onEdit ? "button" : "region"}
            aria-label="Manage technical crew"
        >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3 mb-4">
                <h4 className="flex items-center gap-2 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 group-hover:text-[#002395] transition-colors">
                    <Wrench size={16} className="text-[#002395] group-hover:scale-110 transition-transform" aria-hidden="true" /> 
                    Ekipa (Crew)
                </h4>
                {onEdit && (
                    <button className="text-[9px] uppercase font-bold antialiased tracking-widest text-[#002395] opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100">
                        Edytuj
                    </button>
                )}
            </div>

            <div className="flex-1 flex flex-col justify-center items-center py-2">
                <div className="flex flex-wrap justify-center gap-2 mb-2">
                    {visibleCrew.map((assign) => {
                        const person: Collaborator | undefined = crew?.find((c) => String(c.id) === String(assign.collaborator));
                        if (!person) return null;
                        
                        const roleLabel: string = assign.role_description || person.specialty.substring(0, 4);

                        return (
                            <span key={assign.id} className="px-2.5 py-1 bg-stone-50 text-stone-700 text-[10px] font-bold antialiased uppercase tracking-widest rounded-md border border-stone-200 shadow-sm flex items-center gap-1">
                                {person.first_name} {person.last_name.charAt(0)}. 
                                <span className="text-stone-400 lowercase tracking-normal">({roleLabel})</span>
                            </span>
                        );
                    })}
                    
                    {overflowCount > 0 && (
                        <span className="px-2.5 py-1 bg-blue-50 text-[#002395] text-[10px] font-bold antialiased uppercase tracking-widest rounded-md border border-blue-200 shadow-sm">
                            +{overflowCount}
                        </span>
                    )}
                    
                    {projectCrew.length === 0 && (
                        <span className="text-xs text-stone-400 italic">Brak przypisanej ekipy.</span>
                    )}
                </div>
            </div>
            
            <div className="text-center text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mt-auto border-t border-stone-100 pt-3">
                Zatrudnionych: {projectCrew.length}
            </div>
        </GlassCard>
    );
}