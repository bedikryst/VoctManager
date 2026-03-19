/**
 * @file ArtistManagement.tsx
 * @description HR & Roster Management Module Controller.
 * @architecture
 * Implements React Query (useQueries) for parallel data fetching.
 * Delegates heavy form rendering and dirty state tracking to ArtistEditorPanel.
 * Extracts static CSS and mapping logic outside the component to optimize memory allocation.
 * @module hr/ArtistManagement
 * @author Krystian Bugalski
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  Plus, Edit2, Trash2, UserPlus, Mail, Phone, 
  CheckCircle2, ChevronDown, ChevronUp, Mic, Star, Activity, Search, Filter, Users
} from 'lucide-react';

import api from '../../utils/api';
import ConfirmModal from '../../components/ui/ConfirmModal';
import ArtistEditorPanel from './ArtistEditorPanel';

import type { Artist } from '../../types';

interface VoiceTypeOption {
  value: string;
  label: string;
}

// --- Static Functions & Styles ---
const STYLE_GLASS_CARD = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-[2rem]";
const STYLE_GLASS_INPUT = "w-full pl-11 pr-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";

const getVoiceColorConfig = (voiceType?: string | null) => {
    if (!voiceType) return { bg: 'bg-stone-50', text: 'text-stone-600', border: 'border-stone-200' };
    if (voiceType.startsWith('S')) return { bg: 'bg-rose-50/80', text: 'text-rose-700', border: 'border-rose-200' };
    if (voiceType.startsWith('A') || voiceType === 'MEZ') return { bg: 'bg-purple-50/80', text: 'text-purple-700', border: 'border-purple-200' };
    if (voiceType.startsWith('T') || voiceType === 'CT') return { bg: 'bg-sky-50/80', text: 'text-sky-700', border: 'border-sky-200' };
    if (voiceType.startsWith('B')) return { bg: 'bg-emerald-50/80', text: 'text-emerald-700', border: 'border-emerald-200' };
    return { bg: 'bg-stone-50', text: 'text-stone-600', border: 'border-stone-200' };
};

/**
 * ArtistManagement Component
 * @returns {React.JSX.Element}
 */
export default function ArtistManagement(): React.JSX.Element {
  const queryClient = useQueryClient();

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [voiceFilter, setVoiceFilter] = useState<string>('');

  // Accordion State
  const [expandedArtistId, setExpandedArtistId] = useState<string | null>(null);

  // Editor Panel State
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [editingArtist, setEditingArtist] = useState<Artist | null>(null);

  // Deactivation / Activation Modal State
  const [artistToToggle, setArtistToToggle] = useState<{ id: string, willBeActive: boolean } | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState<boolean>(false);

  // --- Data Fetching Engine (React Query) ---
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
      toast.error("Ostrzeżenie synchronizacji", {
        description: "Nie udało się pobrać wszystkich danych o artystach."
      });
    }
  }, [isError]);

  useEffect(() => {
    document.body.style.overflow = isPanelOpen || artistToToggle ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isPanelOpen, artistToToggle]);

  // --- Derived State & Analytics ---
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
          const matchesVoice = voiceFilter ? a.voice_type === voiceFilter : true;
          return matchesSearch && matchesVoice;
      });
  }, [artists, searchTerm, voiceFilter]);

  // --- Action Handlers ---
  const refreshGlobal = useCallback(async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ['artists'] });
  }, [queryClient]);

  const toggleExpand = (id: string) => setExpandedArtistId(prev => prev === id ? null : id);

  const openPanel = (artist: Artist | null = null) => {
    setEditingArtist(artist);
    setIsPanelOpen(true);
  };

  const closePanel = () => {
      setIsPanelOpen(false);
      setTimeout(() => setEditingArtist(null), 300);
  };

  const executeStatusToggle = async () => {
    if (!artistToToggle) return;
    setIsTogglingStatus(true);
    const toastId = toast.loading(artistToToggle.willBeActive ? "Aktywowanie konta..." : "Archiwizowanie artysty...");

    try {
      await api.patch(`/api/artists/${artistToToggle.id}/`, { is_active: artistToToggle.willBeActive });
      await refreshGlobal();
      toast.success(artistToToggle.willBeActive ? "Konto artysty aktywowane" : "Artysta zarchiwizowany", { id: toastId });
    } catch (err) { 
      console.error("Failed to toggle status:", err);
      toast.error("Błąd systemu", { id: toastId, description: "Nie udało się zmienić statusu artysty." });
    } finally {
      setIsTogglingStatus(false);
      setArtistToToggle(null);
    }
  };

  // --- Render Helpers ---
  const renderStars = (level?: number | null) => {
    if (!level) return <span className="text-stone-300 italic text-[9px] font-bold antialiased uppercase tracking-widest">A vista: Brak</span>;
    return (
      <div className="flex gap-1 items-center" title={`Czytanie a vista: ${level}/5`}>
        <span className="text-[9px] uppercase tracking-widest font-bold antialiased text-stone-400 mr-1.5 hidden sm:inline-block">A vista:</span>
        {[1, 2, 3, 4, 5].map(star => (
          <Star key={star} size={12} className={star <= level ? "text-amber-400 fill-amber-400" : "text-stone-200"} aria-hidden="true" />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in relative cursor-default pb-12 max-w-6xl mx-auto">
      
      {/* --- EDITORIAL HEADER --- */}
      <header className="relative pt-2 mb-8">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-5">
                  <div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-4">
                          <Users size={12} className="text-[#002395]" aria-hidden="true" />
                          <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-[#002395]/80">
                              Zasoby Ludzkie
                          </p>
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

      {/* --- ENSEMBLE BALANCE WIDGET (COLOR-CODED) --- */}
      <div className="inline-flex flex-wrap items-center gap-2.5 p-2.5 bg-white/60 backdrop-blur-xl border border-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-3xl w-full sm:w-auto mb-2">
          <div className="px-5 py-2.5 bg-rose-50/50 rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] border border-rose-100/50 flex flex-col items-center min-w-[80px]">
              <span className="text-[9px] font-bold antialiased text-rose-500 uppercase tracking-widest">Soprany</span>
              <span className="text-xl font-black text-rose-700 leading-none mt-1.5">{ensembleBalance.S}</span>
          </div>
          <div className="px-5 py-2.5 bg-purple-50/50 rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] border border-purple-100/50 flex flex-col items-center min-w-[80px]">
              <span className="text-[9px] font-bold antialiased text-purple-500 uppercase tracking-widest">Alty</span>
              <span className="text-xl font-black text-purple-700 leading-none mt-1.5">{ensembleBalance.A}</span>
          </div>
          <div className="px-5 py-2.5 bg-sky-50/50 rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] border border-sky-100/50 flex flex-col items-center min-w-[80px]">
              <span className="text-[9px] font-bold antialiased text-sky-500 uppercase tracking-widest">Tenory</span>
              <span className="text-xl font-black text-sky-700 leading-none mt-1.5">{ensembleBalance.T}</span>
          </div>
          <div className="px-5 py-2.5 bg-emerald-50/50 rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] border border-emerald-100/50 flex flex-col items-center min-w-[80px]">
              <span className="text-[9px] font-bold antialiased text-emerald-500 uppercase tracking-widest">Basy</span>
              <span className="text-xl font-black text-emerald-700 leading-none mt-1.5">{ensembleBalance.B}</span>
          </div>
          <div className="px-6 py-2.5 ml-2 border-l border-stone-200/50 flex flex-col items-center justify-center min-w-[80px]">
              <span className="text-[9px] font-bold antialiased text-stone-400 uppercase tracking-widest">Tutti</span>
              <span className="text-xl font-black text-stone-800 leading-none mt-1.5">{ensembleBalance.Total}</span>
          </div>
      </div>

      {/* --- SEARCH & FILTER BAR --- */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search size={16} className="text-stone-400" aria-hidden="true" />
              </div>
              <input 
                  type="text" 
                  placeholder="Szukaj po nazwisku..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className={STYLE_GLASS_INPUT}
              />
          </div>
          <div className="relative w-full sm:w-72 flex-shrink-0">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Filter size={16} className="text-stone-400" aria-hidden="true" />
              </div>
              <select 
                  value={voiceFilter} 
                  onChange={e => setVoiceFilter(e.target.value)}
                  className={`${STYLE_GLASS_INPUT} font-bold text-stone-600 appearance-none`}
              >
                  <option value="">Wszystkie głosy</option>
                  {voiceTypes.map(vt => <option key={vt.value} value={vt.value}>{vt.label}</option>)}
              </select>
          </div>
      </div>

      {/* --- ARTIST CARDS (ACCORDION) --- */}
      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-stone-100/50 rounded-[2rem] w-full border border-white/50"></div>)}
          </div>
        ) : displayArtists.length > 0 ? displayArtists.map((artist) => {
          const isExpanded = expandedArtistId === artist.id;
          const initials = `${artist.first_name?.charAt(0) || ''}${artist.last_name?.charAt(0) || ''}`.toUpperCase();
          const vColor = getVoiceColorConfig(artist.voice_type);

          return (
            <div key={artist.id} className={`${STYLE_GLASS_CARD} transition-all duration-300 ${!artist.is_active ? 'opacity-60 grayscale hover:grayscale-0 bg-stone-50/30' : isExpanded ? 'border-[#002395]/30 shadow-[0_10px_30px_rgba(0,35,149,0.05)]' : 'hover:border-[#002395]/20 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgb(0,0,0,0.06)]'}`}>
              
              {/* Core Card Details */}
              <div 
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 cursor-pointer relative z-10 hover:bg-white/40 transition-colors"
                onClick={() => toggleExpand(artist.id)}
              >
                <div className="flex items-center gap-5">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 font-bold tracking-widest text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] border ${artist.is_active ? 'bg-white border-stone-100 text-[#002395]' : 'bg-stone-100 border-stone-200 text-stone-400'}`}>
                    {initials}
                  </div>
                  <div>
                    <h3 className="text-lg md:text-xl font-bold text-stone-900 flex items-center gap-3 tracking-tight">
                      {artist.first_name} {artist.last_name}
                      {!artist.is_active && <span className="px-2 py-1 bg-stone-200 text-stone-600 text-[8px] antialiased uppercase tracking-widest font-bold rounded-md border border-stone-300 shadow-sm">Archiwum</span>}
                    </h3>
                    <div className="flex items-center gap-4 mt-1.5">
                        <span className={`px-2.5 py-1 text-[9px] font-bold antialiased uppercase tracking-widest rounded-md border shadow-sm ${artist.is_active ? `${vColor.bg} ${vColor.text} ${vColor.border}` : 'bg-stone-100 text-stone-400 border-stone-200'}`}>
                          {artist.voice_type_display || artist.voice_type}
                        </span>
                        {artist.is_active && renderStars(artist.sight_reading_skill)}
                    </div>
                  </div>
                </div>

                <div className="text-stone-400 self-end md:self-auto hidden sm:block bg-white shadow-sm p-2 rounded-full border border-stone-100 transition-transform duration-300">
                  {isExpanded ? <ChevronUp size={20} className="text-[#002395]" aria-hidden="true" /> : <ChevronDown size={20} aria-hidden="true" />}
                </div>
              </div>

              {/* Expanded Accordion Content */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="bg-stone-50/40 border-t border-white/60 overflow-hidden relative z-0"
                  >
                    <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                      
                      {/* Contact Info */}
                      <div>
                        <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-400 mb-4 border-b border-stone-200/60 pb-2">Dane Kontaktowe</h4>
                        <div className="space-y-4 text-sm text-stone-700 font-medium">
                          <p className="flex items-center gap-3">
                            <Mail size={16} className="text-stone-400" aria-hidden="true" />
                            <a href={`mailto:${artist.email}`} className="hover:text-[#002395] transition-colors">{artist.email}</a>
                          </p>
                          <p className="flex items-center gap-3">
                            <Phone size={16} className="text-stone-400" aria-hidden="true" />
                            {artist.phone_number ? (
                              <a href={`tel:${artist.phone_number}`} className="hover:text-[#002395] transition-colors">{artist.phone_number}</a>
                            ) : <span className="text-stone-400 italic text-[11px] font-normal">Brak telefonu</span>}
                          </p>
                           <p className="text-[10px] font-medium antialiased text-stone-500 tracking-wider mt-5 bg-white/60 px-3 py-2 rounded-lg border border-stone-200/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] inline-block">
                            Konto: {artist.user ? `Aktywne (@${artist.username})` : 'Brak konta'}
                          </p>
                        </div>
                      </div>

                      {/* Vocal Profile Range */}
                      <div>
                        <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-400 mb-4 border-b border-stone-200/60 pb-2">Profil Wokalny</h4>
                        <div className="space-y-4">
                          <div>
                            <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 flex items-center gap-2 mb-2"><Activity size={14} aria-hidden="true" /> Skala Głosu</p>
                            <p className={`text-sm font-bold bg-white border inline-block px-4 py-2 rounded-xl shadow-sm ${vColor.border} ${vColor.text}`}>
                              {(artist.vocal_range_bottom || artist.vocal_range_top) 
                                ? `${artist.vocal_range_bottom || '?'}  —  ${artist.vocal_range_top || '?'}`
                                : <span className="text-stone-400 italic font-normal text-[10px] uppercase tracking-widest">Brak danych</span>}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Administrative Actions */}
                      <div className="flex flex-col justify-center gap-3 border-t md:border-t-0 border-stone-200/60 pt-6 md:pt-0">
                        <button onClick={(e) => { e.stopPropagation(); openPanel(artist); }} className="w-full py-3.5 bg-white border border-stone-200/80 text-stone-600 text-[10px] font-bold antialiased uppercase tracking-widest rounded-xl hover:border-[#002395]/40 hover:text-[#002395] hover:shadow-md transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95">
                          <Edit2 size={14} aria-hidden="true" /> Edytuj Profil
                        </button>
                        
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setArtistToToggle({ id: artist.id, willBeActive: !artist.is_active }); 
                          }} 
                          className={`w-full py-3.5 bg-white border text-[10px] font-bold antialiased uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 ${artist.is_active ? 'border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300'}`}
                        >
                          {artist.is_active ? <><Trash2 size={14} aria-hidden="true" /> Zarchiwizuj</> : <><CheckCircle2 size={14} aria-hidden="true" /> Aktywuj Konto</>}
                        </button>
                      </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          );
        }) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${STYLE_GLASS_CARD} p-16 flex flex-col items-center justify-center text-center`}>
             <Search size={48} className="text-stone-300 mb-4 opacity-50" aria-hidden="true" />
            <span className="text-[11px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2">Brak wyników</span>
            <span className="text-xs text-stone-400 max-w-sm">Zmień kryteria wyszukiwania lub dodaj nową osobę do bazy.</span>
          </motion.div>
        )}
      </div>

      {/* --- EXTERNAL COMPONENTS --- */}
      <ArtistEditorPanel 
        isOpen={isPanelOpen}
        onClose={closePanel}
        artist={editingArtist}
        voiceTypes={voiceTypes}
        refreshGlobal={refreshGlobal}
      />

      <ConfirmModal 
        isOpen={!!artistToToggle}
        title={artistToToggle?.willBeActive ? "Aktywować profil?" : "Zarchiwizować artystę?"}
        description={artistToToggle?.willBeActive 
            ? "Artysta odzyska możliwość logowania się do platformy i będzie widoczny w obsadzie nowych projektów." 
            : "Artysta utraci dostęp do panelu i nut. Jego dane historyczne w przeszłych projektach zostaną zachowane."}
        onConfirm={executeStatusToggle}
        onCancel={() => setArtistToToggle(null)}
        isLoading={isTogglingStatus}
      />

    </div>
  );
}