/**
 * @file CrewManagement.tsx
 * @description External Collaborators & Crew Management Module Controller.
 * @architecture Feature-Sliced Design (Enterprise 2026)
 * DESIGN SYNC: Converted to a `max-w-7xl` 4-column layout to mirror the Artist Management interface.
 * Delegates rendering to memoized `CrewCard` to optimize memory allocation and DOM re-renders.
 * @module admin/crew/CrewManagement
 * @author Krystian Bugalski
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Search, Filter, Wrench } from 'lucide-react';

import api from '../../../utils/api';
import ConfirmModal from '../../../components/ui/ConfirmModal';
import CrewEditorPanel, { SPECIALTY_CHOICES } from './CrewEditorPanel';
import { CrewCard } from './CrewCard';
import type { Collaborator } from '../../../types';

const extractData = (payload: any): any[] => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (payload.results && Array.isArray(payload.results)) return payload.results;
    return [];
};

const STYLE_GLASS_INPUT = "w-full pl-11 pr-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";

export default function CrewManagement(): React.JSX.Element {
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('');

  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [editingPerson, setEditingPerson] = useState<Collaborator | null>(null);
  const [initialSearchContext, setInitialSearchContext] = useState<string>('');

  const [personToDelete, setPersonToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const { data: rawCrew, isLoading, isError } = useQuery({
    queryKey: ['collaborators'],
    queryFn: async () => (await api.get('/api/collaborators/')).data
  });

  const crew = useMemo<Collaborator[]>(() => extractData(rawCrew), [rawCrew]);

  useEffect(() => {
    if (isError) toast.error("Ostrzeżenie", { description: "Nie udało się pobrać listy współpracowników." });
  }, [isError]);

  useEffect(() => {
    document.body.style.overflow = isPanelOpen || personToDelete ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isPanelOpen, personToDelete]);

  const displayCrew = useMemo<Collaborator[]>(() => {
      return crew.filter(c => {
          const matchesSearch = `${c.first_name} ${c.last_name} ${c.company_name || ''}`.toLowerCase().includes(searchTerm.toLowerCase());
          const matchesSpecialty = specialtyFilter ? c.specialty === specialtyFilter : true;
          return matchesSearch && matchesSpecialty;
      });
  }, [crew, searchTerm, specialtyFilter]);

  const openPanel = (person: Collaborator | null = null, searchContext: string = '') => {
    setEditingPerson(person);
    setInitialSearchContext(searchContext);
    setIsPanelOpen(true);
  };

  const closePanel = () => {
      setIsPanelOpen(false);
      setTimeout(() => {
          setEditingPerson(null);
          setInitialSearchContext('');
      }, 300);
  };

  const executeDelete = async () => {
    if (!personToDelete) return;
    setIsDeleting(true);
    const toastId = toast.loading("Usuwanie współpracownika...");

    try {
      await api.delete(`/api/collaborators/${personToDelete}/`);
      await queryClient.invalidateQueries({ queryKey: ['collaborators'] });
      toast.success("Osoba została usunięta z bazy.", { id: toastId });
    } catch (err) { 
      toast.error("Nie można usunąć tej osoby", { 
          id: toastId, 
          description: "Prawdopodobnie jest ona powiązana z istniejącymi projektami. Spróbuj edytować jej dane." 
      }); 
    } finally {
      setIsDeleting(false);
      setPersonToDelete(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in relative cursor-default pb-12 max-w-7xl mx-auto px-4 sm:px-0">
      
      <header className="relative pt-2 mb-8">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-5">
                  <div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-4">
                          <Wrench size={12} className="text-[#002395]" aria-hidden="true" />
                          <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-[#002395]/80">Logistyka</p>
                      </div>
                      <h1 className="text-3xl md:text-4xl font-medium text-stone-900 leading-tight tracking-tight" style={{ fontFamily: "'Cormorant', serif" }}>
                          Ekipa <span className="italic text-[#002395]">Techniczna</span>.
                      </h1>
                  </div>
                  <button 
                    onClick={() => openPanel(null)} 
                    className="flex items-center gap-2 bg-[#002395] hover:bg-[#001766] text-white text-[10px] uppercase tracking-widest font-bold antialiased py-3 px-6 rounded-xl transition-all shadow-[0_4px_14px_rgba(0,35,149,0.3)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.4)] hover:-translate-y-0.5 active:scale-95"
                  >
                      <Plus size={16} aria-hidden="true" /> Dodaj Osobę / Firmę
                  </button>
              </div>
          </motion.div>
      </header>

      {/* FILTERS */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search size={16} className="text-stone-400" aria-hidden="true" />
              </div>
              <input 
                  type="text" placeholder="Szukaj po nazwisku lub firmie..." 
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className={STYLE_GLASS_INPUT}
              />
          </div>
          <div className="relative w-full sm:w-72 flex-shrink-0">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Filter size={16} className="text-stone-400" aria-hidden="true" />
              </div>
              <select 
                  value={specialtyFilter} onChange={e => setSpecialtyFilter(e.target.value)}
                  className={`${STYLE_GLASS_INPUT} font-bold text-stone-600 appearance-none`}
              >
                  <option value="">Wszystkie specjalizacje</option>
                  {SPECIALTY_CHOICES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
          </div>
      </div>

      {/* CREW GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-64 bg-stone-100/50 rounded-[2rem] border border-white/50 animate-pulse"></div>
          ))
        ) : displayCrew.length > 0 ? (
          <AnimatePresence>
            {displayCrew.map((person) => (
              <CrewCard 
                  key={person.id} 
                  person={person} 
                  onEdit={openPanel} 
                  onDelete={(id) => setPersonToDelete(id)} 
              />
            ))}
          </AnimatePresence>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] col-span-full p-16 text-center flex flex-col items-center justify-center rounded-[2rem]">
            <Wrench size={48} className="text-stone-300 mb-4 opacity-50" aria-hidden="true" />
            <span className="text-[11px] font-bold antialiased text-stone-500 uppercase tracking-widest mb-2">Brak wyników</span>
            
            {/* ENTERPRISE UX: Actionable Empty State */}
            {searchTerm ? (
                <div className="flex flex-col items-center gap-3 mt-2">
                    <span className="text-xs text-stone-400 max-w-sm">Nie znaleźliśmy firmy lub osoby "{searchTerm}". Możesz dodać ją teraz.</span>
                    <button 
                        onClick={() => openPanel(null, searchTerm)} 
                        className="mt-2 bg-stone-100 hover:bg-[#002395] hover:text-white border border-stone-200/80 text-stone-600 text-[10px] font-bold antialiased uppercase tracking-widest py-2.5 px-5 rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-2"
                    >
                        <Plus size={14} aria-hidden="true" /> Dodaj do bazy: {searchTerm}
                    </button>
                </div>
            ) : (
                <span className="text-xs text-stone-400 max-w-sm">Zmień filtry lub dodaj nową osobę / firmę do bazy.</span>
            )}
          </motion.div>
        )}
      </div>

      {/* --- EXTERNAL COMPONENTS --- */}
      <CrewEditorPanel 
        isOpen={isPanelOpen}
        onClose={closePanel}
        person={editingPerson}
        initialSearchContext={initialSearchContext}
      />

      <ConfirmModal 
        isOpen={!!personToDelete}
        title="Usunąć tę osobę z bazy?"
        description="Zniknie ona bezpowrotnie ze spisu. Nie można usunąć osób powiązanych już z koncertami (w takim przypadku zaktualizuj jej dane)."
        onConfirm={executeDelete}
        onCancel={() => setPersonToDelete(null)}
        isLoading={isDeleting}
      />
    </div>
  );
}