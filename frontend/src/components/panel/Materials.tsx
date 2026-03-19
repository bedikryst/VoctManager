/**
 * @file Materials.tsx
 * @description Artist Rehearsal Materials Module.
 * @architecture
 * SECURITY UPGRADE: Scoped Data Fetching (Filters by ?artist=id).
 * IP PROTECTION (New): Auto-locks all files, audio, and lyrics when a project 
 * status changes to 'DONE' (Archive) to protect the conductor's custom arrangements.
 * ENTERPRISE UPGRADE 2026: Powered by parallel React Query (useQueries).
 * @module artist/Materials
 * @author Krystian Bugalski
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueries } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  Search, Music, FileText, ChevronDown, ChevronUp, 
  Download, PlayCircle, Headphones, Briefcase, 
  Clock, Youtube, AlignLeft, Loader2, Lock
} from 'lucide-react';

import api from '../../utils/api';
import type { 
    Project, Piece, Track, PieceCasting, 
    Participation, Composer, ProgramItem 
} from '../../types';

// --- Extended Interfaces for Nested Data ---
interface EnrichedPiece extends Piece {
    composerData: Composer | null;
    myCasting: PieceCasting | null;
    tracks: Track[];
}

interface ProjectMaterialGroup {
    project: Project;
    participation: Participation;
    pieces: EnrichedPiece[];
}

// --- Static Styles ---
const STYLE_GLASS_CARD = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl";
const STYLE_GLASS_INPUT = "w-full pl-11 pr-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";

export default function Materials(): React.JSX.Element {
  const { user } = useAuth(); 
  
  // --- UI States ---
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedPieceId, setExpandedPieceId] = useState<string | null>(null);
  const [showLyricsFor, setShowLyricsFor] = useState<string | null>(null);

  // --- Data Fetching Engine (React Query) ---
  const results = useQueries({
    queries: [
      { queryKey: ['mat-projects'], queryFn: async () => (await api.get('/api/projects/')).data, enabled: !!user?.id },
      { queryKey: ['mat-participations', user?.id], queryFn: async () => (await api.get(`/api/participations/?artist=${user?.id}`)).data, enabled: !!user?.id },
      { queryKey: ['mat-programItems'], queryFn: async () => (await api.get('/api/program-items/')).data, enabled: !!user?.id },
      { queryKey: ['mat-castings'], queryFn: async () => (await api.get('/api/piece-castings/')).data, enabled: !!user?.id },
      { queryKey: ['mat-pieces'], queryFn: async () => (await api.get('/api/pieces/')).data, enabled: !!user?.id },
      { queryKey: ['mat-tracks'], queryFn: async () => (await api.get('/api/tracks/')).data, enabled: !!user?.id },
      { queryKey: ['mat-composers'], queryFn: async () => (await api.get('/api/composers/')).data, enabled: !!user?.id }
    ]
  });

  const isLoading = results.some(q => q.isLoading);
  const isError = results.some(q => q.isError);

  useEffect(() => {
    if (isError) {
      toast.error("Błąd synchronizacji", { 
          description: "Nie udało się załadować materiałów. Odśwież stronę." 
      });
    }
  }, [isError]);

  // --- Data Extraction ---
  const rawData = useMemo(() => ({
    projects: Array.isArray(results[0].data) ? results[0].data as Project[] : [],
    myParticipations: Array.isArray(results[1].data) ? results[1].data as Participation[] : [], 
    programItems: Array.isArray(results[2].data) ? results[2].data as ProgramItem[] : [],
    pieceCastings: Array.isArray(results[3].data) ? results[3].data as PieceCasting[] : [],
    pieces: Array.isArray(results[4].data) ? results[4].data as Piece[] : [],
    tracks: Array.isArray(results[5].data) ? results[5].data as Track[] : [],
    composers: Array.isArray(results[6].data) ? results[6].data as Composer[] : []
  }), [results]);

  // --- Aggregation & Relational Joining (Memoized) ---
  const groupedMaterials = useMemo<ProjectMaterialGroup[]>(() => {
    if (!user?.id || rawData.myParticipations.length === 0) return [];

    const activeParticipations = rawData.myParticipations.filter(p => p.status !== 'DEC');
    const myProjectIds = activeParticipations.map(p => String(p.project));
    
    const myProjects = rawData.projects.filter(p => myProjectIds.includes(String(p.id)) && p.status !== 'CANC');

    const groups = myProjects.map(project => {
        const participation = activeParticipations.find(p => String(p.project) === String(project.id))!;
        
        const projectProgram = rawData.programItems
            .filter(pi => String(pi.project) === String(project.id))
            .sort((a, b) => a.order - b.order);
        
        const enrichedPieces = projectProgram.map(pi => {
            const piece = rawData.pieces.find(p => String(p.id) === String(pi.piece));
            if (!piece) return null;
            
            const composerData = rawData.composers.find(c => String(c.id) === String(piece.composer)) || null;
            const myCasting = rawData.pieceCastings.find(c => String(c.participation) === String(participation.id) && String(c.piece) === String(piece.id)) || null;
            const pieceTracks = rawData.tracks.filter(t => String(t.piece) === String(piece.id));

            return { ...piece, composerData, myCasting, tracks: pieceTracks } as EnrichedPiece;
        }).filter(Boolean) as EnrichedPiece[];

        return { project, participation, pieces: enrichedPieces };
    });

    // Sortuj projekty (Aktywne na górze, zarchiwizowane na dole, chronologicznie)
    return groups.sort((a, b) => {
        if (a.project.status !== 'DONE' && b.project.status === 'DONE') return -1;
        if (a.project.status === 'DONE' && b.project.status !== 'DONE') return 1;
        return new Date(a.project.date_time).getTime() - new Date(b.project.date_time).getTime();
    });

  }, [rawData, user]);

  // --- Search Filtering ---
  const filteredGroups = useMemo<ProjectMaterialGroup[]>(() => {
      if (!searchQuery) return groupedMaterials;
      const term = searchQuery.toLowerCase();

      return groupedMaterials.map(group => {
          const filteredPieces = group.pieces.filter(piece => 
              piece.title.toLowerCase().includes(term) || 
              (piece.composerData?.last_name || '').toLowerCase().includes(term)
          );
          return { ...group, pieces: filteredPieces };
      }).filter(group => group.pieces.length > 0);
  }, [groupedMaterials, searchQuery]);


  // --- Event Handlers ---
  const togglePieceExpand = (pieceId: string) => {
      setExpandedPieceId(prev => prev === pieceId ? null : pieceId);
  };

  const handleAudioPlay = (e: React.SyntheticEvent<HTMLAudioElement>) => {
      const target = e.currentTarget;
      document.querySelectorAll('audio').forEach(audioEl => { 
          if (audioEl !== target) audioEl.pause(); 
      });
  };

  // --- Render ---
  if (isLoading && !!user?.id) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-stone-400" size={32} aria-hidden="true" /></div>;
  }

  return (
    <div className="space-y-8 animate-fade-in relative cursor-default pb-12 max-w-5xl mx-auto">
      
      <header className="relative pt-2 mb-8">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-4">
                  <Headphones size={12} className="text-[#002395]" aria-hidden="true" />
                  <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-[#002395]/80">
                      Strefa Artysty
                  </p>
              </div>
              <h1 className="text-3xl md:text-4xl font-medium text-stone-900 leading-tight tracking-tight" style={{ fontFamily: "'Cormorant', serif" }}>
                  Materiały do <span className="italic text-[#002395]">ćwiczeń</span>.
              </h1>
          </motion.div>
      </header>

      <div className="relative w-full max-w-xl">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search size={16} className="text-stone-400" aria-hidden="true" />
          </div>
          <input 
              type="text" 
              placeholder="Szukaj utworu lub kompozytora..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={STYLE_GLASS_INPUT}
          />
      </div>

      <div className="space-y-12">
        <AnimatePresence mode="popLayout">
          {filteredGroups.length > 0 ? (
            filteredGroups.map((group) => {
                // SPRAWDZAMY CZY PROJEKT JEST W ARCHIWUM (ZAKOŃCZONY)
                const isArchived = group.project.status === 'DONE';

                return (
                  <motion.div 
                      key={group.project.id}
                      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                      className="space-y-5"
                  >
                      {/* Project Header */}
                      <div className={`flex items-center gap-3 border-b border-stone-200/60 pb-3 ml-2 ${isArchived ? 'opacity-70' : ''}`}>
                          <Briefcase size={18} className={isArchived ? "text-stone-400" : "text-[#002395]"} aria-hidden="true" />
                          <div>
                              <h2 className={`text-sm font-bold antialiased uppercase tracking-widest ${isArchived ? 'text-stone-600' : 'text-stone-800'}`}>
                                {group.project.title}
                              </h2>
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-[10px] font-bold antialiased text-stone-500 uppercase tracking-widest flex items-center gap-1">
                                    <Clock size={10} aria-hidden="true" /> {new Date(group.project.date_time).toLocaleDateString('pl-PL')}
                                </p>
                                {isArchived && (
                                    <span className="px-2 py-0.5 bg-stone-200 text-stone-600 text-[8px] font-bold antialiased uppercase tracking-widest rounded shadow-sm">
                                        Archiwum
                                    </span>
                                )}
                              </div>
                          </div>
                      </div>

                      {/* Pieces Accordion */}
                      {group.pieces.map((piece, idx) => {
                          const isExpanded = expandedPieceId === String(piece.id);
                          
                          return (
                            <motion.div 
                              key={piece.id} layout
                              className={`${STYLE_GLASS_CARD} overflow-hidden transition-all duration-300 ${isExpanded ? 'border-[#002395]/30 shadow-[0_10px_30px_rgba(0,35,149,0.05)]' : 'hover:border-[#002395]/20 hover:shadow-[0_8px_20px_rgb(0,0,0,0.04)]'} ${isArchived ? 'grayscale-[0.5]' : ''}`}
                            >
                              <div 
                                onClick={() => togglePieceExpand(String(piece.id))}
                                className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-white/40 transition-colors"
                              >
                                  <div className="flex items-center gap-4">
                                      <div className={`w-10 h-10 rounded-xl bg-white border border-stone-100 flex items-center justify-center flex-shrink-0 shadow-sm font-bold text-sm ${isArchived ? 'text-stone-400' : 'text-[#002395]'}`}>
                                          {idx + 1}
                                      </div>
                                      <div>
                                          <h3 className="text-lg font-bold text-stone-900 tracking-tight leading-tight">{piece.title}</h3>
                                          <p className="text-[10px] font-bold antialiased text-stone-500 uppercase tracking-widest mt-0.5">
                                              {piece.composerData ? `${piece.composerData.first_name || ''} ${piece.composerData.last_name}` : 'Tradycyjny / Nieznany'}
                                          </p>
                                      </div>
                                  </div>

                                  <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto mt-2 sm:mt-0">
                                      <div className="flex gap-2">
                                          {piece.myCasting && (
                                              <span className={`px-2.5 py-1 ${isArchived ? 'bg-stone-200 text-stone-500' : 'bg-[#002395] text-white'} text-[9px] tracking-widest font-bold antialiased uppercase rounded-md shadow-sm`}>
                                                  Głos: {(piece.myCasting as any).voice_line_display || piece.myCasting.voice_line}
                                              </span>
                                          )}
                                          {/* Ukrywamy szybkie tagi zasobów, jeśli jest to archiwum */}
                                          {!isArchived && piece.sheet_music && <span className="px-2.5 py-1 bg-blue-50 text-[#002395] text-[9px] tracking-widest font-bold antialiased uppercase rounded-md border border-blue-100">PDF</span>}
                                          {!isArchived && piece.tracks.length > 0 && <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[9px] tracking-widest font-bold antialiased uppercase rounded-md border border-emerald-100">Audio</span>}
                                          {isArchived && <span className="px-2.5 py-1 bg-stone-100 text-stone-400 text-[9px] tracking-widest font-bold antialiased uppercase rounded-md border border-stone-200 flex items-center gap-1"><Lock size={10}/> Blokada</span>}
                                      </div>
                                      
                                      <div className="text-stone-400 bg-white shadow-sm p-1.5 rounded-full border border-stone-100 transition-transform duration-300">
                                          {isExpanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
                                      </div>
                                  </div>
                              </div>

                              {/* Expanded Content */}
                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div 
                                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                    className="bg-stone-50/40 border-t border-white/60 overflow-hidden"
                                  >
                                    
                                    {isArchived ? (
                                        // WIDOK BLOKADY DLA ARCHIWUM (IP PROTECTION)
                                        <div className="p-8 md:p-12 flex flex-col items-center justify-center text-center bg-stone-50/30">
                                            <div className="w-16 h-16 bg-white border border-stone-200 rounded-full flex items-center justify-center mb-4 shadow-sm">
                                                <Lock size={24} className="text-stone-400" aria-hidden="true" />
                                            </div>
                                            <h4 className="text-[11px] font-bold antialiased uppercase tracking-widest text-stone-600 mb-2">Dostęp Zablokowany</h4>
                                            <p className="text-xs text-stone-500 max-w-md leading-relaxed">
                                                Projekt został zakończony. Materiały ćwiczeniowe, partytury oraz teksty nie są już dostępne ze względu na ochronę własności intelektualnej i autorskich aranżacji dyrygenta.
                                            </p>
                                        </div>
                                    ) : (
                                        // WIDOK STANDARDOWY DLA AKTYWNYCH PROJEKTÓW
                                        <div className="p-5 md:p-8 space-y-8">
                                            
                                            <div className="flex flex-wrap gap-4">
                                                {piece.sheet_music ? (
                                                    <a href={piece.sheet_music} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2.5 px-6 py-3 bg-white border border-stone-200/80 rounded-xl text-[10px] uppercase tracking-widest font-bold antialiased text-[#002395] hover:border-[#002395]/40 hover:shadow-md transition-all shadow-sm active:scale-95">
                                                        <Download size={16} aria-hidden="true" /> Pobierz Nuty (PDF)
                                                    </a>
                                                ) : (
                                                    <span className="inline-flex items-center gap-2.5 px-6 py-3 bg-stone-100 border border-stone-200/50 rounded-xl text-[10px] uppercase tracking-widest font-bold antialiased text-stone-400 cursor-not-allowed">
                                                        <FileText size={16} aria-hidden="true" /> Brak wgranego pliku nut
                                                    </span>
                                                )}

                                                {piece.reference_recording && (
                                                    <a href={piece.reference_recording} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2.5 text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-red-600 hover:text-red-700 bg-white hover:bg-red-50 px-6 py-3 rounded-xl transition-colors border border-red-100 shadow-sm active:scale-95">
                                                        <Youtube size={16} aria-hidden="true" /> YouTube / Spotify
                                                    </a>
                                                )}
                                            </div>

                                            {piece.tracks.length > 0 && (
                                                <div>
                                                    <h4 className="flex items-center gap-2 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-4 ml-1">
                                                        <Headphones size={14} className="text-emerald-600" aria-hidden="true" /> Ścieżki Ćwiczeniowe (Midi)
                                                    </h4>
                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                        {piece.tracks.map((track) => {
                                                            const isMyTrack = piece.myCasting?.voice_line === track.voice_part;
                                                            return (
                                                                <div key={track.id} className={`bg-white/80 backdrop-blur-sm p-4 rounded-xl border shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4 transition-colors ${isMyTrack ? 'border-emerald-300 ring-2 ring-emerald-500/10' : 'border-stone-200/80'}`}>
                                                                    <span className={`text-[10px] uppercase tracking-widest font-bold antialiased px-3 py-1.5 rounded-lg border flex items-center gap-2 w-max ${isMyTrack ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                                                                        <PlayCircle size={14} aria-hidden="true" /> 
                                                                        {(track as any).voice_part_display || track.voice_part}
                                                                        {isMyTrack && " (Twój głos)"}
                                                                    </span>
                                                                    <audio controls controlsList="nodownload" className="w-full xl:w-64 h-9 outline-none rounded-lg" preload="none" onPlay={handleAudioPlay}>
                                                                        <source src={track.audio_file} type="audio/mpeg" />
                                                                    </audio>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {(piece.lyrics_original || piece.lyrics_translation) && (
                                                <div className="bg-white/60 backdrop-blur-md border border-white/80 rounded-2xl shadow-sm overflow-hidden">
                                                    <button onClick={() => setShowLyricsFor(showLyricsFor === piece.id ? null : String(piece.id))} className="w-full flex items-center justify-between p-5 text-left hover:bg-white/80 transition-colors">
                                                        <span className="flex items-center gap-2.5 text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-600">
                                                            <AlignLeft size={16} className="text-[#002395]" aria-hidden="true" /> Tekst Utworu i Tłumaczenie
                                                        </span>
                                                        <span className="text-stone-400 bg-white shadow-sm p-1.5 rounded-full border border-stone-100">
                                                            {showLyricsFor === piece.id ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
                                                        </span>
                                                    </button>
                                                    
                                                    <AnimatePresence>
                                                        {showLyricsFor === piece.id && (
                                                            <motion.div initial={{height:0}} animate={{height:'auto'}} exit={{height:0}} className="overflow-hidden border-t border-stone-100/50">
                                                                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 bg-stone-50/30">
                                                                    {piece.lyrics_original && (
                                                                        <div>
                                                                            <h5 className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-3 border-b border-stone-200/60 pb-2">Oryginał</h5>
                                                                            <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed font-serif">{piece.lyrics_original}</p>
                                                                        </div>
                                                                    )}
                                                                    {piece.lyrics_translation && (
                                                                        <div>
                                                                            <h5 className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-3 border-b border-stone-200/60 pb-2">Tłumaczenie (Notatki)</h5>
                                                                            <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed font-serif italic opacity-90">{piece.lyrics_translation}</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            )}

                                            <div className="mt-6 pt-6 border-t border-stone-200/60 flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center border border-stone-200 flex-shrink-0 text-stone-400">
                                                    <Music size={14} aria-hidden="true" />
                                                </div>
                                                {piece.myCasting ? (
                                                    <div>
                                                        <p className="text-sm font-bold text-stone-800">Twoja rola: {(piece.myCasting as any).voice_line_display || piece.myCasting.voice_line}</p>
                                                        {piece.myCasting.notes && <p className="text-xs text-stone-500 italic mt-0.5">Notatki: {piece.myCasting.notes}</p>}
                                                    </div>
                                                ) : (
                                                    <p className="text-[11px] text-stone-400 italic font-medium ml-1">Dyrygent nie zatwierdził jeszcze podziału na głosy w tym utworze.</p>
                                                )}
                                            </div>

                                        </div>
                                    )}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          );
                      })}
                  </motion.div>
              );
            })
          ) : (
            <motion.div 
              key="empty-state"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className={`${STYLE_GLASS_CARD} text-center p-16 flex flex-col items-center justify-center`}
            >
              <Music size={48} className="text-stone-300 mb-4 opacity-50" aria-hidden="true" />
              <span className="text-[11px] font-bold antialiased uppercase tracking-widest text-stone-600 mb-2">
                  Brak przypisanych materiałów
              </span>
              <span className="text-xs text-stone-400 max-w-md leading-relaxed">
                  W tej chwili nie masz nadchodzących projektów lub dyrygent nie zatwierdził jeszcze żadnego programu koncertu.
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}