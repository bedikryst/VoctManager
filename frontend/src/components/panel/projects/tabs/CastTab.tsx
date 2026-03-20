/**
 * @file CastTab.tsx
 * @description Primary Casting Manager Module.
 * @architecture
 * Assigns active artists to the project via the 'Participation' junction table.
 * Consumes ProjectDataContext directly to prevent redundant API calls.
 * Utilizes useMemo for roster filtering and Sonner for interactive mutation feedback.
 * @module project/tabs/CastTab
 * @author Krystian Bugalski
 */

import React, { useMemo } from 'react';
import { MicVocal, BookOpen, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

import api from '../../../../utils/api';
import { useProjectData } from '../../../../hooks/useProjectData';
import type { Artist, Participation } from '../../../../types';

interface CastTabProps {
  projectId: string;
}

const STYLE_GLASS_CARD = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl overflow-hidden";

export default function CastTab({ projectId }: CastTabProps): React.JSX.Element | null {
  const queryClient = useQueryClient();
  const { artists, participations } = useProjectData(projectId);

  // --- Derived Data (Memoized) ---
  const activeArtists = useMemo<Artist[]>(() => {
    return artists.filter((a) => a.is_active !== false); 
  }, [artists]);

  const projectParticipations = useMemo<Participation[]>(() => {
    return participations.filter((p) => String(p.project) === String(projectId));
  }, [participations, projectId]);

  const toggleCasting = async (
    artistId: string | number, 
    isCurrentlyCasted: boolean, 
    participationId?: string | number
  ): Promise<void> => {
    const actionLabel = isCurrentlyCasted ? "Usuwanie z obsady..." : "Dodawanie do obsady...";
    const toastId = toast.loading(actionLabel);

    try {
      if (isCurrentlyCasted && participationId) {
        await api.delete(`/api/participations/${participationId}/`);
      } else {
        await api.post('/api/participations/', { artist: artistId, project: projectId, status: 'INV' });
      }
      
      // Zamiast fetchGlobal() odświeżamy w tle tylko dany wpis!
      await queryClient.invalidateQueries({ queryKey: ['participations', projectId] }); 
      
      toast.success(isCurrentlyCasted ? "Usunięto z obsady" : "Dodano do obsady", { id: toastId });
    } catch (err) { 
      toast.error("Błąd zapisu", { id: toastId, description: "Wystąpił problem z połączeniem z bazą danych." });
    }
  };

  return (
    <div className={`${STYLE_GLASS_CARD} max-w-3xl mx-auto`}>
      <div className="p-5 bg-white/40 border-b border-white/60 flex justify-between items-center relative z-10">
        <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 shadow-sm">
                <Users size={14} className="text-[#002395]" aria-hidden="true" />
            </div>
            <h4 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-700">Dostępni Chórzyści</h4>
        </div>
        <span className="text-[9px] uppercase font-bold antialiased tracking-widest text-[#002395] bg-white px-3 py-1.5 rounded-lg border border-blue-100 shadow-sm">
          Zatrudniono: {projectParticipations.length}
        </span>
      </div>
      
      <div className="divide-y divide-stone-100/50 max-h-[600px] overflow-y-auto scrollbar-hide">
        {activeArtists.length > 0 ? activeArtists.map((artist) => {
          const participation = projectParticipations.find((p) => String(p.artist) === String(artist.id));
          const isCurrentlyCasted = !!participation;
          
          const voiceTypeDisplay = (artist as any).voice_type_display || (artist as any).voice_type || "Brak typu";
          const rangeBottom = (artist as any).vocal_range_bottom;
          const rangeTop = (artist as any).vocal_range_top;
          const sightReading = (artist as any).sight_reading_skill;
          
          return (
            <div key={artist.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-5 transition-colors gap-4 ${isCurrentlyCasted ? 'bg-blue-50/20' : 'hover:bg-white/50'}`}>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <p className="font-bold text-stone-900 text-sm tracking-tight">{artist.first_name} {artist.last_name}</p>
                  <span className="text-[8px] font-bold antialiased uppercase tracking-[0.2em] text-stone-500 bg-stone-100/80 px-2 py-1 rounded-md shadow-sm border border-stone-200/50">
                    {voiceTypeDisplay}
                  </span>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400">
                  {(rangeBottom || rangeTop) && (
                    <span className="flex items-center gap-1.5">
                      <MicVocal size={12} className="text-[#002395]/60" aria-hidden="true" />
                      <span>Skala: <strong className="text-stone-600">{rangeBottom || '?'} - {rangeTop || '?'}</strong></span>
                    </span>
                  )}
                  {sightReading && (
                    <span className="flex items-center gap-1.5">
                      <BookOpen size={12} className="text-[#002395]/60" aria-hidden="true" />
                      <span>A vista: <strong className="text-stone-600">{sightReading}/5</strong></span>
                    </span>
                  )}
                </div>
              </div>
              
              <button 
                onClick={() => toggleCasting(artist.id, isCurrentlyCasted, participation?.id)} 
                className={`flex justify-center items-center gap-2 px-5 py-2.5 rounded-xl text-[9px] uppercase font-bold antialiased tracking-[0.15em] transition-all shadow-sm active:scale-95 ${
                  isCurrentlyCasted 
                  ? 'bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300' 
                  : 'bg-[#002395] border border-[#001766] text-white hover:bg-[#001766] shadow-[0_4px_10px_rgba(0,35,149,0.2)]'
                }`}
              >
                {isCurrentlyCasted ? 'Usuń z obsady' : 'Dodaj do projektu'}
              </button>
            </div>
          );
        }) : (
          <div className="p-8 text-center">
            <p className="text-xs text-stone-400 italic">Brak aktywnych chórzystów w bazie.</p>
          </div>
        )}
      </div>
    </div>
  );
}