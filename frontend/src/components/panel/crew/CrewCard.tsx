/**
 * @file CrewCard.tsx
 * @description Isolated, memoized UI component for a single crew/collaborator card.
 * Integrates "Dense Data Boxes" for company info and standardized action footers.
 * @module panel/crew/CrewCard
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Edit2, Trash2, Mail, Phone, Briefcase } from 'lucide-react';
import type { Collaborator } from '../../../types';
import { SPECIALTY_CHOICES } from './CrewEditorPanel';
import { GlassCard } from '../../../components/ui/GlassCard';
import { Button } from '../../../components/ui/Button';

const getSpecialtyLabel = (val: string): string => {
    return SPECIALTY_CHOICES.find(s => s.value === val)?.label || 'Inne';
};

interface CrewCardProps {
    person: Collaborator;
    onEdit: (person: Collaborator) => void;
    onDelete: (id: string) => void;
}

export const CrewCard = React.memo(({ person, onEdit, onDelete }: CrewCardProps) => {
    const initials = `${person.first_name?.charAt(0) || ''}${person.last_name?.charAt(0) || ''}`.toUpperCase();

    return (
        <motion.div 
            layout
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="transition-all duration-300 group hover:-translate-y-0.5 hover:shadow-lg"
        >
            <GlassCard className="flex flex-col justify-between h-full">
                <div className="relative z-10 flex-1">
                    <div className="flex items-start gap-4 mb-5">
                        <div className="w-12 h-12 rounded-2xl bg-white text-stone-600 border border-stone-100 flex items-center justify-center shadow-sm font-bold tracking-widest text-xs flex-shrink-0">
                            {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-bold text-stone-900 tracking-tight leading-tight truncate">
                                {person.first_name} {person.last_name}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                <span className="px-2 py-0.5 text-[8px] font-bold antialiased uppercase tracking-widest rounded-md border shadow-sm bg-blue-50 text-[#002395] border-blue-200">
                                    {getSpecialtyLabel(person.specialty)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-stone-50/80 border border-stone-200/60 rounded-xl p-3.5 mb-5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 flex items-center gap-1.5">
                                <Briefcase size={10} aria-hidden="true" /> Firma / Marka
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-stone-200 text-stone-700 shadow-sm truncate max-w-[120px]" title={person.company_name || ""}>
                                {person.company_name ? person.company_name : <span className="text-stone-400 italic">Brak danych</span>}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-2.5 text-xs text-stone-600 mb-6 font-medium">
                        <p className="flex items-center gap-2.5">
                            <Mail size={14} className="text-stone-400 flex-shrink-0" aria-hidden="true" /> 
                            {person.email ? <a href={`mailto:${person.email}`} className="hover:text-[#002395] transition-colors truncate">{person.email}</a> : <span className="italic text-stone-400 font-normal">Brak e-mail</span>}
                        </p>
                        <p className="flex items-center gap-2.5">
                            <Phone size={14} className="text-stone-400 flex-shrink-0" aria-hidden="true" /> 
                            {person.phone_number ? <a href={`tel:${person.phone_number}`} className="hover:text-[#002395] transition-colors">{person.phone_number}</a> : <span className="italic text-stone-400 font-normal">Brak telefonu</span>}
                        </p>
                    </div>
                </div>

                <div className="flex gap-3 border-t border-stone-100/50 pt-5 relative z-10">
                    <Button 
                        variant="outline"
                        onClick={() => onEdit(person)} 
                        leftIcon={<Edit2 size={14} aria-hidden="true" />}
                        className="flex-1"
                    >
                        Edytuj
                    </Button>
                    <Button 
                        variant="outline"
                        onClick={() => onDelete(person.id!)} 
                        leftIcon={<Trash2 size={14} aria-hidden="true" />}
                        className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                    >
                        Usuń
                    </Button>
                </div>
            </GlassCard>
        </motion.div>
    );
}, (prevProps, nextProps) => {
    return prevProps.person.id === nextProps.person.id && 
           JSON.stringify(prevProps.person) === JSON.stringify(nextProps.person);
});

CrewCard.displayName = 'CrewCard';