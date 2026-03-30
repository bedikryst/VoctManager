/**
 * @file BudgetTab.tsx
 * @description Financial estimation and fee assignment widget.
 * @architecture
 * ENTERPRISE 2026:
 * - Implements Hybrid JIT Fetching (Context for dictionaries, React Query for relations).
 * - "Dirty State Tracking" strictly isolates API sync to mutated fields, preventing N+1 floods.
 * - Features Unified Floating Action Bar (FAB) for state commits and instant rollbacks.
 * - Pure TypeScript interfaces without `any` assertions.
 * @module project/ProjectEditorPanel/tabs/BudgetTab
 * @author Krystian Bugalski
 */

import React, { useState, useMemo, useContext } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Banknote, Users, Wrench, Sparkles, Save, AlertCircle } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import api from '../../../../../utils/api';
import { ProjectDataContext, IProjectDataContext } from '../../ProjectDashboard';
import type { Participation, CrewAssignment } from '../../../../../types';

interface BudgetTabProps {
  projectId: string;
}

const STYLE_GLASS_CARD = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl overflow-hidden";
const STYLE_GLASS_INPUT = "bg-white/50 backdrop-blur-sm border border-stone-200/60 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] rounded-xl";
const STYLE_LIST_CONTAINER = "divide-y divide-stone-100/50 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]";

export default function BudgetTab({ projectId }: BudgetTabProps): React.JSX.Element | null {
  const queryClient = useQueryClient();
  
  // 1. Consume Global Dictionaries (RAM)
  const context = useContext(ProjectDataContext) as IProjectDataContext;
  if (!context) return null;
  const { artists, crew } = context;

  // 2. JIT Fetching for Relational Entities
  const { data: participations = [] } = useQuery<Participation[]>({
    queryKey: ['participations', projectId],
    queryFn: async () => {
      const res = await api.get(`/api/participations/?project=${projectId}`);
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 60000
  });

  const { data: crewAssignments = [] } = useQuery<CrewAssignment[]>({
    queryKey: ['crewAssignments', projectId],
    queryFn: async () => {
      const res = await api.get(`/api/crew-assignments/?project=${projectId}`);
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 60000
  });

  // --- Local Mutable State (Dirty Tracking) ---
  const [dirtyArtists, setDirtyArtists] = useState<Record<string, number | null>>({}); 
  const [dirtyCrew, setDirtyCrew] = useState<Record<string, number | null>>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const isDirty = Object.keys(dirtyArtists).length > 0 || Object.keys(dirtyCrew).length > 0;

  // --- Derived Core Data ---
  const projectParticipations = useMemo<Participation[]>(() => {
    return participations.filter((p) => String(p.project) === String(projectId));
  }, [participations, projectId]);

  const projectCrewAssignments = useMemo<CrewAssignment[]>(() => {
    return crewAssignments.filter((a) => String(a.project) === String(projectId));
  }, [crewAssignments, projectId]);

  // --- Financial Computations ---
  const totalArtists = useMemo<number>(() => {
    return projectParticipations.reduce((sum, p) => {
        const activeFee = dirtyArtists.hasOwnProperty(p.id) ? dirtyArtists[String(p.id)] : p.fee;
        return sum + (Number(activeFee) || 0);
    }, 0);
  }, [projectParticipations, dirtyArtists]);

  const totalCrew = useMemo<number>(() => {
    return projectCrewAssignments.reduce((sum, c) => {
        const activeFee = dirtyCrew.hasOwnProperty(c.id) ? dirtyCrew[String(c.id)] : c.fee;
        return sum + (Number(activeFee) || 0);
    }, 0);
  }, [projectCrewAssignments, dirtyCrew]);
  
  const grandTotal: number = totalArtists + totalCrew;

  // --- Handlers ---
  const handleFeeChange = (id: string | number, value: string, type: 'artist' | 'crew'): void => {
    const numericValue = value ? parseInt(value, 10) : null;
    const stringId = String(id);
    if (type === 'artist') setDirtyArtists((prev) => ({ ...prev, [stringId]: numericValue }));
    else setDirtyCrew((prev) => ({ ...prev, [stringId]: numericValue }));
  };

  const handleCancel = (): void => {
    setDirtyArtists({});
    setDirtyCrew({});
  };

  const handleSaveBudget = async (): Promise<void> => {
    if (!isDirty) return;

    setIsSaving(true);
    const toastId = toast.loading("Zapisywanie kosztorysu...");

    try {
      const syncPromises: Promise<any>[] = [];
      
      Object.keys(dirtyArtists).forEach((id) => {
        syncPromises.push(api.patch(`/api/participations/${id}/`, { fee: dirtyArtists[id] }));
      });
      Object.keys(dirtyCrew).forEach((id) => {
        syncPromises.push(api.patch(`/api/crew-assignments/${id}/`, { fee: dirtyCrew[id] }));
      });
      
      await Promise.all(syncPromises);
      
      await queryClient.invalidateQueries({ queryKey: ['participations', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['crewAssignments', projectId] });

      setDirtyArtists({});
      setDirtyCrew({});
      toast.success(`Zapisano zmiany dla ${syncPromises.length} wpisów.`, { id: toastId });
    } catch (err) {
      console.error("[BudgetTab] Failed to save budget:", err);
      toast.error("Błąd podczas zapisu", { id: toastId, description: "Nie udało się zapisać wszystkich zmian w budżecie." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24 relative">
      
      {/* ENTERPRISE FLOATING ACTION BAR (FAB) */}
      <AnimatePresence>
        {isDirty && (
          <motion.div 
            initial={{ y: 100, opacity: 0, x: '-50%' }}
            animate={{ y: 0, opacity: 1, x: '-50%' }}
            exit={{ y: 100, opacity: 0, x: '-50%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed bottom-6 md:bottom-10 left-1/2 z-[200] w-[90%] max-w-md bg-stone-900/95 backdrop-blur-2xl border border-stone-700 shadow-2xl p-4 rounded-2xl flex items-center justify-between"
          >
            <div className="flex flex-col ml-2">
              <span className="text-[10px] font-bold antialiased text-white uppercase tracking-widest flex items-center gap-2">
                <AlertCircle size={14} className="text-orange-400" aria-hidden="true" /> Niezapisane Kwoty
              </span>
              <span className="text-xs text-stone-400 mt-0.5">
                Masz wstrzymane zmiany ({Object.keys(dirtyArtists).length + Object.keys(dirtyCrew).length}).
              </span>
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
                <button 
                  onClick={handleCancel} 
                  disabled={isSaving}
                  className="px-4 py-3 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-400 hover:text-white hover:bg-stone-800 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                >
                  Anuluj
                </button>
                <button 
                  onClick={handleSaveBudget} 
                  disabled={isSaving} 
                  className="flex items-center justify-center gap-2 bg-[#002395] hover:bg-[#001766] disabled:bg-stone-600 text-white text-[10px] antialiased uppercase tracking-[0.1em] font-bold py-3 px-5 rounded-xl transition-all shadow-[0_4px_14px_rgba(0,35,149,0.3)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.4)] disabled:shadow-none active:scale-95 flex-shrink-0"
                >
                    {isSaving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />} Zapisz
                </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- DASHBOARD WIDGETS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className={`${STYLE_GLASS_CARD} p-6 flex flex-col justify-center items-center relative group hover:-translate-y-0.5 transition-transform`}>
          <div className="absolute -right-4 -bottom-4 text-stone-200 opacity-20 pointer-events-none group-hover:scale-110 transition-transform duration-700">
            <Users size={100} aria-hidden="true" />
          </div>
          <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-2 relative z-10">Koszty Artystyczne</p>
          <p className="text-2xl font-bold text-stone-800 tracking-tight relative z-10">{totalArtists.toLocaleString('pl-PL')} PLN</p>
        </div>
        
        <div className={`${STYLE_GLASS_CARD} p-6 flex flex-col justify-center items-center relative group hover:-translate-y-0.5 transition-transform`}>
          <div className="absolute -right-4 -bottom-4 text-stone-200 opacity-20 pointer-events-none group-hover:scale-110 transition-transform duration-700">
            <Wrench size={100} aria-hidden="true" />
          </div>
          <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-2 relative z-10">Koszty Techniczne</p>
          <p className="text-2xl font-bold text-stone-800 tracking-tight relative z-10">{totalCrew.toLocaleString('pl-PL')} PLN</p>
        </div>
        
        <div className="bg-gradient-to-br from-[#002395] via-[#001766] to-[#000a33] p-6 rounded-2xl shadow-[0_10px_30px_rgba(0,35,149,0.15)] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] flex flex-col justify-center items-center text-white relative overflow-hidden group hover:-translate-y-0.5 transition-transform">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4" aria-hidden="true"></div>
          <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-blue-200 mb-2 relative z-10 flex items-center gap-1.5">
            <Sparkles size={12} aria-hidden="true" /> Kosztorys Całkowity
          </p>
          <p className="text-3xl font-bold tracking-tight relative z-10">{grandTotal.toLocaleString('pl-PL')} PLN</p>
        </div>
      </div>

      {/* --- BUDGET ASSIGNMENT COLUMNS --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* ARTISTS COLUMN */}
        <div className={`${STYLE_GLASS_CARD} flex flex-col h-[500px]`}>
          <div className="p-5 bg-white/40 border-b border-white/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 shadow-sm">
                  <Users size={14} className="text-[#002395]" aria-hidden="true" />
                </div>
                <h4 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-700">Honoraria Wokalne</h4>
            </div>
            {Object.keys(dirtyArtists).length > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse shadow-[0_0_10px_rgba(249,115,22,0.5)]" title="Niezapisane zmiany"></span>
            )}
          </div>
          
          <div className={STYLE_LIST_CONTAINER}>
            {projectParticipations.length > 0 ? projectParticipations.map((part) => {
              const artist = artists.find((a) => String(a.id) === String(part.artist));
              if (!artist) return null;
              
              const isCellDirty = dirtyArtists.hasOwnProperty(String(part.id));
              const currentFeeValue = isCellDirty ? dirtyArtists[String(part.id)] : part.fee;
              const voiceTypeDisplay = artist.voice_type_display || artist.voice_type || "Brak Danych";

              return (
                <div key={part.id} className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${isCellDirty ? 'bg-orange-50/30' : 'hover:bg-white/50'}`}>
                  <div>
                    <p className="font-bold text-stone-900 text-sm tracking-tight">{artist.first_name} {artist.last_name}</p>
                    <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mt-0.5">{voiceTypeDisplay}</p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <input 
                      type="number" min="0" step="50" placeholder="0" 
                      value={currentFeeValue || ''} 
                      onChange={(e) => handleFeeChange(part.id, e.target.value, 'artist')}
                      className={`w-28 px-3 py-2 text-right text-sm font-bold focus:outline-none transition-all ${isCellDirty ? 'border-orange-300 text-orange-700 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 bg-white shadow-sm rounded-xl' : `${STYLE_GLASS_INPUT} focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40`}`} 
                    />
                    <span className={`text-[10px] font-bold antialiased uppercase tracking-widest ${isCellDirty ? 'text-orange-500' : 'text-stone-400'}`}>PLN</span>
                  </div>
                </div>
              );
            }) : <p className="text-[11px] text-stone-400 italic p-8 text-center">Brak artystów w tym projekcie.</p>}
          </div>
        </div>

        {/* CREW COLUMN */}
        <div className={`${STYLE_GLASS_CARD} flex flex-col h-[500px]`}>
          <div className="p-5 bg-white/40 border-b border-white/60 flex items-center justify-between">
             <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-stone-100 flex items-center justify-center border border-stone-200 shadow-sm">
                  <Wrench size={14} className="text-stone-600" aria-hidden="true" />
                </div>
                <h4 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-700">Koszty Logistyki</h4>
             </div>
             {Object.keys(dirtyCrew).length > 0 && (
               <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse shadow-[0_0_10px_rgba(249,115,22,0.5)]" title="Niezapisane zmiany"></span>
             )}
          </div>
          
          <div className={STYLE_LIST_CONTAINER}>
            {projectCrewAssignments.length > 0 ? projectCrewAssignments.map((assign) => {
              const person = crew.find((c) => String(c.id) === String(assign.collaborator));
              if (!person) return null;
              
              const isCellDirty = dirtyCrew.hasOwnProperty(String(assign.id));
              const currentFeeValue = isCellDirty ? dirtyCrew[String(assign.id)] : assign.fee;

              return (
                <div key={assign.id} className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${isCellDirty ? 'bg-orange-50/30' : 'hover:bg-white/50'}`}>
                  <div>
                    <p className="font-bold text-stone-900 text-sm tracking-tight">{person.first_name} {person.last_name}</p>
                    <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mt-0.5">{assign.role_description || person.specialty}</p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <input 
                      type="number" min="0" step="50" placeholder="0" 
                      value={currentFeeValue || ''} 
                      onChange={(e) => handleFeeChange(assign.id, e.target.value, 'crew')}
                      className={`w-28 px-3 py-2 text-right text-sm font-bold focus:outline-none transition-all ${isCellDirty ? 'border-orange-300 text-orange-700 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 bg-white shadow-sm rounded-xl' : `${STYLE_GLASS_INPUT} focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40`}`} 
                    />
                    <span className={`text-[10px] font-bold antialiased uppercase tracking-widest ${isCellDirty ? 'text-orange-500' : 'text-stone-400'}`}>PLN</span>
                  </div>
                </div>
              );
            }) : <p className="text-[11px] text-stone-400 italic p-8 text-center">Brak ekipy technicznej.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}