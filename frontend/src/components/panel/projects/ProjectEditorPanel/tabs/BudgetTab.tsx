/**
 * @file BudgetTab.tsx
 * @description Financial estimation and fee assignment widget.
 * @architecture Enterprise 2026
 * - Implements Hybrid JIT Fetching (Context for dictionaries, React Query for relations).
 * - "Dirty State Tracking" strictly isolates API sync to mutated fields, preventing N+1 floods.
 * - Features Unified Floating Action Bar (FAB) for state commits and instant rollbacks.
 * BUGFIX: Replaced magic strings with centralized `queryKeys` for perfect cache synchronization.
 * @module project/ProjectEditorPanel/tabs/BudgetTab
 * @author Krystian Bugalski
 */

import React, { useState, useMemo, useContext } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Banknote, Users, Wrench, Sparkles, Save, AlertCircle } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import api from '../../../../../utils/api';
import { queryKeys } from '../../../../../utils/queryKeys';
import { ProjectDataContext, IProjectDataContext } from '../../ProjectDashboard';
import type { Participation, CrewAssignment } from '../../../../../types';

const extractData = (payload: any): any[] => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (payload.results && Array.isArray(payload.results)) return payload.results;
    return [];
};

interface BudgetTabProps {
  projectId: string;
}

const STYLE_GLASS_CARD = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl";
const STYLE_GLASS_INPUT = "bg-white/50 backdrop-blur-sm border border-stone-200/60 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";

export default function BudgetTab({ projectId }: BudgetTabProps): React.JSX.Element | null {
  const queryClient = useQueryClient();
  const context = useContext(ProjectDataContext) as IProjectDataContext;
  if (!context) return null;
  const { artists, crew } = context;

  // --- Safe JIT Data Fetching ---
  const { data: rawParticipations = [], isLoading: isLoadingParts } = useQuery({
    queryKey: queryKeys.participations.byProject(projectId),
    queryFn: async () => (await api.get(`/api/participations/?project=${projectId}`)).data,
    staleTime: 60000
  });

  const { data: rawCrew = [], isLoading: isLoadingCrew } = useQuery({
    queryKey: queryKeys.crewAssignments.byProject(projectId),
    queryFn: async () => (await api.get(`/api/crew-assignments/?project=${projectId}`)).data,
    staleTime: 60000
  });

  const participations = extractData(rawParticipations) as Participation[];
  const crewAssignments = extractData(rawCrew) as CrewAssignment[];

  const isLoading = isLoadingParts || isLoadingCrew;

  // --- Mutable Local State (Dirty Tracking) ---
  const [dirtyFees, setDirtyFees] = useState<Record<string, { type: 'cast' | 'crew', value: string }>>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleFeeChange = (id: string, value: string, type: 'cast' | 'crew') => {
    setDirtyFees(prev => ({ ...prev, [id]: { type, value } }));
  };

  const handleReset = () => {
    setDirtyFees({});
  };

  const handleBulkSave = async () => {
    const keys = Object.keys(dirtyFees);
    if (keys.length === 0) return;

    setIsSaving(true);
    const toastId = toast.loading(`Zapisywanie budżetu (${keys.length} modyfikacji)...`);

    try {
      const promises = keys.map(id => {
        const mutation = dirtyFees[id];
        const numericVal = mutation.value === '' ? null : parseFloat(mutation.value);
        const endpoint = mutation.type === 'cast' ? `/api/participations/${id}/` : `/api/crew-assignments/${id}/`;
        return api.patch(endpoint, { fee: numericVal });
      });

      await Promise.all(promises);
      
      // Cache invalidation za pomocą nowej fabryki kluczy
      await queryClient.invalidateQueries({ queryKey: queryKeys.participations.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.crewAssignments.all });
      
      setDirtyFees({});
      toast.success("Budżet zaktualizowany pomyślnie.", { id: toastId });
    } catch (err) {
      toast.error("Błąd zapisu", { id: toastId, description: "Nie udało się zapisać wszystkich stawek. Spróbuj ponownie." });
    } finally {
      setIsSaving(false);
    }
  };

  const isDirty = Object.keys(dirtyFees).length > 0;

  // --- Enriched Financial Datasets ---
  const enrichedCast = useMemo(() => {
    return participations
      .map(p => ({ ...p, artistData: artists.find(a => String(a.id) === String(p.artist)) }))
      .filter(p => p.artistData && p.status !== 'DEC')
      .sort((a, b) => a.artistData!.last_name.localeCompare(b.artistData!.last_name));
  }, [participations, artists]);

  const enrichedCrew = useMemo(() => {
    return crewAssignments
      .map(c => ({ ...c, crewData: crew.find(col => String(col.id) === String(c.collaborator)) }))
      .filter(c => c.crewData)
      .sort((a, b) => a.crewData!.last_name.localeCompare(b.crewData!.last_name));
  }, [crewAssignments, crew]);

  // --- KPI Calculations ---
  const kpi = useMemo(() => {
    let castTotal = 0;
    let crewTotal = 0;
    let missingCount = 0;

    enrichedCast.forEach(p => {
      const currentVal = dirtyFees[String(p.id)] ? dirtyFees[String(p.id)].value : String(p.fee || '');
      if (!currentVal) missingCount++;
      else castTotal += parseFloat(currentVal);
    });

    enrichedCrew.forEach(c => {
      const currentVal = dirtyFees[String(c.id)] ? dirtyFees[String(c.id)].value : String(c.fee || '');
      if (!currentVal) missingCount++;
      else crewTotal += parseFloat(currentVal);
    });

    return { castTotal, crewTotal, missingCount, grandTotal: castTotal + crewTotal };
  }, [enrichedCast, enrichedCrew, dirtyFees]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white/40 rounded-[2rem] border border-stone-200/60">
        <Loader2 size={32} className="animate-spin text-[#002395] mb-4" />
        <span className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500">Przeliczanie ksiąg...</span>
      </div>
    );
  }

  if (enrichedCast.length === 0 && enrichedCrew.length === 0) {
    return (
      <div className="text-center py-20 bg-white/40 rounded-[2rem] border border-dashed border-stone-300/60">
        <Banknote size={48} className="mx-auto mb-4 opacity-30 text-stone-400" />
        <span className="text-[11px] font-bold antialiased uppercase tracking-widest text-stone-500 block mb-2">Brak personelu do wyceny</span>
        <span className="text-xs text-stone-400 max-w-sm mx-auto block leading-relaxed">Dodaj najpierw wykonawców w zakładkach "Obsada" lub "Ekipa Techniczna", aby móc przydzielać stawki.</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24">
      {/* KPI DASHBOARD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-[#0a0a0a] rounded-[2rem] p-6 relative overflow-hidden group shadow-[0_20px_40px_rgba(0,0,0,0.2)] border border-stone-800">
              <div className="absolute -top-16 -right-16 w-48 h-48 bg-[#002395] rounded-full blur-[60px] opacity-50 pointer-events-none transition-transform duration-1000 group-hover:scale-125"></div>
              <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-blue-300 mb-1.5 relative z-10 flex items-center gap-1.5"><Sparkles size={12}/> Budżet Produkcji</p>
              <p className="text-3xl font-black text-white tracking-tight relative z-10">{kpi.grandTotal.toLocaleString('pl-PL')} PLN</p>
          </div>
          <div className={`${STYLE_GLASS_CARD} p-6 flex flex-col justify-center`}>
              <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-[#002395]/70 mb-1.5 flex items-center gap-1.5"><Users size={12}/> Koszty Artystyczne</p>
              <p className="text-2xl font-black text-[#002395] tracking-tight">{kpi.castTotal.toLocaleString('pl-PL')} PLN</p>
          </div>
          <div className={`${STYLE_GLASS_CARD} p-6 flex flex-col justify-center relative overflow-hidden`}>
              <p className={`text-[9px] font-bold antialiased uppercase tracking-widest mb-1.5 flex items-center gap-1.5 ${kpi.missingCount > 0 ? 'text-orange-600' : 'text-stone-400'}`}>
                {kpi.missingCount > 0 ? <AlertCircle size={12}/> : <Wrench size={12}/>} Koszty Logistyczne
              </p>
              <div className="flex items-end justify-between">
                <p className="text-2xl font-black text-stone-800 tracking-tight">{kpi.crewTotal.toLocaleString('pl-PL')} PLN</p>
                {kpi.missingCount > 0 && <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded-md border border-orange-100">Braki: {kpi.missingCount}</span>}
              </div>
          </div>
      </div>

      {/* DOUBLE TABLES */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        
        {/* CAST TABLE */}
        <div className="bg-white/60 backdrop-blur-xl border border-stone-200/80 rounded-[2rem] overflow-hidden shadow-sm flex flex-col">
          <div className="p-5 border-b border-stone-200/60 bg-stone-50/50 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#002395] flex items-center justify-center border border-blue-100 shadow-sm"><Users size={14}/></div>
            <h3 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-800">Obsada Artystyczna</h3>
          </div>
          <div className="overflow-auto flex-1 max-h-[60vh] scrollbar-hide">
            <table className="w-full text-left border-collapse min-w-[400px]">
              <tbody className="divide-y divide-stone-100/80">
                {enrichedCast.map(part => {
                  const person = part.artistData!;
                  const isCellDirty = dirtyFees[String(part.id)] !== undefined;
                  const currentFeeValue = isCellDirty ? dirtyFees[String(part.id)].value : String(part.fee || '');
                  
                  return (
                    <tr key={part.id} className={`transition-colors ${isCellDirty ? 'bg-orange-50/30' : 'hover:bg-white/50'}`}>
                      <td className="p-4">
                        <p className="font-bold text-stone-900 text-sm tracking-tight">{person.first_name} {person.last_name}</p>
                        <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mt-0.5">{person.voice_type_display || person.voice_type}</p>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          <input 
                            type="number" min="0" step="50" placeholder="0" 
                            value={currentFeeValue || ''} 
                            onChange={(e) => handleFeeChange(String(part.id), e.target.value, 'cast')}
                            className={`w-28 px-3 py-2 text-right text-sm font-bold focus:outline-none transition-all ${isCellDirty ? 'border-orange-300 text-orange-700 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 bg-white shadow-sm rounded-xl' : `${STYLE_GLASS_INPUT} focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40`}`} 
                          />
                          <span className={`text-[10px] font-bold antialiased uppercase tracking-widest ${isCellDirty ? 'text-orange-500' : 'text-stone-400'}`}>PLN</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* CREW TABLE */}
        <div className="bg-white/60 backdrop-blur-xl border border-stone-200/80 rounded-[2rem] overflow-hidden shadow-sm flex flex-col">
          <div className="p-5 border-b border-stone-200/60 bg-stone-50/50 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-600 flex items-center justify-center border border-stone-200 shadow-sm"><Wrench size={14}/></div>
            <h3 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-800">Ekipa i Logistyka</h3>
          </div>
          <div className="overflow-auto flex-1 max-h-[60vh] scrollbar-hide">
            {enrichedCrew.length === 0 ? (
                <div className="p-10 text-center text-stone-400 text-xs italic">Brak przypisanej ekipy technicznej.</div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[400px]">
                <tbody className="divide-y divide-stone-100/80">
                  {enrichedCrew.map(assign => {
                    const person = assign.crewData!;
                    const isCellDirty = dirtyFees[String(assign.id)] !== undefined;
                    const currentFeeValue = isCellDirty ? dirtyFees[String(assign.id)].value : String(assign.fee || '');
                    
                    return (
                      <tr key={assign.id} className={`transition-colors ${isCellDirty ? 'bg-orange-50/30' : 'hover:bg-white/50'}`}>
                        <td className="p-4">
                          <p className="font-bold text-stone-900 text-sm tracking-tight">{person.first_name} {person.last_name}</p>
                          <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mt-0.5">{assign.role_description || person.specialty}</p>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2.5">
                            <input 
                              type="number" min="0" step="50" placeholder="0" 
                              value={currentFeeValue || ''} 
                              onChange={(e) => handleFeeChange(String(assign.id), e.target.value, 'crew')}
                              className={`w-28 px-3 py-2 text-right text-sm font-bold focus:outline-none transition-all ${isCellDirty ? 'border-orange-300 text-orange-700 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 bg-white shadow-sm rounded-xl' : `${STYLE_GLASS_INPUT} focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40`}`} 
                            />
                            <span className={`text-[10px] font-bold antialiased uppercase tracking-widest ${isCellDirty ? 'text-orange-500' : 'text-stone-400'}`}>PLN</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

      {/* FLOATING ACTION BAR (FAB) */}
      <AnimatePresence>
        {isDirty && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 p-3 bg-white/90 backdrop-blur-xl border border-stone-200 shadow-[0_10px_40px_rgba(0,0,0,0.1)] rounded-2xl"
          >
            <div className="px-3 flex items-center gap-2 text-orange-600">
              <AlertCircle size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Niezapisane zmiany</span>
            </div>
            <div className="w-px h-8 bg-stone-200/80"></div>
            <button 
              onClick={handleReset}
              disabled={isSaving}
              className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-xl transition-all disabled:opacity-50"
            >
              Odrzuć
            </button>
            <button 
              onClick={handleBulkSave}
              disabled={isSaving}
              className="px-6 py-2.5 bg-[#002395] hover:bg-[#001766] text-white text-[10px] font-bold uppercase tracking-widest rounded-xl shadow-[0_4px_14px_rgba(0,35,149,0.3)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.4)] transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Zapisz do bazy
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}