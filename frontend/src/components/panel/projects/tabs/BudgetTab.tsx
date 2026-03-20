/**
 * @file BudgetTab.tsx
 * @description Financial estimation and fee assignment widget.
 * @architecture
 * Implements "Dirty State Tracking" to defer API syncing only to fields mutated by the user, 
 * neutralizing N+1 request flooding on large rosters.
 * Uses useMemo for heavy budget recalculations and Sonner for mutation feedback.
 * @module project/tabs/BudgetTab
 * @author Krystian Bugalski
 */
import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Loader2, Banknote, Users, Wrench, Sparkles } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import api from '../../../../utils/api';
import { useProjectData } from '../../../../hooks/useProjectData';
import type { Participation, CrewAssignment } from '../../../../types';

interface BudgetTabProps {
  projectId: string;
}

const STYLE_GLASS_CARD = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl overflow-hidden";
const STYLE_GLASS_INPUT = "bg-white/50 backdrop-blur-sm border border-stone-200/60 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] rounded-xl";

export default function BudgetTab({ projectId }: BudgetTabProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const { participations, crewAssignments, artists, crew } = useProjectData(projectId);

  const [dirtyArtists, setDirtyArtists] = useState<Record<string, number | null>>({}); 
  const [dirtyCrew, setDirtyCrew] = useState<Record<string, number | null>>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const projectParticipations = useMemo<Participation[]>(() => {
    return participations.filter((p) => String(p.project) === String(projectId));
  }, [participations, projectId]);

  const projectCrewAssignments = useMemo<CrewAssignment[]>(() => {
    return crewAssignments.filter((a) => String(a.project) === String(projectId));
  }, [crewAssignments, projectId]);

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

  const handleFeeChange = (id: string | number, value: string, type: 'artist' | 'crew'): void => {
    const numericValue = value ? parseInt(value, 10) : null;
    const stringId = String(id);
    if (type === 'artist') setDirtyArtists((prev) => ({ ...prev, [stringId]: numericValue }));
    else setDirtyCrew((prev) => ({ ...prev, [stringId]: numericValue }));
  };

  const handleSaveBudget = async (): Promise<void> => {
    const modifiedArtistIds = Object.keys(dirtyArtists);
    const modifiedCrewIds = Object.keys(dirtyCrew);

    if (modifiedArtistIds.length === 0 && modifiedCrewIds.length === 0) return;

    setIsSaving(true);
    const toastId = toast.loading("Zapisywanie kosztorysu...");

    try {
      const syncPromises: Promise<any>[] = [];
      
      modifiedArtistIds.forEach((id) => syncPromises.push(api.patch(`/api/participations/${id}/`, { fee: dirtyArtists[id] })));
      modifiedCrewIds.forEach((id) => syncPromises.push(api.patch(`/api/crew-assignments/${id}/`, { fee: dirtyCrew[id] })));
      
      await Promise.all(syncPromises);
      
      // Inwalidacja obu kluczy
      await queryClient.invalidateQueries({ queryKey: ['participations', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['crewAssignments', projectId] });

      setDirtyArtists({});
      setDirtyCrew({});
      toast.success(`Zapisano zmiany dla ${syncPromises.length} osób.`, { id: toastId });
    } catch (err) {
      toast.error("Błąd podczas zapisu", { id: toastId, description: "Nie udało się zapisać wszystkich zmian w budżecie." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          <div className="divide-y divide-stone-100/50 flex-1 overflow-y-auto scrollbar-hide">
            {projectParticipations.length > 0 ? projectParticipations.map((part) => {
              const artist = artists.find((a) => String(a.id) === String(part.artist));
              if (!artist) return null;
              
              const isDirty = dirtyArtists.hasOwnProperty(String(part.id));
              const currentFeeValue = isDirty ? dirtyArtists[String(part.id)] : part.fee;
              const voiceTypeDisplay = (artist as any).voice_type_display || (artist as any).voice_type || "N/A";

              return (
                <div key={part.id} className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${isDirty ? 'bg-orange-50/20' : 'hover:bg-white/50'}`}>
                  <div>
                    <p className="font-bold text-stone-900 text-sm tracking-tight">{artist.first_name} {artist.last_name}</p>
                    <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mt-0.5">{voiceTypeDisplay}</p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <input 
                      type="number" min="0" step="50" placeholder="0" 
                      value={currentFeeValue || ''} 
                      onChange={(e) => handleFeeChange(part.id, e.target.value, 'artist')}
                      className={`w-28 px-3 py-2 text-right text-sm focus:outline-none transition-all ${isDirty ? 'border-orange-300 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 bg-white shadow-sm rounded-xl' : `${STYLE_GLASS_INPUT} focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40`}`} 
                    />
                    <span className={`text-[10px] font-bold antialiased uppercase tracking-widest ${isDirty ? 'text-orange-500' : 'text-stone-400'}`}>PLN</span>
                  </div>
                </div>
              );
            }) : <p className="text-[11px] text-stone-400 italic p-8 text-center">Brak artystów w tym projekcie.</p>}
          </div>
        </div>

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
          <div className="divide-y divide-stone-100/50 flex-1 overflow-y-auto scrollbar-hide">
            {projectCrewAssignments.length > 0 ? projectCrewAssignments.map((assign) => {
              const person = crew.find((c) => String(c.id) === String(assign.collaborator));
              if (!person) return null;
              
              const isDirty = dirtyCrew.hasOwnProperty(String(assign.id));
              const currentFeeValue = isDirty ? dirtyCrew[String(assign.id)] : assign.fee;

              return (
                <div key={assign.id} className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${isDirty ? 'bg-orange-50/20' : 'hover:bg-white/50'}`}>
                  <div>
                    <p className="font-bold text-stone-900 text-sm tracking-tight">{person.first_name} {person.last_name}</p>
                    <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mt-0.5">{assign.role_description || person.specialty}</p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <input 
                      type="number" min="0" step="50" placeholder="0" 
                      value={currentFeeValue || ''} 
                      onChange={(e) => handleFeeChange(assign.id, e.target.value, 'crew')}
                      className={`w-28 px-3 py-2 text-right text-sm focus:outline-none transition-all ${isDirty ? 'border-orange-300 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 bg-white shadow-sm rounded-xl' : `${STYLE_GLASS_INPUT} focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40`}`} 
                    />
                    <span className={`text-[10px] font-bold antialiased uppercase tracking-widest ${isDirty ? 'text-orange-500' : 'text-stone-400'}`}>PLN</span>
                  </div>
                </div>
              );
            }) : <p className="text-[11px] text-stone-400 italic p-8 text-center">Brak ekipy technicznej.</p>}
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-stone-200/50">
        <button 
          onClick={handleSaveBudget} 
          disabled={isSaving || (Object.keys(dirtyArtists).length === 0 && Object.keys(dirtyCrew).length === 0)} 
          className="w-full md:w-auto md:min-w-[240px] md:mx-auto py-4 px-8 bg-[#002395] hover:bg-[#001766] disabled:bg-stone-300 disabled:text-stone-500 text-white text-[10px] font-bold antialiased uppercase tracking-widest rounded-xl transition-all shadow-[0_4px_14px_rgba(0,35,149,0.2)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.3)] disabled:shadow-none flex justify-center items-center gap-2 active:scale-95"
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Banknote size={16} aria-hidden="true" />}
          {isSaving ? 'Zapisywanie...' : 'Zapisz Kosztorys'}
        </button>
      </div>
    </div>
  );
}