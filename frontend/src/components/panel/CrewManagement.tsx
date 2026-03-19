/**
 * @file CrewManagement.tsx
 * @description External Collaborators & Crew Management Module.
 * @architecture
 * Implements React Query (useQuery) for robust state synchronization.
 * Delegates form rendering and dirty state tracking to CrewEditorPanel.
 * Extracts static CSS and mapping logic outside the component to optimize memory allocation.
 * Replaced native alerts with ConfirmModal and Sonner toasts.
 * @module admin/CrewManagement
 * @author Krystian Bugalski
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  Plus, Edit2, Trash2, Search, Filter, Wrench, 
  Mail, Phone, Briefcase, Loader2
} from 'lucide-react';

import api from '../../utils/api';
import ConfirmModal from '../../components/ui/ConfirmModal';
import CrewEditorPanel, { SPECIALTY_CHOICES } from './CrewEditorPanel';

import type { Collaborator } from '../../types';

// --- Static Styles ---
const STYLE_GLASS_CARD = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl";
const STYLE_GLASS_INPUT = "w-full pl-11 pr-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";

const getSpecialtyLabel = (val: string): string => {
    return SPECIALTY_CHOICES.find(s => s.value === val)?.label || 'Inne';
};

/**
 * CrewManagement Component
 * @returns {React.JSX.Element}
 */
export default function CrewManagement(): React.JSX.Element {
  const queryClient = useQueryClient();

  // --- Search & Filter State ---
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('');

  // --- Editor Panel State ---
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [editingPerson, setEditingPerson] = useState<Collaborator | null>(null);

  // --- Deletion Modal State ---
  const [personToDelete, setPersonToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // --- Data Fetching Engine (React Query) ---
  const { data: crew = [], isLoading, isError } = useQuery<Collaborator[]>({
    queryKey: ['collaborators'],
    queryFn: async () => {
      const res = await api.get('/api/collaborators/');
      return Array.isArray(res.data) ? res.data : [];
    }
  });

  useEffect(() => {
    if (isError) {
      toast.error("Ostrzeżenie", { description: "Nie udało się pobrać listy współpracowników." });
    }
  }, [isError]);

  useEffect(() => {
    document.body.style.overflow = isPanelOpen || personToDelete ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isPanelOpen, personToDelete]);

  // --- Derived State (Memoized) ---
  const displayCrew = useMemo<Collaborator[]>(() => {
      return crew.filter(c => {
          const matchesSearch = `${c.first_name} ${c.last_name} ${c.company_name || ''}`.toLowerCase().includes(searchTerm.toLowerCase());
          const matchesSpecialty = specialtyFilter ? c.specialty === specialtyFilter : true;
          return matchesSearch && matchesSpecialty;
      });
  }, [crew, searchTerm, specialtyFilter]);

  // --- Action Handlers ---
  const refreshGlobal = useCallback(async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ['collaborators'] });
  }, [queryClient]);

  const openPanel = (person: Collaborator | null = null) => {
    setEditingPerson(person);
    setIsPanelOpen(true);
  };

  const closePanel = () => {
      setIsPanelOpen(false);
      setTimeout(() => setEditingPerson(null), 300);
  };

  const executeDelete = async () => {
    if (!personToDelete) return;
    setIsDeleting(true);
    const toastId = toast.loading("Usuwanie współpracownika...");

    try {
      await api.delete(`/api/collaborators/${personToDelete}/`);
      await refreshGlobal();
      toast.success("Osoba została usunięta z bazy.", { id: toastId });
    } catch (err) { 
      console.error("Deletion failed:", err);
      toast.error("Nie można usunąć tej osoby", { 
          id: toastId, 
          description: "Prawdopodobnie jest ona powiązana z istniejącymi projektami. Spróbuj edytować jej dane." 
      }); 
    } finally {
      setIsDeleting(false);
      setPersonToDelete(null);
    }
  };

  // --- Render ---
  return (
    <div className="space-y-6 animate-fade-in relative cursor-default pb-12 max-w-6xl mx-auto">
      
      {/* --- EDITORIAL HEADER --- */}
      <header className="relative pt-2 mb-8">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-5">
                  <div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-4">
                          <Wrench size={12} className="text-[#002395]" aria-hidden="true" />
                          <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-[#002395]/80">
                              Logistyka
                          </p>
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

      {/* --- SEARCH & FILTER BAR --- */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
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

      {/* --- GRID VIEWS --- */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3].map(i => <div key={i} className="h-48 bg-stone-100/50 border border-white/50 rounded-2xl w-full"></div>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {displayCrew.length > 0 ? displayCrew.map((person) => (
              <motion.div 
                key={person.id} layout
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className={`${STYLE_GLASS_CARD} p-6 flex flex-col justify-between hover:border-[#002395]/20 hover:shadow-[0_12px_24px_rgb(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group`}
              >
                {/* Opcjonalny znak wodny narzędzia dla klimatu */}
                <div className="absolute -right-4 -top-4 text-[#002395] opacity-[0.02] pointer-events-none group-hover:scale-110 transition-transform duration-700">
                    <Wrench size={100} strokeWidth={1} aria-hidden="true" />
                </div>

                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white text-stone-600 border border-stone-100 flex items-center justify-center shadow-sm font-bold tracking-widest text-xs flex-shrink-0">
                        {person.first_name[0]}{person.last_name[0]}
                      </div>
                      <div>
                        <h3 className="font-bold text-stone-900 text-lg leading-tight tracking-tight">{person.first_name} {person.last_name}</h3>
                        <span className="text-[9px] font-bold antialiased uppercase tracking-widest text-[#002395] bg-blue-50 px-2 py-1 rounded-md border border-blue-100 mt-1.5 inline-block shadow-sm">
                          {getSpecialtyLabel(person.specialty)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5 text-xs text-stone-600 mb-6 font-medium">
                    {person.company_name && (
                        <p className="flex items-center gap-2.5"><Briefcase size={14} className="text-stone-400" aria-hidden="true" /> <span className="font-bold text-stone-800 tracking-tight">{person.company_name}</span></p>
                    )}
                    <p className="flex items-center gap-2.5"><Mail size={14} className="text-stone-400" aria-hidden="true" /> {person.email || <span className="italic text-stone-400 font-normal">Brak e-mail</span>}</p>
                    <p className="flex items-center gap-2.5"><Phone size={14} className="text-stone-400" aria-hidden="true" /> {person.phone_number || <span className="italic text-stone-400 font-normal">Brak telefonu</span>}</p>
                  </div>
                </div>

                <div className="flex gap-3 border-t border-stone-100/50 pt-5 relative z-10">
                  <button 
                    onClick={() => openPanel(person)} 
                    className="flex-1 py-2.5 bg-white border border-stone-200/80 text-stone-700 text-[10px] font-bold antialiased uppercase tracking-widest rounded-xl hover:border-[#002395]/40 hover:text-[#002395] hover:shadow-md transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"
                  >
                    <Edit2 size={14} aria-hidden="true" /> Edytuj
                  </button>
                  <button 
                    onClick={() => setPersonToDelete(person.id)} 
                    className="p-3 bg-white border border-stone-200/80 text-stone-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 rounded-xl transition-all flex items-center justify-center shadow-sm active:scale-95" 
                    title="Usuń z bazy"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </motion.div>
            )) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${STYLE_GLASS_CARD} col-span-full p-16 text-center flex flex-col items-center justify-center`}>
                <Wrench size={48} className="text-stone-300 mb-4 opacity-50" aria-hidden="true" />
                <span className="text-[11px] font-bold antialiased text-stone-500 uppercase tracking-widest mb-2">Brak współpracowników</span>
                <span className="text-xs text-stone-400 max-w-sm">Zmień filtry lub dodaj nową osobę / firmę do bazy.</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* --- EXTERNAL COMPONENTS --- */}
      <CrewEditorPanel 
        isOpen={isPanelOpen}
        onClose={closePanel}
        person={editingPerson}
        refreshGlobal={refreshGlobal}
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