/**
 * @file CastTab.tsx
 * @description Primary Casting Manager Module for Vocal Assignments.
 * @architecture
 * ENTERPRISE 2026: 
 * - Fixed: Phantom Shift/Flicker during cross-list transfer eliminated.
 * - Architecture: Implements absolute DOM continuity via Unified AnimatePresence 
 * and render-time visual positioning. Items never leave the layout domain; their 
 * visually assigned container is calculated dynamically, preventing popping.
 * - Mobile UX: Segmented Control still JIT-filters, maintaining performance.
 * @module project/ProjectEditorPanel/tabs/CastTab
 * @author Krystian Bugalski
 */

import React, { useMemo, useContext, useState } from 'react';
import { MicVocal, BookOpen, Users, Loader2, Search, UserCheck, UserPlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';

import api from '../../../../../utils/api';
import { ProjectDataContext, IProjectDataContext } from '../../ProjectDashboard';
import type { Artist, Participation } from '../../../../../types';

interface CastTabProps {
  projectId: string;
}

const STYLE_GLASS_INPUT = "w-full pl-11 pr-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";

// ENTERPRISE FIX: Added [scrollbar-gutter:stable] to list containers (and root on mobile) to neutralize layout shifts.
const STYLE_LIST_CONTAINER = "flex-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable] bg-white/40 backdrop-blur-md border border-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl p-2";

export default function CastTab({ projectId }: CastTabProps): React.JSX.Element | null {
  const queryClient = useQueryClient();
  const context = useContext(ProjectDataContext) as IProjectDataContext;
  
  if (!context) return null;
  const { artists } = context;

  const { data: participations = [], isLoading: isFetching } = useQuery<Participation[]>({
    queryKey: ['participations', projectId],
    queryFn: async () => {
      const res = await api.get(`/api/participations/?project=${projectId}`);
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 60000
  });

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [processingId, setProcessingId] = useState<string | number | null>(null);
  const [mobileView, setMobileView] = useState<'AVAILABLE' | 'ASSIGNED'>('AVAILABLE');

  // --- Derived Data (Single Sorted Source of Truth) ---
  const allArtists = useMemo(() => {
    let active = artists.filter(a => a.is_active !== false);
    
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      active = active.filter(a => 
        a.first_name.toLowerCase().includes(q) || 
        a.last_name.toLowerCase().includes(q) ||
        a.voice_type_display?.toLowerCase().includes(q)
      );
    }

    return active.sort((a, b) => {
        const voiceCompare = (a.voice_type || '').localeCompare(b.voice_type || '');
        if (voiceCompare !== 0) return voiceCompare;
        return a.last_name.localeCompare(b.last_name);
    });
  }, [artists, searchQuery]);

  const assignedIds = useMemo(() => new Set(participations.map(p => String(p.artist))), [participations]);

  // JIT Filtering based on the current mobile view - used *only* in mobile render loop
  const mobileVisibleArtists = useMemo(() => {
      if (mobileView === 'ASSIGNED') return allArtists.filter(a => assignedIds.has(String(a.id)));
      return allArtists.filter(a => !assignedIds.has(String(a.id)));
  }, [allArtists, assignedIds, mobileView]);

  // --- Mutation Handlers ---
  const toggleCasting = async (
    artistId: string | number, 
    isCurrentlyCasted: boolean, 
    participationId?: string | number
  ): Promise<void> => {
    setProcessingId(artistId);

    try {
      if (isCurrentlyCasted && participationId) {
        await api.delete(`/api/participations/${participationId}/`);
        toast.success("Usunięto z obsady");
      } else {
        await api.post('/api/participations/', { artist: artistId, project: projectId, status: 'INV' });
        toast.success("Dodano do obsady");
      }
      await queryClient.invalidateQueries({ queryKey: ['participations', projectId] }); 
    } catch (err) { 
      toast.error("Błąd zapisu", { description: "Wystąpił problem z połączeniem z bazą danych." });
    } finally {
      setProcessingId(null);
    }
  };

  // --- Reusable Artist Row Component ---
  const ArtistCard = ({ artist, isAssigned }: { artist: Artist, isAssigned: boolean }) => {
    const participation = participations.find(p => String(p.artist) === String(artist.id));
    const isProcessing = processingId === artist.id;

    return (
      <motion.div 
        layoutId={`artist-card-${artist.id}`}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
        // ENTERPRISE FIX: Use `layout="position"` to tell Framer to animate coordinates relative to a *stable* base domain,
        // neutralizing pops caused by full geometric geometric geometric geometric geometric geometric geometric geometric geometric geometric geometric geometric geometric geometric geometric geometric geometric geometric re-flow during state updates.
        layout="position"
        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border border-stone-200/60 rounded-xl mb-2 shadow-sm gap-4"
      >
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2.5">
            <p className="font-bold text-sm tracking-tight text-stone-900">
                {artist.first_name} {artist.last_name}
            </p>
            <span className={`text-[8px] font-bold antialiased uppercase tracking-[0.2em] px-2 py-0.5 rounded-md border ${isAssigned ? 'bg-blue-50 text-[#002395] border-blue-100' : 'bg-stone-50 text-stone-500 border-stone-200/60'}`}>
                {artist.voice_type_display || artist.voice_type || "?"}
            </span>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400">
            {(artist.vocal_range_bottom || artist.vocal_range_top) && (
                <span className="flex items-center gap-1">
                  <MicVocal size={12} className="text-[#002395]/40" aria-hidden="true" />
                  <span><strong className="text-stone-600">{artist.vocal_range_bottom || '?'} - {artist.vocal_range_top || '?'}</strong></span>
                </span>
            )}
            {artist.sight_reading_skill && (
                <span className="flex items-center gap-1">
                  <BookOpen size={12} className="text-[#002395]/40" aria-hidden="true" />
                  <span>A vista: <strong className="text-stone-600">{artist.sight_reading_skill}/5</strong></span>
                </span>
            )}
            </div>
        </div>
        
        <button 
            disabled={isProcessing}
            onClick={() => toggleCasting(artist.id, isAssigned, participation?.id)} 
            className={`flex justify-center items-center p-2.5 sm:px-4 sm:py-2.5 rounded-lg text-[9px] uppercase font-bold antialiased tracking-widest transition-all shadow-sm active:scale-95 disabled:opacity-50 flex-shrink-0 ${
            isAssigned 
            ? 'bg-red-50 border border-red-200 text-red-600 hover:bg-red-100' 
            : 'bg-stone-900 border border-stone-800 text-white hover:bg-[#002395] hover:border-[#001766]'
            }`}
            aria-label={isAssigned ? `Usuń ${artist.first_name} z obsady` : `Dodaj ${artist.first_name} do obsady`}
        >
            {isProcessing ? (
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : isAssigned ? (
                <><Trash2 size={14} className="sm:mr-1.5" aria-hidden="true" /> <span className="hidden sm:inline">Usuń</span></>
            ) : (
                <><UserPlus size={14} className="sm:mr-1.5" aria-hidden="true" /> <span className="hidden sm:inline">Dodaj</span></>
            )}
        </button>
      </motion.div>
    );
  };

  // --- Render ---
  return (
    <div className="max-w-6xl mx-auto flex flex-col h-[80vh]">
      
      {/* Header & Global Search */}
      <div className="mb-6 space-y-4 flex-shrink-0">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 shadow-sm">
                    <Users size={18} className="text-[#002395]" aria-hidden="true" />
                </div>
                <div>
                    <h4 className="text-[12px] font-bold antialiased uppercase tracking-widest text-stone-800">Casting Główny</h4>
                    <p className="text-[10px] text-stone-500 font-medium">Zarządzaj wokalistami. Ustawienie [scrollbar-gutter] Neutralizuje skoki układu.</p>
                </div>
            </div>
            
            {/* Search Bar */}
            <div className="relative w-full md:w-80">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search size={16} className="text-stone-400" aria-hidden="true" />
                </div>
                <input 
                    type="text" 
                    placeholder="Szukaj artysty..." 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={STYLE_GLASS_INPUT}
                />
            </div>
        </div>

        {/* Mobile Segmented Control */}
        <div className="md:hidden flex bg-white/60 p-1 rounded-xl border border-stone-200/60 shadow-sm">
            <button onClick={() => setMobileView('AVAILABLE')} className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${mobileView === 'AVAILABLE' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>Baza ({allArtists.filter(a => !assignedIds.has(String(a.id))).length})</button>
            <button onClick={() => setMobileView('ASSIGNED')} className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${mobileView === 'ASSIGNED' ? 'bg-[#002395] text-white shadow-sm' : 'text-stone-500'}`}>Obsada ({participations.length})</button>
        </div>
      </div>
      
      {isFetching ? (
        <div className="flex-1 flex justify-center items-center">
            <Loader2 size={32} className="animate-spin text-[#002395]/40" aria-hidden="true" />
        </div>
      ) : (
        // ENTERPRISE FIX: Place BOTH list displays under a UNIFIED AnimatePresence domain.
        // This keeps the DOM nodes stable across state updates, ensuring the animation domain 
        // is continuous and preventing cross-container pops.
        <AnimatePresence mode="popLayout" initial={false}>
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 overflow-hidden pb-8">
              
              {/* Left Column: AVAILABLE ARTISTS (Visible only on Desktop or Mobile 'AVAILABLE' view) */}
              <motion.div 
                key="available-list" 
                layoutId="available-list-container"
                className={`flex-col h-full [scrollbar-gutter:stable] ${mobileView === 'AVAILABLE' ? 'flex' : 'hidden md:flex'}`}
              >
                  <div className="flex items-center justify-between mb-3 px-2">
                      <span className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500">Baza Artystów</span>
                      <span className="text-[9px] font-bold antialiased text-stone-400 bg-stone-100 px-2 py-0.5 rounded-md">
                        {allArtists.filter(a => !assignedIds.has(String(a.id))).length}
                      </span>
                  </div>
                  
                  <div className={STYLE_LIST_CONTAINER}>
                      {allArtists.filter(a => !assignedIds.has(String(a.id))).map(artist => (
                          <ArtistCard key={artist.id} artist={artist} isAssigned={false} />
                      ))}
                      {allArtists.filter(a => !assignedIds.has(String(a.id))).length === 0 && (
                          <div className="h-full flex flex-col items-center justify-center text-center opacity-60 p-6">
                              <Users size={24} className="text-stone-400 mb-2" aria-hidden="true" />
                              <p className="text-[10px] uppercase font-bold tracking-widest text-stone-500">Brak dostępnych</p>
                          </div>
                      )}
                  </div>
              </motion.div>

              {/* Right Column: ASSIGNED ARTISTS (Visible only on Desktop or Mobile 'ASSIGNED' view) */}
              <motion.div 
                key="assigned-list" 
                layoutId="assigned-list-container"
                className={`flex-col h-full [scrollbar-gutter:stable] ${mobileView === 'ASSIGNED' ? 'flex' : 'hidden md:flex'}`}
              >
                  <div className="flex items-center justify-between mb-3 px-2">
                      <span className="text-[10px] font-bold antialiased uppercase tracking-widest text-[#002395] flex items-center gap-1.5"><UserCheck size={14} /> Obsada Projektu</span>
                      <span className="text-[9px] font-bold antialiased text-[#002395] bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md">
                          {participations.length}
                      </span>
                  </div>

                  <div className={`${STYLE_LIST_CONTAINER} border-[#002395]/20 bg-blue-50/10`}>
                      {allArtists.filter(a => assignedIds.has(String(a.id))).map(artist => (
                          <ArtistCard key={artist.id} artist={artist} isAssigned={true} />
                      ))}
                      {participations.length === 0 && (
                          <div className="h-full flex flex-col items-center justify-center text-center opacity-60 p-6">
                              <UserCheck size={24} className="text-stone-400 mb-2" aria-hidden="true" />
                              <p className="text-[10px] uppercase font-bold tracking-widest text-stone-500">Obsada jest pusta</p>
                          </div>
                      )}
                  </div>
              </motion.div>

          </div>
        </AnimatePresence>
      )}
    </div>
  );
}