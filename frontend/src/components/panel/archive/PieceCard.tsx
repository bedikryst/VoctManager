/**
 * @file PieceCard.tsx
 * @description Expandable UI component representing a single repertoire piece.
 * @architecture
 * Extracted memory-heavy static objects (color maps, formatter functions) outside the render cycle.
 * Strictly typed with interfaces from the global dictionary.
 * Features high-density data rendering and fluid spring-based layout expansions.
 * @module archive/PieceCard
 * @author Krystian Bugalski
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Edit2, Trash2, Music, FileText, Headphones, 
  ChevronDown, ChevronUp, Download, Clock, Youtube, 
  AlignLeft, PlayCircle 
} from 'lucide-react';

import type { Piece, Composer } from '../../../types';

interface PieceCardProps {
  piece: Piece;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onOpenPanel: (piece: Piece, tab: 'DETAILS' | 'TRACKS') => void;
  onDelete: (id: string) => void;
  getComposerInfo: (composerId: any) => Composer | null;
}

// --- Static Configurations, Styles & Utilities ---

const STYLE_GLASS_CARD = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl overflow-hidden transition-all duration-300";

const EPOCH_COLORS: Record<string, string> = {
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

const getEpochColor = (epochId?: string | null): string => {
  if (!epochId) return 'bg-stone-50 text-stone-500 border-stone-200';
  return EPOCH_COLORS[epochId] || 'bg-stone-50 text-stone-500 border-stone-200';
};

const formatDuration = (totalSeconds?: number | null): string | null => {
  if (!totalSeconds) return null;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m > 0 ? `${m} min` : ''} ${s > 0 ? `${s} sek` : ''}`.trim();
};

/**
 * PieceCard Component
 * @param {PieceCardProps} props
 * @returns {React.JSX.Element}
 */
export default function PieceCard({ 
  piece, isExpanded, onToggleExpand, onOpenPanel, onDelete, getComposerInfo 
}: PieceCardProps): React.JSX.Element {
  
  const comp = getComposerInfo(piece.composer);
  const [showLyrics, setShowLyrics] = useState<boolean>(false);

  const handleAudioPlay = (e: React.SyntheticEvent<HTMLAudioElement>): void => {
    const target = e.currentTarget;
    document.querySelectorAll('audio').forEach(audioEl => { 
        if (audioEl !== target) audioEl.pause(); 
    });
  };

  // Bezpieczne rzutowanie pól dodawanych przez backend DRF
  const pieceTracks = (piece as any).tracks || [];
  const epochDisplay = (piece as any).epoch_display || piece.epoch;

  return (
    <div className={`${STYLE_GLASS_CARD} ${isExpanded ? 'border-[#002395]/30 shadow-[0_10px_30px_rgba(0,35,149,0.05)]' : 'hover:border-[#002395]/20 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgb(0,0,0,0.06)]'}`}>
      <div 
        className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 cursor-pointer hover:bg-white/40 transition-colors relative z-10" 
        onClick={() => onToggleExpand(String(piece.id))}
      >
        
        <div className="flex items-start gap-4 md:gap-5">
          <div className="w-12 h-12 rounded-2xl bg-white border border-stone-100 flex items-center justify-center flex-shrink-0 text-[#002395] shadow-sm">
            <Music size={20} aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-xl md:text-2xl font-bold text-stone-900 flex items-center gap-2.5 tracking-tight" style={{ fontFamily: "'Cormorant', serif" }}>
              {piece.title}
              {piece.epoch && (
                  <span className={`text-[8px] font-bold antialiased uppercase tracking-widest px-2 py-1 rounded-lg border font-sans shadow-sm ${getEpochColor(piece.epoch)}`}>
                      {epochDisplay}
                  </span>
              )}
            </h3>
            
            <div className="flex items-center gap-3 text-[10px] font-bold antialiased text-stone-500 uppercase tracking-widest mt-1">
              <span>{comp ? `${comp.first_name || ''} ${comp.last_name}`.trim() : 'Tradycyjny / Nieznany'}</span>
              {piece.composition_year && (
                  <span className="flex items-center gap-1.5 border-l border-stone-300 pl-3">
                      <Clock size={12} aria-hidden="true" /> {piece.composition_year}
                  </span>
              )}
            </div>
            
            {/* Quick-glance Technical Metadata */}
            <div className="flex flex-wrap gap-2 mt-2.5 text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400">
                {piece.voicing && <span className="px-2 py-1 border border-stone-200/80 bg-white/60 backdrop-blur-sm rounded-md shadow-sm">🎤 {piece.voicing}</span>}
                {piece.estimated_duration && <span className="px-2 py-1 border border-stone-200/80 bg-white/60 backdrop-blur-sm rounded-md flex items-center gap-1 shadow-sm"><Clock size={10} aria-hidden="true" /> {formatDuration(piece.estimated_duration)}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="hidden md:flex gap-2">
            {piece.sheet_music && <span className="px-2.5 py-1.5 bg-blue-50 text-[#002395] text-[9px] tracking-widest font-bold antialiased uppercase rounded-lg border border-blue-100 shadow-sm flex items-center gap-1.5"><FileText size={10} aria-hidden="true" /> PDF</span>}
            {pieceTracks.length > 0 && <span className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 text-[9px] tracking-widest font-bold antialiased uppercase rounded-lg border border-emerald-100 shadow-sm flex items-center gap-1.5"><Headphones size={10} aria-hidden="true" /> Audio ({pieceTracks.length})</span>}
          </div>
          <div className="text-stone-400 bg-white shadow-sm p-2 rounded-full border border-stone-100 transition-transform duration-300">
              {isExpanded ? <ChevronUp size={20} className="text-[#002395]" aria-hidden="true" /> : <ChevronDown size={20} aria-hidden="true" />}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-stone-50/40 border-t border-white/60 overflow-hidden relative z-0">
            <div className="p-6 md:p-8">
              
              <div className="flex flex-col lg:flex-row justify-between gap-8 mb-10">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-8">
                  
                  {/* Internal Metadata Block */}
                  <div>
                    <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-400 mb-3 border-b border-stone-200/60 pb-2">Metadane Utworu</h4>
                    <div className="space-y-2 text-sm text-stone-700 font-medium">
                      {piece.language && <p><span className="font-bold antialiased text-stone-400 text-[10px] uppercase tracking-widest w-24 inline-block">Język:</span> {piece.language}</p>}
                      {piece.arranger && <p><span className="font-bold antialiased text-stone-400 text-[10px] uppercase tracking-widest w-24 inline-block">Aranżer:</span> {piece.arranger}</p>}
                      {piece.voicing && <p><span className="font-bold antialiased text-stone-400 text-[10px] uppercase tracking-widest w-24 inline-block">Obsada:</span> {piece.voicing}</p>}
                      {piece.estimated_duration && <p><span className="font-bold antialiased text-stone-400 text-[10px] uppercase tracking-widest w-24 inline-block">Czas:</span> {formatDuration(piece.estimated_duration)}</p>}
                      
                      {!piece.language && !piece.arranger && !piece.voicing && !piece.estimated_duration && <p className="italic text-stone-400 text-xs">Brak dodatkowych metadanych.</p>}
                    </div>
                  </div>
                  
                  {/* Composer Block */}
                  <div>
                    <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-400 mb-3 border-b border-stone-200/60 pb-2">Kompozytor</h4>
                    {comp ? (
                      <div className="text-sm text-stone-700">
                        <p className="font-bold text-stone-900 text-base">{comp.first_name} {comp.last_name}</p>
                        {(comp.birth_year || comp.death_year) && (
                          <p className="mt-1 flex items-center gap-1 text-stone-500 text-[11px] font-bold antialiased tracking-widest uppercase">
                            <span>{comp.birth_year ? `* ${comp.birth_year}` : ''}</span>
                            <span className="mx-1 opacity-50">|</span>
                            <span>{comp.death_year ? `† ${comp.death_year}` : ''}</span>
                          </p>
                        )}
                      </div>
                    ) : <p className="text-xs text-stone-400 italic">Tradycyjny / Nieznany</p>}
                    
                    {/* Divisi Requirements Context */}
                    {piece.voice_requirements && piece.voice_requirements.length > 0 && (
                        <div className="mt-5">
                            <h4 className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-2 border-b border-stone-200/60 pb-1.5">Algorytm Divisi</h4>
                            <div className="flex flex-wrap gap-2 mt-2.5">
                                {piece.voice_requirements.map(req => (
                                <span key={req.id} className="px-2.5 py-1 bg-white/60 border border-[#002395]/20 text-[#002395] text-[9px] font-bold antialiased uppercase tracking-widest rounded-md shadow-sm">
                                    {(req as any).voice_line_display || req.voice_line}: {req.quantity}
                                </span>
                                ))}
                            </div>
                        </div>
                    )}
                  </div>
                </div>

                {/* Action Tools */}
                <div className="flex flex-col gap-3 min-w-[220px] border-t lg:border-t-0 border-stone-200/60 pt-6 lg:pt-0">
                  <button onClick={(e) => { e.stopPropagation(); onOpenPanel(piece, 'DETAILS'); }} className="w-full py-3.5 bg-white border border-stone-200/80 text-stone-600 text-[10px] font-bold antialiased uppercase tracking-widest rounded-xl hover:border-[#002395]/40 hover:text-[#002395] hover:shadow-md transition-all flex items-center justify-center gap-2.5 shadow-sm active:scale-95">
                    <Edit2 size={14} aria-hidden="true" /> Edytuj Metadane
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onOpenPanel(piece, 'TRACKS'); }} className="w-full py-3.5 bg-white border border-stone-200/80 text-stone-600 text-[10px] font-bold antialiased uppercase tracking-widest rounded-xl hover:border-emerald-500/40 hover:text-emerald-700 hover:shadow-md transition-all flex items-center justify-center gap-2.5 shadow-sm active:scale-95">
                    <Headphones size={14} aria-hidden="true" /> Zarządzaj Audio
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onDelete(String(piece.id)); }} className="w-full py-3.5 mt-2 text-stone-400 hover:text-red-600 text-[10px] font-bold antialiased uppercase tracking-widest transition-colors flex items-center justify-center gap-2.5 active:scale-95">
                    <Trash2 size={14} aria-hidden="true" /> Usuń Utwór
                  </button>
                </div>
              </div>

              {/* MEDIA & LYRICS ACCORDION */}
              {((piece.lyrics_original || piece.lyrics_translation) || piece.reference_recording) && (
                  <div className="border-t border-stone-200/60 pt-8 mb-8 space-y-5">
                      {piece.reference_recording && (
                          <a href={piece.reference_recording} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2.5 text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-red-600 hover:text-red-700 bg-white hover:bg-red-50 px-5 py-3 rounded-xl transition-colors border border-red-100 shadow-sm active:scale-95">
                              <Youtube size={16} aria-hidden="true" /> Nagranie Referencyjne YouTube / Spotify
                          </a>
                      )}
                      
                      {(piece.lyrics_original || piece.lyrics_translation) && (
                          <div className="bg-white/60 backdrop-blur-md border border-white/80 rounded-2xl shadow-sm overflow-hidden">
                              <button onClick={() => setShowLyrics(!showLyrics)} className="w-full flex items-center justify-between p-5 text-left hover:bg-white/80 transition-colors">
                                  <span className="flex items-center gap-2.5 text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-600"><AlignLeft size={16} className="text-[#002395]" aria-hidden="true" /> Tekst Utworu (Lyrics)</span>
                                  <span className="text-stone-400 bg-white shadow-sm p-1.5 rounded-full border border-stone-100">{showLyrics ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}</span>
                              </button>
                              
                              <AnimatePresence>
                                  {showLyrics && (
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

              {/* DIRECT RESOURCE ACCESS (PDF & Audio Maps) */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 border-t border-stone-200/60 pt-8">
                <div>
                  <h4 className="flex items-center gap-2 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-4 ml-1"><FileText size={14} className="text-[#002395]" aria-hidden="true" /> Partytura (PDF)</h4>
                  {piece.sheet_music ? (
                    <a href={piece.sheet_music} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2.5 px-6 py-3.5 bg-white border border-stone-200/80 rounded-xl text-[10px] uppercase tracking-widest font-bold antialiased text-[#002395] hover:border-[#002395]/40 transition-all shadow-sm active:scale-95"><Download size={14} aria-hidden="true" /> Pobierz Nuty</a>
                  ) : <p className="text-xs text-stone-400 italic bg-white/40 p-5 rounded-xl border border-dashed border-stone-200 text-center">Brak wgranego pliku PDF.</p>}
                </div>
                
                <div>
                  <h4 className="flex items-center gap-2 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-4 ml-1"><Headphones size={14} className="text-emerald-600" aria-hidden="true" /> Ścieżki Ćwiczeniowe</h4>
                  {pieceTracks.length > 0 ? (
                    <div className="space-y-3">
                      {pieceTracks.map((track: any) => (
                        <div key={track.id} className="bg-white/80 backdrop-blur-sm p-3.5 rounded-xl border border-stone-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <span className="text-[10px] uppercase tracking-widest font-bold antialiased text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 flex items-center gap-2">
                              <PlayCircle size={12} aria-hidden="true" /> {track.title || track.voice_part_display || track.voice_part}
                          </span>
                          <audio controls controlsList="nodownload" className="w-full md:w-64 h-9 outline-none rounded-lg" preload="none" onPlay={handleAudioPlay}><source src={track.audio_file} type="audio/mpeg" /></audio>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-xs text-stone-400 italic bg-white/40 p-5 rounded-xl border border-dashed border-stone-200 text-center">Brak wgranych plików audio.</p>}
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}