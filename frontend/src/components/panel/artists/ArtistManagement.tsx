/**
 * @file ArtistManagement.tsx
 * @description HR & Roster Management Module Controller.
 * @architecture
 * ENTERPRISE 2026: 
 * Upgraded from Accordion List to a high-density Card Grid view for superior glanceability.
 * Implements React Query (useQueries) for parallel data fetching.
 * Delegates rendering to isolated, memoized <ArtistCard /> components preventing monolithic re-renders.
 * @module hr/ArtistManagement
 * @author Krystian Bugalski
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { UserPlus, Search, Filter, Users } from 'lucide-react';

import api from '../../../utils/api';
import ConfirmModal from '../../../components/ui/ConfirmModal';
import ArtistEditorPanel from './ArtistEditorPanel';
import { ArtistCard } from './ArtistCard';

import type { Artist } from '../../../types';

interface VoiceTypeOption {
  value: string;
  label: string;
}

const STYLE_GLASS_INPUT = "w-full pl-11 pr-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";

export default function ArtistManagement(): React.JSX.Element {
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [voiceFilter, setVoiceFilter] = useState<string>('');

  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [editingArtist, setEditingArtist] = useState<Artist | null>(null);
  const [initialSearchContext, setInitialSearchContext] = useState<string>('');

  const [artistToToggle, setArtistToToggle] = useState<{ id: string, willBeActive: boolean } | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState<boolean>(false);

  const results = useQueries({
    queries: [
      { queryKey: ['artists'], queryFn: async () => (await api.get('/api/artists/')).data },
      { queryKey: ['voiceTypes'], queryFn: async () => (await api.get('/api/options/voice-types/')).data }
    ]
  });

  const isLoading = results.some(query => query.isLoading);
  const isError = results.some(query => query.isError);

  const artists: Artist[] = Array.isArray(results[0].data) ? results[0].data : [];
  const voiceTypes: VoiceTypeOption[] = Array.isArray(results[1].data) ? results[1].data : [];

  useEffect(() => {
    if (isError) {
      toast.error("Ostrzeżenie", { description: "Nie udało się pobrać danych o artystach." });
    }
  }, [isError]);

  useEffect(() => {
    document.body.style.overflow = isPanelOpen || artistToToggle ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isPanelOpen, artistToToggle]);

  const activeArtists = useMemo(() => artists.filter(a => a.is_active), [artists]);
  
  const ensembleBalance = useMemo(() => {
      return {
          S: activeArtists.filter(a => a.voice_type?.startsWith('S')).length,
          A: activeArtists.filter(a => a.voice_type?.startsWith('A') || a.voice_type === 'MEZ').length,
          T: activeArtists.filter(a => a.voice_type?.startsWith('T') || a.voice_type === 'CT').length,
          B: activeArtists.filter(a => a.voice_type?.startsWith('B')).length,
          Total: activeArtists.length
      };
  }, [activeArtists]);

  const displayArtists = useMemo(() => {
      return artists.filter(a => {
          const matchesSearch = `${a.first_name} ${a.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());
          const matchesVoice = voiceFilter ? (a.voice_type === voiceFilter || a.voice_type?.startsWith(voiceFilter)) : true;
          return matchesSearch && matchesVoice;
      });
  }, [artists, searchTerm, voiceFilter]);


  const openPanel = useCallback((artist: Artist | null = null, initialNameContext: string = '') => {
    setEditingArtist(artist);
    setInitialSearchContext(initialNameContext);
    setIsPanelOpen(true);
  }, []);

  const closePanel = useCallback(() => {
      setIsPanelOpen(false);
      setTimeout(() => {
          setEditingArtist(null);
          setInitialSearchContext('');
      }, 300);
  }, []);

  const handleToggleRequest = useCallback((id: string, willBeActive: boolean) => {
      setArtistToToggle({ id, willBeActive });
  }, []);

  const executeStatusToggle = async () => {
    if (!artistToToggle) return;
    setIsTogglingStatus(true);
    const toastId = toast.loading(artistToToggle.willBeActive ? "Aktywowanie konta..." : "Archiwizowanie artysty...");

    try {
      await api.patch(`/api/artists/${artistToToggle.id}/`, { is_active: artistToToggle.willBeActive });
      await queryClient.invalidateQueries({ queryKey: ['artists'] });
      toast.success(artistToToggle.willBeActive ? "Konto artysty aktywowane" : "Artysta zarchiwizowany", { id: toastId });
    } catch (err) { 
      toast.error("Błąd systemu", { id: toastId, description: "Nie udało się zmienić statusu artysty." });
    } finally {
      setIsTogglingStatus(false);
      setArtistToToggle(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in relative cursor-default pb-12 max-w-7xl mx-auto px-4 sm:px-0">
      
      <header className="relative pt-2 mb-8">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-5">
                  <div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-4">
                          <Users size={12} className="text-[#002395]" aria-hidden="true" />
                          <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-[#002395]/80">Zasoby Ludzkie</p>
                      </div>
                      <h1 className="text-3xl md:text-4xl font-medium text-stone-900 leading-tight tracking-tight" style={{ fontFamily: "'Cormorant', serif" }}>
                          Zarządzanie <span className="italic text-[#002395]">Zespołem</span>.
                      </h1>
                  </div>
                  <button onClick={() => openPanel(null)} className="flex items-center gap-2 bg-[#002395] hover:bg-[#001766] text-white text-[10px] uppercase tracking-widest font-bold antialiased py-3 px-6 rounded-xl transition-all shadow-[0_4px_14px_rgba(0,35,149,0.3)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.4)] hover:-translate-y-0.5 active:scale-95">
                      <UserPlus size={16} aria-hidden="true" /> Dodaj Artystę
                  </button>
              </div>
          </motion.div>
      </header>

      {/* ENTERPRISE UX: Dashboard-as-Navigation (Interactive Widget) */}
      <div className="inline-flex flex-wrap items-center gap-2.5 p-2.5 bg-white/60 backdrop-blur-xl border border-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-3xl w-full sm:w-auto mb-2">
          <button onClick={() => setVoiceFilter(voiceFilter === 'S' ? '' : 'S')} className={`px-5 py-2.5 rounded-2xl border flex flex-col items-center min-w-[80px] transition-all active:scale-95 cursor-pointer ${voiceFilter === 'S' ? 'bg-rose-100 border-rose-300 ring-2 ring-rose-500/20' : 'bg-rose-50/50 border-rose-100/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] hover:bg-rose-100/50'}`}>
              <span className="text-[9px] font-bold antialiased text-rose-500 uppercase tracking-widest">Soprany</span>
              <span className="text-xl font-black text-rose-700 leading-none mt-1.5">{ensembleBalance.S}</span>
          </button>
          <button onClick={() => setVoiceFilter(voiceFilter === 'A' ? '' : 'A')} className={`px-5 py-2.5 rounded-2xl border flex flex-col items-center min-w-[80px] transition-all active:scale-95 cursor-pointer ${voiceFilter === 'A' ? 'bg-purple-100 border-purple-300 ring-2 ring-purple-500/20' : 'bg-purple-50/50 border-purple-100/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] hover:bg-purple-100/50'}`}>
              <span className="text-[9px] font-bold antialiased text-purple-500 uppercase tracking-widest">Alty</span>
              <span className="text-xl font-black text-purple-700 leading-none mt-1.5">{ensembleBalance.A}</span>
          </button>
          <button onClick={() => setVoiceFilter(voiceFilter === 'T' ? '' : 'T')} className={`px-5 py-2.5 rounded-2xl border flex flex-col items-center min-w-[80px] transition-all active:scale-95 cursor-pointer ${voiceFilter === 'T' ? 'bg-sky-100 border-sky-300 ring-2 ring-sky-500/20' : 'bg-sky-50/50 border-sky-100/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] hover:bg-sky-100/50'}`}>
              <span className="text-[9px] font-bold antialiased text-sky-500 uppercase tracking-widest">Tenory</span>
              <span className="text-xl font-black text-sky-700 leading-none mt-1.5">{ensembleBalance.T}</span>
          </button>
          <button onClick={() => setVoiceFilter(voiceFilter === 'B' ? '' : 'B')} className={`px-5 py-2.5 rounded-2xl border flex flex-col items-center min-w-[80px] transition-all active:scale-95 cursor-pointer ${voiceFilter === 'B' ? 'bg-emerald-100 border-emerald-300 ring-2 ring-emerald-500/20' : 'bg-emerald-50/50 border-emerald-100/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] hover:bg-emerald-100/50'}`}>
              <span className="text-[9px] font-bold antialiased text-emerald-500 uppercase tracking-widest">Basy</span>
              <span className="text-xl font-black text-emerald-700 leading-none mt-1.5">{ensembleBalance.B}</span>
          </button>
          <button onClick={() => setVoiceFilter('')} className={`px-6 py-2.5 ml-2 border-l border-stone-200/50 flex flex-col items-center justify-center min-w-[80px] transition-all cursor-pointer ${voiceFilter === '' ? 'opacity-100' : 'opacity-50 hover:opacity-100'}`}>
              <span className="text-[9px] font-bold antialiased text-stone-400 uppercase tracking-widest">Tutti</span>
              <span className="text-xl font-black text-stone-800 leading-none mt-1.5">{ensembleBalance.Total}</span>
          </button>
      </div>

      {/* FILTERS */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search size={16} className="text-stone-400" aria-hidden="true" />
              </div>
              <input 
                  type="text" placeholder="Szukaj po nazwisku..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className={STYLE_GLASS_INPUT}
              />
          </div>
          <div className="relative w-full sm:w-72 flex-shrink-0">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Filter size={16} className="text-stone-400" aria-hidden="true" />
              </div>
              <select value={voiceFilter} onChange={e => setVoiceFilter(e.target.value)} className={`${STYLE_GLASS_INPUT} font-bold text-stone-600 appearance-none`}>
                  <option value="">Wszystkie głosy</option>
                  {voiceTypes.map(vt => <option key={vt.value} value={vt.value}>{vt.label}</option>)}
              </select>
          </div>
      </div>

      {/* ROSTER LIST (Grid View) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-64 bg-stone-100/50 rounded-[2rem] border border-white/50 animate-pulse"></div>
          ))
        ) : displayArtists.length > 0 ? (
          <AnimatePresence>
            {displayArtists.map((artist) => (
              <ArtistCard 
                key={artist.id}
                artist={artist}
                onEdit={openPanel}
                onToggleStatus={handleToggleRequest}
              />
            ))}
          </AnimatePresence>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full bg-white/70 backdrop-blur-xl border border-white/60 rounded-[2rem] p-16 flex flex-col items-center justify-center text-center">
             <Search size={48} className="text-stone-300 mb-4 opacity-50" aria-hidden="true" />
            <span className="text-[11px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2">Brak wyników</span>
            
            {/* ENTERPRISE UX: Actionable Empty State */}
            {searchTerm ? (
                <div className="flex flex-col items-center gap-3 mt-2">
                    <span className="text-xs text-stone-400 max-w-sm">Nie znaleźliśmy chórzysty "{searchTerm}". Możesz dodać go teraz do bazy.</span>
                    <button 
                        onClick={() => openPanel(null, searchTerm)} 
                        className="mt-2 bg-stone-100 hover:bg-[#002395] hover:text-white border border-stone-200/80 text-stone-600 text-[10px] font-bold antialiased uppercase tracking-widest py-2.5 px-5 rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-2"
                    >
                        <UserPlus size={14} aria-hidden="true" /> Dodaj: {searchTerm}
                    </button>
                </div>
            ) : (
                <span className="text-xs text-stone-400 max-w-sm">Zmień kryteria wyszukiwania lub dodaj nową osobę do bazy.</span>
            )}
          </motion.div>
        )}
      </div>

      <ArtistEditorPanel 
        isOpen={isPanelOpen} 
        onClose={closePanel} 
        artist={editingArtist} 
        voiceTypes={voiceTypes} 
        initialSearchContext={initialSearchContext} 
      />

      <ConfirmModal 
        isOpen={!!artistToToggle}
        title={artistToToggle?.willBeActive ? "Aktywować profil?" : "Zarchiwizować artystę?"}
        description={artistToToggle?.willBeActive 
            ? "Artysta odzyska możliwość logowania się do platformy i będzie widoczny w obsadzie nowych projektów." 
            : "Artysta utraci dostęp do panelu. Jego dane historyczne w przeszłych projektach zostaną zachowane."}
        onConfirm={executeStatusToggle}
        onCancel={() => setArtistToToggle(null)}
        isLoading={isTogglingStatus}
      />
    </div>
  );
}