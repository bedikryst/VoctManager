/**
 * @file CrewCard.tsx
 * @description Isolated, memoized UI component for a single crew/collaborator card.
 * @architecture Enterprise 2026
 * DESIGN SYNC: Visually unified with `ArtistCard.tsx` to maintain strict system-wide consistency.
 * Implements "Dense Data Boxes" for company info and standardized symmetrical action footers.
 * @module admin/crew/CrewCard
 * @author Krystian Bugalski
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Edit2, Trash2, Mail, Phone, Briefcase, Wrench } from 'lucide-react';
import type { Collaborator } from '../../../types';
import { SPECIALTY_CHOICES } from './CrewEditorPanel';

const STYLE_GLASS_CARD = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-[2rem]";

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
      className={`${STYLE_GLASS_CARD} p-6 flex flex-col justify-between hover:border-[#002395]/20 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgb(0,0,0,0.06)] transition-all duration-300 group`}
    >
      <div className="relative z-10 flex-1">
        {/* HEADER: Avatar & Name */}
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

        {/* SECTION: Professional Profile (Dense Box) */}
        <div className="bg-stone-50/80 border border-stone-200/60 rounded-xl p-3.5 mb-5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 flex items-center gap-1.5">
                    <Briefcase size={10} aria-hidden="true" /> Firma / Marka
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-stone-200 text-stone-700 shadow-sm truncate max-w-[120px]" title="{person.company_name}">
                    {person.company_name ? person.company_name : <span className="text-stone-400 italic">Brak danych</span>}
                </span>
            </div>
        </div>

        {/* SECTION: Contact Info */}
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

      {/* FOOTER: Symmetrical Actions */}
      <div className="flex gap-3 border-t border-stone-100/50 pt-5 relative z-10">
        <button 
          onClick={() => onEdit(person)} 
          className="flex-1 py-2.5 bg-white border border-stone-200/80 text-stone-600 text-[10px] font-bold antialiased uppercase tracking-widest rounded-xl hover:border-[#002395]/40 hover:text-[#002395] hover:shadow-md transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"
        >
          <Edit2 size={14} aria-hidden="true" /> Edytuj
        </button>
        <button 
          onClick={() => onDelete(person.id!)} 
          className="flex-1 py-2.5 bg-white border border-stone-200/80 text-stone-600 text-[10px] font-bold antialiased uppercase tracking-widest rounded-xl hover:border-red-200 hover:text-red-600 hover:bg-red-50 hover:shadow-md transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"
        >
          <Trash2 size={14} aria-hidden="true" /> Usuń
        </button>
      </div>

    </motion.div>
  );
}, (prevProps, nextProps) => {
  return prevProps.person.id === nextProps.person.id && 
         JSON.stringify(prevProps.person) === JSON.stringify(nextProps.person);
});