/**
 * @file ProjectCardDetails.tsx
 * @description Renders the descriptive content and dress code requirements for a project.
 * Strictly presentational component. Relies entirely on passed props and flexbox models.
 * @module panel/projects/ProjectCard/components/ProjectCardDetails
 */

import React from 'react';
import { AlignLeft, Shirt } from 'lucide-react';
import type { Project } from '../../../../types';

interface ProjectCardDetailsProps {
    project: Project;
}

export default function ProjectCardDetails({ project }: ProjectCardDetailsProps): React.JSX.Element {
    const hasDressCode = project.dress_code_female || project.dress_code_male;

    return (
        <>
            <div className="bg-white border border-stone-200/80 rounded-2xl p-5 shadow-sm flex-1 flex flex-col">
                <h4 className="flex items-center gap-2.5 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-3">
                    <AlignLeft size={16} className="text-[#002395]" aria-hidden="true" /> Opis wydarzenia
                </h4>
                {project.description ? (
                    <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">{project.description}</p>
                ) : (
                    <p className="text-xs text-stone-400 italic">Nie ma żadnych dodatkowych uwag do tego wydarzenia.</p>
                )}
            </div>

            <div className="bg-white border border-stone-200/80 rounded-2xl p-4 shadow-sm">
                <h4 className="flex items-center gap-2.5 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-3">
                    <Shirt size={16} className="text-[#002395]" aria-hidden="true" /> Dress Code
                </h4>
                <div className="flex flex-wrap gap-2">
                    {project.dress_code_female && (
                        <div className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                            <span className="text-stone-400 font-medium">Panie:</span>
                            <span className="text-stone-800">{project.dress_code_female}</span>
                        </div>
                    )}
                    {project.dress_code_male && (
                        <div className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                            <span className="text-stone-400 font-medium">Panowie:</span>
                            <span className="text-stone-800">{project.dress_code_male}</span>
                        </div>
                    )}
                    {!hasDressCode && (
                        <div className="text-xs text-stone-400 italic py-1">Nie ma wymagań co do ubioru.</div>
                    )}
                </div>
            </div>
        </>
    );
}