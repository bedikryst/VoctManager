/**
 * @file Materials.jsx
 * @description Artist Rehearsal Materials Module.
 * Implements a Mobile-First layout, contextual grouping by upcoming projects,
 * and secure cross-module Divisi (Micro-casting) visibility.
 * UI UPGRADE 2026: Adheres to Enterprise UI standards (Glassmorphism, Inner Glows, 
 * Antialiased Micro-typography, and Pixel-Perfect rhythms).
 * @module artist/Materials
 * @author Krystian Bugalski
 */

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Music, FileText, ChevronDown, ChevronUp, 
  Download, PlayCircle, Star, Headphones, Lock, Briefcase, Clock, Users, Youtube, AlignLeft
} from 'lucide-react';
import api from '../../utils/api';

export default function Materials() {
  const { user } = useAuth();
  const isAdmin = user?.is_admin;

  const [groupedMaterials, setGroupedMaterials] = useState([]);
  const [composers, setComposers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [allCastings, setAllCastings] = useState([]); 

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPieceId, setExpandedPieceId] = useState(null);
  const [expandedLyricsId, setExpandedLyricsId] = useState(null);

  useEffect(() => {
    const fetchMaterialsAndProfile = async () => {
      try {
        const [piecesRes, meRes, compRes, projectsRes, programItemsRes, castingsRes] = await Promise.allSettled([
          api.get('/api/pieces/'),
          api.get('/api/artists/me/'),
          api.get('/api/composers/'),
          api.get('/api/projects/'),
          api.get('/api/program-items/'),
          api.get('/api/piece-castings/') 
        ]);

        const fetchedPieces = piecesRes.status === 'fulfilled' && Array.isArray(piecesRes.value.data) ? piecesRes.value.data : [];
        const projects = projectsRes.status === 'fulfilled' && Array.isArray(projectsRes.value.data) ? projectsRes.value.data : [];
        const programItems = programItemsRes.status === 'fulfilled' && Array.isArray(programItemsRes.value.data) ? programItemsRes.value.data : [];
        
        if (castingsRes.status === 'fulfilled') {
            const data = castingsRes.value.data;
            setAllCastings(Array.isArray(data) ? data : (data?.results || []));
        }
        
        if (compRes.status === 'fulfilled') {
            setComposers(Array.isArray(compRes.value.data) ? compRes.value.data : (compRes.value.data?.results || []));
        }
        
        if (meRes.status === 'fulfilled' && meRes.value.data) {
            setCurrentUser(meRes.value.data);
        }
        
        const now = new Date();
        
        const activeProjects = projects
            .filter(p => new Date(p.date_time) >= now || p.status !== 'DONE')
            .sort((a, b) => new Date(a.date_time) - new Date(b.date_time));

        const grouped = activeProjects.map(proj => {
            const pItems = programItems
                .filter(pi => pi.project === proj.id)
                .sort((a, b) => a.order - b.order);
            
            const pPieces = pItems.map(pi => {
                const pieceId = typeof pi.piece === 'object' ? pi.piece.id : pi.piece;
                return fetchedPieces.find(p => p.id === pieceId);
            }).filter(Boolean);

            return { project: proj, pieces: pPieces };
        }).filter(group => group.pieces.length > 0); 

        setGroupedMaterials(grouped);
        
      } catch (err) {
        console.error("Failed to orchestrate grouped materials:", err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMaterialsAndProfile();
  }, []);

  const toggleExpand = (uniqueId) => {
      setExpandedPieceId(prev => prev === uniqueId ? null : uniqueId);
      setExpandedLyricsId(null);
  };

  const handleAudioPlay = (e) => {
    document.querySelectorAll('audio').forEach(audioEl => {
      if (audioEl !== e.target) audioEl.pause();
    });
  };

  const getEpochColor = (epochId) => {
    const colors = {
        'MED': 'bg-stone-100 text-stone-700 border-stone-200',
        'REN': 'bg-amber-50 text-amber-700 border-amber-200',
        'BAR': 'bg-yellow-50 text-yellow-800 border-yellow-300',
        'CLA': 'bg-blue-50 text-blue-700 border-blue-200',
        'ROM': 'bg-rose-50 text-rose-700 border-rose-200',
        'M20': 'bg-purple-50 text-purple-700 border-purple-200',
        'CON': 'bg-teal-50 text-teal-700 border-teal-200',
        'POP': 'bg-pink-50 text-pink-700 border-pink-200',
        'FOLK': 'bg-green-50 text-green-700 border-green-200',
    };
    return colors[epochId] || 'bg-stone-50 text-stone-500 border-stone-200';
  };

  const formatDuration = (totalSeconds) => {
      if (!totalSeconds) return null;
      const m = Math.floor(totalSeconds / 60);
      const s = totalSeconds % 60;
      return `${m > 0 ? `${m} min` : ''} ${s > 0 ? `${s} sek` : ''}`.trim();
  };

  const filteredGroups = useMemo(() => {
    if (!searchQuery) return groupedMaterials;
    const term = searchQuery.toLowerCase();
    
    return groupedMaterials.map(group => {
        const filteredPieces = group.pieces.filter(piece => {
            const titleMatch = piece.title?.toLowerCase().includes(term);
            const comp = composers.find(c => c.id === piece.composer);
            const composerName = comp ? `${comp.first_name || ''} ${comp.last_name}`.toLowerCase() : '';
            return titleMatch || composerName.includes(term);
        });
        return { ...group, pieces: filteredPieces };
    }).filter(group => group.pieces.length > 0); 
  }, [groupedMaterials, composers, searchQuery]);

  // --- UI Shared Styles ---
  const glassInputStyle = "bg-white/50 backdrop-blur-sm border border-stone-200/60 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all";
  const glassCardStyle = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl overflow-hidden";

  return (
    <div className="space-y-6 animate-fade-in pb-24 md:pb-8 cursor-default max-w-4xl mx-auto">
      
      {/* --- EDITORIAL HEADER --- */}
      <header className="relative pt-2 mb-8 border-b border-stone-200/60 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-5">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-4">
                  <Headphones size={12} className="text-[#002395]" />
                  <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-[#002395]/80">
                      Baza wiedzy chórzysty
                  </p>
                  {!isAdmin && <Lock size={10} className="text-stone-400 ml-1" title="Dostęp tylko dla artystów" />}
              </div>
              <h1 className="text-3xl md:text-4xl font-medium text-stone-900 leading-tight tracking-tight" style={{ fontFamily: "'Cormorant', serif" }}>
                  Materiały do <span className="italic text-[#002395]">Prób</span>.
              </h1>
          </motion.div>
          
          <div className="relative w-full md:w-72 flex-shrink-0">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search size={16} className="text-stone-400" />
            </div>
            <input
              type="text"
              placeholder="Szukaj utworu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-11 pr-4 py-3 text-sm text-stone-800 ${glassInputStyle}`}
            />
          </div>
      </header>

      {isLoading ? (
        <div className="animate-pulse space-y-8">
          {[1, 2].map(i => (
             <div key={i} className="space-y-4">
                 <div className="h-6 w-1/3 bg-stone-200/50 rounded-lg"></div>
                 <div className="h-20 bg-white/50 border border-white/60 rounded-2xl w-full"></div>
                 <div className="h-20 bg-white/50 border border-white/60 rounded-2xl w-full"></div>
             </div>
          ))}
        </div>
      ) : (
        <div className="space-y-12">
          <AnimatePresence mode="popLayout">
            {filteredGroups.length > 0 ? (
              filteredGroups.map(group => (
                  <motion.div 
                      key={`group-${group.project.id}`} 
                      layout 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="space-y-4"
                  >
                      {/* Project Section Header */}
                      <div className="flex items-center gap-2.5 mb-5 border-b border-stone-200/60 pb-2.5 px-2">
                          <Briefcase size={16} className="text-[#002395]" />
                          <h3 className="font-serif text-2xl font-bold text-stone-900 tracking-tight">{group.project.title}</h3>
                      </div>

                      {/* Pieces List */}
                      {group.pieces.map((piece, pieceIndex) => {
                          const uniqueKey = `${group.project.id}-${piece.id}`;
                          const isExpanded = expandedPieceId === uniqueKey;
                          
                          const comp = composers.find(c => c.id === piece.composer);
                          const composerDisplayName = comp ? `${comp.first_name || ''} ${comp.last_name}`.trim() : 'Tradycyjny / Nieznany';
                          
                          let sortedTracks = piece.tracks ? [...piece.tracks] : [];
                          const myVoiceGroup = currentUser?.voice_type_display ? currentUser.voice_type_display.charAt(0).toUpperCase() : null;

                          if (myVoiceGroup) {
                              sortedTracks.sort((a, b) => {
                                  const aDisplay = (a.title || a.voice_part_display || '').toUpperCase();
                                  const bDisplay = (b.title || b.voice_part_display || '').toUpperCase();
                                  const aIsMine = aDisplay.startsWith(myVoiceGroup) || aDisplay.includes('TUTTI');
                                  const bIsMine = bDisplay.startsWith(myVoiceGroup) || bDisplay.includes('TUTTI');
                                  if (aIsMine && !bIsMine) return -1;
                                  if (!aIsMine && bIsMine) return 1;
                                  return 0; 
                              });
                          }

                          const pieceCastings = allCastings.filter(c => String(c.piece) === String(piece.id) && String(c.project_id) === String(group.project.id));
                          const groupedCastings = pieceCastings.reduce((acc, casting) => {
                              const line = casting.voice_line_display || casting.voice_line;
                              if (!acc[line]) acc[line] = [];
                              acc[line].push(casting);
                              return acc;
                          }, {});
                          const sortedLines = Object.keys(groupedCastings).sort();

                          return (
                            <motion.div 
                              key={uniqueKey} layout
                              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}
                              className={`${glassCardStyle} transition-all duration-300 ${isExpanded ? 'border-[#002395]/30 shadow-[0_10px_30px_rgba(0,35,149,0.05)]' : 'hover:border-[#002395]/20 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgb(0,0,0,0.06)]'}`}
                            >
                              <div 
                                className="p-4 md:p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-white/40 transition-colors relative z-10"
                                onClick={() => toggleExpand(uniqueKey)}
                              >
                                <div className="flex items-start gap-4 overflow-hidden">
                                  <div className="w-10 h-10 mt-0.5 rounded-xl bg-white border border-stone-100 flex items-center justify-center flex-shrink-0 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
                                    <span className="text-[11px] font-bold text-[#002395]">{pieceIndex + 1}</span>
                                  </div>
                                  <div className="truncate flex flex-col items-start">
                                    <h3 className="text-lg sm:text-xl font-bold text-stone-900 truncate flex items-center gap-2 tracking-tight" style={{ fontFamily: "'Cormorant', serif" }}>
                                        {piece.title}
                                        {piece.epoch && (
                                            <span className={`hidden sm:flex text-[8px] font-bold antialiased uppercase tracking-widest px-2 py-0.5 rounded-md border font-sans items-center shadow-sm ${getEpochColor(piece.epoch)}`}>
                                                {piece.epoch_display || piece.epoch}
                                            </span>
                                        )}
                                    </h3>
                                    
                                    <div className="flex flex-wrap items-center gap-2 text-[9px] font-bold antialiased text-stone-500 uppercase tracking-widest truncate mt-1">
                                      <span>{composerDisplayName}</span>
                                      {piece.composition_year && (
                                          <span className="flex items-center gap-1 border-l border-stone-300 pl-2">
                                              <Clock size={10}/> {piece.composition_year}
                                          </span>
                                      )}
                                      {piece.voicing && (
                                          <span className="hidden sm:flex items-center gap-1 border-l border-stone-300 pl-2">
                                              🎤 {piece.voicing}
                                          </span>
                                      )}
                                      {piece.estimated_duration && (
                                          <span className="hidden sm:flex items-center gap-1 border-l border-stone-300 pl-2 text-[#002395]">
                                              <Clock size={10}/> {formatDuration(piece.estimated_duration)}
                                          </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-4 flex-shrink-0">
                                  <div className="hidden sm:flex items-center gap-2.5">
                                      {piece.sheet_music && <span className="w-2 h-2 rounded-full bg-[#002395] shadow-[0_0_8px_rgba(0,35,149,0.5)]" title="Nuty dostępne"></span>}
                                      {piece.tracks?.length > 0 && <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" title="Audio dostępne"></span>}
                                      {sortedLines.length > 0 && <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" title="Obsada Divisi zdefiniowana"></span>}
                                  </div>
                                  <div className="text-stone-400 bg-white shadow-sm p-2 rounded-full border border-stone-100 transition-transform duration-300">
                                      {isExpanded ? <ChevronUp size={16} className="text-[#002395]" /> : <ChevronDown size={16} />}
                                  </div>
                                </div>
                              </div>

                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div 
                                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                      className="bg-stone-50/40 border-t border-white/60 relative z-0"
                                  >
                                    <div className="p-5 sm:p-6 space-y-8">
                                        
                                        {/* --- MEDIA & LYRICS SECTION --- */}
                                        {((piece.lyrics_original || piece.lyrics_translation) || piece.reference_recording) && (
                                            <div className="space-y-4">
                                                {piece.reference_recording && (
                                                    <a href={piece.reference_recording} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-full sm:w-auto gap-2 text-[9px] font-bold antialiased uppercase tracking-widest text-red-600 hover:text-red-700 bg-white hover:bg-red-50 px-6 py-3.5 rounded-xl transition-colors border border-red-100 shadow-sm active:scale-95">
                                                        <Youtube size={16} /> Odtwórz referencję na YouTube
                                                    </a>
                                                )}
                                                
                                                {(piece.lyrics_original || piece.lyrics_translation) && (
                                                    <div className="bg-white/80 backdrop-blur-md border border-stone-200/60 rounded-2xl shadow-sm overflow-hidden">
                                                        <button onClick={() => setExpandedLyricsId(expandedLyricsId === uniqueKey ? null : uniqueKey)} className="w-full flex items-center justify-between p-5 text-left hover:bg-white transition-colors">
                                                            <span className="flex items-center gap-2.5 text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-600"><AlignLeft size={16} className="text-[#002395]"/> Tekst Utworu (Lyrics)</span>
                                                            <span className="text-stone-400 bg-stone-50 p-1.5 rounded-full border border-stone-100">{expandedLyricsId === uniqueKey ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</span>
                                                        </button>
                                                        
                                                        <AnimatePresence>
                                                            {expandedLyricsId === uniqueKey && (
                                                                <motion.div initial={{height:0}} animate={{height:'auto'}} exit={{height:0}} className="overflow-hidden border-t border-stone-100">
                                                                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 bg-stone-50/30">
                                                                        {piece.lyrics_original && (
                                                                            <div>
                                                                                <h5 className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-3 border-b border-stone-200/60 pb-2">Oryginał</h5>
                                                                                <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed font-serif">{piece.lyrics_original}</p>
                                                                            </div>
                                                                        )}
                                                                        {piece.lyrics_translation && (
                                                                            <div>
                                                                                <h5 className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-3 border-b border-stone-200/60 pb-2">Tłumaczenie</h5>
                                                                                <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed font-serif italic opacity-90">{piece.lyrics_translation}</p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* --- RESOURCES SECTION (SHEET MUSIC & AUDIO) --- */}
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 border-y border-stone-200/60 py-8">
                                            
                                            <div>
                                                <h4 className="flex items-center gap-2 text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-500 mb-4 ml-1">
                                                    <FileText size={14} className="text-[#002395]"/> Partytura / Wyciąg
                                                </h4>
                                                {piece.sheet_music ? (
                                                    <a href={piece.sheet_music} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between w-full p-5 bg-white/80 backdrop-blur-md border border-stone-200/80 rounded-2xl hover:border-[#002395]/40 hover:shadow-md transition-all group active:scale-[0.99] shadow-sm">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold text-stone-800 group-hover:text-[#002395] transition-colors">Otwórz plik z nutami</span>
                                                            <span className="text-[9px] uppercase tracking-widest font-bold antialiased text-stone-400 mt-1">Dokument PDF</span>
                                                        </div>
                                                        <div className="bg-blue-50 text-[#002395] p-3 rounded-xl"><Download size={18} /></div>
                                                    </a>
                                                ) : (
                                                    <p className="text-xs text-stone-400 italic bg-white/40 p-5 rounded-2xl border border-dashed border-stone-300/60 text-center">
                                                        Bibliotekarz nie wgrał jeszcze nut dla tego utworu.
                                                    </p>
                                                )}
                                            </div>

                                            <div>
                                                <h4 className="flex items-center gap-2 text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-500 mb-4 ml-1">
                                                    <Headphones size={14} className="text-emerald-600"/> Nagrania Ćwiczeniowe
                                                </h4>
                                                {sortedTracks.length > 0 ? (
                                                    <div className="space-y-3">
                                                    {sortedTracks.map(track => {
                                                        const trackLabel = (track.title || track.voice_part_display || '').toUpperCase();
                                                        const isMyPart = myVoiceGroup && (trackLabel.startsWith(myVoiceGroup) || trackLabel.includes('TUTTI'));

                                                        return (
                                                        <div key={track.id} className={`bg-white/80 backdrop-blur-md p-4 rounded-2xl border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm ${isMyPart ? 'border-amber-300 bg-amber-50/40 shadow-[0_4px_10px_rgba(245,158,11,0.1)]' : 'border-stone-200/80'}`}>
                                                            <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
                                                                <span className="text-xs font-bold uppercase tracking-widest text-stone-700 flex items-center gap-2">
                                                                    <PlayCircle size={16} className={isMyPart ? "text-amber-500" : "text-stone-400"} />
                                                                    {track.title || track.voice_part_display}
                                                                </span>
                                                                {isMyPart && (
                                                                    <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[9px] font-bold antialiased uppercase tracking-widest rounded-md flex items-center gap-1.5 shadow-sm border border-amber-200">
                                                                        <Star size={10} className="fill-amber-700" /> Twoja partia
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <audio controls controlsList="nodownload" className="w-full sm:w-64 h-9 outline-none rounded-lg" preload="none" onPlay={handleAudioPlay}>
                                                                <source src={track.audio_file} type="audio/mpeg" />
                                                            </audio>
                                                        </div>
                                                        );
                                                    })}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-stone-400 italic bg-white/40 p-5 rounded-2xl border border-dashed border-stone-300/60 text-center">
                                                        Brak wgranych ścieżek dźwiękowych.
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* --- DIVISI CASTING SECTION --- */}
                                        <div>
                                            <h4 className="flex items-center gap-2 text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-500 mb-4 ml-1">
                                                <Users size={14} className="text-[#002395]"/> Kto śpiewa w tym utworze? (Divisi)
                                            </h4>
                                            {sortedLines.length > 0 ? (
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                    {sortedLines.map(line => {
                                                        const isMyPart = myVoiceGroup && line.toUpperCase().startsWith(myVoiceGroup);
                                                        return (
                                                            <div key={line} className={`p-4 rounded-2xl border shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] ${isMyPart ? 'bg-blue-50/50 border-blue-200 shadow-sm' : 'bg-white/60 border-stone-200/80'}`}>
                                                                <h5 className={`text-[10px] font-bold antialiased uppercase tracking-widest border-b pb-2 mb-3 ${isMyPart ? 'text-[#002395] border-blue-100/50' : 'text-stone-400 border-stone-100'}`}>
                                                                    {line}
                                                                </h5>
                                                                <ul className="space-y-1.5">
                                                                    {groupedCastings[line].map(a => (
                                                                        <li key={a.id} className="text-xs font-bold text-stone-700 truncate" title={a.artist_name}>
                                                                            {a.artist_name}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <p className="text-[11px] text-stone-400 italic font-medium ml-1">Dyrygent nie zatwierdził jeszcze podziału na głosy w tym utworze.</p>
                                            )}
                                        </div>

                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          );
                      })}
                  </motion.div>
              ))
            ) : (
              <motion.div 
                key="empty-state"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className={`${glassCardStyle} text-center p-16 flex flex-col items-center justify-center`}
              >
                <Music size={48} className="text-stone-300 mb-4 opacity-50" />
                <span className="text-[11px] font-bold antialiased uppercase tracking-widest text-stone-600 mb-2">
                    Brak przypisanych materiałów
                </span>
                <span className="text-xs text-stone-400 max-w-md leading-relaxed">W tej chwili nie masz nadchodzących projektów lub dyrygent nie zatwierdził jeszcze żadnego programu koncertu.</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}